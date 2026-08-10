#!/bin/bash
# Overnight fence — arm / disarm / status.
#
# Built 2026-08-09 (Wave 2), user-ratified ("Build chflags tier") after Sol's
# three-pass review established that the regex hook (tier 1) cannot be made
# complete and that chmod 0444 (the old tier 2) does NOT stop deletion — `rm`
# unlinks a read-only file through a writable parent. `chflags uchg` does stop
# it, at the kernel, verified: rm -f / cp-over / redirect all return
# "Operation not permitted". That makes tier 1's incompleteness stop mattering
# for canonical files: however a destructive command is spelled — quoted,
# escaped, wrapped, substituted, in-language — it fails at the filesystem.
#
# Replaces the two hand-maintained chmod one-liners in the program doc, which
# had drifted apart from each other AND from the hook's own fenced-token set
# (they missed MODEL-SWITCHING.md, gen2-search-ledger.md, .claude/settings.json
# and .claude/hooks/). One list, defined once, below.
#
# DESIGN — why a manifest and not a second hardcoded list:
#   arm records EXACTLY what it locked to a manifest OUTSIDE the vault, and
#   disarm unlocks from that record. So disarm is always exact even if this
#   script's file list changes between arming and disarming, and the overnight
#   conductor (which can write inside the vault) cannot tamper with it.
#
# `set -u`, never `set -e` — house convention: non-zero exits are normal here
# (chflags on an already-clear file, grep with no match) and must not abort.
set -u

VAULT="${FENCE_VAULT:-/Users/OWNER/Claude}"
SENTINEL="$VAULT/Journal/Overnight/ACTIVE"
STATE_DIR="${FENCE_STATE_DIR:-$HOME/.config/popperwick}"
MANIFEST="$STATE_DIR/fence-lock.manifest"

# --- THE CANONICAL SET ------------------------------------------------------
# Keep aligned with FENCED_TOKENS in .claude/hooks/overnight_fence.py. A file
# listed here that does not exist is skipped silently (globs may be empty).
# Symlinks are rejected: `chflags` DOES follow a link and protect its target
# (verified 2026-08-09, contra Sol's review), but `ls -lO` reads the LINK, so a
# symlinked entry reports unlocked and corrupts `status` and post-verification.
# There are none in the set today; rejecting keeps it that way honestly.
canonical_paths() {
  local p
  for p in \
    "$VAULT/CLAUDE.md" \
    "$VAULT/AGENTS.md" \
    "$VAULT/AUTHORIZATIONS.md" \
    "$VAULT/MODEL-SWITCHING.md" \
    "$VAULT/Journal/Trading Plan/"*.md \
    "$VAULT/Journal/Backtests/DATA-MANIFEST.md" \
    "$VAULT/Journal/Backtests/W3 Builder Spec"*.md \
    "$VAULT/Journal/Backtests/Bench Maturity Assessment"*.md \
    "$VAULT/.claude/settings.json" \
    "$VAULT/.claude/hooks/"*.py \
    "$VAULT/.claude/scripts/fence.sh" \
  ; do
    [ -f "$p" ] && [ ! -L "$p" ] && printf '%s\n' "$p"
  done
}

locked_flag() { ls -lO "$1" 2>/dev/null | awk '{print $5}' | grep -q uchg \
  && echo yes || echo no; }

# Single-operator tool, but arm/disarm racing each other would corrupt the
# manifest. mkdir is atomic on every filesystem we care about (Sol).
acquire_lock() {
  mkdir -p "$STATE_DIR" || return 1
  if ! mkdir "$STATE_DIR/.lock" 2>/dev/null; then
    echo "ANOTHER fence.sh IS RUNNING (or crashed). If you are sure it is not," >&2
    echo "  rmdir '$STATE_DIR/.lock'  then retry." >&2
    return 1
  fi
  trap 'rmdir "$STATE_DIR/.lock" 2>/dev/null' EXIT
}

cmd_arm() {
  if [ -e "$SENTINEL" ]; then
    echo "ALREADY ARMED (sentinel exists). Run 'fence.sh status'." >&2
    return 1
  fi
  acquire_lock || return 1
  mkdir -p "$(dirname "$SENTINEL")" || return 1

  # TRANSACTIONAL ORDER (Sol 2026-08-09): publish the INTENDED manifest FIRST,
  # atomically, then lock. The old order (lock, then append) meant an interrupt
  # between the two left an immutable file NOT in the manifest — invisible to
  # disarm. Manifest-first makes it a guaranteed SUPERSET of what is locked, and
  # `chflags nouchg` on an already-unlocked file is a harmless no-op. So every
  # interruption now fails toward "disarm can still clear everything".
  local f n=0 failed=0
  canonical_paths > "$MANIFEST.tmp" || return 1
  printf '# vault=%s\n' "$VAULT" >> "$MANIFEST.tmp"
  mv -f "$MANIFEST.tmp" "$MANIFEST" || return 1

  while IFS= read -r f; do
    case "$f" in '#'*) continue ;; esac
    chflags uchg "$f" 2>/dev/null
    # POST-VERIFY: chflags can report success without the flag landing. Trust
    # the observed flag, never the exit code (Sol).
    if [ "$(locked_flag "$f")" = yes ]; then
      n=$((n + 1))
    else
      echo "WARN: failed to lock $f" >&2
      failed=$((failed + 1))
    fi
  done < "$MANIFEST"

  if [ "$failed" -gt 0 ]; then
    echo "ABORTING: $failed file(s) did not lock — rolling back, NOT arming." >&2
    cmd_disarm >/dev/null 2>&1
    echo "Rolled back. Fence is NOT armed; investigate before retrying." >&2
    return 1
  fi
  if ! touch "$SENTINEL" 2>/dev/null; then
    echo "ABORTING: locked $n files but could NOT set the sentinel." >&2
    cmd_disarm >/dev/null 2>&1
    echo "Rolled back. Fence is NOT armed." >&2
    return 1
  fi
  echo "FENCE ARMED — $n canonical files immutable (chflags uchg); sentinel set."
  echo "Manifest: $MANIFEST"
  echo "Disarm with: $VAULT/.claude/scripts/fence.sh disarm"
}

# Unlock everything still flagged under a root. Ground truth is the FLAG, not
# the manifest — Sol's decisive finding was that a truncated-but-valid manifest
# produced zero errors, so disarm deleted it and reported success with 47 of 48
# files still immutable. Bookkeeping can lie; the filesystem cannot.
sweep_flagged() {
  local root="$1" f swept=0
  while IFS= read -r f; do
    chflags nouchg "$f" 2>/dev/null && swept=$((swept + 1))
  done < <(find "$root" -flags +uchg -type f -not -path "*/.git/*" 2>/dev/null)
  echo "$swept"
}

cmd_disarm() {
  local n=0 f mvault=""
  acquire_lock || return 1
  # Sentinel first: tier 1 stops denying immediately, so a slow unlock below
  # cannot strand a session that is otherwise fine.
  rm -f "$SENTINEL"

  if [ -f "$MANIFEST" ]; then
    mvault=$(grep '^# vault=' "$MANIFEST" 2>/dev/null | head -1 | cut -d= -f2-)
    while IFS= read -r f; do
      case "$f" in ''|'#'*) continue ;; esac
      chflags nouchg "$f" 2>/dev/null && n=$((n + 1))
    done < "$MANIFEST"
  else
    echo "No manifest — relying on the flag sweep." >&2
  fi

  # ALWAYS sweep by flag afterwards, whatever the manifest said. This is what
  # closes the truncated-manifest hole: correctness no longer depends on the
  # manifest being complete.
  n=$((n + $(sweep_flagged "$VAULT")))
  if [ -n "$mvault" ] && [ "$mvault" != "$VAULT" ] && [ -d "$mvault" ]; then
    echo "NOTE: manifest was written for '$mvault' — sweeping there too." >&2
    n=$((n + $(sweep_flagged "$mvault")))
  fi

  # Verify by observation before claiming success.
  local residue=0
  while IFS= read -r f; do
    [ "$(locked_flag "$f")" = yes ] && residue=$((residue + 1))
  done < <(canonical_paths)

  if [ "$residue" -gt 0 ]; then
    echo "INCOMPLETE — $residue canonical file(s) STILL immutable." >&2
    echo "  Manifest kept at $MANIFEST. Run: $0 recover" >&2
    return 1
  fi
  rm -f "$MANIFEST"
  echo "FENCE DISARMED — $n files unlocked, sentinel removed, 0 residue."
  return 0
}

# Last-resort: unlock every immutable file under the vault, manifest or not.
# Deliberately broad — this is the "I am stuck" button, and availability beats
# precision here. It names every file it touches so an unrelated immutable file
# (Sol's over-breadth note) is visible rather than silent.
# MOVED VAULT: if the manifest points elsewhere, that root is swept too; if the
# vault has moved and no manifest survives, run with FENCE_VAULT=<new path>.
cmd_recover() {
  local n=0 f mvault=""
  [ -f "$MANIFEST" ] && mvault=$(grep '^# vault=' "$MANIFEST" 2>/dev/null |
    head -1 | cut -d= -f2-)
  for root in "$VAULT" "$mvault"; do
    [ -z "$root" ] || [ ! -d "$root" ] && continue
    while IFS= read -r f; do
      chflags nouchg "$f" 2>/dev/null && { n=$((n + 1)); echo "  unlocked: $f"; }
    done < <(find "$root" -flags +uchg -type f -not -path "*/.git/*" 2>/dev/null)
  done
  rm -f "$SENTINEL" "$MANIFEST"
  echo "RECOVERED — $n files unlocked, sentinel and manifest cleared."
  [ "$n" -eq 0 ] && echo "  (nothing was locked under $VAULT — if the vault has" \
    "moved, retry with FENCE_VAULT=<new path> $0 recover)" >&2
  return 0
}

cmd_status() {
  local armed total locked f
  armed=$([ -e "$SENTINEL" ] && echo ARMED || echo disarmed)
  echo "sentinel : $armed  ($SENTINEL)"
  echo "manifest : $([ -f "$MANIFEST" ] && wc -l < "$MANIFEST" | tr -d ' ' || echo 0) entries"
  total=0; locked=0
  while IFS= read -r f; do
    total=$((total + 1))
    [ "$(locked_flag "$f")" = yes ] && locked=$((locked + 1))
  done < <(canonical_paths)
  echo "canonical: $locked of $total immutable (uchg)"
  if [ "$armed" = ARMED ] && [ "$locked" -lt "$total" ]; then
    echo "WARNING: armed but $((total - locked)) canonical file(s) NOT locked." >&2
  fi
  if [ "$armed" = disarmed ] && [ "$locked" -gt 0 ]; then
    echo "WARNING: disarmed but $locked file(s) still locked — run: $0 recover" >&2
  fi
}

case "${1:-}" in
  arm)     cmd_arm ;;
  disarm)  cmd_disarm ;;
  recover) cmd_recover ;;
  status)  cmd_status ;;
  *) echo "usage: fence.sh {arm|disarm|status|recover}" >&2; exit 2 ;;
esac
