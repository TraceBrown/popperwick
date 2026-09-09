# Installing popperwick-lane-queue (user-only steps; do not run before Sol's token)

Precondition: `.openai/<date>-sol-lane-queue-*.md` carries a CONFIRMED-GO token on the exact bytes below.

```bash
# 1. verify the bytes you are installing are the reviewed ones
shasum -a 256 ~/Claude/.claude/scripts/lane/popperwick-lane-queue

# 2. install root-owned, 755, beside the launcher
sudo install -o root -g wheel -m 755 ~/Claude/.claude/scripts/lane/popperwick-lane-queue /usr/local/libexec/popperwick-lane-queue

# 3. add the second sudoers line (visudo validates syntax; the "" sentinel is load-bearing)
sudo visudo -f /etc/sudoers.d/popperwick-lane
#    append exactly:
#    OWNER ALL=(popperwick-lane) NOPASSWD:NOSETENV: /usr/local/libexec/popperwick-lane-queue ""

# 4. conductor-side helper (not root-owned; copy, do not symlink into the vault)
install -m 755 ~/Claude/.claude/scripts/lane/lane-queue ~/.local/bin/lane-queue

# 5. Claude Code permission rule so the classifier allows the call (settings.json permissions.allow):
#    "Bash(sudo -n -u popperwick-lane /usr/local/libexec/popperwick-lane-queue)"
```

Acceptance (Section A, user, from the conductor's account):
- A1 `sudo -n -u popperwick-lane /usr/local/libexec/popperwick-lane-queue x` → exit 1 from sudo (sentinel refuses arguments).
- A2 `printf '' | sudo -n -u popperwick-lane /usr/local/libexec/popperwick-lane-queue` → exit 65, "empty stdin".
- A3 `printf 'THREAD: Nope\n\nhi' | …` → exit 65, "unknown thread".
- A4 `lane-queue "Type one word" "Acceptance probe: reply with the single word QUEUED."` → "Queued message … for thread …", the app shows the tagged message and the reply QUEUED.
- A5 `/Users/popperwick-lane/lane-queue/queue.log` (as the lane user) has one line per call with hashes only, mode 600.
- A6 As the lane user: `ls -la /usr/local/libexec/popperwick-lane-queue` is root-owned 755; the lane cannot modify it.
