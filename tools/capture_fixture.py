"""Capture __NEXT_DATA__ fixtures from Culver's restaurant pages for JS test fixtures."""

import json
import sys
import os

# Add project root to path so we can import flavor_service
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
from src.flavor_service import extract_json_data, get_flavor_calendar, get_restaurant_info


FIXTURES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "worker", "test", "fixtures"
)


def capture_nextdata(slug: str) -> dict:
    """Fetch a restaurant page and extract the raw __NEXT_DATA__ JSON."""
    url = f"https://www.culvers.com/restaurants/{slug}"
    print(f"Fetching {url}...")
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()

    # Extract the full __NEXT_DATA__ props
    data = extract_json_data(resp.text)
    if not data:
        raise ValueError(f"No __NEXT_DATA__ found for {slug}")
    return data


def generate_expected_output(slug: str) -> dict:
    """Run the Python flavor_service parser and capture its output as the golden reference."""
    url = f"https://www.culvers.com/restaurants/{slug}"

    restaurant_info = get_restaurant_info(url)
    flavors = get_flavor_calendar(url, days=30)

    return {
        "name": restaurant_info.get("name", ""),
        "city": restaurant_info.get("city", ""),
        "state": restaurant_info.get("state", ""),
        "address": restaurant_info.get("address", ""),
        "flavors": flavors,
    }


def main():
    slugs = ["mt-horeb", "madison-todd-drive"]

    for slug in slugs:
        safe_name = slug  # slug is already filesystem-safe

        # Capture raw __NEXT_DATA__
        nextdata = capture_nextdata(slug)
        nextdata_path = os.path.join(FIXTURES_DIR, f"{safe_name}-nextdata.json")
        with open(nextdata_path, "w") as f:
            json.dump(nextdata, f, indent=2)
        print(f"  Saved __NEXT_DATA__ to {nextdata_path}")

        # Generate expected output from Python parser
        expected = generate_expected_output(slug)
        expected_path = os.path.join(FIXTURES_DIR, f"{safe_name}-expected.json")
        with open(expected_path, "w") as f:
            json.dump(expected, f, indent=2)
        print(f"  Saved expected output to {expected_path}")
        print(f"  {len(expected['flavors'])} flavors captured")
        print()


if __name__ == "__main__":
    main()
