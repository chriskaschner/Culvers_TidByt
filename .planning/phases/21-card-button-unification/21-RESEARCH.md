# Phase 21: Card & Button Unification - Research

**Researched:** 2026-03-13
**Domain:** CSS architecture, card system consolidation, button system unification
**Confidence:** HIGH

## Summary

Phase 21 unifies all card-like elements under a single `.card` base class and consolidates ~21 button definitions into 3 base types with modifiers. The codebase currently has 10 elements using `.card` and at least 17 standalone card patterns with their own `background`, `border`, `border-radius`, and `padding` definitions. The button system has ~14 unique button classes scattered across `style.css` and page-scoped `<style>` blocks, with significant duplication of properties like `background: var(--brand)`, `border-radius: 6px`, `font-weight: 600`.

The main complexity is that 6 card patterns and 5 button patterns live in page-scoped `<style>` blocks (group.html, fun.html, quiz.html) rather than in style.css, requiring both CSS consolidation and HTML class attribute updates across 15 HTML pages and 4+ JS files. Additionally, there are ~25+ inline `style="..."` attributes on buttons in HTML files (primarily group.html and compare.html) that must be replaced with CSS classes.

**Primary recommendation:** Work in two waves -- (1) define all base classes and modifiers in style.css, then (2) sweep HTML/JS files to apply new classes and remove inline styles/page-scoped overrides. Run existing Playwright card system tests (`vizp-card-system.spec.mjs`) and design token tests after each wave.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- ALL 27 card patterns inherit `.card` base class -- no exceptions
- 10 already use `.card` base; 17 standalone patterns must be migrated
- Overlay/positioned cards (fronts-overlay-card, fronts-legend-card, fronts-timeline-card) get `.card` base for visual consistency (border, shadow, radius) with positioning overridden in modifier class
- Complex cards (drive-card, signal-card) get `.card` on the outer container; internal sub-component structure stays untouched
- Existing `.card` base values are the standard: border-radius 12px, padding var(--space-4), box-shadow var(--shadow-sm)
- Cards needing different padding/radius use modifier classes (e.g., `.card--compact`)
- This is pragmatic unification (get everything on one base) -- future phase can define generic card sub-components (.card-header, .card-body) if needed
- 3 base types only: `.btn-primary`, `.btn-secondary`, `.btn-text`
- `.btn-text` is NEW -- created for text-link buttons (currently .change-store-btn, .compare-add-hint-btn, .store-change-btn): no background, no border, brand color, underline on hover
- Shape modifiers: `.btn--icon` (square, icon-only), `.btn--circle` (circular, like play button)
- Domain-specific buttons remapped to base + modifier combos
- Button layout modifiers replace inline styles: `.btn--block` (width:100%, display:block), `.btn--full` (width:100% without block display)
- Margins handled by parent containers using spacing tokens, not inline style overrides
- compare.html:73 fully hardcoded button -> straight swap to `.btn-primary` class
- group.html inline styles (width:100%, display:block, margin) -> replaced with button layout modifiers
- JS-generated markup already uses CSS classes -- verify completeness via grep in execution
- Semantic card modifiers using Phase 20 state tokens: `.card.card--success`, `.card.card--danger`, `.card.card--state-{x}`
- Quiz mode cards follow same card modifier pattern
- Active/hover transforms on quiz cards via modifier

### Claude's Discretion
- Button size modifier tiers (2 vs 3 sizes) based on actual padding analysis
- Day-card border-left accent approach (reusable modifier vs component-specific)
- Exact modifier naming for edge cases
- Drive-btn mapping to base types
- View-mode-btn (toggle button) consolidation approach

### Deferred Ideas (OUT OF SCOPE)
- Generic card sub-components (.card-header, .card-body, .card-footer) -- future design system maturity phase
- Card padding scale standardization beyond .card--compact -- evaluate after unification shows actual patterns
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CARD-01 | All card-like elements across all pages inherit from .card base class with consistent border, shadow, and border-radius | Full inventory of 27 card patterns identified with current CSS locations. 10 already use `.card`, 17 need migration. |
| CARD-02 | Button system consolidated from 14 definitions to 3 base types (.btn-primary, .btn-secondary, .btn-text) with consistent padding | Full inventory of 21 button classes identified across style.css and page-scoped blocks. Mapping to 3 base types + modifiers documented. |
| CARD-03 | No inline style overrides of button properties anywhere in the codebase | 25+ inline style attributes on buttons catalogued across compare.html, group.html, and JS-generated markup. |
| CARD-04 | JS innerHTML-generated card/button HTML uses CSS classes instead of hardcoded styles | 4 JS files audited (compare-page.js, shared-nav.js, todays-drive.js, planner-domain.js). shared-nav.js has inline styles in footer links; others clean. |
</phase_requirements>

## Standard Stack

This phase is pure CSS/HTML refactoring. No new libraries needed.

### Core
| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| Vanilla CSS | N/A | All card/button definitions | No build step, no preprocessor per project constraints |
| CSS Custom Properties | N/A | Design tokens already in :root | 37+ tokens from Phase 20 available |
| BEM-like modifiers | N/A | Naming convention for card/button variants | Already established: `.card--hero`, `.card--quiz`, etc. |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| Playwright | Browser tests for card system | Verify computed styles match after migration |
| pytest | Static analysis of CSS token compliance | Verify no hardcoded colors leak in |
| grep/static scan | Verify zero inline button styles remain | Final verification pass |

## Architecture Patterns

### Current Card System (10 using .card base)

These already inherit `.card` and just need their modifiers preserved:

| Card | Location | Class Pattern | Notes |
|------|----------|---------------|-------|
| today-card | index.html:102 | `card card--hero today-card` | Has own padding override |
| compare-day (via card--compare-day) | style.css:119 | `card card--compare-day` | padding:0, overflow:hidden |
| map-store-card | map.html:1034 | `card card--map-store store-card` | border-left accent |
| quiz-mode-card | fun.html:158-178 | `card card--quiz quiz-mode-card` | 6 instances with per-mode border-left |
| blackberry-preview cards | assets/ | `card` | 7 instances, preview page only |

### Standalone Card Patterns (17 needing migration)

| Card Pattern | File | Current CSS Location | Key Properties to Preserve |
|-------------|------|---------------------|---------------------------|
| store-card | style.css:883 | style.css | border-radius:6px -> override to 12px, padding:space-3 space-4 |
| day-card | style.css:1038 | style.css | border-left accent, border-radius:6px -> override |
| signal-card | style.css:1276 | style.css | border-left accent, unique background #fcfdff |
| historical-context-card | style.css:1307 | style.css | unique border/bg colors |
| near-me-card | style.css:1668 | style.css | flex display, hover interaction |
| today-card-skeleton | style.css:1849 | style.css | loading state, border-radius:8px |
| week-day-card | style.css:1891 | style.css | fixed width 140px, border-left accent |
| updates-cta-card | style.css:2009 | style.css | flex column layout, #f8f9fa bg |
| calendar-cta-card | style.css:2048 | style.css | flex row layout, border-left accent |
| fronts-overlay-card | style.css:2335 | style.css | absolute positioned, dark theme, backdrop-filter |
| fronts-legend-card | style.css:2346 | style.css | extends fronts-overlay-card |
| fronts-timeline-card | style.css:2387 | style.css | extends fronts-overlay-card |
| error-card | style.css:2646 | style.css | danger state background |
| drive-card | style.css:2921 | style.css | border-left accent, compact padding |
| compare-day-card | style.css:3508 | style.css | box-shadow, 12px radius, #fff bg |
| vote-card | group.html:81 | page-scoped `<style>` | hardcoded colors, radius:10px |
| winner-card | group.html:149 | page-scoped `<style>` | green border/bg (state-success) |
| madlibs-card | fun.html:79 | page-scoped `<style>` | brand border, special bg |
| linkout-card | fun.html:109 | page-scoped `<style>` | neutral bg, border |
| share-panel (group) | group.html:171 | page-scoped `<style>` | centered panel (card-like) |
| first-visit-prompt | style.css:3325 | style.css | bg-muted, rounded |
| compare-add-hint | style.css:3579 | style.css | dashed border (keep as-is, not a visual card) |
| compare-nudge | style.css:3597 | style.css | state-watch accent (alert-like) |

**Note:** Some patterns (compare-add-hint, compare-nudge) are borderline -- they look like notifications/hints rather than cards. Decision from CONTEXT says ALL 27 inherit `.card`. The planner should be careful to apply `.card` base while preserving their unique visual identity via modifiers.

### Current Button System (21 classes)

| Button Class | CSS Location | Current Properties | Migration Target |
|-------------|-------------|-------------------|-----------------|
| .btn | style.css:341 | Generic base: inline-block, padding, radius:6px, fw:600 | Potential shared base (or fold into .btn-primary/.btn-secondary) |
| .btn-primary | style.css:1552 | brand bg, white text, radius:6px, fw:600 | KEEP as base type |
| .btn-secondary | style.css:1569 | brand border, brand text, white bg, radius:6px | KEEP as base type |
| .btn-text | (NEW) | To be created: no bg, no border, brand color, underline:hover | NEW base type |
| .btn-google | style.css:351 | brand bg (same as primary) | -> .btn-primary (or .btn-primary.btn--google) |
| .btn-apple | style.css:360 | dark text bg | -> .btn-primary.btn--dark |
| .btn-search | style.css:716 | brand bg, w:100%, fw:600 | -> .btn-primary.btn--block |
| .btn-retry | style.css:2660 | danger bg, white text | -> .btn-primary.btn--danger |
| .drive-btn | style.css:2807 | brand border, brand text (= secondary) | -> .btn-secondary (or .btn-secondary.btn--sm) |
| .drive-btn-muted | style.css:2823 | muted variant of drive-btn | -> .btn-secondary.btn--muted |
| .calendar-cta-btn | style.css:2087 | brand bg, small padding | -> .btn-primary.btn--sm |
| .change-store-btn | style.css:1500 | no bg, no border, underline | -> .btn-text |
| .store-change-btn | style.css:3303 | no bg, no border, underline, brand color | -> .btn-text |
| .compare-add-hint-btn | style.css:3588 | no bg, no border, brand color | -> .btn-text |
| .location-geo-btn | style.css:1425 | icon button, bordered | -> .btn-secondary.btn--icon |
| .icon-btn | style.css:662 | 36x36 circle, brand color | -> .btn-secondary.btn--icon (or .btn--circle) |
| .fronts-play-btn | style.css:2397 | 54x54 circle, gradient bg | -> .btn--circle (custom dark theme) |
| .view-mode-btn | style.css:2203 | toggle button in segmented control | Special: part of toggle group, not standalone button |
| .first-visit-confirm | style.css:3344 | brand bg, small padding | -> .btn-primary.btn--sm |
| .vote-btn | group.html:107 | page-scoped, selectable toggle | Special: multi-state selector, not standard button |
| .directions-btn | group.html:201 | page-scoped, w:100%, brand bg | -> .btn-primary.btn--block |
| .quiz-geo-btn | quiz.html:117 | page-scoped, branded outline | -> .btn-secondary |
| .brand-chip | style.css:749 | filter chip (not really a button) | Keep as chip (not a button type) |

### Recommended Button Size Analysis

Actual padding values across all button classes:

| Class | Padding | Category |
|-------|---------|----------|
| .btn-primary | space-3 space-6 (0.75rem 2rem) | Default |
| .btn-secondary | space-3 1.25rem (0.75rem 1.25rem) | Default |
| .calendar-cta-btn | 0.375rem space-3 (0.375rem 0.75rem) | Small |
| .first-visit-confirm | 0.375rem space-3 | Small |
| .btn-retry | space-2 space-5 (0.5rem 1.5rem) | Small-Medium |
| .drive-btn | 0.4rem 0.7rem | Small |
| .btn-search | space-2 space-5 (0.5rem 1.5rem) | Small-Medium |
| .directions-btn | 0.7rem (uniform) | Default |
| .vote-btn | 0.45rem 0.5rem | Small |
| fun.html .btn-primary | space-2 1.25rem | Small |

**Recommendation (Claude's Discretion): 2 size tiers.**
- Default: `padding: var(--space-3) var(--space-5)` (~0.75rem 1.5rem) -- covers primary/secondary/directions
- Small (`.btn--sm`): `padding: var(--space-2) var(--space-3)` (~0.5rem 0.75rem) -- covers calendar-cta, drive, retry, first-visit

Two tiers are sufficient. The padding differences within each tier are minor (0.375rem vs 0.5rem in the small group). Three tiers would create unnecessary complexity.

### Recommended Card Modifier Strategy

**Border-left accent approach (Claude's Discretion):**

Multiple card types use border-left accents: day-card, signal-card, drive-card, calendar-cta-card, week-day-card, map-store-card. The border-left accent is a recurring pattern.

**Recommendation: Reusable border-left modifier.**

```css
.card--accent { border-left: 4px solid var(--brand); }
.card--accent-sm { border-left: 3px solid var(--brand); }
```

Then state-specific overrides via existing patterns:
```css
.card--accent.day-card-confirmed { border-left-color: var(--state-confirmed); }
```

This approach is cleaner than component-specific because 6+ card types share the exact same border-left pattern.

### Inline Style Inventory (Button Properties)

These inline `style="..."` attributes on buttons must be replaced:

**compare.html:**
- Line 37: `style="margin-top:1rem;"` on .btn-primary -- replace with parent spacing
- Line 73: `style="display:inline-block;padding:0.5rem 1.25rem;background:#005696;color:white;border-radius:0.5rem;text-decoration:none;font-weight:600;"` -- fully hardcoded, replace with `.btn-primary`
- Line 70: `style="text-align:center;margin:1.5rem auto;padding:1rem;max-width:24rem;"` on .updates-cta-card -- layout styles, move to CSS

**group.html:**
- Line 254: `style="width:100%;margin-top:0.5rem;"` on .btn-primary -- replace with `.btn-primary.btn--block` + parent margin
- Line 266: `style="margin:0.25rem auto;"` on .btn-secondary -- parent spacing
- Line 274: `style="width:100%;"` on .btn-primary -- `.btn--block`
- Line 281: `style="display:block;width:100%;margin-top:0.75rem;"` on .btn-secondary -- `.btn-secondary.btn--block`
- Lines 546, 621, 624, 682, 695, 697, 723: JS-generated inline styles in `innerHTML` (not button-related but card content styling)

**shared-nav.js:**
- Lines 153, 169-172, 572: inline styles on nav and footer elements (layout + color)

### View-Mode-Btn Strategy (Claude's Discretion)

The `.view-mode-btn` is part of a segmented toggle control (`.view-mode-toggle`). It has unique behavior:
- Grouped inside a bordered container with overflow:hidden
- Active state fills with brand color
- Not a standalone button

**Recommendation:** Keep `.view-mode-btn` as a distinct component class, not mapped to the 3 base types. It's a toggle segment, not a button. Add `.card` base to the toggle group container if appropriate, or leave it as non-card/non-button component.

### Drive-Btn Mapping (Claude's Discretion)

The `.drive-btn` has: `border: 1px solid var(--brand); color: var(--brand); background: var(--bg-surface); border-radius: 6px; font-size: 0.84rem; font-weight: 600;`

This is essentially `.btn-secondary` with smaller padding.

**Recommendation:** Map `.drive-btn` -> `.btn-secondary.btn--sm`. The `.drive-btn-muted` variant becomes `.btn-secondary.btn--sm.btn--muted` (or just `.btn-secondary.btn--muted.btn--sm`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Button reset styles | Custom reset per button class | Shared base properties on `.btn-primary`/`.btn-secondary`/`.btn-text` | 14+ classes currently duplicate border:none, cursor:pointer, font-weight:600 |
| Card shadow/border/radius | Per-card background/border/radius | `.card` base class inheritance | 17 standalone patterns duplicate 3-5 shared properties |
| Button width modifiers | Inline `style="width:100%"` | `.btn--block` CSS class | 5+ inline width overrides scattered across HTML |
| Danger/success semantic colors | Hardcoded hex on individual elements | State tokens from Phase 20 (--state-danger, --state-success) | Tokens already defined and used elsewhere |

## Common Pitfalls

### Pitfall 1: Specificity Conflicts When Adding .card Base
**What goes wrong:** Adding `.card` to an element that already has specific `border-radius`, `padding`, `background` rules causes the element to look wrong because `.card` properties may override or not override depending on CSS specificity and source order.
**Why it happens:** `.card` sets border-radius:12px but many cards have 8px or 6px. `.card` sets padding:var(--space-4) but cards have 0, space-3, 1.25rem, etc.
**How to avoid:** Always pair `.card` with a modifier that sets the correct padding/radius. For cards that override radius, the modifier must come AFTER `.card` in CSS source order, or use `.card.card--compact` compound selector for higher specificity.
**Warning signs:** Visual regression where cards suddenly get extra padding or rounded corners.

### Pitfall 2: Page-Scoped Styles vs style.css Ordering
**What goes wrong:** Page-scoped `<style>` blocks in group.html, fun.html, quiz.html may override or conflict with newly added rules in style.css.
**Why it happens:** style.css is loaded via `<link>` in `<head>`, and page-scoped `<style>` blocks also appear in `<head>`. Browser applies later declarations to win, but only if specificity is equal.
**How to avoid:** When migrating page-scoped card/button styles to style.css, also REMOVE them from the page-scoped block. Audit that no duplicate rules exist.
**Warning signs:** Styles that work on one page but not another, or styles that "flicker" on load.

### Pitfall 3: Fronts Dark-Theme Cards Have Unique Visual Language
**What goes wrong:** Adding `.card` base (white bg, light border) to fronts overlay cards (dark glass-morphism theme) breaks their appearance.
**Why it happens:** `.card` sets `background: var(--bg-surface)` (white) and `border: 1px solid var(--border)` (light gray), but fronts cards need dark translucent backgrounds.
**How to avoid:** Use a modifier like `.card--overlay` that completely overrides background, border, and shadow with the fronts dark theme values. Must use higher specificity: `.card.card--overlay` or ensure modifier comes after base.
**Warning signs:** White cards appearing over the dark fronts map.

### Pitfall 4: Breaking JS-Generated Markup
**What goes wrong:** Changing class names in CSS without updating JS that generates HTML with those class names.
**Why it happens:** JS files (todays-drive.js, planner-ui.js, today-page.js, compare-page.js) build HTML strings with hardcoded class names.
**How to avoid:** When adding `.card` to a card type, update BOTH the CSS definition AND all JS `innerHTML`/`className` assignments that reference that card type.
**Warning signs:** JS-rendered cards missing styles after the CSS change.

### Pitfall 5: Compare.html Line 73 Full Hardcoded Button
**What goes wrong:** This button has ALL properties inline -- `display:inline-block;padding:0.5rem 1.25rem;background:#005696;color:white;border-radius:0.5rem;text-decoration:none;font-weight:600;`. Simply adding a class won't fix it because inline styles have higher specificity.
**How to avoid:** REMOVE the entire `style="..."` attribute and add `.btn-primary` class. Don't try to override inline styles with CSS classes.
**Warning signs:** Button still looks branded but test for "zero inline style overrides" fails.

### Pitfall 6: Design Token Test False Positives
**What goes wrong:** The existing `test_design_tokens.py` has an allowlist of selectors where hardcoded hex values are permitted. When moving page-scoped styles into style.css, new selectors may not be in the allowlist.
**How to avoid:** When migrating styles into style.css, replace hardcoded hex values with design tokens (e.g., `#005696` -> `var(--brand)`, `#2e7d32` -> `var(--state-success)`). If impossible to tokenize, add the selector to the allowlist.
**Warning signs:** `uv run pytest tests/test_design_tokens.py` fails after migration.

## Code Examples

### Pattern 1: Adding .card Base to Standalone Card

Before (standalone):
```css
/* style.css */
.store-card {
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-2);
}
```

After (inheriting .card):
```css
/* style.css -- .card base already provides background, border, border-radius, box-shadow */
.store-card {
  display: flex;
  flex-direction: column;
  padding: var(--space-3) var(--space-4); /* Override .card default padding */
  border-radius: 6px; /* Override .card 12px if keeping 6px, or remove to inherit 12px */
  margin-bottom: var(--space-2);
}
```

HTML before:
```html
<div class="store-card">
```

HTML after:
```html
<div class="card store-card">
```

### Pattern 2: Creating .btn-text Base Type

```css
.btn-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--brand);
  font-size: var(--text-base);
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  padding: 0 var(--space-1);
  min-height: 44px; /* WCAG touch target */
}

.btn-text:hover {
  color: var(--brand-dark);
}
```

### Pattern 3: Button Layout Modifiers

```css
.btn--block {
  display: block;
  width: 100%;
}

.btn--sm {
  padding: var(--space-2) var(--space-3);
  font-size: 0.875rem;
}

.btn--danger {
  background: var(--state-danger);
  color: white;
}

.btn--danger:hover {
  background: var(--state-danger-text); /* --state-danger-text is #b71c1c */
}
```

### Pattern 4: Replacing Inline Styles on Buttons

Before (group.html):
```html
<button class="btn-primary" id="start-vote-btn" disabled style="width:100%;margin-top:0.5rem;">Start voting</button>
```

After:
```html
<button class="btn-primary btn--block" id="start-vote-btn" disabled>Start voting</button>
```

Parent gets margin via CSS:
```css
#start-vote-btn { margin-top: var(--space-2); }
/* Or via parent container spacing */
```

### Pattern 5: Semantic Card Modifiers

```css
.card--success {
  border-color: var(--state-success);
  background: var(--state-success-bg);
}

.card--danger {
  border-color: var(--state-danger);
  background: var(--state-danger-bg);
}

.card--overlay {
  position: absolute;
  z-index: 520;
  border: 1px solid rgba(137, 155, 185, 0.34);
  border-radius: 14px;
  background: linear-gradient(160deg, rgba(26, 33, 48, 0.88), rgba(22, 28, 44, 0.78));
  backdrop-filter: blur(7px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  color: #e5ebf6;
}
```

## State of the Art

| Old Approach (Current) | New Approach (Phase 21) | Impact |
|------------------------|------------------------|--------|
| 17+ standalone card classes each defining background/border/radius | `.card` base + modifier classes | One place to change shared properties |
| 14+ button classes with duplicated font-weight/cursor/display | 3 base types + size/shape/semantic modifiers | Consistent button appearance everywhere |
| Inline `style="width:100%"` on buttons | `.btn--block` modifier class | Zero inline button overrides |
| Page-scoped `<style>` blocks for vote-card, winner-card, etc. | All card styles in style.css | Single source of truth |
| Hardcoded hex in page-scoped styles (#2e7d32, #c62828, #005696) | State tokens (--state-success, --state-danger, --brand) | Token compliance |

## Open Questions

1. **vote-btn toggle behavior**
   - What we know: `.vote-btn` is a multi-state selector (yes/meh/no) with `.selected` states. It's fundamentally different from a standard button.
   - What's unclear: Should it inherit from one of the 3 base types or remain a unique component?
   - Recommendation: Keep as unique component (`.vote-btn`), do not force into the 3-type system. The CONTEXT says "all 21 existing button CSS classes either become a base class, a modifier, or are removed" -- vote-btn becomes a specialized interactive component, not a navigation/action button.

2. **brand-chip / filter-chip status**
   - What we know: `.brand-chip` looks like a toggle button but functions as a filter chip.
   - What's unclear: Should it be part of the button consolidation?
   - Recommendation: Leave as-is. Filter chips are a distinct UI pattern (selection, not action). Not in the 3 base button types.

3. **share-panel in group.html**
   - What we know: It has card-like properties (padding, border, border-radius).
   - What's unclear: Is it one of the 27 card patterns?
   - Recommendation: Include it if the count demands it, but it's a panel/section more than a card.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright + pytest |
| Config file | `worker/playwright.config.mjs` |
| Quick run command | `cd custard-calendar/worker && npx playwright test test/browser/vizp-card-system.spec.mjs` |
| Full suite command | `cd custard-calendar && uv run pytest tests/test_design_tokens.py -v && cd worker && npx playwright test test/browser/vizp-card-system.spec.mjs test/browser/dtkn-state-tokens.spec.mjs test/browser/dtkn-rarity-tokens.spec.mjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CARD-01 | All card elements have .card base with consistent border-radius/shadow | browser | `cd custard-calendar/worker && npx playwright test test/browser/vizp-card-system.spec.mjs` | Partial -- covers Today/Compare/Fun, needs expansion for all 27 cards |
| CARD-02 | Only 3 button base types in style.css | static analysis | `cd custard-calendar && uv run pytest tests/test_design_tokens.py -v` + new test | Needs new test |
| CARD-03 | Zero inline style button overrides | static analysis | New grep-based test | Needs new test |
| CARD-04 | JS innerHTML uses CSS classes not inline styles | static analysis + browser | Combined grep test + Playwright | Partial (shared-nav.js footer has inline styles) |

### Sampling Rate
- **Per task commit:** `cd custard-calendar/worker && npx playwright test test/browser/vizp-card-system.spec.mjs --workers=1`
- **Per wave merge:** `cd custard-calendar && uv run pytest tests/test_design_tokens.py -v && cd worker && npx playwright test --workers=1`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_card_button_unification.py` -- static analysis test: grep for inline button styles, count button class definitions, verify .card presence on all card elements
- [ ] Expand `vizp-card-system.spec.mjs` -- add tests for cards NOT currently covered (error-card, signal-card, drive-card, near-me-card, etc.)
- [ ] Or create new `card-unification.spec.mjs` browser test covering the full 27-card inventory

## Sources

### Primary (HIGH confidence)
- style.css (3899 lines) -- direct inspection of all card/button CSS rules
- 15 HTML files -- direct inspection of class usage and inline styles
- 7 JS files -- direct inspection of innerHTML/className patterns
- test_design_tokens.py -- existing static analysis test patterns
- vizp-card-system.spec.mjs -- existing Playwright card tests

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions -- user-locked requirements informing migration strategy
- Phase 20 state tokens -- verified present in :root block

## Metadata

**Confidence breakdown:**
- Card inventory: HIGH -- every card pattern traced to specific CSS line numbers
- Button inventory: HIGH -- every button class traced to specific CSS line numbers
- Inline style inventory: HIGH -- grep results verified across all files
- Migration strategy: HIGH -- straightforward CSS refactoring with well-understood patterns
- Test gaps: MEDIUM -- existing tests cover core cards but need expansion for full coverage

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable -- vanilla CSS, no dependencies to update)
