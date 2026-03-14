---
phase: 23-compare-ux-fix
plan: 01
subsystem: ui
tags: [geolocation, auto-populate, browser-tests, playwright, compare-page]

# Dependency graph
requires:
  - phase: 22-inline-style-elimination
    provides: classList.toggle('hidden') pattern, clean inline-style-free baseline
provides:
  - Geo-aware auto-populate for first-time Compare visitors
  - SharedNav first-visit prompt suppression on Compare page
  - Header change button override to open Compare multi-store picker
  - Browser test suite for geo auto-populate flow (6 tests)
affects: [shared-nav, compare-page, today-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "doCompareGeolocation with Promise.race timeout pattern"
    - "addInitScript for race-free localStorage setup in Playwright tests"
    - "data-page attribute for page-aware SharedNav behavior"
    - "cloneNode button override to replace event handlers"

key-files:
  created:
    - custard-calendar/worker/test/browser/compare-auto-populate.spec.mjs
  modified:
    - custard-calendar/docs/compare-page.js
    - custard-calendar/docs/shared-nav.js
    - custard-calendar/docs/compare.html
    - custard-calendar/worker/test/browser/compare-expand.spec.mjs
    - custard-calendar/worker/test/browser/compare-filter.spec.mjs
    - custard-calendar/worker/test/browser/compare-grid.spec.mjs
    - custard-calendar/worker/test/browser/compare-localstorage-isolation.spec.mjs
    - custard-calendar/worker/test/browser/compare-picker.spec.mjs
    - custard-calendar/worker/test/browser/compare-single-store.spec.mjs

key-decisions:
  - "SharedNav suppression via data-page attribute check (no new events needed)"
  - "Compare runs its own geo call (not reusing SharedNav's), accessing SharedNav.manifestPromise for store list"
  - "cloneNode pattern to override SharedNav's change button handler without modifying SharedNav binding"
  - "Existing tests updated to use addInitScript and geoFail option to avoid geo race conditions"

patterns-established:
  - "doCompareGeolocation: Promise.race with 3s timeout for geo-aware auto-populate"
  - "addInitScript for localStorage setup in Playwright tests (race-free vs evaluate+reload)"
  - "geoFail option in test setup helpers for empty-state testing"
  - "SharedNav public API expansion: findNearestStore + manifestPromise for cross-module reuse"

requirements-completed: [COMP-01, COMP-02, COMP-03]

# Metrics
duration: 12min
completed: 2026-03-14
---

# Phase 23 Plan 01: Compare UX Fix Summary

**Geo-aware auto-populate with 3s timeout for first-time Compare visitors, SharedNav prompt suppression, and header change button override to Compare's multi-store picker**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-14T18:05:07Z
- **Completed:** 2026-03-14T18:17:16Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- First-time Compare visitors auto-populate from IP geolocation within 3 seconds (or fall back to empty state with CTA)
- SharedNav's first-visit prompt suppressed on Compare page via data-page="compare" check
- Header "change" button on Compare opens Compare's multi-store picker instead of SharedNav's single-store picker
- Auto-populated store sets custard-primary for cross-page benefit (Today, Map pages)
- 6 new browser tests covering all three requirements (COMP-01, COMP-02, COMP-03)
- 6 existing test files updated to use addInitScript for race-free localStorage setup

## Task Commits

Each task was committed atomically:

1. **Task 1: Write browser tests for Compare auto-populate** - `96916a0` (test -- TDD RED phase, 6 failing tests)
2. **Task 2: Implement geo-aware auto-populate and fix existing tests** - `9f33306` (feat -- TDD GREEN phase, all 42 compare tests pass)

## Files Created/Modified
- `custard-calendar/worker/test/browser/compare-auto-populate.spec.mjs` - 6 Playwright tests for geo auto-populate, change button, and geo failure
- `custard-calendar/docs/compare-page.js` - doCompareGeolocation(), _geoAttempted flag, overrideChangeButton(), compareLoadingLabel ref
- `custard-calendar/docs/shared-nav.js` - data-page compare suppression, exposed findNearestStore and manifestPromise
- `custard-calendar/docs/compare.html` - Loading label ("Finding nearest store...") inside skeleton
- `custard-calendar/worker/test/browser/compare-expand.spec.mjs` - addInitScript for localStorage setup
- `custard-calendar/worker/test/browser/compare-filter.spec.mjs` - addInitScript for localStorage setup
- `custard-calendar/worker/test/browser/compare-grid.spec.mjs` - addInitScript for localStorage setup
- `custard-calendar/worker/test/browser/compare-localstorage-isolation.spec.mjs` - geoFail option and addInitScript
- `custard-calendar/worker/test/browser/compare-picker.spec.mjs` - geoFail option and addInitScript
- `custard-calendar/worker/test/browser/compare-single-store.spec.mjs` - geo failure override for zero-store test

## Decisions Made
- SharedNav suppression uses existing `data-page="compare"` attribute on the nav container -- no new events or flags needed
- Compare runs its own geo call rather than reusing SharedNav's doIPGeolocation, but reuses SharedNav.findNearestStore and SharedNav.manifestPromise for the store lookup
- Header change button override uses cloneNode to strip SharedNav's click handler, then rebinds to showCompareStorePicker
- Existing tests updated to use Playwright addInitScript instead of evaluate+reload pattern to avoid race conditions with the new geo auto-populate

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 9 existing test regressions from geo auto-populate behavior change**
- **Found during:** Task 2 (implementation verification)
- **Issue:** 9 existing compare browser tests failed because they expected empty state when zero stores were saved, but the new geo auto-populate changes that behavior. Also, tests using evaluate+reload for localStorage setup had race conditions with async geo flow.
- **Fix:** Updated 6 test files: (a) Tests expecting empty state now use geoFail option to mock geo failure; (b) Tests with evaluate+reload pattern replaced with addInitScript for race-free localStorage setup before page load.
- **Files modified:** compare-single-store.spec.mjs, compare-picker.spec.mjs, compare-localstorage-isolation.spec.mjs, compare-grid.spec.mjs, compare-expand.spec.mjs, compare-filter.spec.mjs
- **Verification:** All 42 compare browser tests pass, 1352 unit tests pass
- **Committed in:** 9f33306 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 -- test regression from intentional behavior change)
**Impact on plan:** Essential fix -- existing tests needed to reflect the new geo-aware behavior. No scope creep.

## Issues Encountered
None -- implementation followed the plan closely. The test regressions were expected and handled as a deviation.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Compare page UX flow is coherent for first-time visitors
- SharedNav properly defers to Compare's onboarding on the Compare page
- All three COMP requirements verified by browser tests
- Ready for any future Compare or SharedNav work

## Self-Check: PASSED

All files exist. Both commits verified (96916a0, 9f33306). 42 compare browser tests pass. 1352 unit tests pass.

---
*Phase: 23-compare-ux-fix*
*Completed: 2026-03-14*
