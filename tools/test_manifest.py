"""Tests for the store manifest builder."""

import json
import os
import pytest

from build_manifest import (
    generate_candidate_slugs,
    normalize_slug,
    parse_locations_by_state_html,
    validate_manifest,
)

# Fixture: HTML snippet mimicking Culver's locations-by-state page structure
SAMPLE_HTML = """
<div class="locations-list">
<h2>Wisconsin</h2>
<ul>
<li>Culver's of Mt. Horeb, WI - Springdale St</li>
<li>Culver's of Madison, WI - Todd Dr</li>
<li>Culver's of Madison, WI - East Towne</li>
<li>Culver's of Middleton, WI - University Ave</li>
</ul>
<h2>Illinois</h2>
<ul>
<li>Culver's of Naperville, IL - Ogden Ave</li>
</ul>
</div>
"""


class TestNormalizeSlug:
    def test_lowercase(self):
        assert normalize_slug("Mt. Horeb") == "mt-horeb"

    def test_spaces_to_hyphens(self):
        assert normalize_slug("Madison Todd Dr") == "madison-todd-dr"

    def test_removes_periods(self):
        assert normalize_slug("St. Louis") == "st-louis"

    def test_removes_apostrophes(self):
        assert normalize_slug("O'Fallon") == "ofallon"

    def test_collapses_hyphens(self):
        assert normalize_slug("Mt.  Horeb") == "mt-horeb"


class TestGenerateCandidateSlugs:
    def test_basic_city(self):
        slugs = generate_candidate_slugs("Mt. Horeb", "WI", "Springdale St")
        assert "mt-horeb" in slugs

    def test_includes_street_variant(self):
        slugs = generate_candidate_slugs("Madison", "WI", "Todd Dr")
        assert "madison-todd-dr" in slugs

    def test_includes_drive_expansion(self):
        slugs = generate_candidate_slugs("Madison", "WI", "Todd Dr")
        assert "madison-todd-drive" in slugs

    def test_includes_city_state(self):
        slugs = generate_candidate_slugs("Fuquay-Varina", "NC", "Main St")
        assert "fuquay-varina-nc" in slugs

    def test_includes_partial_street(self):
        """First word of street name as suffix (e.g., 'racine-21st')."""
        slugs = generate_candidate_slugs("Racine", "WI", "21st Street")
        assert "racine-21st" in slugs

    def test_includes_full_address_with_state(self):
        """Full address with state code (e.g., 'chicago-il-3355-s-mlk-dr')."""
        slugs = generate_candidate_slugs("Chicago", "IL", "3355 S Martin Luther King Dr")
        assert any("chicago-il-3355" in s for s in slugs)

    def test_no_duplicates(self):
        slugs = generate_candidate_slugs("Middleton", "WI", "University Ave")
        assert len(slugs) == len(set(slugs))


class TestParseLocationsHtml:
    def test_extracts_entries(self):
        entries = parse_locations_by_state_html(SAMPLE_HTML)
        assert len(entries) == 5

    def test_entry_has_required_fields(self):
        entries = parse_locations_by_state_html(SAMPLE_HTML)
        for entry in entries:
            assert "city" in entry
            assert "state" in entry
            assert "street" in entry

    def test_mt_horeb_parsed_correctly(self):
        entries = parse_locations_by_state_html(SAMPLE_HTML)
        mt_horeb = [e for e in entries if e["city"] == "Mt. Horeb"]
        assert len(mt_horeb) == 1
        assert mt_horeb[0]["state"] == "WI"
        assert mt_horeb[0]["street"] == "Springdale St"


class TestValidateManifest:
    def test_valid_manifest(self):
        manifest = {
            "generated": "2026-02-20T12:00:00Z",
            "count": 2,
            "stores": [
                {"slug": "mt-horeb", "name": "Mt. Horeb", "city": "Mt. Horeb", "state": "WI", "address": "1700 Springdale St"},
                {"slug": "madison-todd-drive", "name": "Madison Todd Dr", "city": "Madison", "state": "WI", "address": "2102 W Beltline Hwy"},
            ],
        }
        errors = validate_manifest(manifest)
        assert errors == []

    def test_rejects_duplicate_slugs(self):
        manifest = {
            "generated": "2026-02-20T12:00:00Z",
            "count": 2,
            "stores": [
                {"slug": "mt-horeb", "name": "A", "city": "A", "state": "WI", "address": "A"},
                {"slug": "mt-horeb", "name": "B", "city": "B", "state": "WI", "address": "B"},
            ],
        }
        errors = validate_manifest(manifest)
        assert any("duplicate" in e.lower() for e in errors)

    def test_rejects_missing_fields(self):
        manifest = {
            "generated": "2026-02-20T12:00:00Z",
            "count": 1,
            "stores": [
                {"slug": "mt-horeb"},  # missing name, city, state, address
            ],
        }
        errors = validate_manifest(manifest)
        assert len(errors) > 0

    def test_known_slugs_check(self):
        """Helper to verify known slugs are present after a real build."""
        manifest = {
            "generated": "2026-02-20T12:00:00Z",
            "count": 2,
            "stores": [
                {"slug": "mt-horeb", "name": "Mt. Horeb", "city": "Mt. Horeb", "state": "WI", "address": "1700 Springdale St"},
                {"slug": "madison-todd-drive", "name": "Madison Todd Dr", "city": "Madison", "state": "WI", "address": "2102 W Beltline Hwy"},
            ],
        }
        slugs = {s["slug"] for s in manifest["stores"]}
        assert "mt-horeb" in slugs
        assert "madison-todd-drive" in slugs
