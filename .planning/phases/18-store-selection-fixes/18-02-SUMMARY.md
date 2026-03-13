---
phase: 18-store-selection-fixes
plan: 02
subsystem: ui
tags: [compare-page, localStorage, single-store, browser-tests, playwright]

requires:
  - phase: 18-store-selection-fixes
    provides: Phase context for store selection bug fixes
provides:
  - Compare page renders grid for 1 store with add-more hint
  - MIN_COMPARE_STORES lowered from 2 to 1
  - Picker accepts saving with 1+ stores
  - Auto-inherit from custard-primary for first-time Compare visitors
affects: [compare-page, store-selection]

tech-stack:
  added: []
  patterns: [single-store compare grid with placeholder hint]

key-files:
  created:
    - custard-calendar/worker/test/browser/compare-single-store.spec.mjs
  modified:
    - custard-calendar/docs/compare-page.js
    - custard-calendar/worker/test/browser/compare-grid.spec.mjs
    - custard-calendar/worker/test/browser/compare-localstorage-isolation.spec.mjs
    - custard-calendar/worker/test/browser/compare-picker.spec.mjs

key-decisions:
  - "Add-more hint uses dashed border with muted text and inline styles for zero-CSS-file approach"
  - "Hint button triggers store picker with manifest lazy-load matching existing pattern"

patterns-established:
  - "Single-store compare hint: dashed-border placeholder with action button in each day card"

requirements-completed: [STOR-02]

duration: 6min
completed: 2026-03-13
---

# Phase 18 Plan 02: Single-Store Compare Page Summary

**Compare page renders 1-store grid with add-more hint instead of empty state, using MIN_COMPARE_STORES=1 and placeholder slots encouraging comparison**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-13T01:40:22Z
- **Completed:** 2026-03-13T01:46:05Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Compare page now shows a 3-day schedule grid for users with 1 geolocated store instead of the empty "Add stores" prompt
- Each day card includes a dashed-border placeholder hint encouraging users to add another store for comparison
- Picker and store bar work correctly with 1 store minimum, preserving all existing 2+ store behavior
- 6 new browser tests validate single-store flows; all 36 compare tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Write browser tests for single-store Compare page** - `991de1e` (test)
2. **Task 2: Update compare-page.js for single-store support** - `16c99d2` (feat)

## Files Created/Modified
- `custard-calendar/worker/test/browser/compare-single-store.spec.mjs` - 6 new browser tests for single-store Compare page behavior
- `custard-calendar/docs/compare-page.js` - MIN_COMPARE_STORES=1, loadAndRender gate change, add-more hint in renderGrid
- `custard-calendar/worker/test/browser/compare-grid.spec.mjs` - Updated single-store test to expect grid instead of empty state
- `custard-calendar/worker/test/browser/compare-localstorage-isolation.spec.mjs` - Updated primary-store fallback test to expect grid
- `custard-calendar/worker/test/browser/compare-picker.spec.mjs` - Updated remove-to-1-store test to expect grid with hint

## Decisions Made
- Used inline styles on the add-more hint div rather than adding a CSS file, matching the project's zero-build-step approach
- Hint button lazy-loads the store manifest before opening the picker, matching the existing addStoresBtn pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 2 additional test files expecting old 1-store empty state**
- **Found during:** Task 2 (verification step)
- **Issue:** compare-localstorage-isolation.spec.mjs and compare-picker.spec.mjs both expected empty state when 1 store was present
- **Fix:** Updated both tests to expect the grid with add-more hint for 1 store
- **Files modified:** compare-localstorage-isolation.spec.mjs, compare-picker.spec.mjs
- **Verification:** All 36 compare browser tests pass
- **Committed in:** 16c99d2 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix in test expectations)
**Impact on plan:** The plan anticipated updating compare-grid.spec.mjs but missed 2 other test files with the same assumption. All fixed inline.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Compare page single-store support complete
- Phase 18 store selection fixes ready for any remaining plans
- All compare browser tests green (36/36)

---
*Phase: 18-store-selection-fixes*
*Completed: 2026-03-13*
