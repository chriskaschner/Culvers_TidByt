---
phase: 21-card-button-unification
plan: 02
subsystem: ui
tags: [css, card-system, bem-modifiers, html, javascript, design-tokens]

# Dependency graph
requires:
  - phase: 21-card-button-unification
    plan: 01
    provides: Card modifiers (.card--accent, .card--accent-sm, .card--compact, .card--success, .card--danger, .card--overlay) and .card base class
provides:
  - All 27 card elements inherit .card base class
  - 17 standalone card CSS rules deduplicated to remove properties inherited from .card
  - Page-scoped card styles migrated from group.html and fun.html to style.css
  - Token-based colors replace hardcoded hex in migrated styles
affects: [21-03-PLAN, 22-inline-style-elimination]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Card CSS override pattern: keep only properties that differ from .card base, add /* override .card base */ comment"
    - "Page-scoped to style.css migration: move rule, replace hardcoded hex with tokens, remove from source <style>"

key-files:
  created: []
  modified:
    - custard-calendar/docs/style.css
    - custard-calendar/docs/group.html
    - custard-calendar/docs/fun.html
    - custard-calendar/docs/index.html
    - custard-calendar/docs/compare.html
    - custard-calendar/docs/forecast-map.html
    - custard-calendar/docs/today-page.js
    - custard-calendar/docs/todays-drive.js
    - custard-calendar/docs/planner-ui.js
    - custard-calendar/docs/planner-domain.js
    - custard-calendar/docs/shared-nav.js
    - custard-calendar/docs/compare-page.js
    - custard-calendar/tests/test_design_tokens.py

key-decisions:
  - "Migrated page-scoped card styles (vote-card, winner-card, share-panel, madlibs-card, linkout-card) to style.css with token-based colors"
  - "Added .madlibs-card to design token color allowlist for unique teal accent (#0d7377) and active state (#dde9f5)"
  - "Replaced hardcoded hex values in migrated styles: #fff -> var(--bg-surface), #2e7d32 -> var(--state-success), #f9f9f9 -> var(--bg-muted), #eef4fb -> var(--state-confirmed-bg)"
  - "Used card--accent-sm for 3px border-left cards (signal, week-day, drive) and card--accent for 4px border-left cards (day-card)"

patterns-established:
  - "Card modifier chain: class='card card--accent card--compact component-class' for multi-modifier combinations"
  - "CSS deduplication: remove background/border/border-radius/box-shadow/padding from standalone cards when inherited from .card"

requirements-completed: [CARD-01, CARD-04]

# Metrics
duration: 9min
completed: 2026-03-14
---

# Phase 21 Plan 02: Card Migration Summary

**17 standalone card CSS rules deduplicated to inherit .card base, all 27 card elements across 6 HTML files and 6 JS files now have .card class**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-14T01:52:52Z
- **Completed:** 2026-03-14T02:02:16Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Deduplicated 17 standalone card CSS rules by removing background, border, border-radius, box-shadow, and padding properties already inherited from .card base
- Migrated 5 page-scoped card styles (vote-card, winner-card, share-panel, madlibs-card, linkout-card) from group.html and fun.html into style.css with token-based colors
- Added .card class (with appropriate modifiers) to all 27 card elements across 6 HTML files and 6 JS files
- Replaced hardcoded hex colors with design tokens in migrated styles (state-success, bg-muted, bg-surface, etc.)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate 17 standalone card CSS rules to inherit .card base** - `3487a47` (feat)
2. **Task 2: Add .card class to all card HTML elements and JS-generated markup** - `ac5a31b` (feat)

## Files Created/Modified
- `custard-calendar/docs/style.css` - Deduplicated 17 standalone card rules, added migrated page-scoped styles
- `custard-calendar/docs/group.html` - Removed vote-card/winner-card/share-panel from page-scoped styles, added .card classes to JS markup
- `custard-calendar/docs/fun.html` - Removed madlibs-card/linkout-card from page-scoped styles, added .card classes to HTML
- `custard-calendar/docs/index.html` - Added .card to today-card-skeleton, error-card (card--danger), updates-cta-card
- `custard-calendar/docs/compare.html` - Added .card to today-card-skeleton, error-card, compare-nudge, updates-cta-card
- `custard-calendar/docs/forecast-map.html` - Added .card .card--overlay to fronts-legend-card and fronts-timeline-card
- `custard-calendar/docs/today-page.js` - Added .card to near-me-card, .card .card--accent-sm to week-day-card
- `custard-calendar/docs/todays-drive.js` - Added .card .card--accent-sm to drive-card
- `custard-calendar/docs/planner-ui.js` - Added .card .card--accent-sm to signal-card
- `custard-calendar/docs/planner-domain.js` - Added .card .card--accent to day-card (certaintyCardClass), .card to historical-context-card
- `custard-calendar/docs/shared-nav.js` - Added .card to first-visit-prompt
- `custard-calendar/docs/compare-page.js` - Added .card to compare-add-hint
- `custard-calendar/tests/test_design_tokens.py` - Added .madlibs-card to color allowlist

## Decisions Made
- Used var(--state-confirmed-bg) for madlibs-card background (replacing #eef4fb) since it maps to the same blue-tinted surface
- Added .madlibs-card to design token color allowlist because its unique teal accent (#0d7377) and active state (#dde9f5) are not part of the token system
- Winner badge uses var(--bg-surface) instead of #fff and var(--space-2) instead of hardcoded 0.5rem
- Vote card h3 margin uses var(--space-1) instead of hardcoded 0.25rem
- calendar-cta-card CSS deduplicated but no HTML element exists to update (CSS-only component, may be used by future features)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Design token test failures from migrated page-scoped styles**
- **Found during:** Task 1
- **Issue:** Migrated styles contained hardcoded hex values (#fff, #0d7377, #dde9f5, #222, #555) and hardcoded spacing (0.25rem, 0.5rem) that triggered test_design_tokens.py failures
- **Fix:** Replaced tokenizable values with design tokens (var(--bg-surface), var(--space-1), var(--space-2), var(--text-primary), var(--text-secondary)). Added .madlibs-card to color allowlist for non-tokenizable unique accent colors.
- **Files modified:** custard-calendar/docs/style.css, custard-calendar/tests/test_design_tokens.py
- **Verification:** All 7 card_button_unification tests pass; design_token test failures are only pre-existing (nearest-badge, user-position-dot)
- **Committed in:** 3487a47 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor -- tokenizing migrated styles is consistent with project's design token policy. Allowlist addition follows established pattern for domain-specific colors.

## Issues Encountered
- Pre-existing test_design_tokens.py failures (nearest-badge hardcoded #4285f4, user-position-dot #4285f4/#fff, margin-left 0.5rem) remain unchanged -- these are not caused by Plan 02 changes and are tracked as known blockers in STATE.md.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 27 card elements now inherit .card base -- Plan 03 can proceed with button consolidation and inline style elimination
- Page-scoped card styles fully migrated -- group.html and fun.html <style> blocks only contain non-card rules
- Test baselines from Plan 01 remain valid -- Plan 03 will drive inline style baselines to 0
- Legacy button allowlist from Plan 01 ready for Plan 03 migration

## Self-Check: PASSED

- FOUND: docs/style.css
- FOUND: docs/group.html
- FOUND: docs/fun.html
- FOUND: docs/index.html
- FOUND: docs/compare.html
- FOUND: docs/forecast-map.html
- FOUND: tests/test_design_tokens.py
- FOUND: commit 3487a47 (Task 1)
- FOUND: commit ac5a31b (Task 2)

---
*Phase: 21-card-button-unification*
*Completed: 2026-03-14*
