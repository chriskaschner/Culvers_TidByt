---
phase: 20-design-token-expansion
plan: 01
subsystem: ui
tags: [css-custom-properties, design-tokens, color-mix, vanilla-css, playwright]

# Dependency graph
requires:
  - phase: 06-visual-polish-phase6
    provides: Initial 37 CSS custom properties in :root
provides:
  - 30 new CSS custom properties (state, rarity, interactive, brand tokens)
  - 3 browser test files covering DTKN-01, DTKN-02, DTKN-04
  - State-color hex values replaced with var() references
  - Rarity palette unified across popup and badge contexts
  - Common/staple rarity badges hidden via display:none
affects: [20-02-PLAN, quiz-token-migration, map-marker-glows]

# Tech tracking
tech-stack:
  added: [color-mix() for map marker glows and hover tokens]
  patterns: [var(--state-*) for semantic state colors, var(--rarity-*) for rarity colors, classList instead of inline style hex]

key-files:
  created:
    - custard-calendar/worker/test/browser/dtkn-state-tokens.spec.mjs
    - custard-calendar/worker/test/browser/dtkn-rarity-tokens.spec.mjs
    - custard-calendar/worker/test/browser/dtkn-interactive-tokens.spec.mjs
  modified:
    - custard-calendar/docs/style.css
    - custard-calendar/docs/today-page.js
    - custard-calendar/docs/compare-page.js

key-decisions:
  - "Used --state-confirmed (blue) for structural borders/strips and --state-success (green) for badges/match indicators, preserving the existing intentional split"
  - "Replaced map marker glow rgba() values with color-mix() derived from state tokens, consistent with quiz.html precedent"
  - "Watch banner text color mapped to --state-watch-text (#f57f17) replacing the brown #5d4037 for consistency"
  - "prediction-bar-estimated uses --state-estimated rather than a new derived token since the semantic intent aligns"

patterns-established:
  - "State color pattern: var(--state-{name}) for primary, var(--state-{name}-bg) for background, var(--state-{name}-text) for text"
  - "JS state coloring via classList.add instead of element.style.borderLeftColor hex assignments"
  - "Utility classes (.text-success, .text-estimated) for JS innerHTML token references"

requirements-completed: [DTKN-01]

# Metrics
duration: 7min
completed: 2026-03-13
---

# Phase 20 Plan 01: State Tokens and CSS Foundation Summary

**30 new CSS custom properties in :root covering state/rarity/interactive/brand tokens, all state-color hex replaced with var() references, 3 browser test files with 16 passing tests**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-13T16:21:19Z
- **Completed:** 2026-03-13T16:29:49Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added 30 new CSS custom properties to :root (state, rarity, interactive, brand) after existing 37 tokens
- Replaced all hardcoded state-color hex values across CSS rules (day cards, badges, confidence strips, watch banner, popups, signals, suggestions panel)
- Replaced JS inline hex in today-page.js and compare-page.js with CSS class-based state coloring
- Unified rarity badge palette (Today/Compare badges now match popup chip colors) and hidden common/staple badges
- Created 3 comprehensive browser test files (16 tests total) validating token resolution and palette unification
- All 16 DTKN tests pass GREEN, plus 4 existing vizp-card-system regression tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Create browser test scaffolds for DTKN-01, DTKN-02, DTKN-04** - `9c104ce` (test)
2. **Task 2: Add tokens to :root and replace state-color hex in CSS and JS** - `b22fa68` (feat)

## Files Created/Modified
- `custard-calendar/worker/test/browser/dtkn-state-tokens.spec.mjs` - 8 tests for DTKN-01 state token resolution
- `custard-calendar/worker/test/browser/dtkn-rarity-tokens.spec.mjs` - 5 tests for DTKN-02 rarity palette unification
- `custard-calendar/worker/test/browser/dtkn-interactive-tokens.spec.mjs` - 3 tests for DTKN-04 interactive and brand tokens
- `custard-calendar/docs/style.css` - 30 new :root tokens, state/rarity/brand/interactive hex replaced with var() references
- `custard-calendar/docs/today-page.js` - Hero card and week strip use classList instead of inline style hex
- `custard-calendar/docs/compare-page.js` - Add-hint uses CSS class instead of inline style.cssText

## Decisions Made
- Used --state-confirmed (blue/#005696) for structural elements (borders, confidence strips) and --state-success (green/#2e7d32) for success badges/match indicators, preserving the existing intentional split per CONTEXT.md discretion
- Replaced map marker glow rgba() values with color-mix() from state tokens (consistent with quiz.html precedent for color-mix usage)
- Watch banner text color changed from brown #5d4037 to --state-watch-text (#f57f17) for palette consistency
- prediction-bar-estimated mapped to --state-estimated rather than keeping the distinct #b0c4de since the semantic intent aligns
- Left drive dashboard bucket colors (#2e7d32, #f9a825) as-is since they're a separate semantic domain (will be easy to tokenize in Plan 02 or later)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added .compare-add-hint CSS class**
- **Found during:** Task 2 (Part D - compare-page.js hex replacement)
- **Issue:** Removing inline styles from compare-page.js hint element required a CSS class that didn't exist
- **Fix:** Added .compare-add-hint and .compare-add-hint-btn CSS classes using design tokens
- **Files modified:** custard-calendar/docs/style.css
- **Verification:** Visual styling preserved, no inline hex remains
- **Committed in:** b22fa68 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Tokenized suggestions panel and compare-nudge**
- **Found during:** Task 2 (Part B - CSS hex sweep)
- **Issue:** Suggestions panel (#suggestions-panel) and compare-nudge used hardcoded watch-palette hex values that should use tokens
- **Fix:** Replaced with var(--state-watch-bg) and var(--state-watch-border) references
- **Files modified:** custard-calendar/docs/style.css
- **Verification:** grep confirms no remaining hardcoded state hex in these rules
- **Committed in:** b22fa68 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both auto-fixes necessary for completeness of hex replacement. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Token foundation established for Plan 02 (rarity badge CSS changes, interactive hover/focus patterns)
- All 30 tokens in :root available for Plan 02 to reference
- Common/staple badge hiding already done (part of rarity unification)
- Drive dashboard bucket colors and remaining brand-color hex values are available for tokenization in Plan 02

## Self-Check: PASSED

- [x] dtkn-state-tokens.spec.mjs exists
- [x] dtkn-rarity-tokens.spec.mjs exists
- [x] dtkn-interactive-tokens.spec.mjs exists
- [x] 20-01-SUMMARY.md exists
- [x] Commit 9c104ce found (test scaffolds)
- [x] Commit b22fa68 found (tokens and hex replacement)
- [x] All 16 DTKN tests pass GREEN
- [x] All 4 vizp-card-system regression tests pass
- [x] All 1351 unit tests pass

---
*Phase: 20-design-token-expansion*
*Completed: 2026-03-13*
