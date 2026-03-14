---
phase: 22-inline-style-elimination
plan: 01
subsystem: ui
tags: [css, design-tokens, inline-styles, static-analysis, html]

requires:
  - phase: 20-design-token-wiring
    provides: CSS custom properties (--brand, --text-muted, --text-base, --space-*)
  - phase: 21-card-button-unification
    provides: BEM modifier patterns, baseline-count test pattern

provides:
  - Zero inline style= attributes in compare.html, index.html, forecast-map.html HTML markup
  - .hidden CSS class for classList.toggle('hidden') pattern
  - .header-subtitle, .compare-empty-heading, .footer-disclaimer, .d-inline shared CSS classes
  - .updates-cta-card absorbs compare CTA layout properties
  - Static analysis enforcement tests for inline style elimination

affects: [22-02, 23-cone-rendering, 25-test-cleanup]

tech-stack:
  added: []
  patterns: [shared-css-class-for-identical-visual-treatment, token-based-spacing-enforcement]

key-files:
  created:
    - custard-calendar/tests/test_inline_style_elimination.py
  modified:
    - custard-calendar/docs/style.css
    - custard-calendar/docs/compare.html
    - custard-calendar/docs/index.html
    - custard-calendar/docs/forecast-map.html

key-decisions:
  - "header-subtitle class with --space-1 margin (not --space-2) to match original inline 0.25rem spacing"
  - "compare-empty-heading uses raw 1.25rem (no exact token) with comment noting gap between --text-lg and --text-xl"
  - "CTA card text reuses .header-subtitle class (DRY per user decision -- same visual treatment)"
  - "updates-cta-card absorbs text-align, margin-auto, padding, max-width from compare inline styles"

patterns-established:
  - "DRY class reuse: when two elements share identical visual treatment, use same class (e.g., header-subtitle for both header and CTA text)"
  - "Zero-baseline enforcement: inline style tests assert exactly 0 violations from the start"

requirements-completed: [DTKN-03]

duration: 3min
completed: 2026-03-14
---

# Phase 22 Plan 01: Inline Style Elimination Summary

**13 HTML inline style= attributes eliminated across 3 files, replaced by 6 token-consuming CSS classes with zero-baseline static analysis tests**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-14T14:56:36Z
- **Completed:** 2026-03-14T15:00:01Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 5

## Accomplishments
- Removed all 13 inline style= attributes from compare.html (6), index.html (4), forecast-map.html (3)
- Added 6 new CSS classes (.hidden, .header-subtitle, .compare-empty-heading, .footer-disclaimer, .d-inline, updates-cta-card layout absorption)
- All new classes consume design tokens (var(--*)) for spacing and colors
- 5 static analysis tests enforce zero inline styles in HTML markup
- No visual regressions -- CSS classes produce identical styling to removed inline attributes

## Task Commits

Each task was committed atomically (TDD pattern):

1. **Task 1 RED: Static analysis tests** - `d149783` (test) -- 5 failing tests for inline style enforcement
2. **Task 1 GREEN: CSS classes + inline style removal** - `697ba14` (feat) -- 6 CSS classes, 13 inline styles removed
3. **Parent repo submodule update** - `e2c5045` (feat) -- submodule pointer update

## Files Created/Modified
- `custard-calendar/tests/test_inline_style_elimination.py` - 5 static analysis tests for DTKN-03 enforcement
- `custard-calendar/docs/style.css` - .hidden, .header-subtitle, .compare-empty-heading, .footer-disclaimer, .d-inline classes; updates-cta-card layout absorption
- `custard-calendar/docs/compare.html` - 6 inline styles removed, replaced with CSS classes
- `custard-calendar/docs/index.html` - 4 inline styles removed, replaced with CSS classes
- `custard-calendar/docs/forecast-map.html` - 3 inline styles removed (HTML markup only), replaced with CSS classes

## Decisions Made
- **header-subtitle margin:** Used var(--space-1) (0.25rem) not var(--space-2) (0.5rem) to match original inline style exactly, overriding the header p default
- **compare-empty-heading font-size:** Used raw 1.25rem since no exact token exists (falls between --text-lg at 1.125rem and --text-xl at 1.5rem)
- **CTA text class reuse:** Applied .header-subtitle to compare CTA text paragraph (DRY -- same color/size/muted visual treatment per user decision)
- **updates-cta-card absorption:** Added text-align:center, margin:auto, padding, max-width to existing .updates-cta-card rule rather than creating a modifier

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CSS comments with literal values triggered design token tests**
- **Found during:** Task 1 GREEN (verification)
- **Issue:** Inline comments like `/* 0.25rem */` and `/* #666 */` in new CSS classes were detected as hardcoded values by test_design_tokens.py
- **Fix:** Removed literal numeric/hex values from CSS comments, keeping only semantic descriptions
- **Files modified:** custard-calendar/docs/style.css
- **Verification:** test_no_hardcoded_colors and test_no_hardcoded_spacing back to pre-existing failures only
- **Committed in:** 697ba14 (part of GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 bug)
**Impact on plan:** Trivial comment adjustment. No scope creep.

## Issues Encountered
None beyond the auto-fixed comment issue above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- HTML markup is now free of inline styles
- .hidden CSS class is ready for classList.toggle('hidden') pattern (Plan 02 JS refactoring)
- forecast-map.html inline JS still has .style.* assignments (Plan 02 scope)
- Pre-existing test failures remain unchanged (nearest-badge, user-position-dot)

---
## Self-Check: PASSED

- All 6 files verified present
- Submodule commits d149783 (RED), 697ba14 (GREEN) confirmed
- Parent commit e2c5045 confirmed

---
*Phase: 22-inline-style-elimination*
*Completed: 2026-03-14*
