# Phase 21: Card & Button Unification - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Every card-like element and every button across the site inherits from a small set of base classes with no one-off definitions or inline overrides. Requirements: CARD-01, CARD-02, CARD-03, CARD-04.

</domain>

<decisions>
## Implementation Decisions

### Card base inheritance scope
- ALL 27 card patterns inherit `.card` base class -- no exceptions
- 10 already use `.card` base; 17 standalone patterns must be migrated
- Overlay/positioned cards (fronts-overlay-card, fronts-legend-card, fronts-timeline-card) get `.card` base for visual consistency (border, shadow, radius) with positioning overridden in modifier class
- Complex cards (drive-card, signal-card) get `.card` on the outer container; internal sub-component structure stays untouched
- Existing `.card` base values are the standard: border-radius 12px, padding var(--space-4), box-shadow var(--shadow-sm)
- Cards needing different padding/radius use modifier classes (e.g., `.card--compact`)
- This is pragmatic unification (get everything on one base) -- future phase can define generic card sub-components (.card-header, .card-body) if needed

### Button consolidation rules
- 3 base types only: `.btn-primary`, `.btn-secondary`, `.btn-text`
- `.btn-text` is NEW -- created for text-link buttons (currently .change-store-btn, .compare-add-hint-btn, .store-change-btn): no background, no border, brand color, underline on hover
- Shape modifiers: `.btn--icon` (square, icon-only), `.btn--circle` (circular, like play button)
- Domain-specific buttons remapped to base + modifier combos:
  - `.btn-search` -> `.btn-primary.btn--block`
  - `.btn-retry` -> `.btn-primary.btn--danger`
  - `.calendar-cta-btn` -> `.btn-primary.btn--sm`
  - `.drive-btn` -> `.btn-secondary` (or variant)
  - All 21 existing button CSS classes either become a base class, a modifier, or are removed
- Size modifiers: Claude's discretion on how many tiers (2 or 3) based on actual padding values across all 21 button classes

### Inline style replacement
- Button layout modifiers replace inline styles: `.btn--block` (width:100%, display:block), `.btn--full` (width:100% without block display)
- Margins handled by parent containers using spacing tokens, not inline style overrides
- compare.html:73 fully hardcoded button -> straight swap to `.btn-primary` class
- group.html inline styles (width:100%, display:block, margin) -> replaced with button layout modifiers
- JS-generated markup (shared-nav.js, compare-page.js, todays-drive.js) already uses CSS classes -- verify completeness via grep in execution, no inline styles found by scout

### Visual distinctiveness
- Semantic card modifiers using Phase 20 state tokens:
  - `.card.card--success` (replaces winner-card green border/background)
  - `.card.card--danger` (replaces error-card danger background)
  - `.card.card--state-{x}` (replaces signal-card state-based borders)
- Day-card border-left accents: Claude's discretion on whether to make reusable border-left modifiers or keep day-card-specific classes (multiple card types use left-border accents: day-cards, quiz cards, map store cards)
- Quiz mode cards follow same card modifier pattern: `.card.card--quiz` with per-mode border colors via data-quiz-mode attribute selectors (established in Phase 20)
- Active/hover transforms on quiz cards via modifier

### Claude's Discretion
- Button size modifier tiers (2 vs 3 sizes) based on actual padding analysis
- Day-card border-left accent approach (reusable modifier vs component-specific)
- Exact modifier naming for edge cases
- Drive-btn mapping to base types
- View-mode-btn (toggle button) consolidation approach

</decisions>

<specifics>
## Specific Ideas

- This is pragmatic "limp through" unification -- get everything on .card base now, deeper card component architecture is a future phase if needed
- Having everything on .card base makes any future card system redesign much easier (one place to change instead of 27)
- Solid pills for rarity badges and state tokens from Phase 20 should carry through consistently on unified cards

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.card` base class (style.css:111-117): background, border, border-radius (12px), padding (var(--space-4)), box-shadow (var(--shadow-sm))
- `.btn-primary` (style.css:1552-1567): fully defined with token-based colors
- `.btn-secondary` (style.css:1569-1583): fully defined with token-based colors
- `.btn` base (style.css:341-349): inline-block, padding, border-radius, font-weight -- may serve as shared foundation
- Phase 20 state tokens (--state-confirmed, --state-watch, --state-danger, --state-success): ready for semantic card modifiers
- Phase 20 rarity tokens: already unified, cards using rarity badges will inherit consistently

### Established Patterns
- BEM-like modifier pattern already in use: `.card--hero`, `.card--compare-day`, `.card--map-store`, `.card--quiz`
- data-quiz-mode attribute theming: JS sets attribute, CSS responds with per-mode overrides
- Token-based styling: all colors reference CSS custom properties (Phase 20 established this)

### Integration Points
- style.css :root block: any new card/button modifiers defined here
- 15 HTML pages: card classes updated in markup
- 4 JS files generating card/button markup: compare-page.js, shared-nav.js, todays-drive.js, planner-domain.js
- fun.html quiz card styling: per-mode accent borders
- group.html: vote-card and winner-card inline styles + markup
- map.html: fronts overlay cards, store cards

</code_context>

<deferred>
## Deferred Ideas

- Generic card sub-components (.card-header, .card-body, .card-footer) -- future design system maturity phase
- Card padding scale standardization beyond .card--compact -- evaluate after unification shows actual patterns

</deferred>

---

*Phase: 21-card-button-unification*
*Context gathered: 2026-03-13*
