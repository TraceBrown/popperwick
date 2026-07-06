#!/usr/bin/env python3
"""
web_crawl.py — fetch ONE DuckDuckGo html results page via crawl4ai's headless
Chromium and print the organic results as clean, GLM-triageable lines. The
optional [Web] source for the Idle Research on-demand (/research) pipeline.

HARD RULES (mirrors reddit_crawl.py):
  * ANONYMOUS ONLY. No cookies, no login, no auth headers, no API keys.
  * One URL per invocation. The URL MUST be a duckduckgo.com html results page
    (the caller builds https://html.duckduckgo.com/html/?q=<urlencoded topic>);
    any other host is refused (defense-in-depth, like reddit_crawl's reddit-only
    guard). The topic only ever appears percent-encoded inside the query string.

OUTPUT (stdout): one block per organic result, real target URL de-referenced out
of DuckDuckGo's /l/?uddg=<enc> redirect so GLM sees (and can preserve) the true
link, never the tracking wrapper:
    - <title> | <real url>
      <snippet>
Exit codes: 0 = >=1 usable result ; 1 = failed (caller treats source as failed
and continues — fail-open).

Run with the crawl4ai venv's python (the caller sets PLAYWRIGHT_BROWSERS_PATH so
this uses its OWN isolated Chromium, never the notebooklm-py browser):
  ~/.crawl4ai-venv/bin/python web_crawl.py <duckduckgo-html-url> [timeout_ms]
"""
import asyncio
import html as _html
import re
import sys
import urllib.parse

DESKTOP_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Safari/537.36"
)

_TAGS = re.compile(r"(?s)<[^>]+>")
_A = re.compile(r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', re.S)
_SNIP = re.compile(r'class="result__snippet"[^>]*>(.*?)</a>', re.S)


def _clean(s):
    """Strip tags + collapse whitespace + un-escape HTML entities."""
    s = _TAGS.sub(" ", s or "")
    s = _html.unescape(s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _deref(href):
    """Pull the real target out of DuckDuckGo's //duckduckgo.com/l/?uddg=<enc>
    redirect. Returns the de-referenced absolute URL, or "" if not a DDG link."""
    href = _html.unescape(href or "")
    m = re.search(r"[?&]uddg=([^&]+)", href)
    if m:
        try:
            return urllib.parse.unquote(m.group(1))
        except Exception:
            return ""
    # Some rows are already absolute (rare) — accept http(s) only.
    if href.startswith("http://") or href.startswith("https://"):
        return href
    return ""


def parse_results(page_html):
    """DuckDuckGo html -> list of (title, url, snippet). Titles/URLs come from
    result__a in document order; snippets from result__snippet in the same order
    and zipped positionally (DDG emits one snippet per result)."""
    titles, urls = [], []
    for href, title in _A.findall(page_html or ""):
        u = _deref(href)
        if not u:
            continue
        titles.append(_clean(title))
        urls.append(u)
    snippets = [_clean(s) for s in _SNIP.findall(page_html or "")]
    out = []
    for i, (t, u) in enumerate(zip(titles, urls)):
        snip = snippets[i] if i < len(snippets) else ""
        out.append((t or "(no title)", u, snip))
    return out


async def fetch(url: str, timeout_ms: int) -> int:
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

    browser_cfg = BrowserConfig(headless=True, user_agent=DESKTOP_UA)
    run_cfg = CrawlerRunConfig(cache_mode=CacheMode.BYPASS, page_timeout=timeout_ms)
    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        result = await crawler.arun(url=url, config=run_cfg)
        if not result.success:
            print(f"[web_crawl] FAIL {url}: {result.error_message}", file=sys.stderr)
            return 1
        page_html = result.html or ""
        results = parse_results(page_html)
        if not results:
            print(f"[web_crawl] WARN {url}: no organic results parsed", file=sys.stderr)
            return 1
        for t, u, snip in results:
            print(f"- {t} | {u}")
            if snip:
                print(f"  {snip}")
        print(f"[web_crawl] OK {url}: {len(results)} results", file=sys.stderr)
        return 0


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: web_crawl.py <duckduckgo-html-url> [timeout_ms]", file=sys.stderr)
        return 1
    url = sys.argv[1]
    try:
        timeout_ms = int(sys.argv[2]) if len(sys.argv) > 2 else 45000
    except Exception:
        timeout_ms = 45000
    timeout_ms = max(15000, min(90000, timeout_ms))
    if "duckduckgo.com" not in urllib.parse.urlparse(url).netloc.lower():
        print(f"[web_crawl] refusing non-duckduckgo URL: {url}", file=sys.stderr)
        return 1
    try:
        return asyncio.run(fetch(url, timeout_ms))
    except Exception as e:  # noqa: BLE001 — fail-open for the caller
        print(f"[web_crawl] EXCEPTION {url}: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
