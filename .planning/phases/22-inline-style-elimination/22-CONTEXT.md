# Phase 22: Inline Style Elimination - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace all inline style="" attributes across compare.html, index.html, and forecast-map.html with CSS classes consuming design tokens. Eliminate .style.cssText and element.style assignments in compare-page.js and shared-nav.js. Requirement: DTKN-03.

</domain>

<decisions>
## Implementation Decisions

### Header class naming
- Shared classes in style.css (not page-specific) -- all 3 pages use identical header pattern
- Brand blue (#005696) token strategy: Claude's discretion on whether to reference existing token or create new one
- display:inline heading (index.html h2): Claude's discretion on utility vs semantic class

### JS display toggle pattern
- Use classList.toggle('hidden') with existing .hidden class for visibility toggling
- Opportunistic cleanup: convert .style.display toggles in other JS files beyond compare-page.js and shared-nav.js when encountered
- Dynamic color assignments (e.g., borderLeftColor from flavor data): Claude's discretion on CSS custom properties via JS vs keeping .style for truly dynamic values

### Updates CTA card layout
- Layout approach (dedicated modifier vs composable): Claude's discretion based on whether patterns appear elsewhere
- CTA card text (color:#666, font-size:0.875rem) shares classes with header subtitle text -- same visual treatment = same class (DRY)
- CTA heading styling approach: Claude's discretion

### Footer disclaimer
- Class naming approach: Claude's discretion
- Spacing values MUST use design tokens (var(--space-2) instead of raw 0.5rem) -- consistent with Phase 20/21 token approach

### Claude's Discretion
- Header class naming convention (semantic vs utility)
- Brand blue token strategy (existing vs new)
- display:inline heading class approach
- Dynamic JS style assignment handling (CSS custom properties vs .style)
- .hidden !important behavior for classList.toggle pattern
- CTA card layout class approach (dedicated vs composable modifiers)
- CTA heading class naming
- Footer disclaimer class naming

</decisions>

<specifics>
## Specific Ideas

- Reuse shared text classes across subtitle and CTA card text where visual treatment matches
- Follow Phase 21 baseline-count test pattern for enforcement (zero inline styles target)
- Opportunistic JS cleanup beyond strict scope -- reduce inline styles broadly while focused on this area

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.hidden { display: none !important; }` (style.css:104) -- ready for classList.toggle pattern
- `.updates-cta-card` class already exists in compare.html markup -- can absorb inline layout styles
- Spacing tokens (--space-2, --space-4, etc.) available for margin/padding replacement
- Phase 20/21 design tokens in :root for color references

### Established Patterns
- Token-based styling: all colors reference CSS custom properties (Phase 20)
- BEM-like modifier pattern: .card--*, .btn--* (Phase 21)
- Baseline-count test pattern for inline style elimination (Phase 21)
- Zero-baseline test enforcement for inline style violations (Phase 21)

### Integration Points
- style.css :root block -- any new tokens added here
- style.css -- new shared header/footer classes defined here
- compare.html (5-6 inline styles), index.html (4 inline styles), forecast-map.html (3 inline styles)
- compare-page.js (2 .style.display toggles), shared-nav.js (2 .style.display toggles)
- Additional JS files with .style assignments (today-page.js, group.html, etc.) for opportunistic cleanup

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 22-inline-style-elimination*
*Context gathered: 2026-03-13*
