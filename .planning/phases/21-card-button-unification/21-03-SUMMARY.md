---
phase: 21-card-button-unification
plan: 03
subsystem: ui
tags: [css, button-system, bem-modifiers, inline-style-elimination, html, javascript]

# Dependency graph
requires:
  - phase: 21-card-button-unification
    plan: 01
    provides: ".btn-text base type, 6 button modifiers (.btn--block, .btn--sm, .btn--danger, .btn--muted, .btn--icon, .btn--circle), static analysis tests"
  - phase: 21-card-button-unification
    plan: 02
    provides: "All 27 card elements on .card base class, page-scoped card styles migrated"
provides:
  - 13 domain-specific button classes removed and remapped to 3 base types + modifiers
  - Zero inline style="" button attributes in HTML files
  - Zero inline button styles in JS innerHTML strings
  - .btn--dark modifier for dark background button variant
  - Shared footer CSS classes replacing inline styles
  - Test baselines tightened to 0 violations with empty legacy allowlist
affects: [22-inline-style-elimination]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Button class migration: domain-specific -> base + modifier combos (e.g., .btn-retry -> .btn-primary.btn--danger)"
    - "Parent-scoped spacing: margins on buttons handled via parent container CSS selectors, not inline styles"
    - "JS innerHTML class migration: querySelector selectors updated alongside class attribute changes"

key-files:
  created: []
  modified:
    - custard-calendar/docs/style.css
    - custard-calendar/docs/compare.html
    - custard-calendar/docs/group.html
    - custard-calendar/docs/index.html
    - custard-calendar/docs/map.html
    - custard-calendar/docs/forecast-map.html
    - custard-calendar/docs/quiz.html
    - custard-calendar/docs/shared-nav.js
    - custard-calendar/docs/compare-page.js
    - custard-calendar/docs/todays-drive.js
    - custard-calendar/tests/test_card_button_unification.py

key-decisions:
  - "Kept .fronts-play-btn as gradient modifier on .btn-secondary.btn--icon.btn--circle (unique gradient background not mappable to base types)"
  - "Parent-scoped CSS handles button spacing (e.g., #start-vote-btn margin, .compare-empty .btn-primary margin) instead of inline styles"
  - "Shared footer inline styles replaced with .shared-footer, .shared-footer-links, .shared-footer-link CSS classes"
  - ".brand-chip.active gets background: var(--brand) in CSS, removing last inline button style on map.html"
  - "JS querySelector selectors updated from domain-specific class names to new base type classes"

patterns-established:
  - "Button consolidation complete: only .btn-primary, .btn-secondary, .btn-text as base types, everything else is modifier"
  - "Zero-baseline test enforcement: inline style violation counts set to 0, preventing future regression"

requirements-completed: [CARD-02, CARD-03, CARD-04]

# Metrics
duration: 10min
completed: 2026-03-14
---

# Phase 21 Plan 03: Button Consolidation Summary

**13 domain-specific button classes remapped to 3 base types + modifiers, zero inline button styles in HTML/JS, test baselines locked at 0**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-14T02:05:03Z
- **Completed:** 2026-03-14T02:15:10Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Removed 13 standalone button CSS definitions (btn-google, btn-apple, btn-search, btn-retry, drive-btn, drive-btn-muted, calendar-cta-btn, change-store-btn, store-change-btn, compare-add-hint-btn, location-geo-btn, icon-btn, first-visit-confirm) and replaced with base + modifier combos
- Updated all HTML files (compare, group, index, map, forecast-map, quiz) and JS files (shared-nav, compare-page, todays-drive) to use the 3 base types with modifiers
- Eliminated all inline style="" attributes on button elements in HTML and JS-generated markup
- Tightened test baselines to 0 violations and emptied the legacy button allowlist
- Added .btn--dark modifier, disabled states for btn-primary/btn-secondary, shared footer CSS classes

## Task Commits

Each task was committed atomically:

1. **Task 1: Remap domain-specific button CSS to base types + modifiers** - `3827f4e` (feat)
2. **Task 2: Update HTML/JS class attributes and eliminate inline button styles** - `c7dfa9a` (feat)

## Files Created/Modified
- `custard-calendar/docs/style.css` - Removed 13 button class definitions, added .btn--dark modifier, disabled states, shared footer CSS, parent-scoped button spacing rules
- `custard-calendar/docs/compare.html` - Removed inline styles from btn-primary, replaced hardcoded style on CTA link, btn-retry -> btn-primary btn--danger btn--sm
- `custard-calendar/docs/group.html` - Removed inline styles (width, margin, display) from 4 buttons, migrated .directions-btn to CSS, updated JS-rendered button class
- `custard-calendar/docs/index.html` - location-geo-btn -> btn-secondary btn--icon, change-store-btn -> btn-text, btn-retry -> btn-primary btn--danger btn--sm
- `custard-calendar/docs/map.html` - icon-btn -> btn-secondary btn--icon, btn btn-search -> btn-primary btn--block, removed brand-chip inline style
- `custard-calendar/docs/forecast-map.html` - icon-btn -> btn-secondary btn--icon, btn-search -> btn-primary btn--block, fronts-play-btn -> btn-secondary btn--icon btn--circle fronts-play-btn
- `custard-calendar/docs/quiz.html` - Removed .quiz-geo-btn page-scoped style, quiz-geo-btn -> btn-secondary
- `custard-calendar/docs/shared-nav.js` - store-change-btn -> btn-text, first-visit-confirm -> btn-primary btn--sm, footer inline styles -> CSS classes, nav inline style removed
- `custard-calendar/docs/compare-page.js` - compare-add-hint-btn -> btn-text
- `custard-calendar/docs/todays-drive.js` - drive-btn -> btn-secondary btn--sm, drive-btn-muted -> btn-secondary btn--sm btn--muted
- `custard-calendar/tests/test_card_button_unification.py` - Baselines to 0, legacy allowlist emptied

## Decisions Made
- Kept `.fronts-play-btn` as a gradient modifier class on top of `.btn-secondary.btn--icon.btn--circle` rather than creating a generic gradient modifier, since the gradient is unique to the fronts timeline play button
- Used parent-scoped CSS selectors for button spacing (e.g., `#start-vote-btn { margin-top: var(--space-2); }`) instead of inline styles, keeping layout concerns in CSS
- Replaced shared-nav.js footer inline styles with dedicated `.shared-footer`, `.shared-footer-links`, `.shared-footer-link` CSS classes
- Added `background: var(--brand)` to `.brand-chip.active` CSS rule to eliminate the last inline button style on map.html (Culver's default active chip)
- Updated JS querySelector selectors from domain-specific class names (`.store-change-btn`, `.first-visit-confirm`, `.compare-add-hint-btn`) to new base type classes (`.btn-text`, `.btn-primary`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test regex matched wrong .btn-text rule due to CSS ordering**
- **Found during:** Task 1
- **Issue:** `.current-store-badge .btn-text` override was placed before the `.btn-text` base definition in style.css, causing the test regex to match the override block instead of the base
- **Fix:** Moved the `.current-store-badge .btn-text` override to after the `.btn-text` base definition
- **Files modified:** custard-calendar/docs/style.css
- **Verification:** test_btn_text_base_type_exists passes
- **Committed in:** 3827f4e (Task 1 commit)

**2. [Rule 2 - Missing Critical] Eliminated brand-chip inline style on map.html**
- **Found during:** Task 2
- **Issue:** `<button class="brand-chip active" style="background:#005696;border-color:transparent">` was the only remaining inline button style in HTML. The `.brand-chip.active` CSS rule was missing a `background` property.
- **Fix:** Added `background: var(--brand)` to `.brand-chip.active` CSS rule and removed inline style from map.html
- **Files modified:** custard-calendar/docs/style.css, custard-calendar/docs/map.html
- **Verification:** HTML inline button style test passes with baseline 0
- **Committed in:** c7dfa9a (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Minor -- CSS ordering fix was necessary for test correctness, brand-chip fix was needed to achieve zero inline button styles.

## Issues Encountered
- Pre-existing test_design_tokens.py failures (nearest-badge hardcoded #4285f4, user-position-dot #4285f4/#fff, margin-left 0.5rem) remain unchanged -- these are not caused by Plan 03 changes and are tracked in STATE.md.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 21 Card & Button Unification is fully complete
- All 27 card elements inherit .card base (Plan 02)
- Only 3 button base types remain: .btn-primary, .btn-secondary, .btn-text (Plan 03)
- Zero inline button styles in HTML and JS (Plan 03)
- Test suite enforces zero-violation baselines preventing future regression
- Ready for Phase 22 (broader inline style elimination beyond buttons)

## Self-Check: PASSED

- FOUND: custard-calendar/docs/style.css
- FOUND: custard-calendar/docs/compare.html
- FOUND: custard-calendar/docs/group.html
- FOUND: custard-calendar/docs/index.html
- FOUND: custard-calendar/docs/map.html
- FOUND: custard-calendar/docs/forecast-map.html
- FOUND: custard-calendar/docs/quiz.html
- FOUND: custard-calendar/docs/shared-nav.js
- FOUND: custard-calendar/docs/compare-page.js
- FOUND: custard-calendar/docs/todays-drive.js
- FOUND: custard-calendar/tests/test_card_button_unification.py
- FOUND: commit 3827f4e (Task 1)
- FOUND: commit c7dfa9a (Task 2)

---
*Phase: 21-card-button-unification*
*Completed: 2026-03-14*
