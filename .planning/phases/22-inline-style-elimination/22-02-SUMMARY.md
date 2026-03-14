---
phase: 22-inline-style-elimination
plan: 02
subsystem: ui
tags: [javascript, css, design-tokens, inline-styles, static-analysis, classList]

requires:
  - phase: 22-inline-style-elimination
    plan: 01
    provides: .hidden CSS class, zero inline style= attributes in HTML markup
  - phase: 20-design-token-wiring
    provides: CSS custom properties (--brand, --state-success, --state-danger)

provides:
  - Zero .style.display assignments in compare-page.js and shared-nav.js
  - classList.toggle('hidden') pattern for JS visibility toggling
  - .fronts-tick--confirmed CSS class replacing inline fontWeight/color in forecast-map.html
  - .text-danger CSS class for updates-page.js status colors
  - classList.add/remove('hidden') for forecast-map.html view mode toggling
  - Static analysis enforcement tests for JS .style.* elimination
  - Documented exceptions for truly dynamic runtime values (today-page.js brand colors, innerHTML family colors)

affects: [25-test-cleanup]

tech-stack:
  added: []
  patterns: [classList-toggle-hidden-for-visibility, css-class-for-state-colors, documented-exception-for-dynamic-inline-styles]

key-files:
  created: []
  modified:
    - custard-calendar/docs/compare-page.js
    - custard-calendar/docs/shared-nav.js
    - custard-calendar/docs/forecast-map.html
    - custard-calendar/docs/updates-page.js
    - custard-calendar/docs/style.css
    - custard-calendar/tests/test_inline_style_elimination.py

key-decisions:
  - "today-page.js dynamic brand colors kept as .style assignments (Option B) -- truly dynamic per-store values from BRAND_COLORS lookup"
  - "innerHTML family color spans and hotspot-dot backgrounds remain inline -- dynamic runtime values that vary per flavor family"
  - ".text-danger uses var(--state-danger) matching original #c62828 hex; .text-success already existed with var(--state-success-text)"
  - ".fronts-tick-row span base rule gets explicit font-weight:400 for clean toggle with .fronts-tick--confirmed"

patterns-established:
  - "classList.toggle('hidden', condition) for show/hide: replaces .style.display = condition ? '' : 'none'"
  - "Documented exception pattern: truly dynamic runtime values (per-store brand colors, per-family flavor colors) stay as .style assignments with test documenting the exception"
  - "State color utility classes (.text-success, .text-danger) with classList.remove(all) before classList.add(new) for clean state transitions"

requirements-completed: [DTKN-03]

duration: 12min
completed: 2026-03-14
---

# Phase 22 Plan 02: JS Inline Style Elimination Summary

**15 JS .style.* assignments converted to classList operations across 4 files, with .fronts-tick--confirmed and .text-danger CSS classes and 8 new enforcement tests**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-14T15:03:33Z
- **Completed:** 2026-03-14T15:15:49Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Eliminated all .style.display assignments from compare-page.js (2) and shared-nav.js (2) using classList.toggle('hidden')
- Converted 8 .style.display assignments in forecast-map.html to classList.add/remove('hidden') for view mode toggling
- Replaced tick styling in forecast-map.html (2 .style.fontWeight/.color lines) with single classList.toggle('fronts-tick--confirmed')
- Converted 3 .style.color assignments in updates-page.js to .text-success/.text-danger CSS classes
- Added 8 new static analysis enforcement tests (4 JS enforcement + 3 CSS class existence + 1 today-page exception documentation)
- Documented exceptions for truly dynamic runtime values in today-page.js and forecast-map.html innerHTML

## Task Commits

Each task was committed atomically (TDD pattern):

1. **Task 1 RED: JS enforcement tests + CSS classes** - `0335af0` (test) -- 8 new tests, .fronts-tick--confirmed and .text-danger classes, tests correctly fail
2. **Task 2 GREEN: JS .style.* conversions** - `d16f05b` (feat) -- 15 .style.* assignments converted to classList operations
3. **Parent repo submodule update** - `621be79` (feat) -- submodule pointer update

## Files Created/Modified
- `custard-calendar/tests/test_inline_style_elimination.py` - 8 new tests (4 JS enforcement, 3 CSS class checks, 1 exception doc)
- `custard-calendar/docs/style.css` - .fronts-tick--confirmed class, .text-danger class, font-weight:400 on .fronts-tick-row span base
- `custard-calendar/docs/compare-page.js` - 2x .style.display -> classList.remove('hidden') / classList.toggle('hidden', !match)
- `custard-calendar/docs/shared-nav.js` - 2x .style.display -> classList.remove('hidden') / classList.toggle('hidden', !match)
- `custard-calendar/docs/forecast-map.html` - tick styling via .fronts-tick--confirmed, 8x .style.display -> classList.add/remove('hidden')
- `custard-calendar/docs/updates-page.js` - 3x .style.color -> classList.add('text-success'/'text-danger') with clean remove-before-add pattern

## Decisions Made
- **today-page.js (Option B):** Kept .style.borderLeftColor and .style.color for dynamic per-store brand colors. These use runtime BRAND_COLORS lookup (varies per brand: Culver's blue, Kopp's black, etc.) and cannot be replaced with static CSS classes. Documented as test exception.
- **innerHTML dynamic colors:** forecast-map.html popup family color span and hotspot-dot background use truly dynamic familyColor from data. Test has explicit exception for innerHTML string patterns.
- **.text-danger token:** Used var(--state-danger) to match original inline #c62828. The existing .text-success class (from a prior phase) already used var(--state-success-text).
- **Base tick styling:** Added explicit font-weight:400 to .fronts-tick-row span base rule so the .fronts-tick--confirmed modifier has a clean default to toggle against.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] .text-success CSS class already existed with different token name**
- **Found during:** Task 1 (CSS class creation)
- **Issue:** Plan specified adding .text-success with var(--state-success), but style.css already had .text-success at line 1155 using var(--state-success-text). Adding a duplicate would cause conflicts.
- **Fix:** Kept existing .text-success as-is. Added only .text-danger next to it. Updated test assertions to check for partial token match (var(--state-success and var(--state-danger) rather than exact token names.
- **Files modified:** custard-calendar/docs/style.css, custard-calendar/tests/test_inline_style_elimination.py
- **Verification:** Both token values resolve to the same color (#2e7d32) so behavior is identical.
- **Committed in:** 0335af0 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 bug)
**Impact on plan:** Trivial adjustment to avoid CSS class duplication. No scope creep.

## Issues Encountered
None beyond the auto-fixed duplicate class issue above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DTKN-03 requirement fully satisfied: all inline styles in HTML eliminated (Plan 01), all .style.* in JS converted to CSS classes (Plan 02)
- Documented exceptions for truly dynamic runtime values (per-store brand colors, per-family flavor colors in innerHTML)
- Pre-existing test failures remain unchanged (nearest-badge, user-position-dot, browser clickthrough timeout)
- Phase 22 complete -- ready for next phase in v1.5 roadmap

---
## Self-Check: PASSED

- All 7 files verified present
- Submodule commits 0335af0 (RED), d16f05b (GREEN) confirmed
- Parent commit 621be79 confirmed

---
*Phase: 22-inline-style-elimination*
*Completed: 2026-03-14*
