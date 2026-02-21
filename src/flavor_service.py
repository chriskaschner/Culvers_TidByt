"""
Culver's Flavor of the Day - Flavor Service

Fetches flavor data from Culver's restaurant pages and manages a local cache.
Both the Calendar Sync and Tidbyt Render consumers read from this cache.
"""

import os
import requests
from bs4 import BeautifulSoup
import json
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache configuration
DEFAULT_CACHE_PATH = Path(__file__).parent.parent / 'flavor_cache.json'
CACHE_VERSION = 1


def clean_text(text: str) -> str:
    """Remove trademark symbols and clean up text (names, descriptions, etc.)."""
    # Remove registered trademark, trademark, and copyright symbols
    text = text.replace('®', '').replace('™', '').replace('©', '')
    # Remove extra spaces that might result from symbol removal
    text = ' '.join(text.split())
    return text


def extract_json_data(html: str, key: str = "props") -> Optional[Dict]:
    """Extract embedded JSON data from script tags in the HTML."""
    try:
        soup = BeautifulSoup(html, 'html.parser')
        # Find the Next.js data script tag
        script_tags = soup.find_all('script', {'id': '__NEXT_DATA__'})
        
        for script in script_tags:
            if script.string:
                data = json.loads(script.string)
                return data.get(key, {})
        
        # Fallback: look for other script tags with JSON
        for script in soup.find_all('script', {'type': 'application/json'}):
            if script.string:
                try:
                    return json.loads(script.string)
                except json.JSONDecodeError:
                    continue
                    
        logger.warning("No embedded JSON data found in page")
        return None
    except Exception as e:
        logger.error(f"Error extracting JSON data: {e}")
        return None


def get_restaurant_info(restaurant_url: str) -> Dict[str, str]:
    """
    Get restaurant location information from a Culver's restaurant page.

    Args:
        restaurant_url: URL to the Culver's restaurant page

    Returns:
        Dictionary with 'name', 'address', 'city', 'state', 'phone', 'full_address' keys
    """
    try:
        logger.info(f"Fetching restaurant info from {restaurant_url}")
        response = requests.get(restaurant_url, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')
        text = soup.get_text()

        # Extract address using regex patterns
        # Pattern: "1700 Springdale St | Mt. Horeb, WI  | (608) 437-2858"
        # Pattern: "2102 West Beltline Hwy. | Madison, WI  | (608) 274-1221"
        address_pattern = r'(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Highway|Hwy\.?|Boulevard|Blvd|Lane|Ln|Way))\s*[|\s]+([A-Za-z\s.]+),\s*([A-Z]{2})\s*[|\s]+\((\d{3})\)\s*(\d{3}-\d{4})'
        match = re.search(address_pattern, text, re.IGNORECASE)

        if match:
            street = match.group(1).strip()
            city = match.group(2).strip()
            state = match.group(3).strip()
            phone = f"({match.group(4)}) {match.group(5)}"

            # Get restaurant name from URL
            name_slug = restaurant_url.rstrip('/').split('/')[-1]
            name = name_slug.replace('-', ' ').title()

            result = {
                'name': name,
                'address': street,
                'city': city,
                'state': state,
                'phone': phone,
                'full_address': f"{street}, {city}, {state}"
            }

            logger.info(f"Found restaurant: {result['full_address']}")
            return result
        else:
            logger.warning("Could not parse restaurant address from page")
            return {
                'name': 'Culver\'s',
                'address': '',
                'city': '',
                'state': '',
                'phone': '',
                'full_address': ''
            }

    except requests.RequestException as e:
        logger.error(f"HTTP error fetching {restaurant_url}: {e}")
        raise
    except Exception as e:
        logger.error(f"Error getting restaurant info: {e}")
        raise


def get_current_flavor(restaurant_url: str) -> Dict[str, str]:
    """
    Get the current Flavor of the Day from a Culver's restaurant page.

    Args:
        restaurant_url: URL to the Culver's restaurant page

    Returns:
        Dictionary with 'name', 'date', 'detail_url' keys
    """
    try:
        logger.info(f"Fetching current flavor from {restaurant_url}")
        response = requests.get(restaurant_url, timeout=10)
        response.raise_for_status()

        json_data = extract_json_data(response.text)
        if not json_data:
            raise ValueError("Could not extract JSON data from page")

        # Navigate through the JSON structure to find FOTD data
        page_props = json_data.get('pageProps', {})
        page = page_props.get('page', {})
        custom_data = page.get('customData', {})
        calendar_data = custom_data.get('restaurantCalendar', {})
        flavors = calendar_data.get('flavors', [])

        if not flavors:
            raise ValueError("No flavors found in calendar")

        # Get today's date
        today = datetime.now().date()

        # Find today's flavor
        current_flavor = None
        for flavor in flavors:
            # Parse the onDate field (format: "2026-02-08T00:00:00")
            flavor_date_str = flavor.get('onDate', '')
            flavor_date = datetime.fromisoformat(flavor_date_str.replace('Z', '+00:00')).date()

            if flavor_date == today:
                current_flavor = flavor
                break

        # If not found, take the first item (might be today or upcoming)
        if not current_flavor and flavors:
            current_flavor = flavors[0]

        if not current_flavor:
            raise ValueError("Could not find current flavor")

        name = current_flavor.get('title', 'Unknown')
        name = clean_text(name)  # Remove trademark symbols
        url_slug = current_flavor.get('urlSlug', name.lower().replace(' ', '-'))
        date_str = current_flavor.get('onDate', '').split('T')[0]

        result = {
            'name': name,
            'date': date_str,
            'detail_url': f"https://www.culvers.com/flavor-of-the-day/{url_slug}"
        }

        logger.info(f"Found current flavor: {name}")
        return result

    except requests.RequestException as e:
        logger.error(f"HTTP error fetching {restaurant_url}: {e}")
        raise
    except Exception as e:
        logger.error(f"Error getting current flavor: {e}")
        raise


def get_flavor_details(flavor_url: str) -> str:
    """
    Get flavor description from a Culver's flavor detail page.
    
    Args:
        flavor_url: URL to the flavor detail page
        
    Returns:
        Flavor description text
    """
    try:
        logger.info(f"Fetching flavor details from {flavor_url}")
        response = requests.get(flavor_url, timeout=10)
        response.raise_for_status()
        
        json_data = extract_json_data(response.text)
        if not json_data:
            raise ValueError("Could not extract JSON data from page")
        
        # Navigate to flavor details
        page_props = json_data.get('pageProps', {})
        custom_data = page_props.get('customData', {})
        flavor_details = custom_data.get('flavorDetails', {})
        
        description = flavor_details.get('description', '')
        
        if not description:
            # Fallback: try to parse from HTML
            soup = BeautifulSoup(response.text, 'html.parser')
            # Look for description in meta tags
            meta_desc = soup.find('meta', {'property': 'og:description'})
            if meta_desc:
                description = meta_desc.get('content', '')
        
        logger.info(f"Found description: {description[:50]}...")
        return description
        
    except requests.RequestException as e:
        logger.error(f"HTTP error fetching {flavor_url}: {e}")
        raise
    except Exception as e:
        logger.error(f"Error getting flavor details: {e}")
        raise


def get_flavor_calendar(restaurant_url: str, days: int = 5) -> List[Dict[str, str]]:
    """
    Get the upcoming flavor calendar from a Culver's restaurant page.

    Args:
        restaurant_url: URL to the Culver's restaurant page
        days: Number of days to fetch (will try to get up to this many)

    Returns:
        List of dictionaries with 'date', 'name', 'description' keys
    """
    try:
        logger.info(f"Fetching flavor calendar from {restaurant_url}")
        response = requests.get(restaurant_url, timeout=10)
        response.raise_for_status()

        json_data = extract_json_data(response.text)
        if not json_data:
            raise ValueError("Could not extract JSON data from page")

        page_props = json_data.get('pageProps', {})
        page = page_props.get('page', {})
        custom_data = page.get('customData', {})
        calendar_data = custom_data.get('restaurantCalendar', {})
        flavor_items = calendar_data.get('flavors', [])

        if not flavor_items:
            raise ValueError("No calendar items found")

        # Get today's date for filtering
        today = datetime.now().date()

        # Process calendar items
        flavors = []
        for item in flavor_items:
            try:
                # Parse the onDate field (format: "2026-02-08T00:00:00")
                date_str = item.get('onDate', '')
                item_date = datetime.fromisoformat(date_str.replace('Z', '+00:00')).date()

                # Only include today and future dates
                if item_date < today:
                    continue

                name = item.get('title', 'Unknown')
                name = clean_text(name)  # Remove trademark symbols
                description = item.get('description', f"Delicious {name} frozen custard")
                description = clean_text(description)  # Remove trademark symbols from description too
                url_slug = item.get('urlSlug', name.lower().replace(' ', '-'))
                detail_url = f"https://www.culvers.com/flavor-of-the-day/{url_slug}"

                flavor_entry = {
                    'date': date_str.split('T')[0],  # Convert to YYYY-MM-DD
                    'name': name,
                    'description': description,
                    'detail_url': detail_url
                }

                flavors.append(flavor_entry)

            except (ValueError, KeyError) as e:
                logger.warning(f"Error processing calendar item: {e}")
                continue

        logger.info(f"Retrieved {len(flavors)} upcoming flavors")

        # Warn if we got significantly fewer than requested
        if len(flavors) < days and len(flavors) < 5:
            logger.warning(
                f"Only {len(flavors)} flavors available (requested {days}). "
                f"Culver's may not have published the full calendar yet."
            )
        elif len(flavors) < days:
            logger.info(
                f"Got {len(flavors)} of {days} requested flavors. "
                f"This is all that Culver's has scheduled."
            )

        return flavors

    except requests.RequestException as e:
        logger.error(f"HTTP error fetching {restaurant_url}: {e}")
        raise
    except Exception as e:
        logger.error(f"Error getting flavor calendar: {e}")
        raise


def _location_slug(name: str) -> str:
    """Convert location name to slug key, e.g. 'Mt. Horeb' -> 'mt-horeb'."""
    return name.lower().replace('.', '').replace(' ', '-')


def fetch_and_cache(config: Dict, cache_path: str = None) -> Dict:
    """
    Fetch flavor data for all enabled locations and write to cache.

    Args:
        config: Parsed config.yaml dict
        cache_path: Override path for flavor_cache.json

    Returns:
        The cache dict that was written
    """
    if cache_path is None:
        cache_path = str(DEFAULT_CACHE_PATH)

    locations = config.get('culvers', {}).get('locations', [])
    calendar_days = config.get('culvers', {}).get('calendar_days', 30)

    cache_data = {
        'version': CACHE_VERSION,
        'timestamp': datetime.now().isoformat(),
        'locations': {}
    }

    for location in locations:
        if not location.get('enabled', False):
            logger.info(f"Skipping disabled location: {location.get('name')}")
            continue

        name = location.get('name', 'Unknown')
        url = location.get('url')
        slug = _location_slug(name)

        if not url:
            logger.error(f"No URL for location: {name}")
            continue

        try:
            restaurant_info = get_restaurant_info(url)
            flavors = get_flavor_calendar(url, days=calendar_days)

            cache_data['locations'][slug] = {
                'name': name,
                'url': url,
                'role': location.get('role', ''),
                'restaurant_info': restaurant_info,
                'flavors': flavors
            }

            logger.info(f"Cached {len(flavors)} flavors for {name}")

        except Exception as e:
            logger.error(f"Error fetching {name}: {e}")

    with open(cache_path, 'w') as f:
        json.dump(cache_data, f, indent=2)

    logger.info(f"Cache written to {cache_path}")
    return cache_data


def load_cache(cache_path: str = None) -> Dict:
    """
    Load flavor data from cache file.

    Args:
        cache_path: Override path for flavor_cache.json

    Returns:
        Parsed cache dict

    Raises:
        FileNotFoundError: If cache file does not exist
    """
    if cache_path is None:
        cache_path = str(DEFAULT_CACHE_PATH)

    if not os.path.exists(cache_path):
        raise FileNotFoundError(
            f"Cache file not found: {cache_path}. "
            f"Run with --fetch-only first."
        )

    with open(cache_path, 'r') as f:
        return json.load(f)


def get_primary_location(cache_data: Dict) -> Optional[Dict]:
    """Get the primary location data from cache."""
    for slug, loc in cache_data.get('locations', {}).items():
        if loc.get('role') == 'primary':
            return loc
    return None


def get_backup_location(cache_data: Dict) -> Optional[Dict]:
    """Get the backup location data from cache."""
    for slug, loc in cache_data.get('locations', {}).items():
        if loc.get('role') == 'backup':
            return loc
    return None


if __name__ == "__main__":
    import yaml

    print("Testing Flavor Service...")
    print("-" * 50)

    try:
        # Test direct scraper functions
        test_url = "https://www.culvers.com/restaurants/mt-horeb"

        current = get_current_flavor(test_url)
        print(f"\nCurrent Flavor: {current['name']}")
        print(f"Date: {current['date']}")

        calendar = get_flavor_calendar(test_url, days=5)
        print(f"\nUpcoming Flavors ({len(calendar)} days):")
        for flavor in calendar:
            print(f"  {flavor['date']}: {flavor['name']}")

        # Test fetch_and_cache with config
        config_path = Path(__file__).parent.parent / 'config.yaml'
        if config_path.exists():
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)

            print(f"\nTesting fetch_and_cache...")
            cache_data = fetch_and_cache(config)
            print(f"Cached {len(cache_data['locations'])} locations")

            # Test load_cache
            loaded = load_cache()
            print(f"Loaded cache with {len(loaded['locations'])} locations")

            primary = get_primary_location(loaded)
            if primary:
                print(f"Primary: {primary['name']} ({len(primary['flavors'])} flavors)")

        print("\nAll flavor service tests passed!")

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
