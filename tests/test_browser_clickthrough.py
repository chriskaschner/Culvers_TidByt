"""Headless browser smoke test for docs navigation."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
WORKER_DIR = REPO_ROOT / "worker"
PLAYWRIGHT_CONFIG = WORKER_DIR / "playwright.config.mjs"
PLAYWRIGHT_SPEC = WORKER_DIR / "test" / "browser" / "nav-clickthrough.spec.mjs"


def _find_browser_binary() -> str:
    candidates = [
        os.environ.get("CHROME_BIN"),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    raise AssertionError(
        "No Chrome/Chromium browser binary found. "
        "Set CHROME_BIN to a local Chrome/Chromium executable path."
    )


def test_docs_nav_clickthrough_in_browser():
    """Click through Forecast -> Calendar -> Map -> Radar -> Alerts -> Siri -> Forecast."""

    playwright_bin = WORKER_DIR / "node_modules" / ".bin" / "playwright"
    if not playwright_bin.exists():
        playwright_bin = WORKER_DIR / "node_modules" / ".bin" / "playwright.cmd"
    assert playwright_bin.exists(), (
        "Missing Playwright binary at worker/node_modules/.bin/playwright. "
        "Run: cd worker && npm install"
    )
    assert PLAYWRIGHT_CONFIG.exists(), f"Missing Playwright config: {PLAYWRIGHT_CONFIG}"
    assert PLAYWRIGHT_SPEC.exists(), f"Missing Playwright spec: {PLAYWRIGHT_SPEC}"

    env = os.environ.copy()
    env["CHROME_BIN"] = _find_browser_binary()

    result = subprocess.run(
        [
            str(playwright_bin),
            "test",
            str(PLAYWRIGHT_SPEC),
            "--config",
            str(PLAYWRIGHT_CONFIG),
            "--workers",
            "1",
        ],
        cwd=WORKER_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=180,
    )

    assert result.returncode == 0, (
        "Browser click-through failed.\n"
        f"STDOUT:\n{result.stdout}\n"
        f"STDERR:\n{result.stderr}"
    )
