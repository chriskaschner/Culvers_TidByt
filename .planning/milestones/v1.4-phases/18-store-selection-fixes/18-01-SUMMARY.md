---
phase: 18-store-selection-fixes
plan: 01
subsystem: ui
tags: [localStorage, onboarding, today-page, playwright, browser-tests]

# Dependency graph
requires: []
provides:
  - "Flash-free returning-user flow on Today page"
  - "Invalid store slug cleanup with localStorage.removeItem"
  - "Browser tests for onboarding banner visibility"
affects: [shared-nav, store-selection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Synchronous localStorage check before async store manifest load"
    - "MutationObserver-based flash-detection in Playwright tests"

key-files:
  created:
    - "custard-calendar/worker/test/browser/today-onboarding.spec.mjs"
  modified:
    - "custard-calendar/docs/today-page.js"

key-decisions:
  - "Track hidden-attribute transitions instead of initial HTML state in MutationObserver test"
  - "Show loading skeleton immediately for returning users while store manifest loads"

patterns-established:
  - "page.addInitScript for pre-navigation localStorage injection in browser tests"
  - "Synchronous localStorage guard before async data loads to prevent DOM flash"

requirements-completed: [STOR-01]

# Metrics
duration: 4min
completed: 2026-03-13
---

# Phase 18 Plan 01: Store Selection Onboarding Fix Summary

**Synchronous localStorage check in today-page.js init() prevents onboarding banner flash for returning users, with 4 Playwright browser tests covering all visibility scenarios**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-13T01:40:15Z
- **Completed:** 2026-03-13T01:44:03Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Returning users with a valid store in localStorage never see the onboarding banner flash
- Invalid saved store slugs are automatically cleared from localStorage with graceful fallback to onboarding flow
- IP geolocation alone does not suppress the onboarding banner (user must explicitly confirm)
- All 13 today-related browser tests pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Write browser tests for onboarding banner visibility** - `0dd0168` (test)
2. **Task 2: Fix today-page.js init flow to prevent onboarding flash** - `347ccf8` (feat)

**Submodule update:** `2b9ff1e` (chore: update custard-calendar submodule)

## Files Created/Modified
- `custard-calendar/worker/test/browser/today-onboarding.spec.mjs` - 4 Playwright tests for onboarding banner visibility behavior
- `custard-calendar/docs/today-page.js` - init() refactored to check localStorage synchronously before async store load

## Decisions Made
- Used MutationObserver tracking hidden-attribute transitions (not initial HTML state) to detect flash -- the HTML naturally starts with empty-state visible, so we track re-shows after init() hides it
- Loading skeleton shown immediately for returning users provides visual feedback while store manifest and forecast data load asynchronously

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated test MutationObserver strategy**
- **Found during:** Task 2 (GREEN phase verification)
- **Issue:** Original test checked if empty-state was "ever visible" but the HTML starts with it visible (no hidden attr). The test detected this pre-JS state as a failure.
- **Fix:** Changed observer to track hidden-to-visible transitions (re-shows) instead of absolute visibility. This correctly detects the flash bug without false-positiving on the initial HTML state.
- **Files modified:** custard-calendar/worker/test/browser/today-onboarding.spec.mjs
- **Verification:** All 4 onboarding tests pass, all 5 existing hero tests pass
- **Committed in:** 347ccf8 (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test logic)
**Impact on plan:** Test strategy adjusted to match actual DOM lifecycle. No scope creep.

## Issues Encountered
None beyond the test observer adjustment noted above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Store selection onboarding flow is now correctly handled for all user states
- Ready for additional store-selection-fixes plans if any remain in phase 18

## Self-Check: PASSED

- FOUND: custard-calendar/worker/test/browser/today-onboarding.spec.mjs
- FOUND: .planning/phases/18-store-selection-fixes/18-01-SUMMARY.md
- FOUND: submodule commits 0dd0168, 347ccf8
- FOUND: superproject commit 2b9ff1e

---
*Phase: 18-store-selection-fixes*
*Completed: 2026-03-13*
