"""Tests for scripts/check_forecast_coverage.py."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

# Ensure project root is on sys.path
_project_root = str(Path(__file__).resolve().parents[2])
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from scripts.check_forecast_coverage import d1_query, main


@pytest.fixture(autouse=True)
def _no_subprocess(monkeypatch):
    """Prevent accidental subprocess calls during tests."""
    monkeypatch.setattr("subprocess.run", MagicMock(side_effect=RuntimeError("subprocess blocked in tests")))


class TestD1Query:
    def test_returns_none_on_subprocess_failure(self, monkeypatch):
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stderr = "connection refused"
        monkeypatch.setattr("subprocess.run", MagicMock(return_value=mock_result))

        result = d1_query("SELECT 1")
        assert result is None

    def test_returns_empty_list_on_valid_empty_response(self, monkeypatch):
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = '[{"results": []}]'
        monkeypatch.setattr("subprocess.run", MagicMock(return_value=mock_result))

        result = d1_query("SELECT 1")
        assert result == []

    def test_returns_none_on_json_parse_failure(self, monkeypatch):
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "not json"
        monkeypatch.setattr("subprocess.run", MagicMock(return_value=mock_result))

        result = d1_query("SELECT 1")
        assert result is None


class TestMain:
    def test_exits_1_on_d1_query_error(self, monkeypatch):
        """D1 failure should hard-fail the coverage gate."""
        monkeypatch.setattr(
            "scripts.check_forecast_coverage.d1_query",
            lambda sql: None,
        )
        assert main() == 1

    def test_exits_0_when_no_forecasts(self, monkeypatch):
        """Empty forecasts table is legitimate -- exit 0 with warning."""
        monkeypatch.setattr(
            "scripts.check_forecast_coverage.d1_query",
            lambda sql: [],
        )
        assert main() == 0

    def test_exits_0_with_fresh_snapshots(self, monkeypatch):
        """Valid slugs with recent snapshots should pass."""
        call_count = 0

        def fake_d1_query(sql):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # First call: forecast slugs
                return [{"slug": "mt-horeb"}]
            # Subsequent calls: snapshot counts
            return [{"cnt": 2}]

        monkeypatch.setattr(
            "scripts.check_forecast_coverage.d1_query",
            fake_d1_query,
        )
        assert main() == 0
