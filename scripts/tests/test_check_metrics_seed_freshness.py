"""Tests for scripts/check_metrics_seed_freshness.py."""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import pytest

_project_root = str(Path(__file__).resolve().parents[2])
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from scripts.check_metrics_seed_freshness import extract_generated_at, main, SEED_FILE


# ---------------------------------------------------------------------------
# Unit tests for extract_generated_at
# ---------------------------------------------------------------------------

def test_extract_generated_at_standard():
    text = 'export const SEED = {\n  "generated_at": "2026-02-25T21:50:51.871824+00:00",\n};'
    assert extract_generated_at(text) == "2026-02-25T21:50:51.871824+00:00"


def test_extract_generated_at_missing():
    text = 'export const SEED = { "version": 1 };'
    assert extract_generated_at(text) is None


def test_extract_generated_at_z_suffix():
    text = '"generated_at": "2026-01-01T00:00:00Z"'
    assert extract_generated_at(text) == "2026-01-01T00:00:00Z"


# ---------------------------------------------------------------------------
# Integration tests for main() using a temp seed file
# ---------------------------------------------------------------------------

def _make_seed_text(dt: datetime) -> str:
    ts = dt.isoformat()
    return f'export const TRIVIA_METRICS_SEED = {{\n  "generated_at": "{ts}",\n  "version": 1\n}};\n'


def test_fresh_seed_passes(tmp_path):
    """A seed generated 1 day ago should exit 0."""
    now = datetime.now(timezone.utc)
    fresh_dt = now - timedelta(days=1)
    seed_file = tmp_path / "trivia-metrics-seed.js"
    seed_file.write_text(_make_seed_text(fresh_dt))

    with patch("scripts.check_metrics_seed_freshness.SEED_FILE", seed_file):
        exit_code = main(argv=[])

    assert exit_code == 0


def test_stale_seed_fails(tmp_path):
    """A seed generated 50 days ago should exit 1."""
    now = datetime.now(timezone.utc)
    stale_dt = now - timedelta(days=50)
    seed_file = tmp_path / "trivia-metrics-seed.js"
    seed_file.write_text(_make_seed_text(stale_dt))

    with patch("scripts.check_metrics_seed_freshness.SEED_FILE", seed_file):
        exit_code = main(argv=[])

    assert exit_code == 1


def test_missing_generated_at_fails(tmp_path):
    """A seed file with no generated_at field should exit 1."""
    seed_file = tmp_path / "trivia-metrics-seed.js"
    seed_file.write_text('export const TRIVIA_METRICS_SEED = { "version": 1 };\n')

    with patch("scripts.check_metrics_seed_freshness.SEED_FILE", seed_file):
        exit_code = main(argv=[])

    assert exit_code == 1


def test_missing_seed_file_fails(tmp_path):
    """A non-existent seed file should exit 1."""
    missing = tmp_path / "does-not-exist.js"

    with patch("scripts.check_metrics_seed_freshness.SEED_FILE", missing):
        exit_code = main(argv=[])

    assert exit_code == 1


def test_custom_max_days_passes(tmp_path):
    """--max-days 30: a 20-day-old seed should pass."""
    now = datetime.now(timezone.utc)
    seed_file = tmp_path / "trivia-metrics-seed.js"
    seed_file.write_text(_make_seed_text(now - timedelta(days=20)))

    with patch("scripts.check_metrics_seed_freshness.SEED_FILE", seed_file):
        exit_code = main(argv=["--max-days", "30"])

    assert exit_code == 0


def test_custom_max_days_fails(tmp_path):
    """--max-days 30: a 35-day-old seed should fail."""
    now = datetime.now(timezone.utc)
    seed_file = tmp_path / "trivia-metrics-seed.js"
    seed_file.write_text(_make_seed_text(now - timedelta(days=35)))

    with patch("scripts.check_metrics_seed_freshness.SEED_FILE", seed_file):
        exit_code = main(argv=["--max-days", "30"])

    assert exit_code == 1


def test_real_seed_file_passes():
    """The real trivia-metrics-seed.js in the repo should be fresh enough for CI."""
    if not SEED_FILE.exists():
        pytest.skip("trivia-metrics-seed.js not present in this environment")
    exit_code = main(argv=[])
    assert exit_code == 0, (
        "Real seed file is stale. Run: uv run python scripts/generate_intelligence_metrics.py"
    )
