#!/usr/bin/env python3
"""
Culver's Flavor of the Day Tracker - Main Orchestration Script

Fetches flavor calendars from configured locations and syncs to Google Calendar
with backup options included in event descriptions.
"""

import sys
import yaml
import logging
from datetime import datetime
from typing import Dict, List, Optional

from src.culvers_scraper import get_restaurant_info, get_flavor_calendar
from src.calendar_updater import authenticate, sync_calendar

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def load_config(config_path: str = 'config.yaml') -> Dict:
    """Load configuration from YAML file."""
    try:
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        logger.info(f"Loaded configuration from {config_path}")
        return config
    except FileNotFoundError:
        logger.error(f"Configuration file not found: {config_path}")
        sys.exit(1)
    except yaml.YAMLError as e:
        logger.error(f"Error parsing configuration file: {e}")
        sys.exit(1)


def get_locations_by_role(config: Dict) -> Dict[str, Optional[Dict]]:
    """
    Extract primary and backup locations from config.

    Returns:
        Dict with 'primary' and 'backup' keys containing location configs
    """
    locations = config.get('culvers', {}).get('locations', [])

    primary = None
    backup = None

    for location in locations:
        if not location.get('enabled', False):
            logger.info(f"Skipping disabled location: {location.get('name')}")
            continue

        role = location.get('role', '').lower()
        if role == 'primary':
            primary = location
        elif role == 'backup':
            backup = location

    if not primary:
        logger.warning("No primary location found in config")

    return {'primary': primary, 'backup': backup}


def fetch_location_data(location: Dict, calendar_days: int) -> tuple:
    """
    Fetch restaurant info and flavor calendar for a location.

    Returns:
        Tuple of (restaurant_info, flavors)
    """
    location_name = location.get('name', 'Unknown')
    location_url = location.get('url')

    if not location_url:
        logger.error(f"No URL configured for location: {location_name}")
        return None, None

    try:
        logger.info(f"Fetching data for {location_name}...")

        # Get restaurant info
        restaurant_info = get_restaurant_info(location_url)
        logger.info(f"  Address: {restaurant_info['full_address']}")

        # Get flavor calendar
        flavors = get_flavor_calendar(location_url, days=calendar_days)
        logger.info(f"  Flavors: {len(flavors)}")

        return restaurant_info, flavors

    except Exception as e:
        logger.error(f"Error fetching data for {location_name}: {e}")
        return None, None


def main():
    """Main orchestration function."""
    logger.info("=" * 60)
    logger.info("Culver's Flavor of the Day Tracker - Starting")
    logger.info("=" * 60)

    # Load configuration
    config = load_config()
    calendar_days = config.get('culvers', {}).get('calendar_days', 30)
    calendar_id = config.get('google_calendar', {}).get('calendar_id')

    if not calendar_id:
        logger.error("No calendar_id configured in google_calendar section")
        sys.exit(1)

    # Get primary and backup locations
    locations = get_locations_by_role(config)
    primary = locations['primary']
    backup = locations['backup']

    if not primary:
        logger.error("No primary location configured - cannot proceed")
        sys.exit(1)

    # Fetch primary location data
    primary_info, primary_flavors = fetch_location_data(primary, calendar_days)

    if not primary_flavors:
        logger.error("Failed to fetch primary location flavors - cannot proceed")
        sys.exit(1)

    # Fetch backup location data (optional)
    backup_flavors = None
    backup_name = None

    if backup:
        backup_info, backup_flavors = fetch_location_data(backup, calendar_days)
        if backup_flavors:
            backup_name = backup.get('name')
            logger.info(f"Will include backup options from {backup_name}")
        else:
            logger.warning("Failed to fetch backup location - proceeding without backup options")
    else:
        logger.info("No backup location configured")

    # Authenticate with Google Calendar
    logger.info("\nAuthenticating with Google Calendar...")
    try:
        service = authenticate()
    except Exception as e:
        logger.error(f"Authentication failed: {e}")
        sys.exit(1)

    # Sync to calendar
    logger.info(f"\nSyncing to calendar: {calendar_id}")
    logger.info(f"Primary location: {primary.get('name')}")

    try:
        stats = sync_calendar(
            service,
            primary_flavors,
            calendar_id=calendar_id,
            restaurant_url=primary.get('url'),
            restaurant_location=primary_info['full_address'] if primary_info else '',
            backup_flavors=backup_flavors,
            backup_location_name=backup_name
        )

        logger.info("\n" + "=" * 60)
        logger.info("✅ Sync Complete!")
        logger.info(f"   Created: {stats['created']}")
        logger.info(f"   Updated: {stats['updated']}")
        logger.info(f"   Errors: {stats['errors']}")
        logger.info("=" * 60)

        if stats['errors'] > 0:
            logger.warning(f"Completed with {stats['errors']} errors - check logs above")
            sys.exit(1)

    except Exception as e:
        logger.error(f"Sync failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\n\nInterrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
