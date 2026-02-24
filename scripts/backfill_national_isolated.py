#!/usr/bin/env python3
"""National backfill (isolated): fetch all stores not yet in local backfill DB.

Reads the store manifest (docs/stores.json), skips stores already in the
reference DB, and fetches flavor calendars from the Worker API for the rest.
Writes to an isolated SQLite + checkpoint under data/backfill-national/.

Usage:
    python scripts/backfill_national_isolated.py
    python scripts/backfill_national_isolated.py --workers 20
    python scripts/backfill_national_isolated.py --batch-size 100
    python scripts/backfill_national_isolated.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import threading
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

API_BASES = [
    "https://custard.chriskaschner.com",
    "https://custard-calendar.chris-kaschner.workers.dev",
]
USER_AGENT = "custard-backfill/2.0"
REFERENCE_DB_PATH = Path("data/backfill/flavors.sqlite")
OUTPUT_DIR = Path("data/backfill-national")
OUTPUT_DB_PATH = OUTPUT_DIR / "flavors.sqlite"
CHECKPOINT_PATH = OUTPUT_DIR / "checkpoint.json"
MANIFEST_PATH = Path("docs/stores.json")

db_lock = threading.Lock()
counter_lock = threading.Lock()
checkpoint_lock = threading.Lock()
stats = {"success": 0, "failures": 0, "flavors": 0, "done": 0}


def fetch_flavors(slug: str, timeout: int = 30) -> dict:
    last_err: Exception | None = None
    for base in API_BASES:
        url = f"{base}/api/v1/flavors?slug={slug}"
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as err:
            last_err = err
            continue
    raise last_err if last_err else RuntimeError("Unknown fetch failure")


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


def read_existing_slugs(conn: sqlite3.Connection) -> set[str]:
    return set(r[0] for r in conn.execute("SELECT DISTINCT store_slug FROM flavors").fetchall())


def load_checkpoint_slugs() -> set[str]:
    if not CHECKPOINT_PATH.exists():
        return set()
    try:
        payload = json.loads(CHECKPOINT_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return set()
    completed = payload.get("completed_slugs", [])
    if not isinstance(completed, list):
        return set()
    return {str(item) for item in completed if isinstance(item, str) and item}


def save_checkpoint_slugs(completed_slugs: set[str], last_completed_slug: str) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "completed_count": len(completed_slugs),
        "last_completed_slug": last_completed_slug,
        "completed_slugs": sorted(completed_slugs),
    }
    tmp_path = CHECKPOINT_PATH.with_suffix(".tmp")
    tmp_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    tmp_path.replace(CHECKPOINT_PATH)


def process_store(
    slug: str,
    conn: sqlite3.Connection,
    fetched_at: str,
    total: int,
    completed_slugs: set[str],
) -> None:
    try:
        data = fetch_flavors(slug)
        flavors = data.get("flavors", [])

        with db_lock:
            for f in flavors:
                conn.execute(
                    """INSERT OR IGNORE INTO flavors
                       (store_slug, flavor_date, title, description, source, fetched_at)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (
                        slug,
                        f.get("date", ""),
                        f.get("title", ""),
                        f.get("description", ""),
                        "worker-api",
                        fetched_at,
                    ),
                )
            conn.commit()

        with checkpoint_lock:
            completed_slugs.add(slug)
            save_checkpoint_slugs(completed_slugs, last_completed_slug=slug)

        with counter_lock:
            stats["success"] += 1
            stats["flavors"] += len(flavors)
            stats["done"] += 1
            n = stats["done"]
        print(f"[{n}/{total}] {slug}: {len(flavors)} flavors", flush=True)

    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as err:
        with counter_lock:
            stats["failures"] += 1
            stats["done"] += 1
            n = stats["done"]
        print(f"[{n}/{total}] {slug}: ERROR {err}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="National flavor backfill (isolated)")
    parser.add_argument("--workers", type=int, default=10, help="Parallel fetch threads (default 10)")
    parser.add_argument("--batch-size", type=int, default=0, help="Max stores to fetch (0=all)")
    parser.add_argument("--dry-run", action="store_true", help="Show counts without fetching")
    args = parser.parse_args()

    if not REFERENCE_DB_PATH.exists():
        print(f"reference DB missing: {REFERENCE_DB_PATH}")
        return 1

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    all_slugs = [s["slug"] for s in manifest["stores"]]

    reference_conn = sqlite3.connect(f"file:{REFERENCE_DB_PATH}?mode=ro", uri=True)
    reference_existing = read_existing_slugs(reference_conn)

    output_existing: set[str] = set()
    if OUTPUT_DB_PATH.exists():
        try:
            with sqlite3.connect(f"file:{OUTPUT_DB_PATH}?mode=ro", uri=True) as output_ro:
                output_existing = read_existing_slugs(output_ro)
        except sqlite3.OperationalError:
            output_existing = set()

    checkpoint_done = load_checkpoint_slugs()
    skip = reference_existing | output_existing | checkpoint_done
    missing = [s for s in all_slugs if s not in skip]

    print(
        f"manifest={len(all_slugs)} "
        f"existing_reference={len(reference_existing)} "
        f"existing_isolated={len(output_existing)} "
        f"checkpoint_done={len(checkpoint_done)} "
        f"missing={len(missing)}"
    )

    if args.dry_run:
        reference_conn.close()
        return 0

    target = missing[: args.batch_size] if args.batch_size > 0 else missing
    if not target:
        print("nothing to fetch")
        reference_conn.close()
        return 0

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_conn = sqlite3.connect(OUTPUT_DB_PATH, check_same_thread=False)
    ensure_schema(output_conn)

    fetched_at = datetime.now(timezone.utc).isoformat()
    total = len(target)
    print(f"fetching {total} stores with {args.workers} threads...\n")

    completed_slugs = set(output_existing) | set(checkpoint_done)
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(process_store, slug, output_conn, fetched_at, total, completed_slugs): slug
            for slug in target
        }
        for future in as_completed(futures):
            future.result()  # propagate exceptions

    output_conn.close()
    reference_conn.close()
    print(f"\ndone: success={stats['success']} failures={stats['failures']} flavors_added={stats['flavors']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
