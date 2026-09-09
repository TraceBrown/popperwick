# `popperwick-lane` — launcher, cage, settings, battery

The four files a consultant lane needs to run as its own macOS user with **read
access to the GitHub mirror only, write access to an outbox only, and no path
into the vault**. Design of record: Sol's M4 configuration,
[[.openai/2026-09-02-sol-lane-isolation]]; setup:
[[Journal/Lane Account — popperwick-lane Setup Runbook (2026-09-02)]]; the
Seatbelt lineage and its NO-GO history:
[[Journal/Kimi Lane — Seatbelt Sandbox (2026-08-13)]].

**No live run until (a) `lane-verify.sh` Section A is clean and (b) Sol has
confirmed THESE bytes.** The first review returned GO-WITH-EDITS and declared
the previous bytes NO-GO; the edits are in, so the amended files owe a
confirmation pass. A sandbox nobody attacked is a longer config file.

| File | What it is |
|---|---|
| `popperwick-lane-launch` | bash launcher. The one program the sudoers rule exposes. No arguments; commission on stdin; refreshes the mirror; runs Claude Code under Seatbelt; writes the outbox. |
| `popperwick-lane.sb` | Seatbelt profile: `(allow default)`, read wall over `/Users` and the shared temp trees, late write floor, ancestor-immutability denies. Parameters `RUN_ROOT`, `OUTBOX`, `HOME_DIR`, `UID_TMP`, `UID_TMP_PRIVATE`. |
| `settings-lane.json` | Claude Code settings: tool permissions plus the Kimi endpoint and model id. |
| `lane-verify.sh` | Phase 4 battery. Section A (user, privileged) and Section B (conductor, unprivileged). |

## Install (runbook Phase 3 — the user runs these)

```bash
sudo install -o root -g wheel -m 755 -d /usr/local/libexec /usr/local/etc/popperwick
sudo install -o root -g wheel -m 755 ~/Claude/.claude/scripts/lane/popperwick-lane-launch /usr/local/libexec/popperwick-lane-launch
sudo install -o root -g wheel -m 644 ~/Claude/.claude/scripts/lane/popperwick-lane.sb    /usr/local/etc/popperwick/popperwick-lane.sb
sudo install -o root -g wheel -m 644 ~/Claude/.claude/scripts/lane/settings-lane.json   /usr/local/etc/popperwick/settings-lane.json
```

Then the single sudoers line (`sudo visudo -f /etc/sudoers.d/popperwick-lane`):

```
OWNER ALL=(popperwick-lane) NOPASSWD:NOSETENV: /usr/local/libexec/popperwick-lane-launch ""
```

The trailing `""` is the sudoers **empty-argument sentinel**: the rule authorises
that program only when it is invoked with no arguments at all. The launcher
refuses arguments as well; this is the belt to that suspenders.

## Daily use

```bash
printf '%s' "$commission" | sudo -n -u popperwick-lane /usr/local/libexec/popperwick-lane-launch
```

Output lands in `/Users/popperwick-lane/lane/outbox/<UTC-ts>-<6 hex>/`:

```
result.md      the model's stdout          } written by the LAUNCHER, outside
stderr.txt     launcher notes + harness    } the sandbox, into a directory the
meta.json      the run's identity          } agent cannot write at all
commission.md  a copy of what was asked    }
files/         <- everything the agent writes goes here, and only here
```

**Directory split (Sol's first finding, 2026-09-02).** The agent's writable
areas are exactly `<outbox>/files`, `<run>/tmp` and `<run>/claude-config`. If it
could write the outbox run directory itself, it could replace `result.md` with a
symlink or a FIFO and the unsandboxed launcher would write through it — outside
the cage — or block forever on `open()`. That is a confused deputy, and the
split is what closes it. `lane-verify.sh` A2.15–A2.23 attacks it directly.

Everything in the outbox is **untrusted data**, same as any consult archive.
`meta.json` carries the run's identity: commission sha256, mirror HEAD, profile
and settings sha256, the resolved binary and version, the flags used, exit code,
`elapsed_s`, and `timed_out`.

## Verification

```bash
.claude/scripts/lane/lane-verify.sh --section b     # conductor, no privileges
.claude/scripts/lane/lane-verify.sh --section a     # user; sudo (A1/A2/A4 prompt)
```

A1 and A4 use plain `sudo -u` deliberately: the narrow sudoers rule authorises
the launcher only, so `sudo -n /bin/cat` would fail for lack of authorisation
and that failure would be indistinguishable from the denial being tested. A1
also traps exit 127 — `/usr/bin/cat` does not exist on macOS (it is `/bin/cat`),
and the runbook's Phase 4 line should be corrected to match.

## Constants and behaviour worth knowing

- `ANTHROPIC_BASE_URL = https://api.kimi.com/coding`, `ANTHROPIC_MODEL = k3`,
  read out of `~/.local/bin/kimi-do`. The launcher exports
  `ANTHROPIC_AUTH_TOKEN` from `~/.credentials/model.token` before entering the
  sandbox; the credentials directory is denied inside it. If the first live run
  fails with an auth error rather than a sandbox denial, try the same value as
  `ANTHROPIC_API_KEY`.
- **Flags are mandatory, with no capability detection:**
  `--bare --safe-mode --disable-slash-commands --permission-prompts none
  --settings <path> --strict-mcp-config --tools Read,Grep,Glob,Write,Edit -p`.
  A build that rejects one fails the run. All four were exercised against the
  real 2.1.259 binary during the build.
- **The commission arrives on stdin**, never in argv (`ps` is world-readable).
- **The mirror refresh is fatal on any doubt:** fetch+`reset --hard`+`clean -ffdx`,
  then `HEAD` must equal `refs/remotes/origin/main` and
  `git status --porcelain --untracked-files=all` must be empty. A run whose
  provenance cannot be stated does not happen.
- **`/tmp/claude-<uid>`:** Claude Code insists on a per-UID session directory at
  that fixed path and dies `EPERM ... mkdir` without it; `TMPDIR` does not
  redirect it. The launcher pre-creates it 700, refuses if it is a symlink, not
  a directory, or has the wrong owner/mode (squat protection on world-writable
  `/tmp`), and **empties it before every run** (`find … -mindepth 1 -delete`) so
  no file and no unix socket survives from a previous run. The profile re-allows
  exactly that subpath plus a read of the `/tmp` symlink itself — `ls
  /private/tmp` and every sibling entry stay denied. These are Sol's conditions
  for taking the allowance beyond a single attended run.
- **One run at a time.** The launcher takes an atomic `mkdir` lock at
  `~popperwick-lane/scratch/.lock` (holder RUN_ID and pid recorded inside) and
  releases it from its EXIT trap. A second concurrent run dies with exit 75
  rather than emptying the session directory under a live one. A lock left by a
  crashed run is cleared by hand on purpose — the error message says so.
- **Validate before mutate.** `~/scratch`, `~/scratch/runs` and an existing
  mirror are proven to be real, canonical directories before anything chmods
  them or lets `git reset --hard`/`clean -ffdx` act on them; a symlink at any of
  those names is fatal, not followed.
- **Watchdog:** 3600 s, then `SIGTERM` to the agent's whole process group, then
  `SIGKILL` 15 s later. `timed_out` in `meta.json` comes from a marker file the
  watchdog writes into the run root — a directory the agent cannot write — never
  from an exit code the agent could produce.
- **GitHub auth** goes through a per-run `GIT_ASKPASS` helper that `cat`s
  `~/.credentials/github.token`; username defaults to `x-access-token`, or put
  one in `~/.credentials/github.user` (600).

## Known-uncertain: path-scoped permission rules

`settings-lane.json` allows `Edit(//Users/popperwick-lane/lane/outbox/**)`. The
`Write(...)` twin was removed on Sol's finding that 2.1.259 reports it
unmatched. **This cannot be verified offline** — it needs a real model turn. If
A3 reports `files/probe.md MISSING`, the battery prints the diagnosis order:
`stderr.txt` first (an auth failure is not a permission failure), then a bare
`Edit`, then `--permission-mode acceptEdits`. Both fallbacks stay safe because
**the kernel, not the settings file, confines writes to `<outbox>/files` and the
run scratch.**

## Residuals, stated

- `ANTHROPIC_AUTH_TOKEN` is in the agent's environment by necessity; the UID
  split is the mitigation (a process environment is not readable across UIDs on
  macOS). It is deliberately not passed via `env -i NAME=value`, which would put
  it in argv.
- The agent can READ its run root (its commission copy, its own transcripts) but
  can no longer write anything there outside `tmp/` and `claude-config/`.
  `meta.json`'s `commission_sha256` remains as tamper evidence (check B1.3).
- `mach-lookup` stays broad under `(allow default)`; only the pasteboard is
  denied by name. Network egress is fully open (the model endpoint); the
  2026-08-13 narrowing sits in the profile as a commented, NOT-ACTIVE block.
- The lane's Claude Code install must resolve, through every symlink, to
  somewhere under `/Users/popperwick-lane/.local`; the launcher dies otherwise.

## popperwick-lane-queue (added 2026-09-09, DRAFT — Sol review pending, not installed)

The second and only other program the conductor may run as the lane user. Queues ONE message into ONE existing Codex Desktop conversation of the lane account by wrapping `codex queue` (codex-cli 0.153.x), whose per-account queue the running app drains at the conversation's next turn (proven 2026-09-09, `Journal/Codex Queue Probe (2026-09-09).md`). Same shape as the launcher: sudoers `""` sentinel, no arguments, input on stdin (`THREAD: <name-or-uuid>`, blank line, body), lane-user-only, scrubbed environment, single-run lock, and a hashes-only log at `~popperwick-lane/lane-queue/queue.log`. It resolves the thread against the lane's own `session_index.jsonl` (unknown or duplicated names refused — it never creates conversations), validates the body (UTF-8, no control characters, ≤ 8000 bytes), prepends the CLAUDE.md inter-session ORIGIN TAG and a provenance line, and refuses more than 30 messages per rolling hour. Conductor-side helper: `lane-queue "<thread>" "<body>"` (copy to `~/.local/bin`). Install and acceptance steps: `INSTALL-lane-queue.md`. What crosses is an inter-session turn — untrusted data, never authority.
