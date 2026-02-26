#!/usr/bin/env python3
"""Check that the trivia-metrics-seed.js is not stale (>= 45 days old).

Exits nonzero if the seed file is too old, making this suitable as a CI gate.

Usage:
    uv run python scripts/check_metrics_seed_freshness.py
    uv run python scripts/check_metrics_seed_freshness.py --max-days 30
"""

from __future__ import annotations
import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

SEED_FILE = Path(__file__).resolve().parents[1] / "worker" / "src" / "trivia-metrics-seed.js"
DEFAULT_MAX_DAYS = 45


def extract_generated_at(text: str) -> str | None:
    m = re.search(r'"generated_at"\s*:\s*"([^"]+)"', text)
    return m.group(1) if m else None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check trivia-metrics-seed.js freshness")
    parser.add_argument("--max-days", type=int, default=DEFAULT_MAX_DAYS,
                        help=f"Maximum allowed seed age in days (default: {DEFAULT_MAX_DAYS})")
    args = parser.parse_args(argv)

    if not SEED_FILE.exists():
        print(f"ERROR: seed file not found: {SEED_FILE}")
        return 1

    text = SEED_FILE.read_text()
    generated_at = extract_generated_at(text)

    if not generated_at:
        print("ERROR: could not extract generated_at from seed file")
        return 1

    try:
        seed_dt = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
    except ValueError:
        print(f"ERROR: could not parse generated_at: {generated_at!r}")
        return 1

    now = datetime.now(timezone.utc)
    age_days = (now - seed_dt).days

    print(f"Seed generated_at: {generated_at}")
    print(f"Seed age: {age_days} days (max allowed: {args.max_days})")

    if age_days > args.max_days:
        print(f"FAIL: seed is {age_days} days old, exceeds {args.max_days}-day threshold.")
        print("Run: uv run python scripts/generate_intelligence_metrics.py")
        return 1

    print(f"OK: seed is within {args.max_days}-day freshness window.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
