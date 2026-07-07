#!/bin/bash
# papers_digest.sh — on-demand "noteworthy arXiv quant-finance" digest.
#
# Triggered by the Telegram bot's /papers command (never scheduled). Steps:
#   1. ONE polite anonymous call to the arXiv API for the newest q-fin.TR /
#      q-fin.ST submissions (export.arxiv.org, sorted by submittedDate desc).
#   2. Parse the Atom feed (embedded python3 heredoc, stdlib only) into per-entry
#      title + arXiv id + published date + abstract, keeping only entries
#      published within the last DAYS_BACK days.
#   3. GLM triages for NOTEWORTHY items only (falsification/OOS studies, index-
#      futures work, minutes-to-hours microstructure, cost studies, honest regime
#      detection). Output labeled UNVERIFIED and abstract-only.
#   4. Writes dashboard-papers/digest.md -> rendered as a dashboard card.
#   5. Publishes the same summary to the Telegram on-demand topic.
#   6. Re-renders the dashboard so the card is fresh immediately.
#
# Fail-open everywhere: a failed fetch/parse/triage writes an honest note and the
# script still re-renders the dashboard. Nothing here can take the bot or the
# pipeline down. glm-do runs from a neutral mktemp cwd (F5 rule).

set -u
VAULT="/Users/OWNER/Claude"
SCRIPTS="$VAULT/.claude/scripts"
OUTDIR="$SCRIPTS/dashboard-papers"
TELEGRAM_HELPER="$SCRIPTS/idle_research_telegram.py"
LOG="$SCRIPTS/idle-research.log"
MAXBYTES=60000
DAYS_BACK=7
API='https://export.arxiv.org/api/query?search_query=cat:q-fin.TR+OR+cat:q-fin.ST&sortBy=submittedDate&sortOrder=descending&max_results=40'

mkdir -p "$OUTDIR"
TS="$(date '+%Y-%m-%d %H:%M %Z')"
WORKDIR="$(mktemp -d)"   # neutral cwd for glm-do (F5 rule)
trap 'rm -rf "$WORKDIR"' EXIT
out="$OUTDIR/digest.md"

log() { printf '%s | papers-watch %s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')" "$1" >>"$LOG" 2>/dev/null || true; }

PROMPT='You are filtering new arXiv quant-finance papers for an evidence-based retail MES/MNQ futures daytrader who treats every claimed edge as unproven until it survives out-of-sample tests net of transaction costs.
NOTEWORTHY (keep only these):
- falsification, replication, or out-of-sample studies of trading signals (any market)
- intraday or daily equity-index futures work (E-mini, ES/NQ, index futures)
- microstructure findings at minutes-to-hours horizons (NOT sub-second HFT)
- papers quantifying transaction costs / friction for small traders
- order-flow, volume, or auction-based signal studies WITH stated costs or out-of-sample tests
- regime detection with honest out-of-sample methodology
HARD SKIPS: crypto/DeFi-only papers; option-pricing or derivatives-math theory with no trading test; portfolio optimization / asset-allocation theory; pure HFT infrastructure (sub-second latency, market-making inventory control); ML papers reporting only in-sample or gross returns; macro or asset-pricing theory with no tradeable claim.
FORMAT: max 10 items. Each item: paper title, arXiv id exactly as given in the input (NEVER invent ids or URLs), one sentence on why it matters for this reader, and any skepticism flag visible in the abstract itself (gross-only results, in-sample only, survivorship or curve-fit tells). Everything you write is UNVERIFIED and abstract-only — say so in a header line. If nothing qualifies, write exactly: "Quiet week — nothing above the bar." and stop.
You have no tools: never offer to retry, fetch, or follow up.'

# 1. ONE polite API call to a file (fail-open on empty).
curl -sSL -A 'idle-research-papers/1.0' --max-time 60 "$API" >"$WORKDIR/feed.xml" 2>>"$WORKDIR/curl.err"

if [ ! -s "$WORKDIR/feed.xml" ]; then
  printf '## Papers watch — arXiv quant-finance\n_%s — fetch FAILED (arXiv API returned nothing); try again later._\n' \
    "$TS" >"$out"
  log "FAILED fetch"
else
  # 2. Parse the Atom feed -> per-entry text, last DAYS_BACK days only.
  # NB: python3 - reads its PROGRAM from the heredoc, so the feed is read from a
  # file (FEED) rather than stdin (stdin is the program here, not the data).
  entries="$(FEED="$WORKDIR/feed.xml" DAYS_BACK="$DAYS_BACK" /usr/bin/python3 - <<'PYEOF' 2>>"$WORKDIR/parse.err"
import os
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

days = int(os.environ.get("DAYS_BACK", "7"))
cutoff = datetime.utcnow() - timedelta(days=days)
NS = {"a": "http://www.w3.org/2005/Atom"}


def clean(t):
    return " ".join((t or "").split())


try:
    with open(os.environ["FEED"], "r", encoding="utf-8", errors="replace") as f:
        root = ET.fromstring(f.read())
except Exception:
    sys.exit(0)   # unreadable/unparseable -> emit nothing; caller treats as empty

out = []
for e in root.findall("a:entry", NS):
    try:
        title = clean(e.findtext("a:title", default="", namespaces=NS))
        idurl = clean(e.findtext("a:id", default="", namespaces=NS))
        pub = clean(e.findtext("a:published", default="", namespaces=NS))
        summ = clean(e.findtext("a:summary", default="", namespaces=NS))
        # arXiv id = last path segment of the abs URL, e.g. 2501.12345v1
        aid = idurl.rstrip("/").split("/")[-1] if idurl else ""
        try:
            pdate = datetime.strptime(pub[:19], "%Y-%m-%dT%H:%M:%S")
        except Exception:
            pdate = None
        if pdate is not None and pdate < cutoff:
            continue
        if not title or not aid:
            continue
        out.append(
            "Title: %s\narXiv:%s  (https://arxiv.org/abs/%s)\nPublished: %s\n"
            "Abstract: %s\n" % (title, aid, aid, pub[:10], summ))
    except Exception:
        continue

sys.stdout.write("\n".join(out))
PYEOF
)"
  entries="$(printf '%s' "$entries" | head -c "$MAXBYTES")"

  if [ -z "$entries" ]; then
    printf '## Papers watch — arXiv quant-finance\n_%s — no q-fin.TR/q-fin.ST submissions in the last %d days (or parse failed); try again later._\n' \
      "$TS" "$DAYS_BACK" >"$out"
    log "no entries in ${DAYS_BACK}d window"
  else
    # 3. GLM triage from a neutral cwd (F5 rule).
    summary="$(cd "$WORKDIR" && printf '%s' "$entries" | glm-do "$PROMPT" 2>/dev/null)"
    if [ -z "$summary" ]; then
      printf '## Papers watch — arXiv quant-finance\n_%s — GLM triage failed; raw fetch was OK._\n' \
        "$TS" >"$out"
      log "FAILED glm"
    else
      # 4. Write the digest (UNVERIFIED, abstract-only label).
      {
        printf '## Papers watch — arXiv quant-finance\n'
        printf '_Summarized %s · last %d days · UNVERIFIED GLM triage (abstract-only) · refresh: /papers_\n\n' "$TS" "$DAYS_BACK"
        printf '%s\n' "$summary"
      } >"$out"
      log "ok bytes=$(wc -c <"$out" | tr -d ' ')"
      # 5. Publish to the Telegram on-demand topic (fail-open).
      python3 "$TELEGRAM_HELPER" publish-ondemand "$out" >/dev/null 2>&1 || true
    fi
  fi
fi

# 6. Re-render the dashboard so the card is fresh immediately (fail-open).
/usr/bin/python3 "$SCRIPTS/dashboard_gen.py" >/dev/null 2>&1 || true
exit 0
