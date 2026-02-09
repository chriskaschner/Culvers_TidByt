# Culver's Flavor of the Day Tracker

Automatically track Culver's Flavor of the Day and sync to Google Calendar and Tidbyt display.

## Features

- 🍦 Scrapes Culver's website for current and upcoming flavors
- 📅 Automatically syncs to Google Calendar with emoji and descriptions
- 📺 Displays on Tidbyt with color-coded pixel art icons
- 🔄 Runs daily via cron (local) or cloud function (future)
- 🔍 Built-in health checks and monitoring

## Setup

### 1. Install Dependencies

This project uses [uv](https://github.com/astral-sh/uv) for fast Python package management.

```bash
# Install uv if you haven't already
curl -LsSf https://astral.sh/uv/install.sh | sh

# Sync dependencies
uv sync
```

### 2. Configure Location

Edit `config.yaml` to set your preferred Culver's location:

```yaml
culvers:
  primary_location: "https://www.culvers.com/restaurants/mt-horeb"
```

### 3. Set Up Google Calendar API

See [docs/GOOGLE_API_SETUP.md](docs/GOOGLE_API_SETUP.md) for detailed instructions on:
- Creating a Google Cloud Project
- Enabling Calendar API
- Downloading OAuth credentials

### 4. Run Manually

```bash
# Test the scraper
uv run python -c "from src.culvers_scraper import *; print(get_current_flavor('https://www.culvers.com/restaurants/mt-horeb'))"

# Run full sync
uv run python main.py
```

### 5. Set Up Automation

```bash
# Make run script executable
chmod +x run.sh

# Set up launchd (macOS) or cron
# See Phase 6 in implementation plan for details
```

## Project Structure

```
Culvers_TidByt/
├── src/                    # Python source code
│   ├── culvers_scraper.py  # Web scraping logic
│   ├── calendar_updater.py # Google Calendar integration
│   └── monitoring.py       # Health checks
├── tidbyt/                 # Tidbyt app
│   ├── manifest.yaml
│   └── culvers_fotd.star
├── docs/                   # Documentation
├── logs/                   # Application logs
├── config.yaml             # Configuration
├── main.py                 # Main orchestration script
└── run.sh                  # Cron helper script
```

## Usage

### Manual Run

```bash
uv run python main.py
```

### Health Check

```bash
uv run python health_check.py
```

### View Tidbyt App

```bash
# Install Pixlet
brew install tidbyt/tidbyt/pixlet

# Serve locally
pixlet serve tidbyt/culvers_fotd.star
# Open http://localhost:8080
```

## Monitoring

Check system health:

```bash
# View status
cat status.json

# Check logs
tail -f logs/app.log

# Run health checks
uv run python health_check.py
```

## Troubleshooting

See the [Testing & Observability Summary](/.claude/plans/cheeky-questing-stream.md#testing--observability-summary) in the implementation plan for:
- Phase-by-phase verification steps
- Failure diagnosis commands
- Monitoring strategies

## Future Enhancements

- Multi-location support based on calendar/weather
- Cloud function deployment (AWS Lambda, GCP)
- More sophisticated Tidbyt icons
- Dashboard for viewing status

## License

MIT

## Credits

Built with Claude Code
