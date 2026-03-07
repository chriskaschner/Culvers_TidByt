# Technology Stack: Presentation-Layer Restructuring

**Project:** Custard Calendar Site Restructuring
**Researched:** 2026-03-07
**Scope:** CSS layout, progressive disclosure, vanilla JS component patterns for the `docs/` directory

## Constraints (Non-Negotiable)

These are inherited from the existing system and are not up for debate:

| Constraint | Source | Implication |
|------------|--------|-------------|
| No build step | GitHub Pages hosting | No bundlers, no preprocessors, no PostCSS. Raw CSS and JS only. |
| No frameworks | Project convention | No React, Vue, Svelte. Vanilla JS with `window.CustardPlanner` IIFE pattern. |
| Vanilla JS (ES5-ish) | Existing `planner-shared.js`, `todays-drive.js` | `var`, IIFEs, no ES module imports. Must match existing code style. |
| Mobile-first at 375px | Core use case: "family in the car" | Compare grid must work on iPhone SE/Mini. Every layout decision starts here. |
| Single CSS file | Current `docs/style.css` | Extend existing file. No CSS imports, no CSS modules. |
| CDN only for vendored libs | Leaflet loaded via CDN | New dependencies must be zero or CDN-loaded. No npm for frontend. |

## Recommended Stack

### CSS Layout: Comparison Grid

| Technology | Version/Spec | Purpose | Why | Confidence |
|------------|-------------|---------|-----|------------|
| CSS Grid + `auto-fit`/`minmax()` | CSS Grid Level 2 | Primary layout for comparison grid (stores x days) | 97%+ browser support. Handles 2-4 column layouts natively. `repeat(auto-fit, minmax(min(100%, 160px), 1fr))` gives single-column at 375px, multi-column on wider screens without media queries. | HIGH |
| CSS Subgrid | `grid-template-rows: subgrid` | Align card content (flavor name, description, rarity) across sibling cards | 95%+ browser support (Chrome 117+, Safari 16+, Firefox 71+). Ensures flavor names and rarity badges align across comparison columns without fixed heights. | HIGH |
| Flexbox | CSS Flexbox | Internal card layout, chip rows, nav items | Already used extensively in existing `style.css`. Use for one-dimensional arrangements within grid cells. | HIGH |
| CSS Scroll Snap | `scroll-snap-type: x mandatory` | Horizontal swipe for Compare grid on 375px | The comparison grid at 375px cannot show 4 stores side-by-side. Use horizontal scroll-snap to let users swipe between store columns. Each column snaps into view. 97%+ support. | HIGH |

**Compare Grid Layout Strategy (375px):**

The core challenge is displaying a stores-x-days grid at 375px. A 4-store x 3-day table would need 12 cells on a phone screen -- that does not work. The solution is a layered approach:

1. **Mobile (375px):** Horizontal scroll-snap container. Each "slide" shows ONE store's multi-day forecast as a vertical card stack. Partial peek of the next store (show ~20px of next card) signals scrollability. `scroll-snap-align: start` on each store column.

2. **Medium (600px+):** 2-column grid of store cards. Each card contains its multi-day forecast stacked vertically within. `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`.

3. **Wide (800px+):** Full comparison grid. Stores as columns, days as rows. `grid-template-columns: repeat(var(--store-count, 2), 1fr)` with subgrid on each card for row alignment.

```css
/* Mobile-first: single store per view with horizontal swipe */
.compare-grid {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: calc(100% - 2rem); /* peek at next card */
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  gap: 0.75rem;
  padding-right: 1rem;
}

.compare-column {
  scroll-snap-align: start;
}

/* Medium: 2-up grid, no horizontal scroll */
@media (min-width: 600px) {
  .compare-grid {
    grid-auto-flow: unset;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    overflow-x: visible;
    scroll-snap-type: none;
    padding-right: 0;
  }
}

/* Wide: full comparison matrix */
@media (min-width: 800px) {
  .compare-grid {
    grid-template-columns: repeat(var(--store-count, 2), 1fr);
  }
  .compare-column {
    display: grid;
    grid-template-rows: subgrid;
    grid-row: span var(--day-count, 3);
  }
}
```

### CSS: Progressive Disclosure

| Technology | Spec | Purpose | Why | Confidence |
|------------|------|---------|-----|------------|
| `<details>/<summary>` | HTML5 | Week-ahead section, cell expansion (description + patterns), Get Updates flows | Native browser widget. Zero JS needed for basic open/close. Accessible by default (keyboard, screen reader). Already styled in existing `style.css`. | HIGH |
| `<details name="...">` | HTML Exclusive Accordion | Only-one-open sections (e.g., Compare cell expansion) | Browser-native exclusive accordion. Chrome 120+, Safari 17.2+, Firefox 130+. ~85% global support. Graceful degradation: all sections can be open simultaneously on unsupported browsers -- still functional, just not exclusive. | MEDIUM |
| `::details-content` pseudo | CSS Pseudo-Elements L4 | Animate `<details>` open/close transitions | Baseline since September 2025. Enables fade + opacity transitions on details content without JS. Cross-browser. | MEDIUM |
| `interpolate-size: allow-keywords` | CSS Sizing L4 | Animate height 0 to auto on `<details>` | **Chromium-only as of March 2026.** Firefox and Safari do NOT support it. Do NOT rely on this for production. Use as progressive enhancement only -- Chromium users get smooth height animation, others get instant open/close (which is fine). | LOW |
| `aria-expanded` + toggle | ARIA + vanilla JS | Custom progressive disclosure beyond `<details>` (e.g., "Show more" on flavor descriptions) | Standard accessible pattern. Button toggles `aria-expanded`, JS shows/hides target via `[hidden]` attribute. | HIGH |

**Progressive Disclosure Strategy:**

Use `<details>/<summary>` as the primary mechanism. It is the correct semantic element, requires zero JavaScript for basic functionality, and is already styled in the codebase.

For animated transitions, layer CSS on top as progressive enhancement:

```css
/* Base: works everywhere, instant open/close */
details::details-content {
  opacity: 0;
  transition: opacity 300ms ease, content-visibility 300ms allow-discrete;
}
details[open]::details-content {
  opacity: 1;
}

/* Progressive enhancement: smooth height animation (Chromium only) */
@supports (interpolate-size: allow-keywords) {
  :root { interpolate-size: allow-keywords; }
  details::details-content {
    height: 0;
    overflow: clip;
    transition: height 300ms ease, opacity 300ms ease,
                content-visibility 300ms allow-discrete;
  }
  details[open]::details-content {
    height: auto;
  }
}
```

### CSS: Card System and Container Queries

| Technology | Spec | Purpose | Why | Confidence |
|------------|------|---------|-----|------------|
| CSS Custom Properties | CSS Variables | Theme tokens, card spacing, brand colors | Already in use (`:root` has `--brand`, `--text`, etc.). Extend with `--card-gap`, `--card-radius`, `--card-border`. | HIGH |
| `container-type: inline-size` | CSS Containment L3 | Cards adapt to container width (not viewport) for reuse in Compare, Today, Fun | 93%+ global support. Cards placed in a narrow scroll-snap column should adapt independently of viewport width. Use `@container` queries for card-internal layout shifts. | HIGH |
| `:has()` selector | CSS Selectors L4 | Style cards based on content (e.g., card with rarity badge gets highlight border) | 97%+ support. Replaces JS class-toggling. `card:has(.rarity-ultra-rare) { border-left-color: #7b1fa2; }` | HIGH |

**Unified Card Pattern:**

The existing codebase has `.store-card`, `.day-card`, and `.cal-event` -- three different card patterns doing similar things. Introduce a base `.card` class and use modifiers:

```css
.card {
  background: white;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.75rem 1rem;
  container-type: inline-size;
}

/* Content-aware styling via :has() */
.card:has(.rarity-ultra-rare) { border-left: 4px solid #7b1fa2; }
.card:has(.rarity-rare) { border-left: 4px solid #1565c0; }
.card:has(.rarity-uncommon) { border-left: 4px solid #2e7d32; }

/* Card adapts to its container, not the viewport */
@container (min-width: 300px) {
  .card-header { display: flex; justify-content: space-between; align-items: center; }
}

@container (max-width: 299px) {
  .card-header { display: block; }
  .card-meta { margin-top: 0.25rem; }
}
```

### CSS: Filter Chips (Flavor Family Exclusion)

| Technology | Spec | Purpose | Why | Confidence |
|------------|------|---------|-----|------------|
| `<button>` with `aria-pressed` | HTML + ARIA | Flavor family exclusion filter chips | Semantic toggle button. Existing `.brand-chip` and `.flavor-chip` classes in `style.css` already implement this visual pattern. Ensure `aria-pressed="true/false"` toggled by JS and min 44x44px touch target per WCAG 2.5.5. | HIGH |

The codebase already has chip patterns (`.brand-chips`, `.flavor-chip`). Extend for the flavor family exclusion filter on Compare and Map:

```css
.filter-chip {
  min-height: 44px;        /* WCAG 2.5.5 touch target */
  min-width: 44px;
  padding: 0.375rem 0.875rem;
  border: 1.5px solid var(--border);
  border-radius: 999px;
  background: white;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 150ms, color 150ms, border-color 150ms;
}

.filter-chip[aria-pressed="true"] {
  background: var(--brand);
  color: white;
  border-color: transparent;
}
```

### JavaScript: Component Patterns

| Technology | Pattern | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| IIFE Revealing Module | `var X = (function() { ... return { mount, destroy }; })();` | New page modules (Compare, Fun, Today) | **Matches existing pattern exactly.** `CustardPlanner` and `CustardDrive` both use this. No migration cost, no learning curve, no build step. | HIGH |
| `mount(config)` entry point | Convention | Each page module has a single `mount()` that takes a root element ID and config | `CustardDrive.mount({ root: '...', stores: [...] })` is the proven pattern from `todays-drive.js`. New modules follow the same signature. | HIGH |
| `document.createElement` | DOM API | Build dynamic UI (comparison cells, filter chips) from API data | Existing pattern in `todays-drive.js`. `innerHTML` for static blocks, `createElement` for interactive elements needing event listeners. | HIGH |
| `localStorage` | Web Storage API | Persistent store selection, filter preferences | Already used for `custard-primary`, `custard-secondary`, `custard-favorites`. Extend for filter state persistence (e.g., `custard:v1:excluded-families`). | HIGH |
| `CustomEvent` dispatch | DOM Events | Cross-component communication (store changed, filter applied) | Lightweight pub/sub without coupling modules. `document.dispatchEvent(new CustomEvent('custard:store-changed', { detail: { slug } }))`. Allows header indicator to update when any page changes the store. | MEDIUM |

**New Module Structure:**

```javascript
/* compare.js -- Compare page module */
var CustardCompare = (function () {
  'use strict';

  // Private state
  var _stores = [];
  var _excluded = {};

  function mount(config) {
    var root = document.getElementById(config.root);
    _stores = config.stores || [];
    _renderGrid(root);
    _bindFilters(root);
  }

  function destroy() {
    // cleanup event listeners
  }

  function _renderGrid(root) { /* ... */ }
  function _bindFilters(root) { /* ... */ }

  return { mount: mount, destroy: destroy };
})();
```

### CSS: Navigation (4-Item Bottom Tab Bar)

| Technology | Spec | Purpose | Why | Confidence |
|------------|------|---------|-----|------------|
| Sticky bottom nav | `position: sticky; bottom: 0` | 4-item nav (Today/Compare/Map/Fun) always visible on mobile | 4 items fit at ~94px each at 375px. Sticky (not fixed) avoids iOS Safari viewport unit bugs. Below-fold content scrolls above it. | HIGH |
| `scroll-behavior: smooth` | CSS Scroll | Smooth scroll to anchor-linked sections on Today page | Supported everywhere. Use sparingly (only for same-page navigation). | HIGH |

```css
.site-nav {
  display: flex;
  justify-content: space-around;
  position: sticky;
  bottom: 0;
  background: white;
  border-top: 1px solid var(--border);
  padding: 0.5rem 0;
  z-index: 100;
}

.site-nav a {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-muted);
  text-decoration: none;
  padding: 0.375rem 0.5rem;
  min-width: 64px;
  min-height: 48px;    /* touch target */
}

.site-nav a.active {
  color: var(--brand);
}
```

## What NOT to Use

| Technology | Why NOT |
|------------|---------|
| **Any CSS preprocessor (Sass, Less, PostCSS)** | No build step. GitHub Pages serves raw files. The single `style.css` file is manageable at current size (~1500 lines). |
| **CSS Modules / CSS-in-JS** | Requires bundler. Incompatible with constraints. |
| **Tailwind CSS** | Requires build step. Even the CDN "play" version is 300KB+ and produces class soup that conflicts with existing semantic class naming. |
| **Web Components / Custom Elements** | Overkill for 4 pages. The IIFE module pattern is simpler, matches existing code, and the `<details>` element already provides native disclosure behavior. |
| **ES Modules (`import/export`) in browser** | Current codebase uses `<script src>` loading with IIFE globals. Switching requires `type="module"` on every script tag, changes load order semantics (deferred by default), and could break the service worker. Not worth the disruption for a presentation restructure. |
| **Any SPA router / client-side routing** | 4 pages with distinct URLs and distinct data needs. Separate HTML files are correct for GitHub Pages. SPAs add complexity and break browser back/forward behavior. |
| **CSS `@layer`** | The codebase has a single `style.css` with no specificity wars. Cascade layers add mental overhead without solving an actual problem here. |
| **View Transitions API** | ~80% support, Safari gaps. Cross-page transitions require `<meta name="view-transition" content="same-origin">` and coordination between pages. Nice-to-have for a later polish pass, not worth the complexity now. |
| **`interpolate-size` as a required feature** | Chromium-only (~67% support). Must be progressive enhancement behind `@supports`, never a dependency. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Compare layout | CSS Grid + scroll-snap | HTML `<table>` | Tables are semantically wrong for browsing UX. They cannot scroll-snap per column, cannot stack on mobile without JS rewrite. |
| Compare layout | CSS Grid + scroll-snap | Flexbox-only | Flexbox is one-dimensional. The stores-x-days comparison is inherently 2D. Grid handles both axes natively. |
| Progressive disclosure | `<details>/<summary>` | JS-built accordion | `<details>` is free, accessible, works without JS, already styled. A custom accordion needs ARIA management, keyboard handling, and animation code -- more work for the same result. |
| JS pattern | IIFE Revealing Module | ES6 classes with `render()` | Class-based patterns conflict with existing `var`-based IIFE convention. Consistency with `CustardPlanner` and `CustardDrive` matters more than modernity. |
| Content animation | `::details-content` + opacity fade | CSS Grid `0fr`-to-`1fr` hack | `::details-content` is now cross-browser Baseline (Sept 2025). The grid hack requires an extra wrapper `<div>` inside `<details>`, adding meaningless markup. |
| Container responsiveness | Container queries | Media queries only | Container queries let cards respond to their placement context (narrow scroll-snap column vs. full-width section) rather than the viewport. At 93%+ support, production-ready. |
| Card styling | `:has()` selector | JS class toggling | `:has()` at 97%+ eliminates the JS needed to toggle `.card-has-rare-flavor` type classes. Pure CSS. |

## Browser Support Summary

All recommended technologies and their production readiness:

| Feature | Global Support | Baseline? | Fallback Strategy |
|---------|---------------|-----------|------------------|
| CSS Grid | 97%+ | Yes (2017) | None needed |
| CSS Subgrid | 95%+ | Yes (2023) | `@supports (grid-template-rows: subgrid)` with regular grid fallback |
| CSS Scroll Snap | 97%+ | Yes (2020) | Degrades to free scroll (still functional) |
| Container Queries | 93%+ | Yes (2023) | `@supports (container-type: inline-size)` with media query fallback |
| `:has()` selector | 97%+ | Yes (2023) | JS class fallback for the ~3% |
| `<details name="">` | ~85% | Newly available (2025) | Degrades to all-open (still works, not exclusive) |
| `::details-content` | Baseline | Yes (Sept 2025) | Degrades to instant open/close (no animation) |
| `interpolate-size` | ~67% (Chromium only) | **NO** | `@supports` progressive enhancement ONLY |
| Custom Properties | 97%+ | Yes (2017) | None needed |
| `aria-pressed` | 100% | Yes | None needed |

## Installation

```bash
# Nothing to install. Zero new dependencies.
# All CSS is written directly in docs/style.css
# All JS uses <script src> tags loading IIFEs
```

**New files to create** (all in `custard-calendar/docs/`):

| File | Purpose | Pattern |
|------|---------|---------|
| `compare.js` | Compare page module | `var CustardCompare = (function() { ... })();` |
| `today.js` | Today page module (refactor of inline script in index.html) | `var CustardToday = (function() { ... })();` |
| `fun.js` | Fun page module (quiz + mad libs) | `var CustardFun = (function() { ... })();` |
| `compare.html` | Compare page | New HTML file |
| `fun.html` | Fun page | New HTML file |
| `updates.html` | Get Updates page (consolidates calendar/widget/siri/alerts setup) | New HTML file |

**Files to modify:**

| File | Changes |
|------|---------|
| `style.css` | Add comparison grid, unified card, bottom nav, filter chip, disclosure animation styles |
| `planner-shared.js` | Add shared filter utilities, store header indicator renderer, CustomEvent helpers |
| `index.html` | Simplify to Today page with progressive disclosure, new nav |
| `map.html` | Add flavor family filter chips, new nav |
| `quiz.html` | Merge into Fun page or redirect |
| Old pages (radar, calendar, widget, siri, alerts, scoop, forecast-map, group) | Redirect to new locations |

## Sources

- [MDN: CSS Grid Basic Concepts](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Basic_concepts) -- HIGH confidence
- [MDN: CSS Subgrid](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Subgrid) -- HIGH confidence
- [MDN: CSS Scroll Snap](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll_snap) -- HIGH confidence
- [MDN: `::details-content`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::details-content) -- HIGH confidence
- [MDN: `:has()` Selector](https://developer.mozilla.org/en-US/docs/Web/CSS/:has) -- HIGH confidence
- [MDN: Exclusive Accordions with `<details name>`](https://developer.mozilla.org/en-US/blog/html-details-exclusive-accordions/) -- HIGH confidence
- [Can I Use: CSS Container Queries -- 93.68%](https://caniuse.com/css-container-queries) -- HIGH confidence
- [Can I Use: CSS Subgrid -- 95%+](https://caniuse.com/css-subgrid) -- HIGH confidence
- [Can I Use: `interpolate-size` -- Chromium only](https://caniuse.com/mdn-css_properties_interpolate-size) -- HIGH confidence
- [Chrome Developers: Animate to height: auto](https://developer.chrome.com/docs/css-ui/animate-to-height-auto) -- HIGH confidence
- [Josh W. Comeau: Brand New Layouts with CSS Subgrid](https://www.joshwcomeau.com/css/subgrid/) -- MEDIUM confidence
- [Josh W. Comeau: The Undeniable Utility of CSS :has](https://www.joshwcomeau.com/css/has/) -- MEDIUM confidence
- [nerdy.dev: Open/Close Transitions for details](https://nerdy.dev/open-and-close-transitions-for-the-details-element) -- MEDIUM confidence
- [Go Make Things: Accessible disclosure component](https://gomakethings.com/building-an-accessible-show/hide-disclosure-component-with-vanilla-js/) -- MEDIUM confidence
- [FED Mentor: Accessible disclosure](https://fedmentor.dev/posts/disclosure-ui/) -- MEDIUM confidence
- [Piccalilli: Progressive disclosure component](https://piccalil.li/blog/a-progressive-disclosure-component/) -- MEDIUM confidence
- [Envato Tuts+: Scrolling Card UI with Flexbox and CSS Grid](https://webdesign.tutsplus.com/horizontal-scrolling-card-ui-flexbox-and-css-grid--cms-41922t) -- MEDIUM confidence
- [CSS-Tricks: Practical CSS Scroll Snapping](https://css-tricks.com/practical-css-scroll-snapping/) -- MEDIUM confidence
- [TestParty: Accessible Toggle Buttons](https://testparty.ai/blog/accessible-toggle-buttons-modern-web-apps-complete-guide) -- MEDIUM confidence
- [DEV.to: Building a Responsive Layout in 2025](https://dev.to/smriti_webdev/building-a-responsive-layout-in-2025-css-grid-vs-flexbox-vs-container-queries-234m) -- MEDIUM confidence
- [FrontendTools: CSS Subgrid Browser Support 2025-2026](https://www.frontendtools.tech/blog/mastering-css-grid-2025) -- MEDIUM confidence

---

*Stack research: 2026-03-07*
