"""Tests for scripts/upload_backfill.py.

Covers brand inference, flavor normalization, SQL generation, DB reading,
and dry-run/CLI behavior.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

_project_root = str(Path(__file__).resolve().parents[2])
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from scripts.upload_backfill import (
    infer_brand,
    normalize_flavor,
    build_batch_sql,
    read_rows_from_db,
    main,
)


# ---------------------------------------------------------------------------
# infer_brand
# ---------------------------------------------------------------------------

class TestInferBrand:
    def test_culvers_default(self):
        assert infer_brand("mt-horeb") == "Culver's"
        assert infer_brand("madison-todd-drive") == "Culver's"
        assert infer_brand("verona") == "Culver's"

    def test_kopps_prefix(self):
        assert infer_brand("kopps-brookfield") == "Kopp's"
        assert infer_brand("kopps-glendale") == "Kopp's"

    def test_gilles_exact(self):
        assert infer_brand("gilles") == "Gille's"
        # partial match should NOT trigger gilles rule
        assert infer_brand("gilles-extra") != "Gille's"

    def test_hefners_exact(self):
        assert infer_brand("hefners") == "Hefner's"

    def test_kraverz_exact(self):
        assert infer_brand("kraverz") == "Kraverz"

    def test_oscars_prefix(self):
        assert infer_brand("oscars-west") == "Oscar's"
        assert infer_brand("oscars") == "Oscar's"


# ---------------------------------------------------------------------------
# normalize_flavor
# ---------------------------------------------------------------------------

class TestNormalizeFlavor:
    def test_lowercases(self):
        assert normalize_flavor("Turtle") == "turtle"

    def test_strips_trademark_symbols(self):
        assert normalize_flavor("Reese's\u00ae Peanut Butter") == "reeses peanut butter"
        assert normalize_flavor("Custard\u2122") == "custard"

    def test_strips_smart_quotes(self):
        assert normalize_flavor("Reese\u2019s Cup") == "reeses cup"

    def test_collapses_whitespace(self):
        assert normalize_flavor("Mint  Explosion") == "mint explosion"
        assert normalize_flavor("  Caramel Cashew  ") == "caramel cashew"

    def test_replaces_non_alphanumeric(self):
        assert normalize_flavor("Dark Chocolate P.B.") == "dark chocolate p b"

    def test_empty_string(self):
        assert normalize_flavor("") == ""

    def test_none_like_empty(self):
        assert normalize_flavor(None) == ""


# ---------------------------------------------------------------------------
# build_batch_sql
# ---------------------------------------------------------------------------

class TestBuildBatchSql:
    def _make_row(self, **kwargs):
        defaults = {
            "brand": "Culver's",
            "slug": "mt-horeb",
            "date": "2026-01-15",
            "flavor": "Turtle",
            "normalized_flavor": "turtle",
            "description": "Rich custard",
            "fetched_at": "2026-01-15T10:00:00Z",
        }
        defaults.update(kwargs)
        return defaults

    def test_generates_insert_or_ignore(self):
        sql = build_batch_sql([self._make_row()])
        assert "INSERT OR IGNORE INTO snapshots" in sql

    def test_includes_all_columns(self):
        sql = build_batch_sql([self._make_row()])
        for col in ("brand", "slug", "date", "flavor", "normalized_flavor", "description", "fetched_at"):
            assert col in sql

    def test_multiple_rows_produce_multiple_statements(self):
        rows = [self._make_row(date=f"2026-01-{i:02d}") for i in range(1, 4)]
        sql = build_batch_sql(rows)
        assert sql.count("INSERT OR IGNORE") == 3

    def test_apostrophe_in_flavor_is_escaped(self):
        row = self._make_row(flavor="Reese's Cup", normalized_flavor="reeses cup")
        sql = build_batch_sql([row])
        # Single quote in flavor must be doubled for SQL safety
        assert "Reese''s Cup" in sql
        assert "Reese's Cup" not in sql  # raw unescaped form must not appear

    def test_apostrophe_in_description_is_escaped(self):
        row = self._make_row(description="It's delicious")
        sql = build_batch_sql([row])
        assert "It''s delicious" in sql


# ---------------------------------------------------------------------------
# read_rows_from_db
# ---------------------------------------------------------------------------

@pytest.fixture()
def local_db(tmp_path):
    """Minimal local SQLite DB matching the backfill schema."""
    db_path = tmp_path / "flavors.sqlite"
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "CREATE TABLE flavors ("
        "  store_slug TEXT NOT NULL, "
        "  flavor_date TEXT NOT NULL, "
        "  title TEXT NOT NULL, "
        "  description TEXT DEFAULT '', "
        "  source TEXT NOT NULL, "
        "  fetched_at TEXT NOT NULL"
        ")"
    )
    conn.executemany(
        "INSERT INTO flavors VALUES (?, ?, ?, ?, ?, ?)",
        [
            ("mt-horeb", "2026-01-15", "Turtle", "Rich", "live", "2026-01-15T10:00:00Z"),
            ("mt-horeb", "2026-01-16", "Caramel Cashew", "Sweet", "live", "2026-01-16T10:00:00Z"),
            ("verona", "2026-01-15", "Mint Explosion", "Cool", "wayback", "2026-01-15T10:00:00Z"),
        ],
    )
    conn.commit()
    conn.close()
    return db_path


class TestReadRowsFromDb:
    def test_returns_empty_for_missing_db(self, tmp_path):
        result = read_rows_from_db(tmp_path / "nonexistent.sqlite", ["mt-horeb"])
        assert result == []

    def test_maps_columns_correctly(self, local_db):
        rows = read_rows_from_db(local_db, ["mt-horeb"])
        assert len(rows) == 2
        row = rows[0]
        assert row["slug"] == "mt-horeb"
        assert row["date"] == "2026-01-15"
        assert row["flavor"] == "Turtle"
        assert row["normalized_flavor"] == "turtle"
        assert row["brand"] == "Culver's"
        assert row["description"] == "Rich"
        assert "fetched_at" in row

    def test_slug_filter_works(self, local_db):
        rows = read_rows_from_db(local_db, ["verona"])
        assert len(rows) == 1
        assert rows[0]["slug"] == "verona"
        assert rows[0]["flavor"] == "Mint Explosion"

    def test_no_filter_returns_all(self, local_db):
        rows = read_rows_from_db(local_db, None)
        assert len(rows) == 3

    def test_normalized_flavor_derived_correctly(self, local_db):
        rows = read_rows_from_db(local_db, ["mt-horeb"])
        caramel = next(r for r in rows if r["flavor"] == "Caramel Cashew")
        assert caramel["normalized_flavor"] == "caramel cashew"

    def test_brand_inferred_from_slug(self, tmp_path):
        db_path = tmp_path / "kopps.sqlite"
        conn = sqlite3.connect(str(db_path))
        conn.execute(
            "CREATE TABLE flavors (store_slug TEXT, flavor_date TEXT, title TEXT, "
            "description TEXT, source TEXT, fetched_at TEXT)"
        )
        conn.execute(
            "INSERT INTO flavors VALUES ('kopps-brookfield', '2026-01-15', 'Vanilla', '', 'live', '2026-01-15T10:00:00Z')"
        )
        conn.commit()
        conn.close()
        rows = read_rows_from_db(db_path, ["kopps-brookfield"])
        assert rows[0]["brand"] == "Kopp's"


# ---------------------------------------------------------------------------
# CLI / dry-run
# ---------------------------------------------------------------------------

class TestCLI:
    @pytest.fixture(autouse=True)
    def _block_subprocess(self, monkeypatch):
        monkeypatch.setattr(
            "subprocess.run",
            MagicMock(side_effect=RuntimeError("subprocess blocked in tests")),
        )

    def test_dry_run_priority_stores(self, monkeypatch):
        """Dry-run with no DBs present should exit 0 (no rows, nothing to do)."""
        monkeypatch.setattr("scripts.upload_backfill.BACKFILL_DB", Path("/nonexistent/a.sqlite"))
        monkeypatch.setattr("scripts.upload_backfill.WAYBACK_DB", Path("/nonexistent/b.sqlite"))
        monkeypatch.setattr("sys.argv", ["upload_backfill", "--dry-run"])
        result = main()
        assert result == 0

    def test_dry_run_with_data(self, local_db, monkeypatch):
        """Dry-run with actual data should print counts and exit 0."""
        monkeypatch.setattr("scripts.upload_backfill.BACKFILL_DB", local_db)
        monkeypatch.setattr("scripts.upload_backfill.WAYBACK_DB", Path("/nonexistent/b.sqlite"))
        monkeypatch.setattr("sys.argv", ["upload_backfill", "--stores", "mt-horeb", "--dry-run"])
        result = main()
        assert result == 0

    def test_upload_calls_wrangler_once_per_batch(self, local_db, monkeypatch):
        """Uploading 3 rows with batch-size=2 should invoke wrangler twice."""
        calls = []

        def fake_run(cmd, **kwargs):
            calls.append(cmd)
            m = MagicMock()
            m.returncode = 0
            return m

        monkeypatch.setattr("subprocess.run", fake_run)
        monkeypatch.setattr("scripts.upload_backfill.BACKFILL_DB", local_db)
        monkeypatch.setattr("scripts.upload_backfill.WAYBACK_DB", Path("/nonexistent/b.sqlite"))
        monkeypatch.setattr("sys.argv", ["upload_backfill", "--all", "--batch-size", "2"])
        result = main()
        assert result == 0
        # 3 rows / batch-size 2 = 2 wrangler calls
        wrangler_calls = [c for c in calls if "wrangler" in c]
        assert len(wrangler_calls) == 2

    def test_wrangler_failure_exits_nonzero(self, local_db, monkeypatch):
        """A wrangler failure on any batch should result in nonzero exit."""
        def fake_run(cmd, **kwargs):
            m = MagicMock()
            m.returncode = 1
            m.stderr = "D1 error"
            return m

        monkeypatch.setattr("subprocess.run", fake_run)
        monkeypatch.setattr("scripts.upload_backfill.BACKFILL_DB", local_db)
        monkeypatch.setattr("scripts.upload_backfill.WAYBACK_DB", Path("/nonexistent/b.sqlite"))
        monkeypatch.setattr("sys.argv", ["upload_backfill", "--stores", "mt-horeb"])
        result = main()
        assert result == 1
