"""
Google Calendar Sync for Culver's Flavor of the Day

Manages authentication and syncing of flavor events to Google Calendar.
Consumes data from flavor_cache.json via sync_from_cache().
"""

import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Scopes required for calendar access
SCOPES = ['https://www.googleapis.com/auth/calendar']

# Paths for credentials
CREDENTIALS_FILE = 'credentials/credentials.json'
TOKEN_FILE = 'credentials/token.json'


def authenticate():
    """
    Authenticate with Google Calendar API using OAuth 2.0.
    
    Returns:
        Google Calendar service object
    """
    creds = None
    
    # Check if token file exists
    if os.path.exists(TOKEN_FILE):
        logger.info("Loading existing credentials...")
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    
    # If credentials are invalid or don't exist, authenticate
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            logger.info("Refreshing expired credentials...")
            try:
                creds.refresh(Request())
            except Exception as e:
                logger.warning(f"Could not refresh token: {e}")
                creds = None
        
        if not creds:
            logger.info("Starting OAuth authentication flow...")
            if not os.path.exists(CREDENTIALS_FILE):
                raise FileNotFoundError(
                    f"Credentials file not found at {CREDENTIALS_FILE}. "
                    f"Please follow the setup guide in docs/GOOGLE_API_SETUP.md"
                )
            
            flow = InstalledAppFlow.from_client_secrets_file(
                CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
            
        # Save the credentials for the next run
        logger.info(f"Saving credentials to {TOKEN_FILE}...")
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())
    
    try:
        service = build('calendar', 'v3', credentials=creds)
        logger.info("✓ Successfully authenticated with Google Calendar API")
        return service
    except HttpError as e:
        logger.error(f"Error building calendar service: {e}")
        raise


def create_or_update_event(
    service,
    date: str,
    flavor_name: str,
    description: str,
    restaurant_url: str = '',
    restaurant_location: str = '',
    calendar_id: str = 'primary',
    backup_option: Dict[str, str] = None
) -> Dict:
    """
    Create or update a calendar event for a flavor of the day.

    Args:
        service: Google Calendar service object
        date: Date in YYYY-MM-DD format
        flavor_name: Name of the flavor
        description: Flavor description
        restaurant_url: URL to the restaurant page (optional)
        restaurant_location: Physical address of the restaurant (optional)
        calendar_id: Calendar ID (default: 'primary')
        backup_option: Optional dict with 'name' and 'location_name' for secondary location

    Returns:
        Created or updated event
    """
    try:
        # Format event title with ice cream emoji
        summary = f"🍦 {flavor_name}"

        # Parse date and create all-day event times
        event_date = datetime.strptime(date, '%Y-%m-%d')
        start_date = event_date.strftime('%Y-%m-%d')
        end_date = (event_date + timedelta(days=1)).strftime('%Y-%m-%d')

        # Build description with URL if provided
        full_description = description
        if restaurant_url:
            full_description += f"\nMore info: {restaurant_url}"

        # Add backup option if provided
        if backup_option:
            full_description += f"\n\nBackup Option\n🍨: {backup_option['name']} - {backup_option['location_name']}"

        # Event structure
        event_body = {
            'summary': summary,
            'description': full_description,
            'start': {
                'date': start_date,
            },
            'end': {
                'date': end_date,
            },
            'transparency': 'transparent',  # Show as "Free" not "Busy"
            'reminders': {
                'useDefault': False,
                'overrides': []
            }
        }

        # Add location if provided
        if restaurant_location:
            event_body['location'] = restaurant_location
        
        # Check if event already exists for this date
        existing_event = find_event_by_date_and_title(
            service, calendar_id, start_date, summary
        )
        
        if existing_event:
            # Update existing event
            event_id = existing_event['id']
            logger.info(f"Updating existing event: {summary} on {date}")
            event = service.events().update(
                calendarId=calendar_id,
                eventId=event_id,
                body=event_body
            ).execute()
            logger.info(f"✓ Updated event: {event.get('htmlLink')}")
        else:
            # Create new event
            logger.info(f"Creating new event: {summary} on {date}")
            event = service.events().insert(
                calendarId=calendar_id,
                body=event_body
            ).execute()
            logger.info(f"✓ Created event: {event.get('htmlLink')}")
        
        return event
        
    except HttpError as e:
        logger.error(f"Error creating/updating event: {e}")
        raise


def find_event_by_date_and_title(
    service,
    calendar_id: str,
    date: str,
    title: str
) -> Optional[Dict]:
    """
    Find an existing event by date and title.
    
    Args:
        service: Google Calendar service object
        calendar_id: Calendar ID
        date: Date in YYYY-MM-DD format
        title: Event title to match
        
    Returns:
        Event dict if found, None otherwise
    """
    try:
        # Query events for the specific date
        time_min = f"{date}T00:00:00Z"
        time_max = f"{date}T23:59:59Z"
        
        events_result = service.events().list(
            calendarId=calendar_id,
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        
        # Look for event with matching title
        for event in events:
            if event.get('summary', '') == title:
                return event
        
        return None
        
    except HttpError as e:
        logger.warning(f"Error searching for existing event: {e}")
        return None


def sync_calendar(
    service,
    flavors: List[Dict[str, str]],
    calendar_id: str = 'primary',
    restaurant_url: str = '',
    restaurant_location: str = '',
    backup_flavors: List[Dict[str, str]] = None,
    backup_location_name: str = ''
) -> Dict[str, int]:
    """
    Sync a list of flavors to Google Calendar with optional backup location.

    Args:
        service: Google Calendar service object
        flavors: List of flavor dicts with 'date', 'name', 'description'
        calendar_id: Calendar ID (default: 'primary')
        restaurant_url: URL to the restaurant page (optional)
        restaurant_location: Physical address of the restaurant (optional)
        backup_flavors: Optional list of backup location flavors
        backup_location_name: Name of backup location (e.g., "Todd Dr")

    Returns:
        Dict with sync statistics
    """
    stats = {
        'created': 0,
        'updated': 0,
        'errors': 0
    }

    logger.info(f"Syncing {len(flavors)} flavors to calendar '{calendar_id}'")

    # Create a lookup dict for backup flavors by date
    backup_by_date = {}
    if backup_flavors and backup_location_name:
        for backup in backup_flavors:
            backup_by_date[backup['date']] = {
                'name': backup['name'],
                'location_name': backup_location_name
            }
        logger.info(f"Including backup options from {backup_location_name}")

    for flavor in flavors:
        try:
            date = flavor.get('date', '')
            name = flavor.get('name', 'Unknown')
            description = flavor.get('description', '')

            # Check if event exists to determine if creating or updating
            summary = f"🍦 {name}"
            existing = find_event_by_date_and_title(
                service, calendar_id, date, summary
            )

            # Get backup option for this date if available
            backup_option = backup_by_date.get(date)

            # Create or update
            create_or_update_event(
                service, date, name, description,
                restaurant_url, restaurant_location, calendar_id,
                backup_option=backup_option
            )

            if existing:
                stats['updated'] += 1
            else:
                stats['created'] += 1

        except Exception as e:
            logger.error(f"Error syncing flavor {name} on {date}: {e}")
            stats['errors'] += 1

    logger.info(
        f"Sync complete: {stats['created']} created, "
        f"{stats['updated']} updated, {stats['errors']} errors"
    )

    return stats


def delete_past_events(
    service,
    calendar_id: str = 'primary',
    days_back: int = 7
) -> int:
    """
    Delete old flavor events from the calendar (optional cleanup).
    
    Args:
        service: Google Calendar service object
        calendar_id: Calendar ID
        days_back: How many days back to delete (default: 7)
        
    Returns:
        Number of events deleted
    """
    try:
        # Calculate time range
        today = datetime.now().date()
        cutoff_date = today - timedelta(days=days_back)
        
        time_min = cutoff_date.isoformat() + 'T00:00:00Z'
        time_max = today.isoformat() + 'T00:00:00Z'
        
        # Query old events
        logger.info(f"Searching for old events before {today}...")
        events_result = service.events().list(
            calendarId=calendar_id,
            timeMin=time_min,
            timeMax=time_max,
            q="🍦",  # Search for events with ice cream emoji
            singleEvents=True
        ).execute()
        
        events = events_result.get('items', [])
        deleted = 0
        
        for event in events:
            try:
                service.events().delete(
                    calendarId=calendar_id,
                    eventId=event['id']
                ).execute()
                deleted += 1
                logger.info(f"Deleted old event: {event.get('summary')}")
            except HttpError as e:
                logger.warning(f"Could not delete event: {e}")
        
        logger.info(f"Deleted {deleted} old events")
        return deleted
        
    except HttpError as e:
        logger.error(f"Error deleting past events: {e}")
        return 0


def sync_from_cache(service, cache_data: Dict, calendar_id: str) -> Dict[str, int]:
    """
    Sync calendar events from cached flavor data.

    Extracts primary and backup locations from the cache, then calls sync_calendar().

    Args:
        service: Google Calendar service object
        cache_data: Loaded cache dict from flavor_service.load_cache()
        calendar_id: Google Calendar ID

    Returns:
        Dict with sync statistics (created, updated, errors)
    """
    from src.flavor_service import get_primary_location, get_backup_location

    primary = get_primary_location(cache_data)
    if not primary:
        raise ValueError("No primary location found in cache")

    backup = get_backup_location(cache_data)

    return sync_calendar(
        service,
        primary['flavors'],
        calendar_id=calendar_id,
        restaurant_url=primary.get('url', ''),
        restaurant_location=primary.get('restaurant_info', {}).get('full_address', ''),
        backup_flavors=backup['flavors'] if backup else None,
        backup_location_name=backup.get('name', '') if backup else ''
    )


if __name__ == "__main__":
    # Test the calendar functions
    print("Testing Google Calendar Integration...")
    print("-" * 50)
    
    try:
        # Test authentication
        print("\n1. Testing authentication...")
        service = authenticate()
        print("✓ Authentication successful")
        
        # Test listing calendars
        print("\n2. Listing available calendars...")
        calendars = service.calendarList().list().execute()
        for cal in calendars.get('items', []):
            print(f"   - {cal['summary']}: {cal['id']}")
        
        # Test creating a test event
        print("\n3. Creating a test event...")
        from datetime import date, timedelta
        test_date = (date.today() + timedelta(days=1)).strftime('%Y-%m-%d')
        test_event = create_or_update_event(
            service,
            test_date,
            'Test Flavor (Safe to Delete)',
            'This is a test event created by the Culvers FOTD Tracker. Safe to delete.'
        )
        print(f"✓ Test event created for {test_date}")
        print(f"  View it at: {test_event.get('htmlLink')}")
        
        print("\n✅ All calendar tests passed!")
        print("\nNote: Check your Google Calendar to see the test event.")
        print("You can safely delete it.")
        
    except FileNotFoundError as e:
        print(f"\n❌ Error: {e}")
        print("\nPlease follow the setup guide in docs/GOOGLE_API_SETUP.md")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
