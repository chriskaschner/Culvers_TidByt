#!/bin/bash
# Convenience wrapper: render + push Tidbyt from cached data
# For full pipeline (fetch + calendar + tidbyt), use: uv run python main.py

set -e
cd "$(dirname "$0")"

# Load environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

echo "Deploying Culver's FOTD to Tidbyt..."
uv run python main.py --tidbyt-only "$@"
