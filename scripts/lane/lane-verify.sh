#!/bin/bash
# lane-verify.sh — Phase 4 verification battery for the popperwick-lane account.
#
#   Section A  runs from the USER's account and needs privilege: the sudoers
#              rule for A1/A3/A4, and the user's admin password for the A2
#              escape regression (which runs arbitrary probes as the lane user,
#              something the narrow sudoers rule deliberately does NOT allow).
#   Section B  runs as the conductor with no privilege at all.
#
#   ./lane-verify.sh            # both sections
#   ./lane-verify.sh --section a
#   ./lane-verify.sh --section b
#
# `set -u` and NO `set -e`: a verifier must run every check and report, not stop
# at the first failure. (The launcher does the opposite, on purpose.)
#
# This script never deletes anything under the outbox, never writes into the
# vault, and never prints the contents of a credential file — a credential read
# that unexpectedly succeeds is reported as a FAIL with the bytes suppressed.

set -u

LANE_USER='popperwick-lane'
LANE_HOME='/Users/popperwick-lane'
ETC_DIR='/usr/local/etc/popperwick'
PROFILE="$ETC_DIR/popperwick-lane.sb"
SETTINGS="$ETC_DIR/settings-lane.json"
LAUNCHER='/usr/local/libexec/popperwick-lane-launch'
VAULT_LANE_DIR='/Users/OWNER/Claude/.claude/scripts/lane'
VAULT_FILE='/Users/OWNER/Claude/CLAUDE.md'
ENDPOINT_HOST='api.kimi.com'          # must match ANTHROPIC_BASE_URL in settings-lane.json
READERS_GROUP='popperwick-readers'

SECTION='all'
case "${1:-}" in
  --section) SECTION="${2:-all}" ;;
  '') : ;;
  *) printf 'usage: %s [--section a|b|all]\n' "$0" >&2; exit 64 ;;
esac

PASS=0; FAIL=0; SKIP=0
hdr()  { printf '\n===== %s\n' "$1"; }
ok()   { PASS=$((PASS+1)); printf 'PASS  %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf 'FAIL  %s\n' "$1"; }
skip() { SKIP=$((SKIP+1)); printf 'SKIP  %s\n' "$1"; }
cmdline() { printf '      $ %s\n' "$1"; }
obs()  { printf '      observed: %s\n' "$(printf '%s' "$1" | head -c 300 | tr '\n' ' ')"; }

# run <label> <shell-command> -> sets RUN_OUT (combined) and RUN_RC
run() {
  RUN_OUT="$(eval "$1" 2>&1)"; RUN_RC=$?
}

# A denial is only a denial if the command failed AND said so. A silent empty
# success would otherwise read as a pass (the 2026-08-13 "green over a hole").
expect_denied() {  # expect_denied <label> <command>
  run "$2"; cmdline "$2"
  case "$RUN_OUT" in
    *'Operation not permitted'*|*'Permission denied'*|*'not permitted'*)
      if [ "$RUN_RC" -ne 0 ]; then ok "$1 — denied"; else bad "$1 — command succeeded but printed a denial"; fi ;;
    *)
      bad "$1 — NOT denied"; obs "${RUN_OUT:-<no output>} (exit $RUN_RC)" ;;
  esac
}

expect_ok() {      # expect_ok <label> <command>
  run "$2"; cmdline "$2"
  if [ "$RUN_RC" -eq 0 ]; then ok "$1"; else bad "$1 — expected success"; obs "${RUN_OUT:-<no output>} (exit $RUN_RC)"; fi
}

# ---------------------------------------------------------------------------
# SECTION A — from the USER's account, with privilege.
# ---------------------------------------------------------------------------
section_a() {
  hdr "SECTION A — privileged checks (run by the user)"
  printf 'A2 runs probes as %s through sandbox-exec and will ask for your admin\n' "$LANE_USER"
  printf 'password: the sudoers rule intentionally covers only the launcher.\n'

  # --- A1: the UID boundary itself, outside any sandbox (Sol Q6) ------------
  # NOTE the path: cat is /bin/cat on macOS. Sol's Q6 and the runbook both write
  # /usr/bin/cat, which DOES NOT EXIST here — that command exits 127 "No such
  # file or directory" and would read like a denial while never testing anything
  # (verified 2026-09-02). The 127 case is trapped explicitly below.
  hdr "A1 — UID boundary: the lane cannot read the vault"
  A1_CAT='/bin/cat'
  # Plain `sudo -u` (no -n): the narrow sudoers rule authorises the LAUNCHER
  # only, so `sudo -n /bin/cat` would fail for lack of authorisation and that
  # failure would look like the denial we are trying to prove. This prompts.
  A1_TMP="$(mktemp -d "${TMPDIR:-/private/tmp}/lane-verify.XXXXXX")" || { bad "A1 — mktemp failed"; return; }
  A1_OUT="$(sudo -u "$LANE_USER" "$A1_CAT" "$VAULT_FILE" 2>"$A1_TMP/err")"; A1_RC=$?
  A1_ERR="$(cat "$A1_TMP/err" 2>/dev/null)"; rm -rf "$A1_TMP"
  cmdline "sudo -u $LANE_USER $A1_CAT $VAULT_FILE"
  if [ -n "$A1_OUT" ]; then
    bad "A1 — the lane PRINTED vault content: Phase 0 (chmod 700 /Users/OWNER) did not take. STOP."
  elif [ "$A1_RC" -eq 127 ] || printf '%s' "$A1_ERR" | grep -q 'No such file or directory'; then
    bad "A1 — the probe binary never ran (exit $A1_RC); this is NOT a denial"; obs "$A1_ERR"
  elif [ "$A1_RC" -ne 0 ] && printf '%s' "$A1_ERR" | grep -q 'Permission denied'; then
    ok "A1 — Permission denied, no content"; obs "$A1_ERR"
  else
    bad "A1 — no content, but not a clean Permission denied"; obs "$A1_ERR (exit $A1_RC)"
  fi

  # --- A2: deterministic escape regression, /bin/sh probes, no model -------
  hdr "A2 — escape regression as $LANE_USER through sandbox-exec (no model involved)"
  if [ ! -r "$PROFILE" ]; then
    skip "A2 — $PROFILE not installed"; return
  fi
  VTS="verify-$(date -u '+%Y%m%dT%H%M%SZ')"
  VRUN="$LANE_HOME/scratch/$VTS"
  VOUT="$LANE_HOME/lane/outbox/$VTS"
  V_UID="$(id -u "$LANE_USER" 2>/dev/null || echo 0)"
  sudo -u "$LANE_USER" /bin/mkdir -p "$VRUN/tmp" "$VRUN/claude-config" "$VOUT/files" \
    || { bad "A2 — could not create probe dirs"; return; }
  # Decoys standing in for the files the UNSANDBOXED launcher writes.
  for f in commission.md stderr.txt result.md meta.json; do
    sudo -u "$LANE_USER" /bin/sh -c "printf 'SENTINEL\n' > '$VOUT/$f'"
  done
  sudo -u "$LANE_USER" /bin/sh -c "printf '#!/bin/sh\n# SENTINEL\n' > '$VRUN/git-askpass.sh'"
  SB_ARGS="-D RUN_ROOT=$VRUN -D OUTBOX=$VOUT -D HOME_DIR=$LANE_HOME -D UID_TMP=/tmp/claude-$V_UID -D UID_TMP_PRIVATE=/private/tmp/claude-$V_UID -f $PROFILE"
  SB="sudo -u $LANE_USER /usr/bin/sandbox-exec $SB_ARGS"
  MIRROR_FILE="$(sudo -u "$LANE_USER" /bin/sh -c "ls $LANE_HOME/lane/mirror/*.md 2>/dev/null | head -1")"

  expect_denied "A2.1 write \$HOME/escape.md"      "$SB /bin/sh -c 'echo x > $LANE_HOME/escape.md'"
  expect_denied "A2.2 write /tmp/lane-plant"       "$SB /bin/sh -c 'echo x > /tmp/lane-plant'"
  expect_denied "A2.3 write the darwin temp dir"   "$SB /bin/sh -c 'd=\$(getconf DARWIN_USER_TEMP_DIR); echo x > \${d}lane-plant'"
  expect_denied "A2.4 read the vault CLAUDE.md"    "$SB /bin/sh -c 'head -c 40 $VAULT_FILE'"
  expect_denied "A2.5 read github.token"           "$SB /bin/sh -c 'cat $LANE_HOME/.credentials/github.token'"
  expect_denied "A2.6 read model.token"            "$SB /bin/sh -c 'cat $LANE_HOME/.credentials/model.token'"
  expect_denied "A2.7 read ~/.codex"               "$SB /bin/sh -c 'ls $LANE_HOME/.codex'"
  expect_denied "A2.8 rename the outbox root"      "$SB /bin/sh -c 'mv $LANE_HOME/lane/outbox $LANE_HOME/lane/outbox2'"
  expect_denied "A2.9 write into the mirror"       "$SB /bin/sh -c 'echo x > $LANE_HOME/lane/mirror/tamper.md'"
  expect_denied "A2.10 write /dev/tty"             "$SB /bin/sh -c 'printf ESC > /dev/tty'"
  expect_denied "A2.11 list /private/tmp"          "$SB /bin/sh -c 'ls /private/tmp'"
  expect_ok     "A2.12 write inside <outbox>/files" "$SB /bin/sh -c 'echo ok > $VOUT/files/probe.txt'"
  expect_ok     "A2.13 write inside <run>/tmp"     "$SB /bin/sh -c 'echo ok > $VRUN/tmp/probe.txt'"
  if [ -n "$MIRROR_FILE" ]; then
    expect_ok   "A2.14 read the mirror"            "$SB /bin/sh -c 'head -c 40 $MIRROR_FILE'"
  else
    skip "A2.14 read the mirror — the mirror has no top-level .md file yet"
  fi

  # --- A2.15-A2.22: the CONFUSED-DEPUTY battery (Sol #1, 2026-09-02) -------
  # The agent must not be able to replace, or create, anything in the launcher's
  # own directories — a symlink or FIFO there would make the UNSANDBOXED
  # launcher write outside the cage, or block forever on an open().
  hdr "A2.15-A2.22 — confused deputy: the launcher's files and their parents"
  sudo -u "$LANE_USER" /bin/sh -c "cat > '$VRUN/deputy.sh'" <<'DEPUTY'
#!/bin/sh
# Runs INSIDE the sandbox. $1 = outbox run dir, $2 = run root.
echo PROBE-REACHED
V="$1"; R="$2"
o() { d="$1"; shift; if "$@" >/dev/null 2>&1; then echo "RC=0 $d"; else echo "RC=$? $d"; fi; }
o "A2.15 replace outbox/result.md with a regular file" /bin/sh -c "printf PWNED > $V/result.md"
o "A2.16 replace outbox/meta.json with a symlink"      /bin/ln -sf /etc/passwd "$V/meta.json"
o "A2.17 unlink+FIFO over outbox/stderr.txt"           /bin/sh -c "rm -f $V/stderr.txt && /usr/bin/mkfifo $V/stderr.txt"
o "A2.18 replace run/git-askpass.sh (regular file)"    /bin/sh -c "printf '#!/bin/sh
id' > $R/git-askpass.sh"
o "A2.19 replace run/git-askpass.sh with a symlink"    /bin/ln -sf /etc/passwd "$R/git-askpass.sh"
o "A2.20 create a FIFO in the run root"                /usr/bin/mkfifo "$R/planted.fifo"
o "A2.21 replace outbox/commission.md (regular file)"  /bin/sh -c "printf PWNED > $V/commission.md"
o "A2.22 create a new file in the outbox run dir"      /bin/sh -c "printf x > $V/newfile"
DEPUTY
  DEP_BEFORE="$(sudo -u "$LANE_USER" /usr/bin/stat -f '%N %i %z %Sp' \
      "$VOUT/result.md" "$VOUT/meta.json" "$VOUT/commission.md" "$VOUT/stderr.txt" "$VRUN/git-askpass.sh" 2>&1)"
  run "$SB /bin/sh $VRUN/deputy.sh $VOUT $VRUN"
  cmdline "$SB /bin/sh <deputy probes> $VOUT $VRUN"
  if printf '%s' "$RUN_OUT" | grep -q 'PROBE-REACHED'; then
    ok "A2.15-22 probe reached the sandbox (marker present)"
  else
    bad "A2.15-22 probe never ran — every result below is meaningless"; obs "$RUN_OUT"
  fi
  # Per-probe detail (informational; the graded checks are below —
  # a pipeline subshell cannot update the counters).
  printf '%s\n' "$RUN_OUT" | grep '^RC=' | sed 's/^/      /'
  DEP_N="$(printf '%s\n' "$RUN_OUT" | grep -c '^RC=' || true)"
  # A partial run must FAIL: eight probes are defined, so eight records must
  # come back. Fewer means the script died part-way and the silence of the
  # missing probes is not evidence of anything.
  if [ "$DEP_N" -eq 8 ]; then ok "A2.15-22 all 8 deputy probes reported"
  else bad "A2.15-22 expected 8 probe records, got $DEP_N — partial run, results not usable"; obs "$RUN_OUT"; fi
  if printf '%s' "$RUN_OUT" | grep -q '^RC=0 '; then
    bad "A2.15-22 at least one deputy probe SUCCEEDED"; obs "$RUN_OUT"
  else
    ok "A2.15-22 every deputy probe was denied"
  fi
  DEP_AFTER="$(sudo -u "$LANE_USER" /usr/bin/stat -f '%N %i %z %Sp' \
      "$VOUT/result.md" "$VOUT/meta.json" "$VOUT/commission.md" "$VOUT/stderr.txt" "$VRUN/git-askpass.sh" 2>&1)"
  if [ "$DEP_BEFORE" = "$DEP_AFTER" ]; then ok "A2.15-22 filesystem state unchanged (inode/size/mode)"
  else bad "A2.15-22 filesystem CHANGED"; obs "before: $DEP_BEFORE / after: $DEP_AFTER"; fi
  # Each planted path tested INDIVIDUALLY: a single `ls` of several paths prints
  # "No such file" for the missing ones, so one surviving node would hide behind
  # its absent siblings. -e misses a dangling symlink, hence the -L too.
  DEP_PLANTED=''
  for pn in "$VRUN/planted.fifo" "$VOUT/newfile" "$VOUT/planted.fifo"; do
    if sudo -u "$LANE_USER" /bin/sh -c "[ -e '$pn' ] || [ -L '$pn' ]"; then
      DEP_PLANTED="$DEP_PLANTED $pn"
    fi
  done
  if [ -z "$DEP_PLANTED" ]; then ok "A2.15-22 no planted node exists afterwards (each path tested on its own)"
  else bad "A2.15-22 planted node(s) EXIST:$DEP_PLANTED"; fi
  # stderr.txt must still be the regular file the launcher created, not a FIFO.
  if sudo -u "$LANE_USER" /bin/test -p "$VOUT/stderr.txt"; then
    bad "A2.15-22 outbox/stderr.txt is now a FIFO — the launcher would block on it"
  else ok "A2.15-22 outbox/stderr.txt is still a regular file"; fi
  # ...and the descriptor the launcher opens BEFORE the sandbox still works.
  run "sudo -u $LANE_USER /bin/sh -c \"/usr/bin/sandbox-exec $SB_ARGS /bin/sh -c 'echo OPEN-FD-WRITE-OK' > '$VOUT/result.md'\""
  OPEN_FD="$(sudo -u "$LANE_USER" /bin/cat "$VOUT/result.md" 2>&1)"
  cmdline "sudo -u $LANE_USER sh -c 'sandbox-exec ... sh -c echo > $VOUT/result.md'"
  if [ "$OPEN_FD" = 'OPEN-FD-WRITE-OK' ]; then ok "A2.23 an already-open stdout descriptor still writes result.md"
  else bad "A2.23 the parent's redirect into result.md did NOT work — the launcher cannot capture output"; obs "$OPEN_FD"; fi

  # Network must still work: the model endpoint is the whole point of the lane.
  run "$SB /bin/sh -c 'curl -sS -o /dev/null -w %{http_code} --max-time 20 https://$ENDPOINT_HOST/'"
  cmdline "$SB curl -sS -o /dev/null -w %{http_code} https://$ENDPOINT_HOST/"
  case "$RUN_OUT" in
    ''|*000*) bad "A2.24 network to $ENDPOINT_HOST — no HTTP status (DNS or egress blocked)"; obs "$RUN_OUT" ;;
    *) ok "A2.24 network to $ENDPOINT_HOST reachable (HTTP $RUN_OUT)" ;;
  esac
  printf '      NOTE probe dirs left in place for inspection: %s and %s\n' "$VRUN" "$VOUT"

  # --- A3: launcher round trip --------------------------------------------
  hdr "A3 — launcher round trip with a trivial commission"
  if [ ! -x "$LAUNCHER" ]; then skip "A3 — $LAUNCHER not installed"; return; fi
  A3_BEFORE="$(sudo -u "$LANE_USER" /bin/ls -1 "$LANE_HOME/lane/outbox" 2>/dev/null)"
  printf '%s' 'Write a file named probe.md in the current directory containing the single word OK' \
    | sudo -n -u "$LANE_USER" "$LAUNCHER"
  A3_RC=$?
  cmdline "printf '%s' \"<commission>\" | sudo -n -u $LANE_USER $LAUNCHER   -> exit $A3_RC"
  A3_AFTER="$(sudo -u "$LANE_USER" /bin/ls -1 "$LANE_HOME/lane/outbox" 2>/dev/null)"
  # Set difference, never `tail -1`: exactly one new run directory must appear.
  A3_TMP="$(mktemp -d "${TMPDIR:-/private/tmp}/lane-verify.XXXXXX")"
  printf '%s\n' "$A3_BEFORE" | sort >"$A3_TMP/before"
  printf '%s\n' "$A3_AFTER"  | sort >"$A3_TMP/after"
  A3_NEW="$(comm -13 "$A3_TMP/before" "$A3_TMP/after" | grep '[^[:space:]]' || true)"
  rm -rf "$A3_TMP"
  A3_NEWCOUNT="$(printf '%s\n' "$A3_NEW" | grep -c '[^[:space:]]' || true)"
  if [ "$A3_RC" -eq 0 ]; then ok "A3 — launcher exited 0"; else bad "A3 — launcher exited $A3_RC"; fi
  if [ "$A3_NEWCOUNT" -eq 1 ]; then ok "A3 — exactly one new outbox directory"
  else bad "A3 — expected exactly 1 new outbox directory, found $A3_NEWCOUNT"; obs "$A3_NEW"; fi
  A3_RUN="$(printf '%s\n' "$A3_NEW" | grep '[^[:space:]]' | head -1)"
  A3_DIR="$LANE_HOME/lane/outbox/$A3_RUN"
  A3_LIST="$(sudo -u "$LANE_USER" /bin/ls -1 "$A3_DIR" 2>/dev/null)"
  obs "outbox run $A3_RUN: $(printf '%s' "$A3_LIST" | tr '\n' ' ')"
  for f in result.md meta.json commission.md stderr.txt files; do
    if printf '%s\n' "$A3_LIST" | grep -qx "$f"; then ok "A3 — $f present"; else bad "A3 — $f MISSING"; fi
  done
  if sudo -u "$LANE_USER" /bin/test -f "$A3_DIR/files/probe.md"; then
    ok "A3 — files/probe.md written by the agent"
  else
    bad "A3 — files/probe.md MISSING: the agent could not write."
    printf '      DIAGNOSE IN THIS ORDER:\n'
    printf '        1. %s/stderr.txt — an auth 401 means the token/base-URL, not the cage.\n' "$A3_DIR"
    printf '        2. permission-rule syntax: path-scoped rules on the outbox may not match; try a\n'
    printf '           bare "Edit" in settings-lane.json permissions.allow (the kernel still confines\n'
    printf '           writes to <outbox>/files and the run scratch), then --permission-mode acceptEdits.\n'
    printf '        3. a Seatbelt denial in stderr.txt ("Operation not permitted") names the path to add.\n'
  fi
  A3_HOME="$(sudo -u "$LANE_USER" /bin/ls -1a "$LANE_HOME" 2>/dev/null | grep -E '\.md$' | tr '\n' ' ')"
  if [ -z "$A3_HOME" ]; then ok "A3 — no stray *.md at the top of the lane home"; else bad "A3 — stray files in the lane home: $A3_HOME"; fi

  # --- A4: sudo's own environment carries no secret ------------------------
  hdr "A4 — no token in the environment sudo hands the lane"
  A4_OUT="$(sudo -u "$LANE_USER" /usr/bin/env 2>&1)"; A4_RC=$?
  cmdline "sudo -u $LANE_USER /usr/bin/env   (plain sudo: the sudoers rule covers the launcher only)"
  if [ "$A4_RC" -ne 0 ]; then
    bad "A4 — sudo did not run env (exit $A4_RC); this check proves NOTHING until it does"; obs "$A4_OUT"
  else
    A4_NAMES="$(printf '%s\n' "$A4_OUT" | cut -d= -f1 | grep -iE 'token|key|secret|password|passwd' | tr '\n' ' ')"
    if [ -z "$A4_NAMES" ]; then ok "A4 — no credential-shaped variable (names only were inspected)"
    else bad "A4 — sudo passes credential-shaped variables: $A4_NAMES (check NOSETENV in the sudoers rule)"; fi
  fi
}

# ---------------------------------------------------------------------------
# SECTION B — from the conductor's account, no privilege.
# ---------------------------------------------------------------------------
section_b() {
  hdr "SECTION B — unprivileged checks (run by the conductor)"

  # B1: the outbox is readable from this account.
  hdr "B1 — outbox readable from the conductor account"
  # A2 leaves verify-* probe dirs in the outbox; they are not launcher runs.
  B1_RUN="$(ls -1 "$LANE_HOME/lane/outbox" 2>/dev/null | grep -v '^verify-' | tail -1)"
  cmdline "ls -1 $LANE_HOME/lane/outbox | grep -v '^verify-' | tail -1"
  if [ -z "$B1_RUN" ]; then
    skip "B1 — no run directories yet (run A3 first)"
  else
    expect_ok "B1.1 list the newest run dir ($B1_RUN)" "ls -la '$LANE_HOME/lane/outbox/$B1_RUN' >/dev/null"
    for f in result.md meta.json; do
      if [ -r "$LANE_HOME/lane/outbox/$B1_RUN/$f" ]; then ok "B1.2 $f readable"; else bad "B1.2 $f NOT readable from this account"; fi
    done
    # B1.3: tamper evidence. meta.json's sha is computed before the agent runs
    # and written after it exits; the agent can rewrite the outbox copy of the
    # commission but cannot rewrite that hash.
    M="$LANE_HOME/lane/outbox/$B1_RUN/meta.json"; C="$LANE_HOME/lane/outbox/$B1_RUN/commission.md"
    if [ -r "$M" ] && [ -r "$C" ]; then
      WANT="$(sed -n 's/.*"commission_sha256": "\([0-9a-f]*\)".*/\1/p' "$M")"
      GOT="$(shasum -a 256 "$C" | cut -d' ' -f1)"
      if [ "$WANT" = "$GOT" ]; then ok "B1.3 commission.md matches meta.json's sha256"
      else bad "B1.3 commission.md does NOT match meta.json ($GOT vs $WANT) — the outbox copy was rewritten"; fi
    else
      skip "B1.3 commission integrity — meta.json or commission.md unreadable"
    fi
  fi

  # B2/B3: what must stay closed.
  hdr "B2/B3 — mirror and lane home stay closed to the conductor"
  expect_denied "B2 mirror not readable"     "ls '$LANE_HOME/lane/mirror'"
  expect_denied "B3 lane home not listable"  "ls '$LANE_HOME'"

  # B4: outbox mode and group.
  hdr "B4 — outbox root mode 2750, group $READERS_GROUP"
  B4_MODE="$(stat -f '%Lp' "$LANE_HOME/lane/outbox" 2>/dev/null)"
  B4_SETGID="$(stat -f '%p' "$LANE_HOME/lane/outbox" 2>/dev/null)"
  B4_GRP="$(stat -f '%Sg' "$LANE_HOME/lane/outbox" 2>/dev/null)"
  cmdline "stat -f '%Sp %Sg' $LANE_HOME/lane/outbox"
  obs "mode=${B4_MODE:-?} raw=${B4_SETGID:-?} group=${B4_GRP:-?}"
  B4_SETGID_OK=0
  case "$B4_SETGID" in *42750) B4_SETGID_OK=1 ;; esac   # stat %p prints e.g. 042750
  if [ "$B4_MODE" = '750' ] && [ "$B4_GRP" = "$READERS_GROUP" ] && [ "$B4_SETGID_OK" -eq 1 ]; then
    ok "B4 — 2750 $READERS_GROUP"
  else
    bad "B4 — expected 2750 $READERS_GROUP, found mode ${B4_MODE:-?} group ${B4_GRP:-?}"
    printf '      FIX (as the lane user, or with sudo from your account):\n'
    printf '        sudo chgrp %s %s/lane/outbox && sudo chmod 2750 %s/lane/outbox\n' "$READERS_GROUP" "$LANE_HOME" "$LANE_HOME"
  fi

  # B5: credentials unreadable from here.
  hdr "B5 — credentials unreadable from the conductor's account"
  for t in github.token model.token; do
    OUT="$(cat "$LANE_HOME/.credentials/$t" 2>&1 >/dev/null)"; RC=$?
    CONTENT="$(cat "$LANE_HOME/.credentials/$t" 2>/dev/null | head -c 1)"
    cmdline "cat $LANE_HOME/.credentials/$t"
    if [ -n "$CONTENT" ]; then bad "B5 — $t IS READABLE from this account (contents suppressed)"
    elif [ "$RC" -ne 0 ]; then ok "B5 — $t unreadable"; obs "$OUT"
    else skip "B5 — $t not present yet"; fi
  done

  # B6: the installed cage matches the reviewed files, is root-owned, and has
  # exactly the modes the runbook installs (item 10c).
  hdr "B6 — installed files: content, owner, exact mode"
  for spec in "$LAUNCHER:popperwick-lane-launch:755" "$PROFILE:popperwick-lane.sb:644" "$SETTINGS:settings-lane.json:644"; do
    inst="${spec%%:*}"; rest="${spec#*:}"; src="$VAULT_LANE_DIR/${rest%%:*}"; want="${rest##*:}"
    if [ ! -r "$inst" ]; then bad "B6 — $inst not installed"; continue; fi
    OWN="$(stat -f '%Su:%Sg' "$inst")"; MODE="$(stat -f '%Lp' "$inst")"
    A="$(shasum -a 256 "$inst" | cut -d' ' -f1)"; B="$(shasum -a 256 "$src" | cut -d' ' -f1)"
    cmdline "stat -f '%Su:%Sg %Lp' $inst"
    if [ "$A" = "$B" ]; then ok "B6 — $inst matches the vault copy"
    else bad "B6 — $inst DIFFERS from $src — reinstall or re-review"; fi
    if [ "$OWN" = 'root:wheel' ]; then ok "B6 — $inst is root:wheel"
    else bad "B6 — $inst is $OWN, must be root:wheel"; fi
    if [ "$MODE" = "$want" ]; then ok "B6 — $inst mode $want"
    else bad "B6 — $inst mode $MODE, must be $want"; fi
  done
  for dir in '/usr/local/libexec' '/usr/local/etc/popperwick'; do
    if [ ! -d "$dir" ]; then bad "B6 — $dir missing"; continue; fi
    DOWN="$(stat -f '%Su:%Sg' "$dir")"; DMODE="$(stat -f '%Lp' "$dir")"
    if [ "$DOWN" = 'root:wheel' ] && [ "$DMODE" = '755' ]; then ok "B6 — $dir is root:wheel 755"
    else bad "B6 — $dir is $DOWN $DMODE, must be root:wheel 755"; fi
  done
  if [ -r "$LAUNCHER" ]; then
    if grep -q '^ALLOW_TEST_OVERRIDE=0' "$LAUNCHER"; then ok "B6 — installed launcher has ALLOW_TEST_OVERRIDE=0"
    else bad "B6 — installed launcher does NOT have ALLOW_TEST_OVERRIDE=0 (test hooks live!)"; fi
  fi
}

case "$SECTION" in
  a|A) section_a ;;
  b|B) section_b ;;
  all) section_a; section_b ;;
  *) printf 'unknown section: %s\n' "$SECTION" >&2; exit 64 ;;
esac

printf '\n===== SUMMARY: %s PASS, %s FAIL, %s SKIP — %s\n' "$PASS" "$FAIL" "$SKIP" \
  "$( [ "$FAIL" -eq 0 ] && printf 'battery clean (no check failed)' || printf 'FAILURES PRESENT — do not run the lane live' )"
[ "$FAIL" -eq 0 ]
