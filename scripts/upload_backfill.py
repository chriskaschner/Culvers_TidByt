#!/usr/bin/env python3
"""Upload local SQLite backfill data to D1 snapshots table.

Local SQLite databases (data/backfill/flavors.sqlite and
data/backfill-wayback/flavors.sqlite) hold the full historical corpus.
This script bulk-uploads rows to Cloudflare D1 starting with preferred stores.

Table layout in local DBs:
    flavors (store_slug, flavor_date, title, description, source, fetched_at)

D1 target table:
    snapshots (brand, slug, date, flavor, normalized_flavor, description, fetched_at)

Usage:
    # Priority stores only (mt-horeb, verona, madison-todd-drive)
    uv run python scripts/upload_backfill.py

    # Specific stores
    uv run python scripts/upload_backfill.py --stores mt-horeb,verona

    # All WI stores
    uv run python scripts/upload_backfill.py --all-wi

    # Full corpus
    uv run python scripts/upload_backfill.py --all

    # Preview counts without uploading
    uv run python scripts/upload_backfill.py --dry-run

    # Skip stores already in D1 (rough heuristic: skip if slug has >= N rows there)
    uv run python scripts/upload_backfill.py --all-wi --resume
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

D1_DATABASE_NAME = "custard-snapshots"
WORKER_DIR = Path(__file__).resolve().parents[1] / "worker"
DATA_DIR = Path(__file__).resolve().parents[1] / "data"

BACKFILL_DB = DATA_DIR / "backfill" / "flavors.sqlite"
WAYBACK_DB = DATA_DIR / "backfill-wayback" / "flavors.sqlite"

PRIORITY_STORES = ["mt-horeb", "verona", "madison-todd-drive"]

# Batch size: 200 rows per SQL file (D1 wrangler CLI limit is generous but
# large files can hit request-size limits; 200 is safe).
DEFAULT_BATCH_SIZE = 200

# Brand inference patterns mirroring worker/src/brand-registry.js BRAND_REGISTRY
_BRAND_PATTERNS = [
    (re.compile(r"^kopps-"), "Kopp's"),
    (re.compile(r"^gilles$"), "Gille's"),
    (re.compile(r"^hefners$"), "Hefner's"),
    (re.compile(r"^kraverz$"), "Kraverz"),
    (re.compile(r"^oscars"), "Oscar's"),
]
_CULVERS_BRAND = "Culver's"


def infer_brand(slug: str) -> str:
    """Infer brand from slug prefix, mirroring brand-registry.js patterns."""
    for pattern, brand in _BRAND_PATTERNS:
        if pattern.search(slug):
            return brand
    return _CULVERS_BRAND


def normalize_flavor(title: str) -> str:
    """Normalize a flavor title for the normalized_flavor column.

    Mirrors the normalization used by the Worker:
        flavor.lower()
            .replace trademark/copyright symbols
            .replace smart quotes
            .replace non-alphanumeric with space
            .strip()
    """
    if not title:
        return ""
    s = title.lower()
    s = re.sub(r"[\u00ae\u2122\u00a9]", "", s)
    s = re.sub(r"[\u2018\u2019']", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return s.strip()


def sql_quote(value: str) -> str:
    """SQL-quote a string value for inline VALUES clauses."""
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def build_batch_sql(rows: list[dict]) -> str:
    """Build INSERT OR IGNORE SQL for a batch of snapshot rows."""
    lines = []
    for r in rows:
        lines.append(
            "INSERT OR IGNORE INTO snapshots "
            "(brand, slug, date, flavor, normalized_flavor, description, fetched_at) "
            f"VALUES ("
            f"{sql_quote(r['brand'])}, "
            f"{sql_quote(r['slug'])}, "
            f"{sql_quote(r['date'])}, "
            f"{sql_quote(r['flavor'])}, "
            f"{sql_quote(r['normalized_flavor'])}, "
            f"{sql_quote(r['description'])}, "
            f"{sql_quote(r['fetched_at'])}"
            f");"
        )
    return "\n".join(lines) + "\n"


def execute_sql_via_wrangler(sql: str) -> bool:
    """Write SQL to a temp file and execute via wrangler d1 execute."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False) as tmp:
        tmp.write(sql)
        tmp_path = Path(tmp.name)

    result = subprocess.run(
        [
            "npx", "wrangler", "d1", "execute", D1_DATABASE_NAME,
            "--remote",
            "--file", str(tmp_path),
        ],
        capture_output=True,
        text=True,
        cwd=WORKER_DIR,
    )
    tmp_path.unlink(missing_ok=True)
    if result.returncode != 0:
        print(f"  wrangler error: {result.stderr.strip()}", file=sys.stderr)
    return result.returncode == 0


def count_d1_rows_for_store(slug: str) -> int | None:
    """Query D1 for the current row count for a store slug.

    Returns None on error (e.g. D1 unreachable).
    Rate: one wrangler invocation per store — use sparingly (--resume mode only).
    """
    sql = f"SELECT COUNT(*) AS n FROM snapshots WHERE slug = {sql_quote(slug)};"
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False) as tmp:
        tmp.write(sql)
        tmp_path = Path(tmp.name)

    result = subprocess.run(
        [
            "npx", "wrangler", "d1", "execute", D1_DATABASE_NAME,
            "--remote",
            "--file", str(tmp_path),
            "--json",
        ],
        capture_output=True,
        text=True,
        cwd=WORKER_DIR,
    )
    tmp_path.unlink(missing_ok=True)
    if result.returncode != 0:
        return None
    try:
        data = json.loads(result.stdout)
        # Wrangler JSON output: list of result sets, each has results list
        for item in data:
            results = item.get("results", [])
            if results:
                return int(results[0].get("n", 0))
    except (json.JSONDecodeError, KeyError, IndexError, TypeError):
        pass
    return None


def load_wi_slugs() -> list[str]:
    """Parse store-index.js to get all WI store slugs."""
    store_index_path = WORKER_DIR / "src" / "store-index.js"
    content = store_index_path.read_text()
    start = content.index("[")
    end = content.rindex("]") + 1
    stores = json.loads(content[start:end])
    return [s["slug"] for s in stores if s.get("state") == "WI"]


def read_rows_from_db(db_path: Path, slugs: list[str] | None) -> list[dict]:
    """Read flavor rows from a local SQLite DB, optionally filtered by slugs.

    Columns in local DB:
        store_slug, flavor_date, title, description, source, fetched_at

    Returns list of dicts with D1-compatible keys:
        brand, slug, date, flavor, normalized_flavor, description, fetched_at
    """
    if not db_path.exists():
        return []

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        if slugs is not None:
            placeholders = ",".join("?" * len(slugs))
            rows = conn.execute(
                f"SELECT store_slug, flavor_date, title, description, fetched_at "
                f"FROM flavors WHERE store_slug IN ({placeholders})",
                slugs,
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT store_slug, flavor_date, title, description, fetched_at FROM flavors"
            ).fetchall()
    finally:
        conn.close()

    out = []
    for row in rows:
        slug = row["store_slug"]
        title = row["title"] or ""
        description = row["description"] or ""
        fetched_at = row["fetched_at"] or ""
        out.append(
            {
                "brand": infer_brand(slug),
                "slug": slug,
                "date": row["flavor_date"],
                "flavor": title,
                "normalized_flavor": normalize_flavor(title),
                "description": description,
                "fetched_at": fetched_at,
            }
        )
    return out


def upload_rows(rows: list[dict], batch_size: int) -> tuple[int, int]:
    """Upload rows to D1 in batches. Returns (success_count, failure_count)."""
    success = 0
    failures = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        sql = build_batch_sql(batch)
        if execute_sql_via_wrangler(sql):
            success += len(batch)
            print(f"  [{min(i + len(batch), len(rows))}/{len(rows)}] uploaded", flush=True)
        else:
            failures += len(batch)
            print(f"  FAILED batch starting at index {i}", file=sys.stderr)
    return success, failures


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Upload local backfill SQLite data to D1 snapshots table"
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--stores",
        metavar="SLUGS",
        help="Comma-separated list of store slugs to upload",
    )
    group.add_argument(
        "--all-wi",
        action="store_true",
        help="Upload all WI stores from store-index.js",
    )
    group.add_argument(
        "--all",
        action="store_true",
        help="Upload all stores in local databases",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print row counts without uploading",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Skip stores that already have rows in D1 (queries D1 per store -- slow)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=f"Rows per D1 execute call (default: {DEFAULT_BATCH_SIZE})",
    )
    args = parser.parse_args()

    # Determine target slugs
    if args.stores:
        target_slugs: list[str] | None = [s.strip() for s in args.stores.split(",") if s.strip()]
        mode_label = f"stores: {', '.join(target_slugs)}"
    elif args.all_wi:
        target_slugs = load_wi_slugs()
        mode_label = f"all WI ({len(target_slugs)} stores)"
    elif args.all:
        target_slugs = None  # None = no filter
        mode_label = "all stores"
    else:
        target_slugs = PRIORITY_STORES
        mode_label = f"priority stores: {', '.join(PRIORITY_STORES)}"

    print(f"Mode: {mode_label}")
    print(f"Sources: {BACKFILL_DB}, {WAYBACK_DB}")

    # Load rows from both DBs
    rows_backfill = read_rows_from_db(BACKFILL_DB, target_slugs)
    rows_wayback = read_rows_from_db(WAYBACK_DB, target_slugs)
    all_rows = rows_backfill + rows_wayback

    print(f"Rows found: {len(rows_backfill)} backfill + {len(rows_wayback)} wayback = {len(all_rows)} total")

    if not all_rows:
        print("No rows to upload.")
        return 0

    # Summarize per-store counts
    per_store: dict[str, int] = {}
    for r in all_rows:
        per_store[r["slug"]] = per_store.get(r["slug"], 0) + 1

    if args.dry_run:
        print("\nDry run — top 20 stores by row count:")
        for slug, count in sorted(per_store.items(), key=lambda x: -x[1])[:20]:
            print(f"  {slug}: {count}")
        if len(per_store) > 20:
            print(f"  ... and {len(per_store) - 20} more stores")
        print(f"\nTotal: {len(all_rows)} rows across {len(per_store)} stores")
        return 0

    # Resume mode: skip stores already populated in D1
    if args.resume:
        print("Resume mode: checking D1 for existing store counts...")
        slugs_to_skip = set()
        for slug in list(per_store):
            d1_count = count_d1_rows_for_store(slug)
            if d1_count is not None and d1_count >= per_store[slug]:
                print(f"  SKIP {slug}: D1 already has {d1_count} rows (local: {per_store[slug]})")
                slugs_to_skip.add(slug)
        if slugs_to_skip:
            all_rows = [r for r in all_rows if r["slug"] not in slugs_to_skip]
            print(f"  Skipped {len(slugs_to_skip)} store(s); {len(all_rows)} rows remaining")

    if not all_rows:
        print("All stores already uploaded — nothing to do.")
        return 0

    print(f"\nUploading {len(all_rows)} rows (batch size: {args.batch_size})...")
    success, failures = upload_rows(all_rows, args.batch_size)
    print(f"\nDone: {success} uploaded, {failures} failed")
    return 1 if failures > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
