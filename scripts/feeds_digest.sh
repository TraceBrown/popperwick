#!/bin/bash
# feeds_digest.sh — on-demand "noteworthy research feeds" digest.
#
# Triggered by the Telegram bot's /feeds command (never scheduled). Sibling of
# papers_digest.sh, but sweeps FIVE verified RSS/Atom feeds instead of one API.
# Steps:
#   1. Polite sequential fetch of five feeds (5 requests, 2s apart), each to its
#      own file. Sources: NY Fed Liberty Street Economics, Fed Board FEDS Notes,
#      FRBSF, BIS working papers, Journal of Futures Markets table of contents.
#   2. Parse each feed (embedded python3 heredoc, stdlib only) — handles BOTH
#      RSS <item> and Atom <entry>; extracts title/link/date/summary, strips
#      tags, collapses whitespace, tags each item with its source name, and
#      keeps only items published within the last DAYS_BACK days (undated items,
#      e.g. the JFM ToC feed, are kept). All items concatenated, byte-capped.
#   3. GLM triages for NOTEWORTHY items only (falsification/OOS strategy studies,
#      futures microstructure/execution costs, index/E-mini work, liquidity-
#      plumbing with equity-vol implications, retail-trader outcomes). Output
#      labeled UNVERIFIED and summary-level.
#   4. Writes dashboard-feeds/digest.md -> rendered as a dashboard card.
#   5. Publishes the same summary to the Telegram on-demand topic.
#   6. Re-renders the dashboard so the card is fresh immediately.
#
# Fail-open everywhere: a failed fetch/parse/triage writes an honest note and the
# script still re-renders the dashboard. Nothing here can take the bot or the
# pipeline down. glm-do runs from a neutral mktemp cwd (F5 rule).
#
# Politeness: exactly FIVE outbound GETs per invocation, spaced 2s apart, and the
# command is meant for roughly once-daily use — well inside any feed's fair-use.

set -u
VAULT="/Users/OWNER/Claude"
SCRIPTS="$VAULT/.claude/scripts"
OUTDIR="$SCRIPTS/dashboard-feeds"
TELEGRAM_HELPER="$SCRIPTS/idle_research_telegram.py"
LOG="$SCRIPTS/idle-research.log"
MAXBYTES=60000
DAYS_BACK=10

# name|url|label  — name is the safe WORKDIR filename stem; label is the human
# source tag handed to the parser and shown to GLM. All five verified by hand.
FEEDS=(
  "libertystreet|https://libertystreeteconomics.newyorkfed.org/feed/|NY Fed Liberty Street"
  "fedsnotes|https://www.federalreserve.gov/feeds/feds_notes.xml|Fed Board FEDS Notes"
  "frbsf|https://www.frbsf.org/feed/|FRBSF"
  "bis|https://www.bis.org/doclist/wppubls.rss|BIS working papers"
  "jfm|https://onlinelibrary.wiley.com/feed/10969934/most-recent|Journal of Futures Markets"
)

mkdir -p "$OUTDIR"
TS="$(date '+%Y-%m-%d %H:%M %Z')"
WORKDIR="$(mktemp -d)"   # neutral cwd for glm-do (F5 rule)
trap 'rm -rf "$WORKDIR"' EXIT
out="$OUTDIR/digest.md"

log() { printf '%s | feeds-watch %s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')" "$1" >>"$LOG" 2>/dev/null || true; }

PROMPT='You are filtering new research-feed items for an evidence-based retail MES/MNQ futures daytrader. Sources: NY Fed Liberty Street Economics, Fed Board FEDS Notes, FRBSF, BIS working papers, Journal of Futures Markets table of contents.
NOTEWORTHY (keep only these): falsification or out-of-sample studies of trading strategies; futures-market microstructure or execution-cost findings; equity-index or E-mini specific work; liquidity-plumbing analysis with direct equity-volatility implications such as repo stress, dealer capacity, or basis-trade unwinds; retail-trader outcome studies.
HARD SKIPS: bank-regulation minutiae; DSGE or macro theory without a market claim; EM or FX-only work; climate or crypto-only; payments and CBDC; labor-market commentary.
FORMAT: max 8 items. Each item: source name, title, link exactly as given in the input (NEVER invent links), one sentence on why it matters for this reader, and any visible caveat (abstract-only, gross returns, no costs). Header line: everything is UNVERIFIED and summary-level. If nothing qualifies, write exactly: "Quiet period — nothing above the bar." and stop.
You have no tools: never offer to retry, fetch, or follow up.'

# 1+2. Fetch each feed to its own file (fail-open per feed) and parse it. The -L
# matters: several of these 301 to a canonical host. 45s cap, 2s between fetches.
entries=""
i=0
for spec in "${FEEDS[@]}"; do
  i=$((i + 1))
  name="${spec%%|*}"
  rest="${spec#*|}"
  url="${rest%%|*}"
  label="${rest#*|}"
  [ "$i" -gt 1 ] && sleep 2
  curl -sSL -A 'idle-research-feeds/1.0' --max-time 45 "$url" \
    >"$WORKDIR/$name.xml" 2>>"$WORKDIR/curl.err"
  if [ ! -s "$WORKDIR/$name.xml" ]; then
    log "fetch FAILED: $label"
    continue
  fi
  # Parse this feed. NB: python3 - reads its PROGRAM from the heredoc, so the
  # feed is read from a file (FILE env-var) rather than stdin (stdin is the
  # program here, not the data). SOURCE tags each item with its human name.
  part="$(FILE="$WORKDIR/$name.xml" SOURCE="$label" DAYS_BACK="$DAYS_BACK" /usr/bin/python3 - <<'PYEOF' 2>>"$WORKDIR/parse.err"
import os
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

days = int(os.environ.get("DAYS_BACK", "10"))
source = os.environ.get("SOURCE", "feed")
cutoff = datetime.now(timezone.utc) - timedelta(days=days)


def localname(tag):
    # Strip any XML namespace so RSS (no-ns) and Atom (ns) tags compare equal.
    return tag.rsplit("}", 1)[-1] if tag else tag


def clean(t):
    return " ".join((t or "").split())


def strip_tags(t):
    return " ".join(re.sub(r"<[^>]+>", " ", t or "").split())


def child(el, *names):
    for c in el:
        if localname(c.tag) in names:
            return c
    return None


def child_text(el, *names):
    c = child(el, *names)
    return c.text if c is not None else ""


def parse_date(s):
    s = (s or "").strip()
    if not s:
        return None
    # ISO 8601 (Atom published/updated): 2026-07-01T12:00:00Z / +00:00
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:
        pass
    # RFC 822 (RSS pubDate): Tue, 01 Jul 2026 12:00:00 +0000
    try:
        from email.utils import parsedate_to_datetime
        d = parsedate_to_datetime(s)
        if d is not None:
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:
        pass
    # bare date (dc:date variants): 2026-07-01
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except Exception:
        return None


try:
    with open(os.environ["FILE"], "r", encoding="utf-8", errors="replace") as f:
        root = ET.fromstring(f.read())
except Exception:
    sys.exit(0)   # unreadable/unparseable -> emit nothing; caller treats as empty

out = []
for el in root.iter():
    if localname(el.tag) not in ("item", "entry"):
        continue
    try:
        title = clean(child_text(el, "title"))
        # link: RSS <link>text</link>; Atom <link href="..."/> (prefer href).
        link = ""
        lc = child(el, "link")
        if lc is not None:
            link = clean(lc.text or lc.get("href") or "")
        if not link:
            for c in el:
                if localname(c.tag) == "link" and c.get("href"):
                    link = clean(c.get("href"))
                    break
        datestr = clean(child_text(el, "pubDate", "published", "updated", "date"))
        desc = strip_tags(
            child_text(el, "description", "summary", "content", "encoded"))
        pdate = parse_date(datestr)
        # Dated & older than the window -> drop. Undated (e.g. JFM ToC) -> keep.
        if pdate is not None and pdate < cutoff:
            continue
        if not title:
            continue
        out.append(
            "Source: %s\nTitle: %s\nLink: %s\nDate: %s\nSummary: %s\n" %
            (source, title, link, datestr[:32], desc[:1200]))
    except Exception:
        continue

sys.stdout.write("\n".join(out))
PYEOF
)"
  if [ -n "$part" ]; then
    entries="$entries$part
"
  fi
done

entries="$(printf '%s' "$entries" | head -c "$MAXBYTES")"

if [ -z "$entries" ]; then
  # 2b. Zero items from any of the five feeds (or every fetch/parse failed).
  printf '## Feeds watch — Fed / BIS / J. Futures Markets\n_%s — no items in the last %d days from any of the 5 feeds (or all fetches/parses failed); try again later._\n' \
    "$TS" "$DAYS_BACK" >"$out"
  log "FAILED/empty — no items in ${DAYS_BACK}d window"
else
  # 3. GLM triage from a neutral cwd (F5 rule).
  summary="$(cd "$WORKDIR" && printf '%s' "$entries" | glm-do "$PROMPT" 2>/dev/null)"
  if [ -z "$summary" ]; then
    printf '## Feeds watch — Fed / BIS / J. Futures Markets\n_%s — GLM triage failed; raw fetch was OK._\n' \
      "$TS" >"$out"
    log "FAILED glm"
  else
    # 4. Write the digest (UNVERIFIED, summary-level label; names all 5 sources).
    {
      printf '## Feeds watch — Fed / BIS / J. Futures Markets\n'
      printf '_Summarized %s · NY Fed Liberty Street, Fed FEDS Notes, FRBSF, BIS working papers, J. Futures Markets ToC · last %d days · UNVERIFIED GLM triage (summary-level) · refresh: /feeds_\n\n' "$TS" "$DAYS_BACK"
      printf '%s\n' "$summary"
    } >"$out"
    log "ok bytes=$(wc -c <"$out" | tr -d ' ')"
    # 5. Publish to the Telegram on-demand topic (fail-open).
    python3 "$TELEGRAM_HELPER" publish-ondemand "$out" >/dev/null 2>&1 || true
  fi
fi

# 6. Re-render the dashboard so the card is fresh immediately (fail-open).
/usr/bin/python3 "$SCRIPTS/dashboard_gen.py" >/dev/null 2>&1 || true
exit 0
