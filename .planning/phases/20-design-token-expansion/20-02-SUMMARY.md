---
phase: 20-design-token-expansion
plan: 02
subsystem: ui
tags: [css-custom-properties, design-tokens, color-mix, quiz-migration, focus-ring, hover-tokens]

# Dependency graph
requires:
  - phase: 20-design-token-expansion
    plan: 01
    provides: 30 CSS custom properties (state, rarity, interactive, brand tokens), state-color hex replaced, test scaffolds
provides:
  - Remaining map marker glows derived from state tokens via color-mix()
  - Quiz danger/success colors referencing shared state tokens
  - Interactive token wiring (focus-ring on compare chip, hover-bg on CTAs/share)
  - Error card and drive dashboard colors tokenized
  - Zero state/rarity hex values remaining in CSS rules outside :root
affects: [future-css-phases, dark-mode-readiness]

# Tech tracking
tech-stack:
  added: []
  patterns: [var(--state-*) for drive dashboard buckets, var(--hover-bg) for interactive hover states, var(--focus-ring) for all focus-visible rules]

key-files:
  created: []
  modified:
    - custard-calendar/docs/style.css
    - custard-calendar/docs/quiz.html

key-decisions:
  - "Derived .flavor-map-marker-default glow from --state-confirmed at 34% opacity via color-mix(), matching the original rgba alpha"
  - "Derived .flavor-map-marker-nearest glow from --state-confirmed at 70% opacity, replacing the Google-blue rgba(66,133,244,0.7)"
  - "Drive dashboard bucket colors tokenized: great->--state-success, ok->--state-watch, hard_pass->--state-danger; pass bucket left as neutral #757575 (no matching token)"
  - "Error card background and text use --state-danger-bg and --state-danger tokens"

patterns-established:
  - "All interactive hover backgrounds use var(--hover-bg) -- consistent hover feedback across CTAs and share buttons"
  - "All :focus-visible rules use var(--focus-ring) and var(--focus-ring-offset) -- no hardcoded focus colors remain"
  - "Quiz inline tokens derive from shared state tokens via var() indirection, preserving quiz-specific variable names"

requirements-completed: [DTKN-02, DTKN-04]

# Metrics
duration: 3min
completed: 2026-03-13
---

# Phase 20 Plan 02: Rarity and Interactive Token Wiring Summary

**All remaining hardcoded hex values in CSS rules replaced with design tokens -- map marker glows, quiz colors, drive dashboard, error states, focus rings, and hover backgrounds now reference shared token system**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-13T16:32:36Z
- **Completed:** 2026-03-13T16:35:42Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced remaining hardcoded map marker glow rgba values (.flavor-map-marker-default, .flavor-map-marker-nearest) with color-mix() from state tokens
- Migrated quiz --quiz-danger and --quiz-success to derive from --state-danger-text and --state-success-text
- Wired .compare-filter-chip:focus-visible to use var(--focus-ring) and var(--focus-ring-offset)
- Replaced .cta-link:hover and .share-btn:hover hardcoded #f0f7ff with var(--hover-bg)
- Tokenized .error-card, .error-card p, .btn-retry with --state-danger and --state-danger-bg
- Tokenized drive dashboard bucket colors (great/ok/hard_pass) with state tokens
- All 16 DTKN tests pass GREEN, all 4 vizp regression tests pass, all 1351 unit tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Unify rarity badge palette and hide common/staple (DTKN-02)** - `51a7e17` (feat)
2. **Task 2: Wire interactive tokens and migrate quiz colors (DTKN-04)** - `ca85132` (feat)

## Files Created/Modified
- `custard-calendar/docs/style.css` - Map marker glows, focus-visible, hover states, error card, drive dashboard all tokenized
- `custard-calendar/docs/quiz.html` - --quiz-danger and --quiz-success derive from shared state tokens

## Decisions Made
- Derived .flavor-map-marker-default glow from --state-confirmed at 34% opacity via color-mix(), matching the original rgba(0, 54, 102, 0.34) alpha value
- Derived .flavor-map-marker-nearest glow from --state-confirmed at 70% opacity, replacing Google-blue rgba(66,133,244,0.7) with brand-consistent confirmed blue
- Drive dashboard bucket colors tokenized where semantics align: great = --state-success, ok = --state-watch, hard_pass = --state-danger; pass left as neutral #757575 (no semantic token match)
- Error card uses --state-danger-bg and --state-danger tokens for consistency with the state color system
- forecast-map.html not modified -- its inline hex values (#005696, #666) are presentational header styles and its marker coloring is entirely JS-driven, not CSS-class-based

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Tokenized error card with state-danger tokens**
- **Found during:** Task 2 (Part F validation sweep)
- **Issue:** .error-card, .error-card p, and .btn-retry used hardcoded #fce4ec and #c62828 which are exactly --state-danger-bg and --state-danger
- **Fix:** Replaced with var(--state-danger-bg) and var(--state-danger) references
- **Files modified:** custard-calendar/docs/style.css
- **Verification:** grep confirms no remaining state-danger hex values outside :root
- **Committed in:** ca85132 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Error card tokenization is straightforward and aligns with the plan's Part F validation goal. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 20 (Design Token Expansion) is complete -- all DTKN requirements satisfied
- 30 tokens in :root, all state/rarity/interactive/brand hex values replaced in CSS rules
- Zero hardcoded state/rarity hex values remain outside :root definitions
- Token foundation ready for any future dark-mode or theme-switching work

## Self-Check: PASSED

- [x] 20-02-SUMMARY.md exists
- [x] Commit 51a7e17 found (map marker glow tokenization)
- [x] Commit ca85132 found (interactive tokens and quiz migration)
- [x] All 16 DTKN tests pass GREEN
- [x] All 4 vizp-card-system regression tests pass
- [x] All 5 vizp-seasonal-rarity regression tests pass
- [x] All 1351 unit tests pass

---
*Phase: 20-design-token-expansion*
*Completed: 2026-03-13*
