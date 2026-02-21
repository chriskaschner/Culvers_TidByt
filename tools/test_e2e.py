"""
End-to-end validation of the .ics calendar output.

Tests the full pipeline: store slugs -> flavor data -> .ics generation.
Can run against either:
  - Local Worker (via wrangler dev)
  - Generated .ics content directly (no Worker needed)

Usage:
    uv run pytest tools/test_e2e.py -v
"""

import json
import os
import sys
import pytest

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import icalendar for parsing
try:
    from icalendar import Calendar
except ImportError:
    pytest.skip("icalendar not installed (run: uv sync --extra dev)", allow_module_level=True)


FIXTURES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "worker", "test", "fixtures"
)


def load_fixture(slug):
    """Load expected flavor data for a store from fixture files."""
    path = os.path.join(FIXTURES_DIR, f"{slug}-expected.json")
    with open(path) as f:
        return json.load(f)


def generate_ics_via_subprocess(primary_slug, secondary_slugs=None):
    """Generate .ics by calling the Worker's JS code via Node subprocess.

    This avoids needing wrangler dev running and tests the actual JS output.
    """
    import subprocess

    # Build a small Node script that imports and calls the generator
    secondary_list = secondary_slugs or []
    fixtures = {primary_slug: load_fixture(primary_slug)}
    for slug in secondary_list:
        fixtures[slug] = load_fixture(slug)

    stores = [{"slug": primary_slug, "name": fixtures[primary_slug]["name"], "role": "primary"}]
    for slug in secondary_list:
        stores.append({"slug": slug, "name": fixtures[slug]["name"], "role": "secondary"})

    flavors_by_slug = {}
    for slug, data in fixtures.items():
        flavors_by_slug[slug] = [
            {"date": f["date"], "title": f["name"], "description": f["description"]}
            for f in data["flavors"]
        ]

    node_script = f"""
    import {{ generateIcs }} from './worker/src/ics-generator.js';
    const result = generateIcs({{
      calendarName: "Culver's FOTD - {fixtures[primary_slug]['name']}",
      stores: {json.dumps(stores)},
      flavorsBySlug: {json.dumps(flavors_by_slug)},
    }});
    process.stdout.write(result);
    """

    result = subprocess.run(
        ["node", "--input-type=module", "-e", node_script],
        capture_output=True, text=True,
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    )

    if result.returncode != 0:
        raise RuntimeError(f"Node.js execution failed: {result.stderr}")

    return result.stdout


class TestEndToEnd:
    """End-to-end tests for .ics calendar output correctness."""

    @pytest.fixture
    def primary_ics(self):
        """Generate .ics with primary store only."""
        return generate_ics_via_subprocess("mt-horeb")

    @pytest.fixture
    def primary_with_backup_ics(self):
        """Generate .ics with primary + one backup store."""
        return generate_ics_via_subprocess("mt-horeb", ["madison-todd-drive"])

    def test_valid_vcalendar(self, primary_ics):
        """The output parses as a valid iCalendar."""
        cal = Calendar.from_ical(primary_ics)
        assert cal.get("version") == "2.0"
        assert cal.get("prodid") is not None

    def test_has_calendar_name(self, primary_ics):
        """X-WR-CALNAME is set for calendar identification."""
        cal = Calendar.from_ical(primary_ics)
        calname = cal.get("x-wr-calname")
        assert calname is not None
        assert "Culver" in str(calname)

    def test_has_events(self, primary_ics):
        """Calendar contains VEVENT components."""
        cal = Calendar.from_ical(primary_ics)
        events = [c for c in cal.walk() if c.name == "VEVENT"]
        assert len(events) > 0

    def test_no_valarm_anywhere(self, primary_with_backup_ics):
        """No VALARM components exist (no notifications)."""
        cal = Calendar.from_ical(primary_with_backup_ics)
        alarms = [c for c in cal.walk() if c.name == "VALARM"]
        assert len(alarms) == 0, f"Found {len(alarms)} VALARM component(s)"

    def test_all_events_transparent(self, primary_ics):
        """Every event is TRANSPARENT (shows as free, not busy)."""
        cal = Calendar.from_ical(primary_ics)
        events = [c for c in cal.walk() if c.name == "VEVENT"]
        for event in events:
            transp = event.get("transp")
            assert str(transp) == "TRANSPARENT", \
                f"Event on {event.get('dtstart').dt} has TRANSP={transp}"

    def test_primary_flavor_in_summary(self, primary_ics):
        """Primary store's flavor appears in event SUMMARY with ice cream emoji."""
        cal = Calendar.from_ical(primary_ics)
        events = [c for c in cal.walk() if c.name == "VEVENT"]
        first_event = events[0]
        summary = str(first_event.get("summary"))
        assert summary.startswith("\U0001f366"), f"SUMMARY doesn't start with ice cream emoji: {summary}"

    def test_backup_in_description(self, primary_with_backup_ics):
        """Backup store flavor appears in DESCRIPTION with correct format."""
        cal = Calendar.from_ical(primary_with_backup_ics)
        events = [c for c in cal.walk() if c.name == "VEVENT"]
        first_event = events[0]
        desc = str(first_event.get("description"))
        assert "Backup Option" in desc, f"No 'Backup Option' in description: {desc}"
        assert "\U0001f368" in desc, f"No sundae emoji in description: {desc}"

    def test_correct_flavor_for_date(self, primary_ics):
        """The flavor in each event matches the expected fixture data."""
        expected = load_fixture("mt-horeb")
        cal = Calendar.from_ical(primary_ics)
        events = [c for c in cal.walk() if c.name == "VEVENT"]

        # Build a date -> expected flavor map
        expected_by_date = {f["date"]: f["name"] for f in expected["flavors"]}

        for event in events[:5]:  # Check first 5 events
            dt = event.get("dtstart").dt
            date_str = dt.strftime("%Y-%m-%d") if hasattr(dt, "strftime") else str(dt)
            summary = str(event.get("summary"))

            if date_str in expected_by_date:
                expected_flavor = expected_by_date[date_str]
                assert expected_flavor in summary, \
                    f"Date {date_str}: expected '{expected_flavor}' in summary, got '{summary}'"

    def test_allday_events(self, primary_ics):
        """Events are all-day (date only, no time component)."""
        cal = Calendar.from_ical(primary_ics)
        events = [c for c in cal.walk() if c.name == "VEVENT"]
        for event in events[:3]:
            dtstart = event.get("dtstart")
            # All-day events have date params, not datetime
            assert dtstart.params.get("VALUE") == "DATE" or not hasattr(dtstart.dt, "hour"), \
                f"Event is not all-day: {dtstart}"
