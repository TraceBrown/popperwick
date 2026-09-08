#!/bin/bash
# mirror-share.sh — MANUAL, conductor-run READ-ONLY mirror of the vault's
# shareable subset into a SEPARATE git working copy OUTSIDE the vault.
#
# There is no daemon and no schedule behind this file: a human runs it, reads
# the output, and decides. It exists so a second party (another agent, another
# machine) can READ the vault's governance + research subset without being given
# the vault. Nothing ever flows the other way — see "ONE-WAY" below.
#
# Steps (every mode runs 1-4; only --commit/--push run 5-8):
#   1. Read the two config files under $VAULT/.claude/mirror/:
#        include.txt — the ALLOW-LIST (vault-relative files/dirs, # comments ok)
#        deny.txt    — rsync exclude patterns that ALWAYS win over include.txt
#      Comments/blanks are stripped into sanitized temp copies, so neither
#      file's comment syntax depends on rsync's.
#   2. Resolve the include entries. An entry that does not exist is a WARNING
#      (the mirror still builds); an absolute path or one containing ".." is
#      REJECTED (traversal guard) and also only warns.
#   3. Ask rsync itself what it would copy: a --dry-run into a fresh EMPTY temp
#      destination, so the answer is the complete would-be-copied set rather
#      than "whatever differs from last time". That list is this script's single
#      source of truth for the scan, the prune, and the manifest.
#   4. SECRET SCAN the would-be-copied set at its SOURCE paths, before anything
#      is written anywhere. Runs in EVERY mode. Any hit prints file:line with the
#      match masked to its first 6 characters and the run ends with exit 3.
#      --commit/--push stop immediately (nothing copied, nothing staged);
#      --dry-run and --self-test finish printing their report first and THEN exit
#      3, because they write nothing either way and suppressing the file list on
#      the one run the conductor most needs to read would be the wrong trade.
#   5. rsync for real into $MIRROR_DIR/vault/.
#   6. PRUNE: delete anything under $MIRROR_DIR/vault/ that is not in the
#      step-3 list. rsync --delete alone is not enough — it only cleans inside
#      directories it is currently transferring, so an entry REMOVED from
#      include.txt would otherwise linger in the mirror forever (verified).
#   7. SECOND secret scan, this time against the staged tree (belt and braces:
#      step 4 keeps secrets out, step 7 proves what is actually on disk).
#   8. Write MIRROR-MANIFEST.txt + a generated README.md, then git add/commit
#      (and push, only if an "origin" remote already exists).
#
# ONE-WAY, by construction: this script only ever READS the vault. The single
# vault command it runs is `git rev-parse`/`git log` for provenance. Nothing
# from the mirror, from any agent, or from any remote enters the vault except by
# the conductor's own hand — that rule lives in .claude/mirror/README.md and is
# not enforceable from here, only respected.
#
# FAIL-OPEN vs FAIL-CLOSED, deliberately split: a missing include entry is a
# warning (the mirror is a convenience, not a load-bearing pipeline). A secret
# hit, a deny-pattern leak, an rsync error, a prune-guard violation, or a git
# repo that is not the mirror repo is a HARD failure — nothing is committed. The
# asymmetry is the point: an under-full mirror costs an edit, an over-full one
# cannot be unpublished.
#
# Exit codes: 0 ok · 1 failure (usage, config, rsync, assertion, git)
#             2 --push asked for but the mirror repo has no "origin" remote
#             3 secret-scan hit (or --self-test failing ONLY on the scan)
#
# NB the scanner's own patterns and canaries are written so they do not match
# themselves — this file is not mirrorable anyway (.claude/ is denied), but a
# self-tripping scanner would be a confusing bug.

set -u

# --------------------------------------------------------------------------- #
# Defaults and argument parsing.
# --------------------------------------------------------------------------- #
VAULT="$HOME/Claude"
MIRROR_DIR="$HOME/private-share"
MODE=""                    # empty until a mode flag is seen; defaults to dry-run
MAX_HITS_SHOWN=50          # cap the printed hit list; the count is always exact

usage() {
  cat <<'USAGEEOF'
mirror-share.sh — build a read-only, allow-listed mirror of the vault.

  --dry-run              list what would be copied, scan it, change nothing (DEFAULT)
  --commit               copy + prune + manifest, then git add/commit in the mirror
  --push                 everything --commit does, then push to an EXISTING origin
  --self-test            dry-run plus four assertions (deny leak, secrets, include
                         resolution, symlinks); prints PASS/FAIL per assertion
  --mirror-dir PATH      mirror working copy   (default: $HOME/private-share)
  --vault PATH           vault to read         (default: $HOME/Claude)
  --help                 this text

Config (read from <vault>/.claude/mirror/):
  include.txt   allow-list, one vault-relative path per line, # comments ok
  deny.txt      rsync exclude patterns; these ALWAYS win over include.txt

Exit codes: 0 ok · 1 failure · 2 --push with no origin remote · 3 secret found
USAGEEOF
}

set_mode() {
  if [ -n "$MODE" ] && [ "$MODE" != "$1" ]; then
    printf 'mirror-share: pick ONE mode (saw --%s and --%s)\n' "$MODE" "$1" >&2
    exit 1
  fi
  MODE="$1"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)    set_mode dry-run ;;
    --commit)     set_mode commit ;;
    --push)       set_mode push ;;
    --self-test)  set_mode self-test ;;
    --mirror-dir) [ $# -ge 2 ] || { printf 'mirror-share: --mirror-dir needs a PATH\n' >&2; exit 1; }
                  MIRROR_DIR="$2"; shift ;;
    --vault)      [ $# -ge 2 ] || { printf 'mirror-share: --vault needs a PATH\n' >&2; exit 1; }
                  VAULT="$2"; shift ;;
    --help|-h)    usage; exit 0 ;;
    *)            printf 'mirror-share: unknown option %s\n\n' "$1" >&2; usage >&2; exit 1 ;;
  esac
  shift
done
[ -n "$MODE" ] || MODE="dry-run"

CONF_DIR="$VAULT/.claude/mirror"
INCLUDE_SRC="$CONF_DIR/include.txt"
DENY_SRC="$CONF_DIR/deny.txt"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

warn() { printf 'WARN    %s\n' "$1" >&2; }
die()  { printf 'FAIL    %s\n' "$1" >&2; exit "${2:-1}"; }

# --------------------------------------------------------------------------- #
# 1a. Sanity: the vault and its config must exist, and the mirror must live
# OUTSIDE the vault. The last check is load-bearing — a mirror nested inside the
# vault would put `git -C "$MIRROR_DIR" add -A` inside the VAULT's repository,
# which is the one thing this tool must never do. realpath resolves symlinks so
# a symlinked "outside" path cannot smuggle its way back in.
# --------------------------------------------------------------------------- #
[ -d "$VAULT" ]        || die "vault not found: $VAULT"
[ -f "$INCLUDE_SRC" ]  || die "missing allow-list: $INCLUDE_SRC"
[ -f "$DENY_SRC" ]     || die "missing deny-list: $DENY_SRC"

VAULT_REAL="$(/bin/realpath "$VAULT" 2>/dev/null || true)"
[ -n "$VAULT_REAL" ] || die "cannot resolve vault path: $VAULT"
# The mirror dir is resolved WITHOUT being created: --dry-run and --self-test
# must leave the filesystem exactly as they found it, so /bin/realpath (which
# requires the path to exist) is not usable here.
MIRROR_REAL="$(MDIR="$MIRROR_DIR" /usr/bin/python3 -c 'import os;print(os.path.realpath(os.environ["MDIR"]))' 2>/dev/null || true)"
[ -n "$MIRROR_REAL" ] || die "cannot resolve mirror dir: $MIRROR_DIR"

case "$MIRROR_REAL" in
  "$VAULT_REAL"|"$VAULT_REAL"/*) die "mirror dir is inside the vault: $MIRROR_REAL" ;;
esac
case "$MIRROR_REAL" in
  /|"$HOME") die "refusing to use $MIRROR_REAL as the mirror dir" ;;
esac

# --------------------------------------------------------------------------- #
# 1b. Sanitized temp copies of the two config files: strip # comments, blank
# lines, and trailing whitespace. rsync's --exclude-from comment handling varies
# by implementation (macOS ships openrsync), so we never rely on it.
# --------------------------------------------------------------------------- #
DENY_CLEAN="$WORKDIR/deny.rsync"
/usr/bin/sed -e 's/[[:space:]]*$//' "$DENY_SRC" \
  | /usr/bin/grep -v -e '^#' -e '^$' >"$DENY_CLEAN"
[ -s "$DENY_CLEAN" ] || die "deny.txt has no usable patterns — refusing to mirror with an empty deny list"

# --------------------------------------------------------------------------- #
# 2. Resolve include entries into an rsync --files-from list. Each entry is
# taken LITERALLY (no globbing, no quoting): the vault is full of names with
# spaces and em-dashes, and a shell-expanded allow-list is an allow-list you
# cannot read. Rejections and misses warn; only the count matters to --self-test.
# --------------------------------------------------------------------------- #
INC_CLEAN="$WORKDIR/files-from.txt"
: >"$INC_CLEAN"
INC_TOTAL=0
INC_MISSING=0
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|'#'*) continue ;; esac
  entry="$(printf '%s' "$line" | /usr/bin/sed -e 's/[[:space:]]*$//')"
  [ -n "$entry" ] || continue
  entry="${entry%/}"                       # a trailing slash is decoration here
  [ -n "$entry" ] || continue
  INC_TOTAL=$((INC_TOTAL + 1))
  # Traversal guard: the allow-list may only name things INSIDE the vault.
  case "$entry" in
    /*|*/../*|../*|*/..|..)
      warn "include entry rejected (absolute or traversal): $entry"
      INC_MISSING=$((INC_MISSING + 1)); continue ;;
  esac
  if [ ! -e "$VAULT/$entry" ]; then
    warn "include entry resolves to nothing: $entry"
    INC_MISSING=$((INC_MISSING + 1)); continue
  fi
  printf '%s\n' "$entry" >>"$INC_CLEAN"
done <"$INCLUDE_SRC"

[ -s "$INC_CLEAN" ] || die "no include entry resolved — nothing to mirror"

# --------------------------------------------------------------------------- #
# 3. Ask rsync what it would copy.
#
# Flag notes, all verified against the macOS rsync (openrsync, 2.6.9-compatible):
#   -r          REQUIRED even with -a: --files-from turns off -a's implied
#               recursion, so a directory entry would copy as a bare dir.
#   -8          without it rsync escapes non-ASCII in --out-format as \#342...,
#               which would corrupt every " — " path in the list.
#   --no-links / --no-devices / --no-specials
#               regular files only; symlinks are skipped with a stderr note
#               rather than followed (a symlink out of the vault is exactly the
#               kind of thing an allow-list is supposed to stop).
#   --prune-empty-dirs
#               a directory whose entire contents were denied never appears.
#   --exclude-from before --files-from: deny wins even for an explicitly listed
#               entry (verified: a denied directory named in --files-from is
#               still dropped).
# The destination is a FRESH EMPTY temp dir so the listing is the complete set,
# not the delta against a previous mirror.
# --------------------------------------------------------------------------- #
RSYNC_FLAGS="-a -r -8 --no-links --no-devices --no-specials --prune-empty-dirs --delete"
PROBE_DEST="$WORKDIR/probe-dest"
mkdir -p "$PROBE_DEST"

# The '>>> ' prefix in --out-format is load-bearing, not decoration: this rsync
# writes diagnostics such as `skipping non-regular file "X"` to STDOUT, mixed in
# with the file list (verified). Without a marker those lines would be parsed as
# paths and inflate every count downstream. Real entries carry the prefix;
# chatter does not.
# shellcheck disable=SC2086
rsync $RSYNC_FLAGS --exclude-from="$DENY_CLEAN" --files-from="$INC_CLEAN" \
  --dry-run --out-format='>>> %n' "$VAULT/" "$PROBE_DEST/" \
  >"$WORKDIR/list.raw" 2>"$WORKDIR/rsync.err"
rc=$?
[ "$rc" -eq 0 ] || { /usr/bin/sed -n '1,20p' "$WORKDIR/rsync.err" >&2; die "rsync --dry-run failed (exit $rc)"; }

# Keep marked lines only, strip the marker, then drop directories (their %n ends
# in '/'). What is left is exactly the regular files rsync would copy.
LIST="$WORKDIR/files.txt"
/usr/bin/sed -n 's/^>>> //p' "$WORKDIR/list.raw" | /usr/bin/grep -v '/$' >"$LIST"
FILE_COUNT="$(/usr/bin/grep -c '' "$LIST" | tr -d ' ')"
[ "$FILE_COUNT" -gt 0 ] || die "the allow/deny pair selects zero files"

# Everything rsync said that was NOT a file entry — on either stream. The
# "skipping non-regular file" notes land here, which is how symlinks get
# reported: they are dropped, never followed, and the conductor is told.
CHATTER="$WORKDIR/rsync.chatter"
{ /usr/bin/grep -v '^>>> ' "$WORKDIR/list.raw"; cat "$WORKDIR/rsync.err"; } \
  | /usr/bin/grep -v '^$' >"$CHATTER"
SKIPPED_LINKS="$(/usr/bin/grep -c 'skipping non-regular file' "$CHATTER" | tr -d ' ')"
if [ "$SKIPPED_LINKS" -gt 0 ]; then
  warn "rsync skipped $SKIPPED_LINKS non-regular file(s) (symlinks/devices) — NOT in the mirror:"
  /usr/bin/grep 'skipping non-regular file' "$CHATTER" | /usr/bin/sed -e 's/^/        /' >&2
fi

TOTAL_BYTES="$(ROOT="$VAULT" LIST_FILE="$LIST" /usr/bin/python3 - <<'PYEOF'
import os
root = os.environ["ROOT"]
total = 0
with open(os.environ["LIST_FILE"], "rb") as f:      # DATA from a file, never stdin
    for raw in f.read().split(b"\n"):
        if not raw:
            continue
        try:
            total += os.path.getsize(os.path.join(os.fsencode(root), raw))
        except OSError:
            pass
print(total)
PYEOF
)"
[ -n "$TOTAL_BYTES" ] || TOTAL_BYTES=0

# --------------------------------------------------------------------------- #
# 4. Secret scan.
#
# The patterns are written to a temp file and handed to /usr/bin/grep -E -f (an
# explicit path: `grep` on an interactive shell here is a wrapper function, and a
# security scan must not depend on which grep is first on PATH).
#   -a  scan even files grep considers binary (a leaked key in a stray binary is
#       still a leaked key); -o keeps the output bounded to the match itself.
#   -n  gives the line number; the match is then masked to 6 chars before print.
# --------------------------------------------------------------------------- #
PATFILE="$WORKDIR/secret-patterns.txt"
cat >"$PATFILE" <<'PATEOF'
sk-[A-Za-z0-9_-]{20,}
ghp_[A-Za-z0-9]{30,}
github_pat_[A-Za-z0-9_]{20,}
xox[abp]-[A-Za-z0-9-]{10,}
AKIA[0-9A-Z]{16}
-----BEGIN [A-Z ]*PRIVATE KEY
Bearer [A-Za-z0-9._-]{20,}
ANTHROPIC_(AUTH_TOKEN|API_KEY)["']?\s*[:=]\s*["']?[A-Za-z0-9]
[Aa][Pp][Ii][_-]?[Kk][Ee][Yy]\s*[:=]\s*["'][A-Za-z0-9]{16,}
PATEOF

# Canary: one known-positive line per pattern, in the same order. Every line is
# assembled through printf substitutions so that THIS FILE never contains a
# contiguous string its own scanner would flag. If any pattern fails to match
# its canary the regex dialect has drifted (or a pattern has a typo) and the
# scanner would fail SILENTLY — so that is a hard stop, not a warning.
CANARY="$WORKDIR/canary.txt"
{
  printf 'sk-%s\n'                            'CANARYCANARYCANARYCANARYCANARY'
  printf 'ghp_%s\n'                           'CANARYCANARYCANARYCANARYCANARY1234'
  printf 'github_pat_%s\n'                    'CANARYCANARYCANARY01234'
  printf 'xoxb-%s\n'                          'CANARY01234567'
  printf 'AKIA%s\n'                           'CANARY0123456789'
  printf -- '-----BEGIN RSA %s KEY-----\n'    'PRIVATE'
  printf 'Bearer %s\n'                        'CANARYCANARYCANARY01234'
  printf 'ANTHROPIC_AUTH_TOKEN %s "CANARY0"\n' '='
  printf 'api_key %s "%s"\n'                  '=' 'CANARY0123456789'
} >"$CANARY"

pat_i=0
while IFS= read -r pat; do
  pat_i=$((pat_i + 1))
  if ! /usr/bin/sed -n "${pat_i}p" "$CANARY" | /usr/bin/grep -a -E -q -e "$pat"; then
    die "secret-scan self-check FAILED: pattern #$pat_i did not match its canary — the scanner is not working, refusing to run"
  fi
done <"$PATFILE"
[ "$pat_i" -ge 9 ] || die "secret-scan self-check FAILED: only $pat_i pattern(s) loaded"

SCAN_HITS=0
secret_scan() {   # $1 = root dir, $2 = list of relative paths, $3 = human label
  local root="$1" list="$2" label="$3"
  local rel out h lineno m shown
  SCAN_HITS=0
  shown=0
  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    out="$(/usr/bin/grep -a -E -o -n -f "$PATFILE" -- "$root/$rel" 2>/dev/null)"
    [ -n "$out" ] || continue
    while IFS= read -r h; do
      [ -n "$h" ] || continue
      SCAN_HITS=$((SCAN_HITS + 1))
      if [ "$shown" -lt "$MAX_HITS_SHOWN" ]; then
        lineno="${h%%:*}"       # grep -n output is always "<lineno>:<match>"
        m="${h#*:}"             # so splitting on the FIRST colon is unambiguous
        printf 'SECRET  %s:%s  %.6s… (masked)\n' "$rel" "$lineno" "$m" >&2
        shown=$((shown + 1))
      fi
    done <<<"$out"
  done <"$list"
  if [ "$SCAN_HITS" -gt 0 ]; then
    [ "$SCAN_HITS" -gt "$shown" ] && printf 'SECRET  … and %s more hit(s) not shown\n' \
      "$((SCAN_HITS - shown))" >&2
    printf 'FAIL    secret scan (%s): %s hit(s) — nothing was committed or pushed.\n' \
      "$label" "$SCAN_HITS" >&2
    printf '        Resolve each hit (redact the source, or add the file to deny.txt) and re-run.\n' >&2
    return 1
  fi
  return 0
}

# Scan the SOURCE files first, in every mode — a secret is then never written
# into the mirror directory at all, not even transiently.
if ! secret_scan "$VAULT" "$LIST" "vault sources"; then
  SCAN_FAILED=1
else
  SCAN_FAILED=0
fi
# A hit stops --commit/--push here and now: nothing is copied, nothing is
# staged. --dry-run and --self-test write nothing in any case, so they finish
# their report first and exit 3 at the end — suppressing the file list on the
# one run where the conductor most needs to read it would be the wrong trade.
case "$MODE" in
  commit|push) [ "$SCAN_FAILED" -eq 0 ] || exit 3 ;;
esac

# --------------------------------------------------------------------------- #
# --self-test: four independent assertions over the step-3 list. Prints
# PASS/FAIL per assertion and exits non-zero if any failed.
# --------------------------------------------------------------------------- #
if [ "$MODE" = "self-test" ]; then
  st_other_fail=0

  # (a) Deny leak. Each deny pattern is re-implemented and tested INDEPENDENTLY
  # against the list, rather than trusting that rsync applied it. rsync wildcard
  # semantics reproduced: no internal '/' -> match the final component at any
  # depth; leading '/' -> anchored at the transfer root; otherwise match the full
  # path or any tail beginning at a '/' boundary; trailing '/' -> directories
  # only (so a file is denied when any ANCESTOR matches); '*' does not cross '/',
  # '**' does.
  deny_out="$(LIST_FILE="$LIST" DENY_FILE="$DENY_CLEAN" /usr/bin/python3 - <<'PYEOF'
import os
import re


def to_regex(pat):
    out, i, n = [], 0, len(pat)
    while i < n:
        c = pat[i]
        if c == "*":
            if i + 1 < n and pat[i + 1] == "*":
                out.append(".*"); i += 2; continue
            out.append("[^/]*"); i += 1; continue
        if c == "?":
            out.append("[^/]"); i += 1; continue
        if c == "[":
            j = pat.find("]", i + 1)
            if j != -1:
                out.append(pat[i:j + 1]); i = j + 1; continue
        out.append(re.escape(c)); i += 1
    return "".join(out)


def candidates(path, dir_only):
    """Path components rsync would test this pattern against."""
    parts = path.split("/")
    dirs = ["/".join(parts[:k]) for k in range(1, len(parts))]
    return dirs if dir_only else dirs + [path]


def tails(p):
    yield p
    idx = p.find("/")
    while idx != -1:
        yield p[idx + 1:]
        idx = p.find("/", idx + 1)


with open(os.environ["LIST_FILE"], "r", encoding="utf-8", errors="surrogateescape") as f:
    paths = [ln for ln in f.read().split("\n") if ln]
with open(os.environ["DENY_FILE"], "r", encoding="utf-8", errors="surrogateescape") as f:
    pats = [ln for ln in f.read().split("\n") if ln]

leaks = []
for raw in pats:
    dir_only = raw.endswith("/")
    body = raw[:-1] if dir_only else raw
    anchored = body.startswith("/")
    # A LEADING slash counts as "contains a slash" for rsync, so read has_slash
    # before stripping it, and let the anchored branch win.
    has_slash = "/" in body
    if anchored:
        body = body[1:]
    rx = re.compile("^" + to_regex(body) + "$")
    for p in paths:
        for cand in candidates(p, dir_only):
            if anchored:
                hit = bool(rx.match(cand))
            elif not has_slash:
                hit = bool(rx.match(cand.split("/")[-1]))
            else:
                hit = any(rx.match(t) for t in tails(cand))
            if hit:
                leaks.append((raw, p))
                break

for pat, p in leaks[:40]:
    print("LEAK\t%s\t%s" % (pat, p))
print("LEAKCOUNT\t%d" % len(leaks))
PYEOF
)"
  leak_count="$(printf '%s\n' "$deny_out" | /usr/bin/sed -n 's/^LEAKCOUNT\t//p' | tail -1)"
  [ -n "$leak_count" ] || leak_count="?"
  if [ "$leak_count" = "0" ]; then
    printf 'PASS    (a) deny leak: 0 of %s listed paths match any of the %s deny patterns\n' \
      "$FILE_COUNT" "$(/usr/bin/grep -c '' "$DENY_CLEAN" | tr -d ' ')"
  else
    printf '%s\n' "$deny_out" | /usr/bin/grep '^LEAK\t' >&2
    printf 'FAIL    (a) deny leak: %s listed path(s) match a deny pattern\n' "$leak_count" >&2
    st_other_fail=1
  fi

  # (b) Secret scan (already run above against the source set).
  if [ "$SCAN_FAILED" -eq 0 ]; then
    printf 'PASS    (b) secret scan: 0 hits across %s files\n' "$FILE_COUNT"
  else
    printf 'FAIL    (b) secret scan: %s hit(s) — see the SECRET lines above\n' "$SCAN_HITS" >&2
  fi

  # (c) Include resolution — every entry resolved, or a warning was printed.
  if [ "$INC_MISSING" -eq 0 ]; then
    printf 'PASS    (c) include resolution: all %s entries resolved\n' "$INC_TOTAL"
  else
    printf 'PASS    (c) include resolution: %s of %s entries did not resolve; a WARN line was printed for each\n' \
      "$INC_MISSING" "$INC_TOTAL"
  fi

  # (d) Symlinks. --no-links should make this vacuous; assert it rather than
  # assume it, because a symlink is how content from outside the allow-list
  # would get in.
  sym=0
  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    if [ -L "$VAULT/$rel" ]; then
      printf 'SYMLINK %s\n' "$rel" >&2
      sym=$((sym + 1))
    fi
  done <"$LIST"
  if [ "$sym" -eq 0 ]; then
    printf 'PASS    (d) symlinks: 0 of %s listed paths are symlinks\n' "$FILE_COUNT"
  else
    printf 'FAIL    (d) symlinks: %s listed path(s) are symlinks\n' "$sym" >&2
    st_other_fail=1
  fi

  printf '\nself-test over %s files (%s bytes) from %s\n' "$FILE_COUNT" "$TOTAL_BYTES" "$VAULT"
  [ "$st_other_fail" -eq 0 ] || exit 1
  [ "$SCAN_FAILED" -eq 0 ] || exit 3
  printf 'RESULT: PASS\n'
  exit 0
fi

# --------------------------------------------------------------------------- #
# --dry-run: print the list rsync produced, then a summary. Changes nothing.
# --------------------------------------------------------------------------- #
if [ "$MODE" = "dry-run" ]; then
  cat "$LIST"
  # `printf --` first: these format strings begin with "--", which bash's printf
  # would otherwise try to parse as an option.
  printf -- '\n-- dry run: %s files, %s bytes, %s include entries (%s unresolved)\n' \
    "$FILE_COUNT" "$TOTAL_BYTES" "$INC_TOTAL" "$INC_MISSING"
  printf -- '-- source: %s at %s\n' "$VAULT" "$(date '+%Y-%m-%d %H:%M %Z')"
  printf -- '-- would write to: %s/vault/  (nothing was written)\n' "$MIRROR_DIR"
  if [ "$SCAN_FAILED" -ne 0 ]; then
    printf -- '-- SECRET SCAN FAILED: %s hit(s) above. --commit would refuse.\n' "$SCAN_HITS"
    exit 3
  fi
  exit 0
fi

# --------------------------------------------------------------------------- #
# 5. The real copy. Same flags as the probe, minus --dry-run.
# --------------------------------------------------------------------------- #
DEST="$MIRROR_DIR/vault"
mkdir -p "$DEST" || die "cannot create $DEST"

# shellcheck disable=SC2086
rsync $RSYNC_FLAGS --exclude-from="$DENY_CLEAN" --files-from="$INC_CLEAN" \
  "$VAULT/" "$DEST/" >"$WORKDIR/rsync.out" 2>"$WORKDIR/rsync2.err"
rc=$?
[ "$rc" -eq 0 ] || { /usr/bin/sed -n '1,20p' "$WORKDIR/rsync2.err" >&2; die "rsync copy failed (exit $rc)"; }

# --------------------------------------------------------------------------- #
# 6. Prune. See the header: rsync --delete only cleans directories it is
# currently transferring, so dropping an entry from include.txt leaves its old
# copy behind. The expected set is the step-3 list; everything else under
# vault/ goes, including any symlink or empty directory left over.
# --------------------------------------------------------------------------- #
PRUNED="$(PRUNE_ROOT="$DEST" MIRROR_DIR="$MIRROR_REAL" LIST_FILE="$LIST" /usr/bin/python3 - <<'PYEOF'
import os
import sys

root = os.environ["PRUNE_ROOT"]
guard = os.environ["MIRROR_DIR"]

# Guard: only ever delete inside <mirror>/vault. Anything else is a bug, and the
# blast radius of a buggy recursive delete is not something to find out about.
real = os.path.realpath(root)
if real != os.path.join(os.path.realpath(guard), "vault") or real.count(os.sep) < 2:
    sys.stderr.write("prune guard refused root %r\n" % real)
    sys.exit(1)

with open(os.environ["LIST_FILE"], "rb") as f:      # DATA from a file, never stdin
    expected = set(x for x in f.read().split(b"\n") if x)

removed = 0
rootb = os.fsencode(real)
for dirpath, dirnames, filenames in os.walk(rootb):
    for name in filenames:
        full = os.path.join(dirpath, name)
        rel = os.path.relpath(full, rootb)
        if rel not in expected:
            try:
                os.remove(full)
                removed += 1
            except OSError as exc:
                sys.stderr.write("prune could not remove %r: %s\n" % (full, exc))
                sys.exit(1)

# Empty directories, deepest first.
for dirpath, dirnames, filenames in os.walk(rootb, topdown=False):
    if dirpath == rootb:
        continue
    try:
        if not os.listdir(dirpath):
            os.rmdir(dirpath)
    except OSError:
        pass

print(removed)
PYEOF
)"
rc=$?
[ "$rc" -eq 0 ] || die "prune failed (exit $rc)"
[ -n "$PRUNED" ] || PRUNED=0
[ "$PRUNED" -gt 0 ] && printf 'pruned  %s stale file(s) from %s\n' "$PRUNED" "$DEST"

# --------------------------------------------------------------------------- #
# 7. Second secret scan, against the staged tree this time.
# --------------------------------------------------------------------------- #
if ! secret_scan "$DEST" "$LIST" "staged mirror"; then
  printf 'FAIL    the staged tree at %s was NOT committed. Fix the hits, then re-run.\n' "$DEST" >&2
  exit 3
fi

# --------------------------------------------------------------------------- #
# 8a. Provenance + manifest + generated README. The vault git read is read-only
# (rev-parse / log); if it fails the mirror still builds with hash "unknown" —
# a mirror without provenance is worse, but a mirror that refuses to build over
# a missing .git is worse still.
#
# The manifest is rewritten only when something OTHER than the generation
# timestamp changed. Otherwise every run would rewrite two tracked files and
# "nothing changed since the last mirror commit" could never be true. So
# `generated:` reads as "when this snapshot last changed", and an unchanged
# run leaves the mirror byte-identical.
# --------------------------------------------------------------------------- #
VAULT_HASH="$(git -C "$VAULT" rev-parse --short HEAD 2>/dev/null || true)"
VAULT_CDATE="$(git -C "$VAULT" log -1 --format=%cI 2>/dev/null || true)"
[ -n "$VAULT_HASH" ] || { VAULT_HASH="unknown"; warn "could not read the vault HEAD hash — provenance recorded as 'unknown'"; }
[ -n "$VAULT_CDATE" ] || VAULT_CDATE="unknown"
GEN_ISO="$(date '+%Y-%m-%dT%H:%M:%S%z')"
GEN_STAMP="$(date '+%Y-%m-%d %H:%M')"

MAN_OUT="$MIRROR_DIR/MIRROR-MANIFEST.txt"
MAN_STATUS="$(MIRROR_DIR="$MIRROR_DIR" MAN_OUT="$MAN_OUT" \
INCLUDE_SRC="$INCLUDE_SRC" DENY_SRC="$DENY_SRC" \
VAULT_HASH="$VAULT_HASH" VAULT_CDATE="$VAULT_CDATE" GEN_ISO="$GEN_ISO" \
/usr/bin/python3 - <<'PYEOF'
import hashlib
import os
import sys

mirror = os.environ["MIRROR_DIR"]
out_path = os.environ["MAN_OUT"]
vault_root = os.path.join(mirror, "vault")


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            chunk = fh.read(1 << 20)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


rows = []
rootb = os.fsencode(vault_root)
mirrorb = os.fsencode(mirror)
for dirpath, dirnames, filenames in os.walk(rootb):
    for name in filenames:
        full = os.path.join(dirpath, name)
        if os.path.islink(full):
            continue
        rel = os.path.relpath(full, mirrorb)          # "vault/<path>"
        rows.append((rel, sha256_file(full)))
rows.sort(key=lambda r: r[0])                          # byte-order, locale-free

lines = [
    "# MIRROR-MANIFEST.txt — generated by mirror-share.sh. Do not edit by hand.",
    "vault-commit:   %s (%s)" % (os.environ["VAULT_HASH"], os.environ["VAULT_CDATE"]),
    "generated:      %s" % os.environ["GEN_ISO"],
    "include-sha256: %s  .claude/mirror/include.txt" % sha256_file(os.environ["INCLUDE_SRC"]),
    "deny-sha256:    %s  .claude/mirror/deny.txt" % sha256_file(os.environ["DENY_SRC"]),
    "file-count:     %d" % len(rows),
    "",
]
for rel, digest in rows:
    lines.append("%s  %s" % (digest, os.fsdecode(rel)))
body = "\n".join(lines) + "\n"


def significant(text):
    """Everything except the generation timestamp — the part worth a commit."""
    return [ln for ln in text.split("\n") if not ln.startswith("generated:")]


# Read FULLY first, compare, and only then write. The read never sits inside an
# open(path, "w") expression: that truncates before the read runs and has zeroed
# a real file in this vault before.
previous = None
if os.path.exists(out_path):
    with open(out_path, "r", encoding="utf-8", errors="surrogateescape") as fh:
        previous = fh.read()

if previous is not None and significant(previous) == significant(body):
    sys.stdout.write("MANIFEST unchanged %d\n" % len(rows))
else:
    # Write via a temp file on the SAME filesystem, then os.replace (atomic
    # there), then assert.
    tmp = out_path + ".tmp"
    with open(tmp, "w", encoding="utf-8", errors="surrogateescape") as fh:
        fh.write(body)
    os.replace(tmp, out_path)
    with open(out_path, "r", encoding="utf-8", errors="surrogateescape") as fh:
        assert fh.read() == body, "manifest write-back verification failed"
    sys.stdout.write("MANIFEST written %d\n" % len(rows))
PYEOF
)"
rc=$?
[ "$rc" -eq 0 ] || die "manifest generation failed (exit $rc)"
printf 'manifest %s\n' "${MAN_STATUS#MANIFEST }"

# The generated README carries only the provenance hash and the timestamp, both
# of which also appear in the manifest — so if the manifest did not change,
# neither would the README. Rewrite it only when it must change (or is missing).
README_OUT="$MIRROR_DIR/README.md"
case "$MAN_STATUS" in
  "MANIFEST unchanged"*) [ -f "$README_OUT" ] && SKIP_README=1 || SKIP_README=0 ;;
  *)                     SKIP_README=0 ;;
esac

if [ "$SKIP_README" -eq 0 ]; then
README_OUT="$README_OUT" VAULT_HASH="$VAULT_HASH" GEN_ISO="$GEN_ISO" \
/usr/bin/python3 - <<'PYEOF'
import os

body = (
    "# PopperWick — shared mirror (read-only)\n"
    "\n"
    "Read-only snapshot of PopperWick's shareable subset; generated by\n"
    "`mirror-share.sh`. Agents: read here, write to your own repository.\n"
    "Nothing here is authoritative over the vault.\n"
    "\n"
    "- Provenance: vault commit `%s`\n"
    "- Generated: %s\n"
    "- Contents and per-file checksums: `MIRROR-MANIFEST.txt`\n"
    "\n"
    "This snapshot is a filtered copy. Absence of a file here says nothing about\n"
    "whether it exists in the vault.\n"
) % (os.environ["VAULT_HASH"], os.environ["GEN_ISO"])

out_path = os.environ["README_OUT"]
tmp = out_path + ".tmp"
with open(tmp, "w", encoding="utf-8") as fh:
    fh.write(body)
os.replace(tmp, out_path)
with open(out_path, "r", encoding="utf-8") as fh:
    assert fh.read() == body, "README write-back verification failed"
PYEOF
rc=$?
[ "$rc" -eq 0 ] || die "README generation failed (exit $rc)"
fi

printf 'staged  %s files (%s source bytes) in %s\n' "$FILE_COUNT" "$TOTAL_BYTES" "$DEST"

# --------------------------------------------------------------------------- #
# 8b. git, in the MIRROR repo only.
#
# `git add -A` is safe HERE and only here: $MIRROR_DIR is a generated tree that
# this script owns, and the toplevel assertion below proves the repo git would
# write to is the mirror itself and not some enclosing repository.
# --------------------------------------------------------------------------- #
if [ ! -d "$MIRROR_DIR/.git" ]; then
  git -C "$MIRROR_DIR" init -b main >/dev/null 2>&1 || die "git init failed in $MIRROR_DIR"
  printf 'git     initialized a new repo at %s (branch main)\n' "$MIRROR_DIR"
fi

TOP="$(git -C "$MIRROR_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
TOP_REAL="$(/bin/realpath "$TOP" 2>/dev/null || true)"
[ -n "$TOP_REAL" ] || die "no git repo at $MIRROR_DIR"
[ "$TOP_REAL" = "$MIRROR_REAL" ] || \
  die "git toplevel is $TOP_REAL, not the mirror dir $MIRROR_REAL — refusing to touch that repo"

git -C "$MIRROR_DIR" add -A || die "git add failed"

if git -C "$MIRROR_DIR" diff --cached --quiet 2>/dev/null; then
  printf 'git     nothing changed since the last mirror commit\n'
  # For --commit that is the end of the job. For --push we still fall through:
  # an unchanged tree can still be a tree the remote has never seen.
  if [ "$MODE" = "commit" ]; then
    exit 0
  fi
else
  COMMIT_MSG="mirror: vault $VAULT_HASH $GEN_STAMP"
  git -C "$MIRROR_DIR" commit -q -m "$COMMIT_MSG" || die "git commit failed"
  printf 'git     committed: %s\n' "$COMMIT_MSG"
fi

[ "$MODE" = "push" ] || exit 0

# --------------------------------------------------------------------------- #
# 8c. Push — only to a remote that ALREADY exists. Adding a remote is the
# conductor's call, made once, by hand; a script that can invent its own
# publication target is a script that can publish somewhere nobody chose.
# --------------------------------------------------------------------------- #
if ! git -C "$MIRROR_DIR" remote get-url origin >/dev/null 2>&1; then
  {
    printf 'FAIL    no "origin" remote in %s — refusing to add one (that is the conductor'"'"'s call).\n' "$MIRROR_DIR"
    printf '        Create the private repo on GitHub, then run exactly:\n\n'
    printf '          git -C %s remote add origin git@github.com:<user>/<repo>.git\n' "$MIRROR_DIR"
    printf '          git -C %s push -u origin main\n\n' "$MIRROR_DIR"
    printf '        After that, --push works on its own.\n'
  } >&2
  exit 2
fi

git -C "$MIRROR_DIR" push origin main || die "git push failed"
printf 'git     pushed to origin/main\n'
exit 0
