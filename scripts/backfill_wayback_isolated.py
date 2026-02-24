#!/usr/bin/env python3
"""Wayback backfill (isolated): ingest archived Culver's calendars by state.

This script pulls archived restaurant pages from the Internet Archive CDX API,
parses Flavor of the Day calendars from __NEXT_DATA__, and writes results to an
isolated SQLite database.

Default scope starts with Wisconsin stores.

Usage:
    python scripts/backfill_wayback_isolated.py --dry-run
    python scripts/backfill_wayback_isolated.py --state WI --workers 8
    python scripts/backfill_wayback_isolated.py --state WI --before-date 2024-01-01
"""

from __future__ import annotations

import argparse
import html
import json
import random
import re
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from pathlib import Path

CDX_APIS = [
    "https://web.archive.org/cdx/search/cdx",
    "http://web.archive.org/cdx/search/cdx",
]
USER_AGENT = "custard-wayback-backfill/1.0"
MANIFEST_PATH = Path("docs/stores.json")
OUTPUT_DIR = Path("data/backfill-wayback")
OUTPUT_DB_PATH = OUTPUT_DIR / "flavors.sqlite"
CHECKPOINT_PATH = OUTPUT_DIR / "checkpoint.json"

NON_CULVERS_PATTERNS = [
    re.compile(r"^kopps-"),
    re.compile(r"^gilles$"),
    re.compile(r"^hefners$"),
    re.compile(r"^kraverz$"),
    re.compile(r"^oscars"),
]

NEXT_DATA_RE = re.compile(r'<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)</script>')
LEGACY_FOTD_RE = re.compile(
    r'<a[^>]*class="value"[^>]*>(?P<title>[^<]+)</a>[\s\S]{0,2500}?'
    r'/fotd-add-to-calendar/\d+/(?P<date>\d{4}-\d{2}-\d{2})',
    re.IGNORECASE,
)

db_lock = threading.Lock()
checkpoint_lock = threading.Lock()
counter_lock = threading.Lock()
stats = {
    "stores_done": 0,
    "stores_ok": 0,
    "stores_failed": 0,
    "snapshots_seen": 0,
    "snapshots_parsed": 0,
    "snapshots_fetch_errors": 0,
    "flavors_upserted": 0,
}


class RateLimiter:
    """Simple thread-safe request pacer (requests per minute)."""

    def __init__(self, requests_per_minute: float) -> None:
        self.min_interval_s = 0.0
        if requests_per_minute and requests_per_minute > 0:
            self.min_interval_s = 60.0 / float(requests_per_minute)
        self._lock = threading.Lock()
        self._next_allowed = 0.0

    def wait(self) -> None:
        if self.min_interval_s <= 0:
            return
        while True:
            with self._lock:
                now = time.monotonic()
                if now >= self._next_allowed:
                    self._next_allowed = now + self.min_interval_s
                    return
                sleep_for = self._next_allowed - now
            time.sleep(min(sleep_for, 0.5))


cdx_rate_limiter = RateLimiter(50.0)
playback_rate_limiter = RateLimiter(12.0)


def clean_text(text: str) -> str:
    return (
        str(text or "")
        .replace("\u00ae", "")
        .replace("\u2122", "")
        .replace("\u00a9", "")
    ).strip()


def is_culvers_slug(slug: str) -> bool:
    for pattern in NON_CULVERS_PATTERNS:
        if pattern.search(slug):
            return False
    return True


def wb_timestamp_to_iso(ts: str) -> str:
    # Wayback format: YYYYMMDDhhmmss
    if len(ts) != 14 or not ts.isdigit():
        return datetime.now(timezone.utc).isoformat()
    dt = datetime.strptime(ts, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _parse_retry_after_seconds(err: urllib.error.HTTPError) -> float | None:
    header = err.headers.get("Retry-After") if err.headers else None
    if not header:
        return None
    try:
        return max(0.0, float(header.strip()))
    except ValueError:
        return None


def _compute_backoff_s(attempt: int, base: float = 2.0, cap: float = 90.0) -> float:
    exp = min(cap, base * (2 ** (attempt - 1)))
    jitter = random.uniform(0.0, min(3.0, exp * 0.25))
    return min(cap, exp + jitter)


def _is_connection_refused(err: urllib.error.URLError) -> bool:
    text = str(err).lower()
    return "connection refused" in text or "failed to connect" in text


def fetch_url(
    url: str,
    timeout: int = 45,
    retries: int = 6,
    limiter: RateLimiter | None = None,
) -> bytes:
    last_err: Exception | None = None

    for attempt in range(1, retries + 1):
        try:
            if limiter is not None:
                limiter.wait()
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as err:
            last_err = err
            if err.code in (429, 500, 502, 503, 504) and attempt < retries:
                retry_after = _parse_retry_after_seconds(err)
                sleep_s = retry_after if retry_after is not None else _compute_backoff_s(attempt)
                time.sleep(max(0.5, sleep_s))
                continue
            break
        except (urllib.error.URLError, TimeoutError, ValueError) as err:
            last_err = err
            if attempt < retries:
                if isinstance(err, urllib.error.URLError) and _is_connection_refused(err):
                    sleep_s = _compute_backoff_s(attempt, base=8.0, cap=240.0)
                else:
                    sleep_s = _compute_backoff_s(attempt)
                time.sleep(sleep_s)
                continue
            break

    raise last_err if last_err else RuntimeError(f"Failed request: {url}")


def fetch_cdx_snapshots(
    slug: str,
    from_year: int,
    to_year: int,
    max_snapshots: int = 0,
) -> list[tuple[str, str]]:
    original_url = f"https://www.culvers.com/restaurants/{slug}"
    params = [
        ("url", original_url),
        ("from", str(from_year)),
        ("to", str(to_year)),
        ("output", "json"),
        ("fl", "timestamp,original,statuscode,mimetype,digest"),
        ("filter", "statuscode:200"),
        ("filter", "mimetype:text/html"),
        # One representative capture per day to keep runtime manageable.
        ("collapse", "timestamp:8"),
    ]
    payload: bytes | None = None
    last_err: Exception | None = None
    for cdx_api in CDX_APIS:
        url = f"{cdx_api}?{urllib.parse.urlencode(params, doseq=True)}"
        try:
            payload = fetch_url(url, timeout=45, retries=6, limiter=cdx_rate_limiter)
            break
        except Exception as err:  # noqa: BLE001
            last_err = err
            continue
    if payload is None:
        raise last_err if last_err else RuntimeError("Failed to fetch CDX snapshots")

    rows = json.loads(payload.decode("utf-8"))
    if not isinstance(rows, list) or len(rows) <= 1:
        return []

    # First row is header; each row: [timestamp, original, statuscode, mimetype, digest]
    captures: list[tuple[str, str]] = []
    for row in rows[1:]:
        if not isinstance(row, list) or len(row) < 2:
            continue
        ts = str(row[0])
        original = str(row[1])
        if len(ts) != 14:
            continue
        captures.append((ts, original))

    captures.sort(key=lambda x: x[0])
    if max_snapshots > 0:
        captures = captures[:max_snapshots]
    return captures


def parse_flavors_from_html(page_html: str) -> list[dict[str, str]]:
    match = NEXT_DATA_RE.search(page_html)
    if not match:
        return parse_flavors_from_legacy_html(page_html)

    data = json.loads(match.group(1))
    props = data.get("props") or data
    custom_data = (
        props.get("pageProps", {})
        .get("page", {})
        .get("customData", {})
    )
    raw_flavors = custom_data.get("restaurantCalendar", {}).get("flavors", [])

    parsed: list[dict[str, str]] = []
    for item in raw_flavors:
        if not isinstance(item, dict):
            continue
        on_date = str(item.get("onDate", ""))
        flavor_date = on_date.split("T")[0] if on_date else ""
        title = clean_text(item.get("title", ""))
        description = clean_text(item.get("description", ""))
        if not flavor_date or not title:
            continue
        parsed.append(
            {
                "date": flavor_date,
                "title": title,
                "description": description,
            }
        )
    return parsed


def parse_flavors_from_legacy_html(page_html: str) -> list[dict[str, str]]:
    found: dict[str, str] = {}
    for match in LEGACY_FOTD_RE.finditer(page_html):
        flavor_date = match.group("date")
        title = clean_text(html.unescape(match.group("title")))
        if not flavor_date or not title:
            continue
        found[flavor_date] = title

    return [
        {"date": d, "title": t, "description": ""}
        for d, t in sorted(found.items(), key=lambda x: x[0])
    ]


def fetch_archived_html(ts: str, original: str) -> str:
    candidates = [
        f"https://web.archive.org/web/{ts}id_/{original}",
        f"https://web.archive.org/web/{ts}/{original}",
        f"http://web.archive.org/web/{ts}id_/{original}",
        f"http://web.archive.org/web/{ts}/{original}",
    ]
    last_err: Exception | None = None
    for candidate in candidates:
        try:
            return fetch_url(
                candidate,
                timeout=60,
                retries=5,
                limiter=playback_rate_limiter,
            ).decode("utf-8", errors="ignore")
        except Exception as err:  # noqa: BLE001
            last_err = err
            continue
    raise last_err if last_err else RuntimeError("Unable to fetch archived HTML")


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """CREATE TABLE IF NOT EXISTS flavors (
               store_slug   TEXT    NOT NULL,
               flavor_date  TEXT    NOT NULL,
               title        TEXT    NOT NULL,
               description  TEXT    DEFAULT '',
               source       TEXT    NOT NULL,
               fetched_at   TEXT    NOT NULL,
               PRIMARY KEY (store_slug, flavor_date)
           )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_flavors_store ON flavors(store_slug)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_flavors_date ON flavors(flavor_date)")
    conn.commit()


def load_checkpoint() -> set[str]:
    if not CHECKPOINT_PATH.exists():
        return set()
    try:
        payload = json.loads(CHECKPOINT_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return set()
    done = payload.get("completed_slugs", [])
    if not isinstance(done, list):
        return set()
    return {str(s) for s in done if isinstance(s, str) and s}


def save_checkpoint(completed: set[str], selector: str) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "selector": selector,
        "completed_count": len(completed),
        "completed_slugs": sorted(completed),
        "stats": stats,
    }
    tmp = CHECKPOINT_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    tmp.replace(CHECKPOINT_PATH)


def upsert_store_rows(
    conn: sqlite3.Connection,
    slug: str,
    rows_by_date: dict[str, tuple[str, str, str]],
) -> int:
    if not rows_by_date:
        return 0

    with db_lock:
        for flavor_date, (title, description, fetched_at) in rows_by_date.items():
            conn.execute(
                """INSERT INTO flavors
                   (store_slug, flavor_date, title, description, source, fetched_at)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(store_slug, flavor_date) DO UPDATE SET
                     title=excluded.title,
                     description=excluded.description,
                     source=excluded.source,
                     fetched_at=excluded.fetched_at""",
                (slug, flavor_date, title, description, "wayback", fetched_at),
            )
        conn.commit()

    return len(rows_by_date)


def process_store(
    slug: str,
    conn: sqlite3.Connection,
    total: int,
    completed: set[str],
    from_year: int,
    to_year: int,
    max_snapshots: int,
    before_date: date | None,
    selector: str,
) -> None:
    try:
        captures = fetch_cdx_snapshots(
            slug=slug,
            from_year=from_year,
            to_year=to_year,
            max_snapshots=max_snapshots,
        )
        with counter_lock:
            stats["snapshots_seen"] += len(captures)

        rows_by_date: dict[str, tuple[str, str, str]] = {}
        parsed_snapshots = 0
        capture_errors = 0
        for ts, original in captures:
            try:
                html_text = fetch_archived_html(ts, original)
            except Exception:  # noqa: BLE001
                capture_errors += 1
                continue

            flavors = parse_flavors_from_html(html_text)
            if not flavors:
                continue
            parsed_snapshots += 1
            fetched_at = wb_timestamp_to_iso(ts)
            for f in flavors:
                f_date = f["date"]
                if before_date is not None:
                    try:
                        parsed_date = datetime.strptime(f_date, "%Y-%m-%d").date()
                    except ValueError:
                        continue
                    if parsed_date >= before_date:
                        continue
                # Keep latest observation for each flavor date within this store run.
                rows_by_date[f_date] = (f["title"], f["description"], fetched_at)

        upserted = upsert_store_rows(conn, slug, rows_by_date)
        with counter_lock:
            stats["snapshots_parsed"] += parsed_snapshots
            stats["snapshots_fetch_errors"] += capture_errors
            stats["flavors_upserted"] += upserted
            stats["stores_ok"] += 1
            stats["stores_done"] += 1
            done_n = stats["stores_done"]

        with checkpoint_lock:
            completed.add(slug)
            save_checkpoint(completed, selector=selector)

        print(
            f"[{done_n}/{total}] {slug}: captures={len(captures)} "
            f"parsed={parsed_snapshots} capture_errors={capture_errors} upserted_dates={upserted}",
            flush=True,
        )
    except Exception as err:  # noqa: BLE001
        with counter_lock:
            stats["stores_failed"] += 1
            stats["stores_done"] += 1
            done_n = stats["stores_done"]
        print(f"[{done_n}/{total}] {slug}: ERROR {err}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Wayback backfill (isolated)")
    parser.add_argument(
        "--state",
        default="WI",
        help="State code filter (default WI). Use ALL for nationwide.",
    )
    parser.add_argument(
        "--exclude-state",
        action="append",
        default=[],
        help="Exclude state code(s), e.g. --exclude-state WI (repeatable).",
    )
    parser.add_argument("--workers", type=int, default=6, help="Parallel store workers (default 6)")
    parser.add_argument(
        "--cdx-rpm",
        type=float,
        default=50.0,
        help="Global CDX request rate limit, requests/minute across all threads (default 50).",
    )
    parser.add_argument(
        "--playback-rpm",
        type=float,
        default=12.0,
        help=(
            "Global playback request rate limit, requests/minute across all threads "
            "(default 12, conservative for Wayback scrape stability)."
        ),
    )
    parser.add_argument("--batch-size", type=int, default=0, help="Max stores to process (0=all)")
    parser.add_argument("--from-year", type=int, default=2010, help="Wayback start year (default 2010)")
    parser.add_argument(
        "--to-year",
        type=int,
        default=datetime.now(timezone.utc).year,
        help="Wayback end year (default current year)",
    )
    parser.add_argument(
        "--max-snapshots-per-store",
        type=int,
        default=0,
        help="Cap captures per store after CDX lookup (0=all)",
    )
    parser.add_argument(
        "--before-date",
        type=str,
        default="2024-01-01",
        help="Only keep flavor_date older than this YYYY-MM-DD (default 2024-01-01). "
        "Use empty string to disable.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Show scope without fetching")
    args = parser.parse_args()

    global cdx_rate_limiter  # noqa: PLW0603
    global playback_rate_limiter  # noqa: PLW0603
    cdx_rate_limiter = RateLimiter(args.cdx_rpm)
    playback_rate_limiter = RateLimiter(args.playback_rpm)

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    state = str(args.state).upper().strip()
    excluded = {str(s).upper().strip() for s in (args.exclude_state or []) if str(s).strip()}
    selector = state if state else "WI"
    if excluded:
        selector += f" (exclude={','.join(sorted(excluded))})"

    def state_match(store_state: str) -> bool:
        st = str(store_state or "").upper()
        if state == "ALL":
            return st not in excluded
        return st == state and st not in excluded

    stores = [
        s for s in manifest.get("stores", [])
        if state_match(s.get("state", "")) and is_culvers_slug(str(s.get("slug", "")))
    ]
    slugs = [str(s["slug"]) for s in stores if s.get("slug")]

    completed = load_checkpoint()
    pending = [slug for slug in slugs if slug not in completed]
    target = pending[: args.batch_size] if args.batch_size > 0 else pending

    before_date: date | None = None
    if args.before_date:
        before_date = datetime.strptime(args.before_date, "%Y-%m-%d").date()

    print(
        f"selector={selector} stores_in_manifest={len(slugs)} completed={len(completed)} "
        f"pending={len(pending)} target={len(target)} from_year={args.from_year} "
        f"to_year={args.to_year} before_date={args.before_date or 'disabled'} "
        f"cdx_rpm={args.cdx_rpm} playback_rpm={args.playback_rpm}"
    )

    if args.dry_run:
        return 0
    if not target:
        print("nothing to fetch")
        return 0

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(OUTPUT_DB_PATH, check_same_thread=False)
    ensure_schema(conn)

    total = len(target)
    print(f"fetching {total} stores with {args.workers} workers...\n")

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(
                process_store,
                slug,
                conn,
                total,
                completed,
                args.from_year,
                args.to_year,
                args.max_snapshots_per_store,
                before_date,
                selector,
            ): slug
            for slug in target
        }
        for future in as_completed(futures):
            future.result()

    conn.close()
    print(
        "\ndone: "
        f"stores_ok={stats['stores_ok']} stores_failed={stats['stores_failed']} "
        f"snapshots_seen={stats['snapshots_seen']} snapshots_parsed={stats['snapshots_parsed']} "
        f"snapshots_fetch_errors={stats['snapshots_fetch_errors']} "
        f"flavor_dates_upserted={stats['flavors_upserted']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
