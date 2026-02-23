"""Tests for scripts/backfill_snapshots.py sentinel filtering."""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

# Ensure project root is on sys.path
_project_root = str(Path(__file__).resolve().parents[2])
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from scripts.backfill_snapshots import read_sqlite, CLOSED_MARKERS


@pytest.fixture()
def sqlite_with_sentinels(tmp_path):
    """Create a temporary SQLite DB with normal and closed-day rows."""
    db_path = tmp_path / "flavors.sqlite"
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "CREATE TABLE flavors ("
        "  store_slug TEXT, flavor_date TEXT, title TEXT, "
        "  description TEXT, fetched_at TEXT"
        ")"
    )
    rows = [
        ("mt-horeb", "2026-02-20", "Turtle", "Tasty", "2026-02-20T10:00:00Z"),
        ("mt-horeb", "2026-02-21", "z *Restaurant Closed Today", "", "2026-02-21T10:00:00Z"),
        ("mt-horeb", "2026-02-22", "Mint Explosion", "Cool", "2026-02-22T10:00:00Z"),
        ("mt-horeb", "2026-02-23", "z *Closed Today for Remodel!", "", "2026-02-23T10:00:00Z"),
    ]
    conn.executemany(
        "INSERT INTO flavors VALUES (?, ?, ?, ?, ?)", rows
    )
    conn.commit()
    conn.close()
    return db_path


def test_closed_markers_filtered_from_output(sqlite_with_sentinels, monkeypatch):
    """Rows with CLOSED_MARKERS titles should be excluded from read_sqlite output."""
    monkeypatch.setattr(
        "scripts.backfill_snapshots.SQLITE_PATH", sqlite_with_sentinels
    )

    result = read_sqlite(store="mt-horeb")

    # 4 total rows, 2 are closed-day sentinels -> 2 should remain
    assert len(result) == 2
    titles = {r["title"] for r in result}
    assert titles == {"Turtle", "Mint Explosion"}
    # None of the closed markers should appear
    for r in result:
        assert r["title"] not in CLOSED_MARKERS
