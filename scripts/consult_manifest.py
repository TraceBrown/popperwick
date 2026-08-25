#!/usr/bin/env python3
"""consult_manifest.py — Phase 0 of the Buzz adjudication (user-ratified 2026-08-25).

Hash-chained, append-only provenance manifest for consultant archives.
In-doctrine baseline (rows in git, no daemon, no network): each archive file
gets a row carrying its sha256, the REQUESTED route and the REPORTED model
header as SEPARATE fields (Sol's route-vs-model discipline — a signature or
stamp proves what the pipeline labeled, not which model generated), an
optional commission-packet hash, and the sha256 of the previous manifest
line (tamper-evident chain; git history is the second witness).

Usage:
  consult_manifest.py add <archive-file> --route <requested> [--packet <file>] [--note ...]
  consult_manifest.py backfill        # one-time: rows for all existing archives
  consult_manifest.py verify          # recompute chain + file hashes
"""
import argparse, hashlib, json, os, re, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

VAULT = Path("/Users/OWNER/Claude")
MANIFEST = VAULT / "CONSULT-MANIFEST.jsonl"

def sha(b: bytes) -> str: return hashlib.sha256(b).hexdigest()
def fsha(p: Path) -> str: return sha(p.read_bytes())

STAMPS = [
    (re.compile(r"\[gpt-do: model=([\w.\-]+)"), "gpt-do"),
    (re.compile(r"kimi-do: served=([\w.\-]+)"), "kimi-do"),
    (re.compile(r"\[or-do: model=([\w/\-\.]+)"), "or-do"),
]

def reported_model(text: str):
    for rx, _ in STAMPS:
        m = rx.search(text)
        if m: return m.group(1)
    return None

def last_line_sha():
    if not MANIFEST.exists() or MANIFEST.stat().st_size == 0:
        return "GENESIS"
    return sha(MANIFEST.read_bytes().splitlines()[-1])

def next_seq():
    if not MANIFEST.exists() or MANIFEST.stat().st_size == 0: return 0
    return json.loads(MANIFEST.read_bytes().splitlines()[-1])["seq"] + 1

def append_row(file: Path, route: str, packet: Path | None, note: str):
    rel = str(file.relative_to(VAULT))
    text = file.read_text(errors="ignore")
    row = {
        "seq": next_seq(),
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "file": rel,
        "file_sha256": fsha(file),
        "requested_route": route,
        "reported_model": reported_model(text),
        "packet_file": str(packet.relative_to(VAULT)) if packet else None,
        "packet_sha256": fsha(packet) if packet else None,
        "note": note,
        "prev_sha256": last_line_sha(),
    }
    with open(MANIFEST, "a") as f:
        f.write(json.dumps(row, separators=(",", ":")) + "\n")
    return row

def git_date(p: Path) -> str:
    # mtime-based (git log --follow per file was prohibitively slow on this repo)
    return datetime.fromtimestamp(p.stat().st_mtime).strftime("%Y-%m-%d")

def backfill():
    files = sorted(list((VAULT / ".openai").glob("*.md")) +
                   list((VAULT / ".kimi").glob("*.md")),
                   key=lambda p: (git_date(p), p.name))
    added = 0
    existing = set()
    if MANIFEST.exists():
        existing = {json.loads(l)["file"] for l in MANIFEST.read_text().splitlines()}
    for p in files:
        if p.name == "README.md" or str(p.relative_to(VAULT)) in existing:
            continue
        folder = p.parent.name
        route = ("gpt-do(tier=sol,inferred-from-filename)" if folder == ".openai" and "sol" in p.name.lower()
                 else "gpt-do(tier=legacy-unknown)" if folder == ".openai"
                 else "kimi-do")
        rep = reported_model(p.read_text(errors="ignore"))
        note = f"BACKFILL legacy archive (first git date {git_date(p)})"
        if rep is None:
            note += "; NO MODEL STAMP — attribution rests on prose only (UNVERIFIED-LEGACY)"
        if "stupid-ideas" in p.name and folder == ".openai":
            note += "; KNOWN DIVERGENCE: prose attests gpt-5.6-terra answered while the wrapper stamp reads model=gpt-5.6-sol — the 2026-08-24 review's provenance hole, recorded here honestly"
        append_row(p, route, None, note)
        added += 1
    print(f"backfilled {added} rows")

def verify():
    if not MANIFEST.exists():
        sys.exit("no manifest")
    lines = MANIFEST.read_bytes().splitlines()
    prev = "GENESIS"
    bad = 0
    for i, ln in enumerate(lines):
        row = json.loads(ln)
        if row["prev_sha256"] != prev:
            print(f"CHAIN BREAK at seq {row['seq']}"); bad += 1
        prev = sha(ln)
        p = VAULT / row["file"]
        if not p.exists():
            print(f"MISSING FILE seq {row['seq']}: {row['file']}"); bad += 1
        elif fsha(p) != row["file_sha256"]:
            print(f"HASH MISMATCH seq {row['seq']}: {row['file']}"); bad += 1
        if row.get("packet_file"):
            q = VAULT / row["packet_file"]
            if not q.exists() or fsha(q) != row["packet_sha256"]:
                print(f"PACKET PROBLEM seq {row['seq']}"); bad += 1
    print(f"verified {len(lines)} rows: {'ALL GOOD' if bad == 0 else f'{bad} PROBLEMS'}")
    sys.exit(0 if bad == 0 else 1)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("add"); a.add_argument("file"); a.add_argument("--route", required=True)
    a.add_argument("--packet"); a.add_argument("--note", default="")
    sub.add_parser("backfill"); sub.add_parser("verify")
    args = ap.parse_args()
    if args.cmd == "add":
        row = append_row(Path(args.file).resolve(), args.route,
                         Path(args.packet).resolve() if args.packet else None, args.note)
        print(json.dumps(row, indent=1))
    elif args.cmd == "backfill":
        backfill()
    else:
        verify()
