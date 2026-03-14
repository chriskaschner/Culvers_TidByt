---
phase: 21-card-button-unification
verified: 2026-03-14T02:21:12Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 21: Card & Button Unification Verification Report

**Phase Goal:** Unify all card and button patterns to a shared base-class system, reducing visual inconsistency and CSS duplication.
**Verified:** 2026-03-14T02:21:12Z
**Status:** PASSED
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Static analysis tests exist that verify card base class presence, button class consolidation, and zero inline button styles | VERIFIED | `test_card_button_unification.py` exists, 205 lines, 7 test functions, all 7 pass |
| 2 | `.btn-text` base type exists in `style.css` with no-background, brand-color, underline-on-hover properties | VERIFIED | Lines 1617-1643 of style.css; test passes |
| 3 | Button modifiers (`.btn--block`, `.btn--sm`, `.btn--danger`, `.btn--muted`, `.btn--icon`, `.btn--circle`) exist in style.css | VERIFIED | Lines 1648-1657; test_button_modifiers_exist passes |
| 4 | Card modifiers (`.card--accent`, `.card--success`, `.card--danger`, `.card--overlay`, `.card--compact`) exist in style.css | VERIFIED | Lines 132-137; test_card_modifiers_exist passes |
| 5 | All 27 card-like elements have the `.card` class in their HTML markup or JS-generated markup | VERIFIED | HTML: index.html, compare.html, fun.html, group.html, forecast-map.html confirmed; JS: today-page.js className assignments, planner-domain.js, todays-drive.js, planner-ui.js, compare-page.js all confirmed |
| 6 | Only 3 button base types exist: `.btn-primary`, `.btn-secondary`, `.btn-text` -- all domain-specific classes removed | VERIFIED | Zero instances of `.btn-google`, `.btn-apple`, `.btn-search`, `.btn-retry`, `.drive-btn`, `.calendar-cta-btn`, `.change-store-btn`, `.store-change-btn`, `.compare-add-hint-btn`, `.location-geo-btn`, `.icon-btn`, `.first-visit-confirm` as top-level CSS rules; test_only_three_button_base_types passes with empty legacy allowlist |
| 7 | Zero inline style attributes set button properties on button elements in HTML | VERIFIED | test_no_inline_button_styles_in_html passes with baseline 0; manual grep confirms no btn/* button elements with padding/background/border-radius/color/width/display inline styles |
| 8 | Zero inline button styles in JS innerHTML strings | VERIFIED | test_no_inline_button_styles_in_js passes with baseline 0; todays-drive.js has one inline style (`left`/`top` for map pin positioning -- not button properties, correctly excluded by test) |
| 9 | Page-scoped card styles from group.html and fun.html migrated to style.css with token-based colors | VERIFIED | `.vote-card` (line 149), `.winner-card` (line 165), `.share-panel` (line 185), `.madlibs-card` (line 193), `.linkout-card` (line 223) all defined in style.css; neither group.html nor fun.html contain CSS rules for these classes |

**Score:** 9/9 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `custard-calendar/tests/test_card_button_unification.py` | Static analysis tests for CARD-01, CARD-02, CARD-03 | VERIFIED | 205 lines, 7 test functions, all pass |
| `custard-calendar/docs/style.css` | `.btn-text`, all button modifiers, all card modifiers | VERIFIED | `.btn-text` at line 1617; button modifiers lines 1648-1657; card modifiers lines 132-137 |
| `custard-calendar/docs/group.html` | vote-card, winner-card, share-panel with `.card` class | VERIFIED | share-panel has `class="card share-panel"`; winner-card and vote-card generated via JS with `class="card card--success winner-card"` and `class="card vote-card"` |
| `custard-calendar/docs/fun.html` | madlibs-card, linkout-card with `.card` class | VERIFIED | `class="card madlibs-card"` at line 124; `class="card linkout-card"` at lines 132 and 141 |
| `custard-calendar/docs/forecast-map.html` | fronts overlay cards with `.card.card--overlay` | VERIFIED | Lines 64 and 77 show `class="card card--overlay fronts-overlay-card fronts-legend-card"` and `class="card card--overlay fronts-overlay-card fronts-timeline-card"` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `test_card_button_unification.py` | `style.css` | CSS static analysis (file read + regex) | WIRED | Test file reads STYLE_CSS via pathlib, 7 tests exercise regex patterns against style.css |
| `style.css (.card base)` | All HTML files with card elements | `class="card {component-class}"` | WIRED | Confirmed in index.html, compare.html, fun.html, group.html, forecast-map.html |
| `todays-drive.js` | `style.css` | JS innerHTML with card class | WIRED | Line 564: `'<article class="card card--accent-sm drive-card ...'` |
| `style.css (.btn-primary, .btn-secondary, .btn-text)` | All HTML/JS files with button elements | Class attributes replacing inline styles | WIRED | compare.html line 73: `class="btn-primary"`; group.html JS-rendered buttons use base classes; shared-nav.js uses `.btn-text`, `.btn-primary btn--sm` |
| `shared-nav.js` | `style.css` | CSS classes instead of inline styles for footer links | WIRED | Footer now uses `.shared-footer`, `.shared-footer-links`, `.shared-footer-link` CSS classes (style.css lines 2673-2692) |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CARD-01 | Plans 01, 02 | All card-like elements inherit `.card` base class | SATISFIED | All 27 card elements confirmed with `.card` in HTML/JS class attributes; test_card_base_class_exists passes |
| CARD-02 | Plans 01, 03 | Button system consolidated to 3 base types | SATISFIED | Only `.btn-primary`, `.btn-secondary`, `.btn-text` as base types in style.css; test_only_three_button_base_types passes with empty legacy allowlist |
| CARD-03 | Plans 01, 03 | No inline style overrides of button properties | SATISFIED | Baselines set to 0 in tests; tests pass; manual verification confirms no button element has inline button property styles |
| CARD-04 | Plans 02, 03 | JS innerHTML-generated card/button HTML uses CSS classes | SATISFIED | today-page.js, planner-domain.js, todays-drive.js, compare-page.js, planner-ui.js, shared-nav.js all confirmed using CSS class names |

No orphaned requirements -- all four CARD-* requirements assigned to Phase 21 in REQUIREMENTS.md are accounted for across Plans 01-03.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `compare.html` | 70-72 | Inline style on `<section>` with layout properties (`text-align`, `margin`, `padding`, `max-width`, `color`, hardcoded `#666`) | Info | Not in CARD-03 scope (not a button element); tracked as DTKN-03 work for Phase 22 |
| `compare.html` | 25-26 | Inline styles on `<h1>` and `<p>` (`color:#005696`, `color:#666`, `margin-top`) | Info | Not in Phase 21 scope; tracked as DTKN-03 for Phase 22 |
| `todays-drive.js` | 738 | `style="left:...;top:...;"` inline style on `<button class="drive-pin">` | Info | Positional CSS for map pin placement, not button styling properties; correctly excluded from test scope |

No blocker anti-patterns found. All noted items are either out of scope for Phase 21 or correctly handled.

---

## Pre-Existing Test Failures (Not Phase 21 Regressions)

`tests/test_design_tokens.py` has 2 failures that predate Phase 21:

- `test_no_hardcoded_colors`: `.nearest-badge` and `.user-position-dot` use `#4285f4` (Google Maps blue) and `#fff` -- present on main branch before any Phase 21 changes
- `test_no_hardcoded_spacing`: `.nearest-badge` has `margin-left: 0.5rem` hardcoded -- same pre-existing violation

These are tracked in STATE.md and explicitly documented in all three Phase 21 SUMMARYs. They are not regressions from this phase.

---

## Human Verification Required

### 1. Visual Card Appearance

**Test:** Open index.html, compare.html, fun.html, group.html, forecast-map.html in a browser
**Expected:** All card-like elements render with consistent border, border-radius (12px), box-shadow, and background surface color; no cards appear unstyled or "flat"
**Why human:** CSS inheritance effects on visual rendering cannot be verified by static analysis

### 2. Fronts Overlay Cards

**Test:** Open forecast-map.html and navigate to the fronts overlay timeline/legend
**Expected:** Dark glass-morphism style cards render correctly (dark semi-transparent background, blur effect, light text)
**Why human:** `.card--overlay` uses backdrop-filter and gradient background that can only be verified visually

### 3. Button Visual Consistency

**Test:** Compare button appearance across pages (index.html, group.html, compare.html, map.html)
**Expected:** `.btn-primary`, `.btn-secondary`, `.btn-text` buttons appear visually consistent in size, padding, and weight
**Why human:** Visual consistency across pages requires human comparison

### 4. JS-Generated Card Rendering

**Test:** Trigger today-page.js to render near-me-cards and week-day-cards (requires geolocation or mock data)
**Expected:** Cards render with consistent card appearance matching other `.card` elements
**Why human:** JS-generated DOM cards require runtime execution to inspect

---

## Gaps Summary

No gaps. All 9 observable truths verified, all 4 CARD requirements satisfied, all key links wired. The phase achieved its goal: all card and button patterns are unified to a shared base-class system with zero inline button style violations and a static analysis test suite enforcing the constraints going forward.

---

_Verified: 2026-03-14T02:21:12Z_
_Verifier: Claude (gsd-verifier)_
