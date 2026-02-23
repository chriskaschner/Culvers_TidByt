#!/usr/bin/env bash
set -euo pipefail
# Generate forecasts and upload to D1.
# Usage: ./scripts/refresh_forecasts.sh [--store SLUG]
uv run python -m analytics.batch_forecast "$@" --days 7
uv run python scripts/upload_forecasts.py
