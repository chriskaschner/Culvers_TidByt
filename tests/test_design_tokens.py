"""Static analysis tests for design token compliance (TOKN-01, TOKN-02, TOKN-03).

Parses CSS and HTML files to verify that hardcoded color hex values and
spacing magic numbers have been replaced with CSS custom property tokens.
"""

import re
from pathlib import Path

DOCS_DIR = Path(__file__).resolve().parent.parent / "docs"
STYLE_CSS = DOCS_DIR / "style.css"

# ---------------------------------------------------------------------------
# Allowed hardcoded hex colors (domain-specific, intentionally not tokenized)
# ---------------------------------------------------------------------------

# Patterns that identify lines where hardcoded hex values are allowed.
# Each entry is a regex applied to the full CSS line (case-insensitive).
ALLOWED_LINE_PATTERNS = [
    # Store brand border colors (.brand-kopps, .brand-gilles, etc.)
    r"\.brand-(?:kopps|gilles|oscars|hefners|kraverz|culvers)\b",
    # Rarity badge colors
    r"\.rarity-badge-",
    r"\.popup-rarity-chip\.rarity-",
    # Fronts dark theme (the entire .fronts-* section uses inverted palette)
    r"\.fronts-",
    r"#fronts-map",
    # Leaflet map control overrides (forced with !important)
    r"!important",
    # Signal card border-left semantic colors (data-signal-type selectors)
    r'\[data-signal-type=',
    # Drive bucket semantic colors (great/ok/pass/hard_pass)
    r"\.drive-bucket-",
    r"\.drive-dot\.drive-bucket-",
    # Google Calendar UI colors -- lines containing these specific values
    r"#039be5",
    r"#dadce0",
    r"#5f6368",
    r"#3c4043",
    r"#1a73e8",
    # Google Calendar border that mimics GCal appearance
    r"\.cal-event\b",
    r"\.cal-event-",
    # Semantic status colors used in specific components
    r"\.popup-match\b",
    r"\.popup-confirmed\b",
    r"\.match-title\b",
    r"\.store-card-match\b",
    r"\.confidence-strip-",
    r"\.day-card-badge-",
    r"\.day-card-watch\b",
    r"\.day-card-confirmed\b",
    r"\.day-card-predicted",
    r"\.day-card-estimated",
    r"\.day-card-none\b",
    r"\.day-card-highlight\b",
    r"\.prediction-bar-estimated\b",
    r"\.watch-banner\b",
    r"\.watch-banner-icon\b",
    r"\.error-card\b",
    r"\.error-msg\b",
    r"\.btn-retry",
    r"\.mobile-toast\b",
    r"\.compare-nudge\b",
    r"\.compare-filter-chip\.active\b",
    r"\.compare-filter-chip:focus-visible\b",
    # Suggestion panel (amber semantic colors)
    r"#suggestions-panel\b",
    # Domain-specific one-off colors in specific components
    r"\.signal-headline\b",
    r"\.signal-explanation\b",
    r"\.signal-card\b",
    r"\.hero-signal\b",
    r"\.historical-context-",
    r"\.overdue-section",
    r"\.similar-section",
    r"\.drive-dealbreaker\b",
    r"\.drive-tag-chip-avoid\b",
    r"\.drive-excluded-item\b",
    r"\.drive-tomorrow\b",
    r"\.drive-map\b",
    r"\.drive-secondary\b",
    r"\.drive-pin\b",
    r"\.compare-directions\b",
    r"\.compare-filter-chip:hover\b",
    r"\.first-visit-guide\b",
    r"\.hero-empty \.hero-coverage\b",
    r"\.quick-start-chip",
    r"\.quick-start-label\b",
    # Score label in drive section
    r"\.drive-score-label\b",
    # Hotspot section colors (fronts sidebar -- domain-specific)
    r"\.hotspot-",
    # The e8eaed border for GCal backups header
    r"#e8eaed",
    # Compare page colors
    r"\.compare-store-row:hover\b",
    # Multi-store active state (blue tint)
    r"\.multi-store-cell\.active\b",
    # Drive sort active state
    r"\.drive-sort-btn\.is-active\b",
    # Calendar CTA chip and button borders (domain colors)
    r"\.calendar-cta-",
    # Share button border
    r"\.share-btn\b",
    r"\.share-btn:hover\b",
    # Error card paragraph
    r"\.error-card p\b",
    # Marker/map effects
    r"\.flavor-map-marker",
    # Compare page
    r"\.compare-",
    # Drive tag chip
    r"\.drive-tag-chip\b",
    # Pill remove background
    r"\.drive-pill-remove\b",
]

# Hex color regex: matches #xxx, #xxxx, #xxxxxx, #xxxxxxxx
HEX_COLOR_RE = re.compile(r"#(?:[0-9a-fA-F]{3,4}){1,2}\b")


def _read_css_outside_root(filepath: Path) -> list[tuple[int, str]]:
    """Return (line_number, line_text) pairs from a CSS file, excluding
    the :root { ... } block."""
    text = filepath.read_text()
    lines = text.splitlines()
    result = []
    in_root = False
    brace_depth = 0
    for i, line in enumerate(lines, start=1):
        stripped = line.strip()
        if stripped.startswith(":root") and "{" in stripped:
            in_root = True
            brace_depth = 0
        if in_root:
            brace_depth += stripped.count("{") - stripped.count("}")
            if brace_depth <= 0:
                in_root = False
            continue
        result.append((i, line))
    return result


def _is_allowed_line(line: str) -> bool:
    """Return True if the line matches any allowed-list pattern."""
    for pattern in ALLOWED_LINE_PATTERNS:
        if re.search(pattern, line, re.IGNORECASE):
            return True
    return False


def _is_inside_comment(line: str) -> bool:
    """Rough check if the hex is inside a CSS comment on the same line."""
    stripped = line.strip()
    return stripped.startswith("/*") or stripped.startswith("*")


# ---------------------------------------------------------------------------
# Spacing tokens: values that must use var(--space-N) tokens
# ---------------------------------------------------------------------------

SPACING_TOKEN_VALUES = {"0.25rem", "0.5rem", "0.75rem", "1rem", "1.5rem", "2rem"}

# CSS properties that are spacing-related (padding, margin, gap, top, etc.)
SPACING_PROPERTIES = re.compile(
    r"^\s*(?:padding|margin|gap|top|bottom|left|right|row-gap|column-gap)"
    r"(?:-(?:top|bottom|left|right|inline|block|start|end))?\s*:",
    re.IGNORECASE,
)


def _find_hardcoded_spacing(lines: list[tuple[int, str]]) -> list[tuple[int, str, str]]:
    """Find lines with hardcoded spacing values that should use tokens.

    Returns list of (line_number, line_text, matched_value).
    Only checks spacing properties (padding, margin, gap, etc.).
    Skips lines that already use var(--space-*) for the matched value.
    """
    results = []
    for lineno, line in lines:
        # Only check spacing properties
        if not SPACING_PROPERTIES.match(line):
            continue
        # Skip lines inside comments
        if _is_inside_comment(line):
            continue
        # Check for each spacing token value as a standalone value
        for val in SPACING_TOKEN_VALUES:
            # Match the value as a standalone token (not part of larger value)
            # e.g., match "0.5rem" but not "0.5rem)" or "-0.5rem"
            # Allow at start of value, after space, or after colon
            pattern = re.compile(
                r"(?<![.\d-])" + re.escape(val) + r"(?!\d)",
            )
            matches = pattern.findall(line)
            if matches:
                # Make sure this isn't already using a var() for this value
                # Check if the line has any bare value (not inside var())
                # Simple approach: if line contains the literal value NOT inside var()
                # Remove all var(--...) references then check
                line_without_vars = re.sub(r"var\(--[^)]+\)", "", line)
                if pattern.search(line_without_vars):
                    results.append((lineno, line, val))
    return results


# ===========================================================================
# Tests
# ===========================================================================


def test_token_count():
    """style.css :root block contains at least 30 CSS custom property definitions."""
    text = STYLE_CSS.read_text()
    # Find the :root block
    root_match = re.search(r":root\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}", text, re.DOTALL)
    assert root_match, ":root block not found in style.css"
    root_content = root_match.group(1)
    # Count custom property definitions (--name: value)
    tokens = re.findall(r"--[\w-]+\s*:", root_content)
    assert len(tokens) >= 30, (
        f"Expected at least 30 tokens in :root, found {len(tokens)}: "
        + ", ".join(t.rstrip(":").strip() for t in tokens)
    )


def test_no_hardcoded_colors():
    """No hardcoded hex color values remain in style.css outside allowed-list."""
    lines = _read_css_outside_root(STYLE_CSS)
    violations = []
    for lineno, line in lines:
        # Skip allowed lines
        if _is_allowed_line(line):
            continue
        # Skip comments
        if _is_inside_comment(line):
            continue
        # Skip @keyframes and animation-only lines
        stripped = line.strip()
        if stripped.startswith("@keyframes"):
            continue
        # Find hex colors
        hex_matches = HEX_COLOR_RE.findall(line)
        if hex_matches:
            violations.append(f"  Line {lineno}: {stripped}  (found: {hex_matches})")
    assert not violations, (
        f"Found {len(violations)} lines with hardcoded hex colors in style.css:\n"
        + "\n".join(violations[:30])
        + ("\n  ... and more" if len(violations) > 30 else "")
    )


def test_no_hardcoded_spacing():
    """No hardcoded standard spacing values in spacing properties outside :root."""
    lines = _read_css_outside_root(STYLE_CSS)
    violations = _find_hardcoded_spacing(lines)
    formatted = [
        f"  Line {ln}: {txt.strip()}  (value: {val})"
        for ln, txt, val in violations
    ]
    assert not violations, (
        f"Found {len(violations)} hardcoded spacing values in style.css:\n"
        + "\n".join(formatted[:30])
        + ("\n  ... and more" if len(formatted) > 30 else "")
    )


def test_no_inline_hardcoded_values():
    """fun.html and updates.html have zero style="" attributes with hardcoded
    hex colors or px/rem spacing values.

    NOTE: This test validates TOKN-03 which is addressed in Plan 02.
    It is expected to fail until Plan 02 is executed.
    """
    inline_style_re = re.compile(r'style="([^"]*)"', re.IGNORECASE)
    spacing_re = re.compile(r"\b\d+(?:\.\d+)?(?:px|rem)\b")
    violations = []

    for filename in ("fun.html", "updates.html"):
        filepath = DOCS_DIR / filename
        if not filepath.exists():
            continue
        text = filepath.read_text()
        for i, line in enumerate(text.splitlines(), start=1):
            for m in inline_style_re.finditer(line):
                style_val = m.group(1)
                hex_found = HEX_COLOR_RE.findall(style_val)
                spacing_found = spacing_re.findall(style_val)
                if hex_found or spacing_found:
                    violations.append(
                        f"  {filename}:{i}: style=\"{style_val}\" "
                        f"(hex: {hex_found}, spacing: {spacing_found})"
                    )

    assert not violations, (
        f"Found {len(violations)} inline styles with hardcoded values:\n"
        + "\n".join(violations[:20])
    )
