#!/bin/bash
# Culver's FOTD Tracker - Cron Helper Script
# This script should be called by cron to run the main.py synchronization

# Change to the project directory
cd "$(dirname "$0")"

# Run the sync with uv (automatically uses .venv)
uv run python main.py >> logs/cron.log 2>&1

# Exit with the status code from main.py
exit $?
