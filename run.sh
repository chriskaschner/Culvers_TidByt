#!/bin/bash
# Culver's FOTD Tracker - Cron Helper Script
# Runs the full pipeline: fetch → calendar sync → tidbyt render + push

# Change to the project directory
cd "$(dirname "$0")"

# Load environment variables (TIDBYT_API_TOKEN)
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Run the full pipeline with uv
uv run python main.py >> logs/cron.log 2>&1

exit $?
