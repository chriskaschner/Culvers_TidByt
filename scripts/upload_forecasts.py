#!/usr/bin/env python3
"""Upload batch forecasts to Worker KV.

Reads the output of `analytics.batch_forecast` and writes each store's
forecast to Cloudflare KV as `forecast:{slug}`. Uses the Wrangler CLI
for KV writes (no API token management needed -- wrangler handles auth).

Usage:
    uv run python scripts/upload_forecasts.py
    uv run python scripts/upload_forecasts.py --input data/forecasts/latest.json
    uv run python scripts/upload_forecasts.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

# KV namespace ID from wrangler.toml
KV_NAMESPACE_ID = "1642a7da91e144cb9b233b940430250c"
DEFAULT_INPUT = Path("data/forecasts/latest.json")


def upload_to_kv(key: str, value: str) -> bool:
    """Write a single key-value pair to Cloudflare KV via wrangler."""
    result = subprocess.run(
        [
            "npx", "wrangler", "kv:key", "put",
            "--namespace-id", KV_NAMESPACE_ID,
            key, value,
        ],
        capture_output=True,
        text=True,
        cwd=Path(__file__).resolve().parents[1] / "worker",
    )
    return result.returncode == 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload forecasts to Worker KV")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT,
                        help="Path to batch forecast JSON")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be uploaded without writing")
    args = parser.parse_args()

    if not args.input.exists():
        print(f"Forecast file not found: {args.input}", file=sys.stderr)
        print("Run `uv run python -m analytics.batch_forecast` first.", file=sys.stderr)
        return 1

    data = json.loads(args.input.read_text())
    forecasts = data.get("forecasts", {})
    print(f"Forecast file: {args.input}")
    print(f"Generated: {data.get('generated_at', '?')}")
    print(f"Target date: {data.get('target_date', '?')}")
    print(f"Stores: {len(forecasts)}")

    if args.dry_run:
        for slug in list(forecasts)[:5]:
            f = forecasts[slug]
            if "days" in f:
                n_days = len(f["days"])
                first_day = f["days"][0] if f["days"] else {}
                top = first_day.get("predictions", [{}])[0] if first_day.get("predictions") else {}
                print(f"  forecast:{slug} -> {n_days} days, day 1 top: {top.get('flavor', '?')} ({top.get('probability', 0):.1%})")
            else:
                top = f["predictions"][0] if f.get("predictions") else {}
                print(f"  forecast:{slug} -> top: {top.get('flavor', '?')} ({top.get('probability', 0):.1%})")
        if len(forecasts) > 5:
            print(f"  ... and {len(forecasts) - 5} more")
        return 0

    success = 0
    failures = 0

    for i, (slug, forecast) in enumerate(forecasts.items()):
        key = f"forecast:{slug}"
        value = json.dumps(forecast, separators=(",", ":"))
        if upload_to_kv(key, value):
            success += 1
            if (i + 1) % 25 == 0 or i + 1 == len(forecasts):
                print(f"  [{i + 1}/{len(forecasts)}] uploaded", flush=True)
        else:
            failures += 1
            print(f"  FAILED: {key}", file=sys.stderr)

    print(f"\nDone: {success} uploaded, {failures} failed")
    return 1 if failures > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
