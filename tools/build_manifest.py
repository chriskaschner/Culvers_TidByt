"""
Build a store manifest (stores.json) of all Culver's restaurant locations.

Strategy:
1. Query Culver's locator API using zip code grid across all states
2. Each API call returns the 10 nearest stores with verified slugs
3. Deduplicate by slug and write stores.json

The locator API at /api/locator/getLocations accepts city/state or zip codes
and returns up to 10 nearest stores with real slugs, addresses, and metadata.

Usage:
    uv run python tools/build_manifest.py                    # Full build (~5 min)
    uv run python tools/build_manifest.py --dry-run          # Show zip ranges without querying
    uv run python tools/build_manifest.py --state WI         # Only query Wisconsin
    uv run python tools/build_manifest.py --state WI,IL,MN   # Multiple states
"""

import argparse
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Dict, List

import requests

logger = logging.getLogger(__name__)

LOCATOR_API = "https://www.culvers.com/api/locator/getLocations"
OUTPUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "site", "stores.json"
)
RATE_LIMIT_DELAY = 0.15  # seconds between API calls

# Zip code ranges by state. Uses every Nth zip for coverage.
# The locator API returns 10 nearest stores per query, so we need
# enough density that every store falls within range of at least one query.
ZIP_RANGES = {
    "WI": (53001, 54990, 5),
    "IL": (60001, 62999, 5),
    "MN": (55001, 56763, 5),
    "MI": (48001, 49971, 5),
    "IN": (46001, 47997, 5),
    "IA": (50001, 52809, 5),
    "MO": (63001, 65899, 8),
    "OH": (43001, 45999, 8),
    "FL": (32003, 34997, 5),
    "AZ": (85001, 86556, 8),
    "CO": (80001, 81658, 8),
    "KS": (66002, 67954, 10),
    "NE": (68001, 69367, 10),
    "SD": (57001, 57799, 10),
    "ND": (58001, 58856, 10),
    "TX": (75001, 79999, 10),
    "KY": (40003, 42788, 10),
    "TN": (37010, 38589, 10),
    "NC": (27006, 28909, 10),
    "SC": (29001, 29945, 10),
    "GA": (30002, 31999, 10),
    "AL": (35004, 36925, 10),
    "UT": (84001, 84791, 8),
    "ID": (83201, 83877, 10),
    "WY": (82001, 82944, 15),
}


def fetch_locator_stores(location: str, session: requests.Session) -> List[Dict]:
    """Query Culver's locator API for stores near a location.

    Returns up to 10 stores with verified slugs.
    """
    try:
        resp = session.get(
            LOCATOR_API,
            params={"location": location},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        stores = []
        for geofence in data.get("data", {}).get("geofences", []):
            meta = geofence.get("metadata", {})
            slug = meta.get("slug", "")
            if not slug:
                continue

            stores.append({
                "slug": slug,
                "name": f"{meta.get('city', '').split(',')[0].strip()}, {meta.get('state', '')}",
                "city": meta.get("city", "").split(",")[0].strip(),
                "state": meta.get("state", ""),
                "address": meta.get("street", ""),
            })

        return stores

    except requests.RequestException as e:
        logger.warning(f"Error querying locator for '{location}': {e}")
        return []


def normalize_slug(text: str) -> str:
    """Normalize a text string into a URL slug."""
    slug = text.lower()
    slug = slug.replace(".", "")
    slug = slug.replace("'", "")
    slug = re.sub(r"[^a-z0-9\-]", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    slug = slug.strip("-")
    return slug


def generate_candidate_slugs(city: str, state: str, street: str) -> List[str]:
    """Generate candidate URL slugs from a location entry.

    Kept for tests and as a fallback. The primary discovery method
    is now the locator API.
    """
    candidates = set()

    city_slug = normalize_slug(city)
    state_slug = state.lower() if state else ""
    street_slug = normalize_slug(street)
    street_name_slug = re.sub(r"^\d+-", "", street_slug)

    candidates.add(city_slug)

    if state_slug:
        candidates.add(f"{city_slug}-{state_slug}")

    if street_slug:
        candidates.add(f"{city_slug}-{street_slug}")
        if state_slug:
            candidates.add(f"{city_slug}-{state_slug}-{street_slug}")

    if street_name_slug and street_name_slug != street_slug:
        candidates.add(f"{city_slug}-{street_name_slug}")

    if street_name_slug:
        parts = street_name_slug.split("-")
        if parts:
            candidates.add(f"{city_slug}-{parts[0]}")
        if len(parts) >= 2:
            candidates.add(f"{city_slug}-{parts[0]}-{parts[1]}")

    expansions = {
        "dr": "drive", "st": "street", "ave": "avenue",
        "blvd": "boulevard", "rd": "road", "ln": "lane",
        "ct": "court", "hwy": "highway", "pkwy": "parkway",
    }

    for abbr, full in expansions.items():
        for slug_variant in [street_slug, street_name_slug]:
            if slug_variant.endswith(f"-{abbr}"):
                expanded = slug_variant[:-len(abbr)] + full
                candidates.add(f"{city_slug}-{expanded}")
            elif slug_variant == abbr:
                candidates.add(f"{city_slug}-{full}")

    return sorted(set(candidates))


def parse_locations_by_state_html(html: str) -> List[Dict[str, str]]:
    """Parse the locations-by-state page for city/state/street entries."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    entries = []

    pattern = re.compile(
        r"Culver'?s\s+of\s+(.+?),\s*([A-Z]{2})\s*[-\u2013]\s*(.+)",
        re.IGNORECASE
    )

    for text_node in soup.stripped_strings:
        match = pattern.search(text_node)
        if match:
            city = match.group(1).strip()
            state = match.group(2).strip().upper()
            street = match.group(3).strip()
            entries.append({"city": city, "state": state, "street": street})

    return entries


def validate_manifest(manifest: Dict) -> List[str]:
    """Validate a manifest for required fields and consistency."""
    errors = []

    required_top = ["generated", "count", "stores"]
    for field in required_top:
        if field not in manifest:
            errors.append(f"Missing top-level field: {field}")

    if "stores" not in manifest:
        return errors

    required_store = ["slug", "name", "city", "state", "address"]
    slugs_seen = set()

    for i, store in enumerate(manifest["stores"]):
        for field in required_store:
            if field not in store:
                errors.append(f"Store #{i} missing field: {field}")

        slug = store.get("slug", "")
        if slug in slugs_seen:
            errors.append(f"Duplicate slug: {slug}")
        slugs_seen.add(slug)

    return errors


def build_manifest(
    output_path: str = OUTPUT_PATH,
    dry_run: bool = False,
    state_filter: str = "",
) -> Dict:
    """Full pipeline: zip code grid search -> deduplicate -> write manifest."""

    # Select states to scan
    if state_filter:
        states = [s.strip().upper() for s in state_filter.split(",")]
        zip_ranges = {}
        for s in states:
            if s in ZIP_RANGES:
                zip_ranges[s] = ZIP_RANGES[s]
            else:
                print(f"  WARNING: No zip range for state '{s}'")
        if not zip_ranges:
            print("No valid states specified.")
            return {}
    else:
        zip_ranges = ZIP_RANGES

    # Generate all zip codes to query
    all_zips = []
    for state, (start, end, step) in sorted(zip_ranges.items()):
        state_zips = list(range(start, end + 1, step))
        all_zips.extend((str(z), state) for z in state_zips)

    print(f"Scanning {len(zip_ranges)} states with {len(all_zips)} zip code queries...")

    if dry_run:
        for state, (start, end, step) in sorted(zip_ranges.items()):
            count = len(range(start, end + 1, step))
            print(f"  {state}: {count} queries ({start}-{end}, step {step})")
        print(f"  Total: {len(all_zips)} queries")
        return {}

    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 (compatible; CulversFOTD/1.0)"})

    confirmed = {}
    current_state = None
    state_start_count = 0
    queries_done = 0

    for zipcode, state in all_zips:
        # Track state transitions for progress reporting
        if state != current_state:
            if current_state is not None:
                state_new = len(confirmed) - state_start_count
                print(f"  {current_state}: {state_new} new stores, {len(confirmed)} total")
                _save_manifest(confirmed, output_path)
            current_state = state
            state_start_count = len(confirmed)

        stores = fetch_locator_stores(zipcode, session)
        for store in stores:
            if store["slug"] not in confirmed:
                confirmed[store["slug"]] = store

        queries_done += 1
        time.sleep(RATE_LIMIT_DELAY)

    # Final state
    if current_state:
        state_new = len(confirmed) - state_start_count
        print(f"  {current_state}: {state_new} new stores, {len(confirmed)} total")

    print(f"\nTotal: {len(confirmed)} unique stores from {queries_done} queries")
    _save_manifest(confirmed, output_path)
    return json.load(open(output_path))


def _save_manifest(confirmed: Dict, output_path: str):
    """Write current confirmed stores to manifest file."""
    stores = sorted(confirmed.values(), key=lambda s: (s.get("state", ""), s.get("city", ""), s.get("slug", "")))

    manifest = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "count": len(stores),
        "stores": stores,
    }

    errors = validate_manifest(manifest)
    if errors:
        print(f"  WARNING: Manifest validation errors: {errors}")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(manifest, f, indent=2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build Culver's store manifest")
    parser.add_argument("--dry-run", action="store_true", help="Show query plan without executing")
    parser.add_argument("--state", default="", help="Comma-separated state codes (e.g., WI,IL)")
    parser.add_argument("--output", default=OUTPUT_PATH, help="Output path for stores.json")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    build_manifest(output_path=args.output, dry_run=args.dry_run, state_filter=args.state)
