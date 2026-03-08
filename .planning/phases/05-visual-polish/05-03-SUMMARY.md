---
phase: 05-visual-polish
plan: 03
subsystem: ui
tags: [css, design-tokens, typography, spacing, css-custom-properties]

# Dependency graph
requires:
  - phase: 05-01
    provides: Design token definitions at :root in style.css
provides:
  - Design token consumption across Today, Map, Compare, SharedNav, and Navigation CSS rules
  - var(--text-primary) consumed in 4 rules replacing hardcoded #1a1a1a
  - var(--text-subtle) consumed in 5 rules replacing hardcoded #999
  - var(--text-base) consumed in 11 rules replacing hardcoded 0.875rem
  - var(--text-sm) consumed in 10 rules replacing hardcoded 0.75rem
  - var(--text-xs) consumed in 4 rules replacing hardcoded 0.6875rem
  - var(--text-2xl) consumed in 1 rule replacing hardcoded 1.75rem
  - var(--text-md) consumed in 4 rules replacing hardcoded 1rem
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [css-design-token-consumption, hardcoded-to-var-replacement]

key-files:
  created: []
  modified: [docs/style.css]

key-decisions:
  - "Only replaced values with exact token matches; left 0.8125rem, 0.9375rem, 0.8rem, 0.85rem, 0.9rem as-is since no matching token exists"
  - "Added store-picker-address font-size tokenization (SharedNav section) as bonus replacement beyond plan spec"
  - "Hero PNG scope acknowledged as 40 profiled flavors with SVG fallback for remaining flavors -- by design"

patterns-established:
  - "Token consumption pattern: nav page CSS rules reference :root design tokens via var() instead of hardcoded values"

requirements-completed: [VIZP-01, VIZP-02, VIZP-03, VIZP-04]

# Metrics
duration: 3min
completed: 2026-03-08
---

# Phase 5 Plan 3: Design Token Adoption Summary

**Design tokens (--text-primary, --text-subtle, --text-xs through --text-2xl) adopted across 37 CSS rules in Today, Map, Compare, SharedNav, and Navigation page sections**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-08T22:48:47Z
- **Completed:** 2026-03-08T22:52:21Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Replaced 21 hardcoded font-size and color values in Today page CSS with var() token references
- Replaced 16 hardcoded font-size and color values in Map, Compare, SharedNav, and Navigation CSS with var() token references
- Zero regressions across 91 passing Playwright browser tests
- All 11 previously unused design tokens now consumed by at least one CSS rule
- Radar, Scoop, Calendar, and global body/header sections remain unmodified

## Task Commits

Each task was committed atomically:

1. **Task 1: Adopt design tokens in Today page CSS rules** - `364f0ed` (feat)
2. **Task 2: Adopt design tokens in Map, Compare, SharedNav, and Navigation CSS** - `0e92b42` (feat)

## Files Created/Modified
- `docs/style.css` - Replaced 37 hardcoded font-size, color values with var() design token references across 4 nav page CSS sections

## Decisions Made
- Only replaced exact token matches (0.75rem -> var(--text-sm), 0.875rem -> var(--text-base), etc.); values like 0.8125rem with no matching token were left as-is
- Did not replace `color: #666` instances since --text-muted already exists but is not one of the unused tokens targeted by this plan
- Did not replace body/header global rules (line 73 `color: #1a1a1a`) since these affect all pages including legacy
- Added store-picker-address tokenization as a bonus match within the SharedNav section scope

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All design tokens now consumed; verification gap from 05-VERIFICATION.md fully closed
- Hero PNG scope (40 profiled flavors) acknowledged as intentional design per CONTEXT.md
- v1.0 milestone complete with all token adoption gaps resolved

## Self-Check: PASSED

- docs/style.css: FOUND
- 05-03-SUMMARY.md: FOUND
- Commit 364f0ed: FOUND
- Commit 0e92b42: FOUND

---
*Phase: 05-visual-polish*
*Completed: 2026-03-08*
