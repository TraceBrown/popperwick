# Installing popperwick-lane-queue (user-only steps; do not run before Sol's round-2 token)

Precondition: `.openai/<date>-sol-lane-queue-*.md` carries a CONFIRMED-GO token on the exact wrapper bytes (compare the sha256 printed in step 1 with the token).

```bash
# 0. the wrapper's self-test passes on the bytes you are about to install
~/Claude/.claude/scripts/lane/popperwick-lane-queue --self-test | tail -1     # SELF-TEST PASS
shasum -a 256 ~/Claude/.claude/scripts/lane/popperwick-lane-queue

# 1. a ROOT-OWNED copy of the app-bundled codex, digest-verified (Sol F1). The wrapper pins
#    a30ec314bbd0e3721632234d07db7c99855db3b9f1e32dbe8c791947f07e7629 = codex-cli 0.153.4,
#    notarized Developer ID "OpenAI OpCo, LLC (2DC432GLL2)" (verified 2026-09-09).
shasum -a 256 /Applications/ChatGPT.app/Contents/Resources/codex        # must print a30ec314…
sudo install -o root -g wheel -m 755 /Applications/ChatGPT.app/Contents/Resources/codex /usr/local/libexec/popperwick-codex-0.153.4
shasum -a 256 /usr/local/libexec/popperwick-codex-0.153.4                # same digest
stat -f '%Su:%Sg %Sp %l' /usr/local/libexec/popperwick-codex-0.153.4    # root:wheel -rwxr-xr-x 1
#    the parent chain must be root-owned and not group/world-writable, with no write ACL (Sol round 2, item 7):
ls -lde /usr/local /usr/local/libexec                                     # root:wheel drwxr-xr-x, no ACL entries

# 2. the wrapper, root-owned, beside the launcher
sudo install -o root -g wheel -m 755 ~/Claude/.claude/scripts/lane/popperwick-lane-queue /usr/local/libexec/popperwick-lane-queue

# 3. the second sudoers line (visudo validates; the "" sentinel is load-bearing)
sudo visudo -f /etc/sudoers.d/popperwick-lane
#    append exactly:
#    OWNER ALL=(popperwick-lane) NOPASSWD:NOSETENV: /usr/local/libexec/popperwick-lane-queue ""
sudo visudo -cf /etc/sudoers.d/popperwick-lane

# 4. conductor-side helper (not root-owned; copy, never symlink into the vault)
install -m 755 ~/Claude/.claude/scripts/lane/lane-queue ~/.local/bin/lane-queue

# 5. Claude Code permission rule so the classifier allows the call (settings.json permissions.allow):
#    "Bash(sudo -n -u popperwick-lane /usr/local/libexec/popperwick-lane-queue)"
```

When the Codex app updates itself, the pinned copy stays at 0.153.4 and keeps working against the newer app only if the queue database format is unchanged; a version bump means a new copy, a new digest in the wrapper, re-review, and re-install.

## Acceptance suite (Sol's replacement list, adapted; run before first real use)

From the conductor's account unless stated:
1. Hashes and ownership: wrapper and codex copy sha256 match the token and the pin; both `root:wheel`, mode 755, one link, canonical paths; `codesign --verify --strict` passes on the copy.
2. `sudo visudo -cf /etc/sudoers.d/popperwick-lane` OK; `sudo -ll` shows exactly the two lines; `sudo -n -u popperwick-lane /usr/local/libexec/popperwick-lane-queue x` and `… -E …` are refused by sudo.
3. Python hijack: with a malicious `re.py`, `json.py`, `sitecustomize.py` in the caller's cwd and `PYTHONPATH` set, a call still behaves identically (the wrapper `cd /` and runs `-I -S`).
4. Input battery (the self-test covers the parser; repeat three by hand through sudo): empty stdin → 65; free text → 65; a pointer followed by an extra blank line → 65; unknown thread → 65.
5. `ps` while a call runs: argv shows only the fixed tag, the provenance line, the pointer path and the footer — never file content.
6. Same-UID attacks in a SACRIFICIAL lane home (never the live `.codex`): symlink, FIFO, hard link, directory swap and oversized file for the index, lock, log and pointer target → each refused with 69/75.
7. Kill the wrapper before, during and after the codex call: the attempt record exists in every case; the lock is released or reported stale; no second process's lock is removed.
8. Malformed log lines and a record dated +30 s in the future → the call refuses (69), never hangs.
9. Attempts 1–10 in an hour admitted, the 11th refused (75).
10. Child environment (observe with a stub if needed): only HOME, PATH, USER, LOGNAME, CODEX_HOME, CODEX_SQLITE_HOME, TMPDIR, LANG, LC_ALL.
11. End to end: `lane-queue "Type one word" /Users/Shared/model-process-review/README.md` → the app shows the tagged pointer (header, the shasum instruction with the digest, footer) and the thread verifies the digest before reading.
12. `/Users/popperwick-lane/lane-queue/queue.log` (as the lane user): mode 600, one attempt and one result record per call, full hashes and UUIDs, no message text.
13. From a lane Codex thread: try to run the wrapper directly and to write into `~/lane-queue` and `~/.codex` — the OS sandbox, not UID ownership, must deny it. If it does not, record that the rate state is not tamper-resistant against the lane's own threads (residual risk) before proceeding.
14. Through the real sudo rule, set hostile `BASH_ENV`, exported shell functions, `SHELLOPTS`, `CDPATH`, `PYTHONPATH`/`PYTHONHOME` and `DYLD_*`: none may execute or change behaviour (`bash -p` plus `python3 -I -S`).
15. Pointer attacks: an intermediate symlink under /Users/Shared to a lane-private directory, a lane-owned target, a hard-linked target, a file over 1 MB, a same-size mutation during hashing, and a replacement AFTER queueing — the first five refused (65); for the last, the receiving thread must refuse on digest mismatch.
16. Log attacks: invalid UTF-8, an invalid date such as February 31, a malformed UUID, a blank record, a missing final newline, a partial record, and an existing log with mode 0644 — each refused (69), none hangs.
17. Diagnostics carry no lane UUID on success or on an ambiguous name; a stub codex producing multi-gigabyte output leaves the wrapper's memory constant (output goes to /dev/null).
18. Hold stdin open without EOF: the wrapper times out at 15 s (75).
19. Ownership, modes, ACLs and flags on `/usr/local`, `/usr/local/libexec`, the codex copy and the wrapper — the whole chain root-owned and non-writable, not only the leaf files.
20. **Deployment gate, not a residual:** queue a deliberately hostile packet that asks the receiving thread to read `~/.codex`, `~/lane-queue` and another lane-private file and to write the result under /Users/Shared. Every read and write must be denied by the OS sandbox. If this or test 13 fails, the installation is NO-GO.

Self-test limits (documented per Sol): `--self-test` does not drive the real child environment or the queue call, and it refuses to run as root (the stub would be root-owned and the ownership assertion would misfire).
