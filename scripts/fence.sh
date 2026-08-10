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
    [ -f "$p" ] && printf '%s\n' "$p"
  done
}

locked_flag() { ls -lO "$1" 2>/dev/null | grep -q uchg && echo yes || echo no; }

cmd_arm() {
  if [ -e "$SENTINEL" ]; then
    echo "ALREADY ARMED (sentinel exists). Run 'fence.sh status'." >&2
    return 1
  fi
  mkdir -p "$STATE_DIR" "$(dirname "$SENTINEL")" || return 1

  # Lock first, sentinel last: if locking fails we have not announced an armed
  # fence that isn't actually enforcing. Record each success immediately, so a
  # partial run still leaves an exact, unlockable manifest.
  : > "$MANIFEST"
  local n=0 f
  while IFS= read -r f; do
    if chflags uchg "$f" 2>/dev/null; then
      printf '%s\n' "$f" >> "$MANIFEST"
      n=$((n + 1))
    else
      echo "WARN: could not lock $f" >&2
    fi
  done < <(canonical_paths)

  touch "$SENTINEL"
  echo "FENCE ARMED — $n canonical files immutable (chflags uchg); sentinel set."
  echo "Manifest: $MANIFEST"
  echo "Disarm with: $VAULT/.claude/scripts/fence.sh disarm"
}

cmd_disarm() {
  local n=0 f miss=0
  # Sentinel first: tier 1 stops denying immediately, so a failed unlock below
  # cannot strand a session that is otherwise fine.
  rm -f "$SENTINEL"
  if [ -f "$MANIFEST" ]; then
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      if chflags nouchg "$f" 2>/dev/null; then
        n=$((n + 1))
      else
        echo "WARN: could not unlock $f" >&2
        miss=$((miss + 1))
      fi
    done < "$MANIFEST"
    # If any manifest entry failed to unlock (corrupt/stale lines), fall back
    # to the flag-based sweep BEFORE discarding the manifest — otherwise
    # stragglers stay locked until the user happens to run `status` (Kimi).
    if [ "$miss" -gt 0 ]; then
      echo "  $miss entr(ies) failed — sweeping by flag as well." >&2
      while IFS= read -r f; do
        chflags nouchg "$f" 2>/dev/null && n=$((n + 1))
      done < <(find "$VAULT" -flags +uchg -type f -not -path "*/.git/*" 2>/dev/null)
      miss=0
    fi
    rm -f "$MANIFEST"
  else
    echo "No manifest found — sweeping the vault for stragglers instead." >&2
    while IFS= read -r f; do
      chflags nouchg "$f" 2>/dev/null && n=$((n + 1))
    done < <(find "$VAULT" -flags +uchg -type f -not -path "*/.git/*" 2>/dev/null)
  fi
  echo "FENCE DISARMED — $n files unlocked, sentinel removed."
  [ "$miss" -gt 0 ] && echo "  ($miss failed — run: $0 recover)" >&2
  return 0
}

# Last-resort: unlock every immutable file in the vault, manifest or not.
cmd_recover() {
  local n=0 f
  while IFS= read -r f; do
    chflags nouchg "$f" 2>/dev/null && { n=$((n + 1)); echo "  unlocked: $f"; }
  done < <(find "$VAULT" -flags +uchg -type f -not -path "*/.git/*" 2>/dev/null)
  rm -f "$SENTINEL" "$MANIFEST"
  echo "RECOVERED — $n files unlocked, sentinel and manifest cleared."
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
