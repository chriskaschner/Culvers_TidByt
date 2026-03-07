# Architecture Patterns

**Domain:** Static vanilla JS site restructuring (11 pages to 4 views)
**Researched:** 2026-03-07

## Current Architecture (As-Is)

The `docs/` directory is a flat collection of 14+ HTML pages, each containing its own copy of the nav, header, and inline `<script>` blocks. Three shared JS files provide common functionality:

```
docs/
  planner-shared.js    -- IIFE exposing window.CustardPlanner (1,500+ lines)
                           State mgmt (localStorage), brand constants, scoring,
                           similarity groups, certainty tiers, timeline builder,
                           action CTAs, telemetry, signals, share buttons
  cone-renderer.js     -- SVG pixel-art cone generation (global functions)
  todays-drive.js      -- IIFE exposing window.CustardDrive (drive ranking UI)
  style.css            -- Single shared stylesheet (3,000+ lines)
  *.html               -- Each page: full <html>, duplicated nav, inline JS
```

**Problems this restructure solves:**

1. **Nav duplication.** Every page has a hand-coded `<nav class="nav-links">` with 11 items. Changing the nav means touching 14 files.
2. **No shared header component.** Each page has its own `<header>` with varying structure.
3. **Inline JS coupling.** Page-specific logic lives in `<script>` blocks inside HTML, making it hard to test or share.
4. **No store indicator.** Only `index.html` shows the selected store. Other pages silently read `localStorage` without surfacing which store is active.

## Recommended Architecture (To-Be)

### Component Model: JS Module Functions, Not Classes

The codebase already uses the right pattern: IIFE modules attached to `window` globals (`window.CustardPlanner`, `window.CustardDrive`). Do NOT introduce Web Components, ES modules, or a build step. Instead, add two more shared JS files following the same IIFE pattern:

```
docs/
  planner-shared.js       -- Existing. No changes needed.
  cone-renderer.js        -- Existing. No changes needed.
  todays-drive.js         -- Existing. No changes needed.
  shared-nav.js           -- NEW. Renders nav + store indicator into placeholder.
  compare-grid.js         -- NEW. Compare page grid rendering + logic.
  style.css               -- Existing. Add new component styles at end.
  index.html              -- Restructured: Today page
  compare.html            -- NEW: Compare page
  map.html                -- Existing: Map page (minor nav update)
  fun.html                -- NEW: Fun page (quiz modes, mad libs, fronts)
  updates.html            -- NEW: Get Updates consolidation page
  privacy.html            -- Existing: unchanged
  404.html                -- NEW: Redirect handler
  [old pages].html        -- Redirect stubs (calendar, radar, alerts, siri, etc.)
```

### Component Boundaries

| Component | File | Responsibility | Communicates With |
|-----------|------|---------------|-------------------|
| **CustardPlanner** | `planner-shared.js` | State (localStorage), API client, scoring, constants, telemetry | All pages read from it |
| **ConeRenderer** | `cone-renderer.js` | SVG cone generation, flavor color lookups | Today, Compare, Map |
| **CustardDrive** | `todays-drive.js` | Drive ranking UI, preference chips | Today page (index.html) |
| **SharedNav** | `shared-nav.js` (NEW) | Renders nav bar + persistent store indicator into a DOM placeholder | All pages include it |
| **CompareGrid** | `compare-grid.js` (NEW) | Store x day comparison grid, cell expansion, family exclusion filter | Compare page |
| **Page-specific JS** | Inline `<script>` or page-specific `.js` | Page initialization, API calls, DOM wiring | CustardPlanner + page DOM |

### Why NOT Web Components

Web Components (Custom Elements) would work technically but are wrong for this codebase:

1. **Mismatch with existing patterns.** Every existing module uses IIFE + `window` globals. Introducing `class extends HTMLElement` creates two competing patterns.
2. **Shadow DOM CSS isolation is counterproductive.** The site shares a single `style.css`. Shadow DOM would require duplicating styles or using CSS custom properties for everything.
3. **No real encapsulation need.** There are no third-party consumers. The "components" are project-internal.
4. **Browser support concern is zero** (both patterns work), but **team cognitive load** of maintaining two paradigms matters for a solo/small-team project.

**Use the IIFE pattern that already exists.** It works, it is understood, and it avoids needless architectural churn.

## Shared Navigation Pattern

### Approach: JS-Rendered Nav with HTML Placeholder

Each page includes a minimal placeholder, and `shared-nav.js` populates it:

```html
<!-- In every page's <header> -->
<div id="shared-nav"></div>

<!-- Before </body> -->
<script src="planner-shared.js"></script>
<script src="shared-nav.js"></script>
```

```javascript
// shared-nav.js (IIFE pattern matching existing codebase)
var CustardNav = (function () {
  'use strict';

  var NAV_ITEMS = [
    { href: 'index.html', label: 'Today', key: 'index' },
    { href: 'compare.html', label: 'Compare', key: 'compare' },
    { href: 'map.html', label: 'Map', key: 'map' },
    { href: 'fun.html', label: 'Fun', key: 'fun' },
  ];

  function render(containerId) {
    var container = document.getElementById(containerId || 'shared-nav');
    if (!container) return;

    var slug = CustardPlanner.getPrimaryStoreSlug();
    var storeHTML = '';
    if (slug) {
      storeHTML = '<div class="store-indicator">' +
        '<span class="store-indicator-slug">' +
        CustardPlanner.escapeHtml(slug.replace(/-/g, ' ')) +
        '</span>' +
        ' <a href="index.html?change=1" class="store-indicator-change">change</a>' +
        '</div>';
    }

    var currentKey = inferCurrentPage();
    var navHTML = NAV_ITEMS.map(function (item) {
      var cls = item.key === currentKey ? ' class="nav-active"' : '';
      return '<a href="' + item.href + '"' + cls + '>' + item.label + '</a>';
    }).join('');

    container.innerHTML = storeHTML +
      '<nav class="nav-links">' + navHTML + '</nav>';
  }

  function inferCurrentPage() {
    var path = window.location.pathname;
    var file = path.substring(path.lastIndexOf('/') + 1);
    if (!file || file === 'index.html') return 'index';
    return file.replace('.html', '');
  }

  return { render: render };
})();

// Auto-render on load
CustardNav.render();
```

**Rationale:** This is lightweight, follows the existing codebase conventions exactly, avoids `fetch()` overhead (no extra HTTP request for a nav partial), and ensures the nav definition lives in one place.

### Store Indicator Behavior

The persistent store indicator in the nav:

1. Reads `localStorage` key `custard-primary` via `CustardPlanner.getPrimaryStoreSlug()`.
2. Shows store name (slug formatted as display text) + "change" link.
3. If no store is saved, shows nothing (first-visit flow handles geolocation + selection on the Today page).
4. The "change" link navigates to `index.html?change=1`, which triggers the store picker on the Today page.

## Data Flow

### State Management via localStorage

The codebase already has a well-structured localStorage state layer in `planner-shared.js`. No changes needed to the mechanism -- only the UI surfaces need to expose it more visibly.

```
localStorage keys (existing):
  custard-primary          -- Store slug string (e.g., "mt-horeb")
  custard-secondary        -- JSON array of secondary store slugs
  custard-favorites        -- JSON array of favorite flavor names
  custard:v1:preferences   -- JSON object: drive preferences, route, sort, tags

Read path:  Page JS --> CustardPlanner.getPrimaryStoreSlug() --> localStorage
Write path: Page JS --> CustardPlanner.setPrimaryStoreSlug() --> localStorage
```

### API Data Flow (unchanged)

```
Page Load
  |
  +--> planner-shared.js loads (synchronous, defines window.CustardPlanner)
  |
  +--> Page JS reads store slug from localStorage
  |
  +--> Page JS calls fetch(WORKER_BASE + '/api/v1/...?slug=X')
  |     (Worker API is the single source of truth)
  |
  +--> Page JS renders response into DOM
  |
  +--> User interactions trigger further API calls or localStorage writes
```

### Compare Page Data Flow (new)

```
compare.html loads
  |
  +--> Reads primary + secondary stores from localStorage
  |    (CustardPlanner.getPrimaryStoreSlug() + secondary stores key)
  |
  +--> For each store, fetches /api/v1/flavors?slug=X
  |    (parallel fetches, Promise.all)
  |
  +--> Builds store x day grid (2-4 stores x 2-3 days)
  |    Each cell: flavor name, certainty badge, rarity chip
  |
  +--> Cell click/tap expands: description, directions link, historical pattern
  |    (fetches /api/v1/metrics/context/flavor/X lazily)
  |
  +--> Family exclusion filter: toggle chips filter grid cells
  |    (client-side filter using CustardPlanner.FLAVOR_FAMILY_MEMBERS)
```

## Progressive Disclosure Pattern

Use native `<details>/<summary>` elements. The codebase already has CSS for them in `style.css` (lines 275-291). The pattern:

```html
<!-- Today page: week-ahead collapsed by default -->
<details class="week-ahead">
  <summary>This week's flavors</summary>
  <div class="week-grid" id="week-ahead-grid">
    <!-- Populated by JS -->
  </div>
</details>

<!-- Compare page: cell expansion -->
<details class="compare-cell-detail">
  <summary>Butter Pecan <span class="rarity-chip rarity-rare">Rare</span></summary>
  <div class="compare-detail-body">
    <p class="flavor-desc">Rich vanilla custard with... </p>
    <a href="..." class="directions-link">Directions</a>
    <p class="flavor-pattern">Shows up roughly every 18 days at this store</p>
  </div>
</details>
```

**Key decisions:**

1. **Do NOT use the `name` attribute** for exclusive accordion behavior on the Compare grid. Users may want multiple cells expanded simultaneously to compare descriptions.
2. **DO use `name` attribute** on the Fun page quiz mode selector, where only one quiz mode should show details at a time.
3. **Animation is a progressive enhancement.** Use `interpolate-size: allow-keywords` and `::details-content` transition where supported; graceful fallback to instant open/close. Browser support in 2026 is good but not universal.
4. **Content inside `<details>` is NOT searchable** in Safari and has quirks in Firefox. Keep the primary information (flavor name, store name, certainty tier) in the `<summary>`, not hidden inside the details body.

## Page Redirect Strategy for GitHub Pages

### Approach: Lightweight HTML Redirect Stubs + 404.html Catch-All

GitHub Pages has no server-side redirect configuration. Use two complementary strategies:

**Strategy 1: Per-page redirect stubs** for known old URLs.

For each retired page (`calendar.html`, `radar.html`, `alerts.html`, `siri.html`, `widget.html`, `scoop.html`, `forecast-map.html`), replace the content with a redirect stub:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=updates.html">
  <link rel="canonical" href="https://custard.chriskaschner.com/updates.html">
  <title>Redirecting...</title>
</head>
<body>
  <p>This page has moved. <a href="updates.html">Go to Get Updates</a>.</p>
  <script>
    // Preserve query params
    var dest = 'updates.html';
    if (location.search) dest += location.search;
    location.replace(dest);
  </script>
</body>
</html>
```

**Redirect mapping:**

| Old URL | New URL | Rationale |
|---------|---------|-----------|
| `calendar.html` | `updates.html` | Calendar sub = delivery channel setup |
| `alerts.html` | `updates.html` | Alert sub = delivery channel setup |
| `siri.html` | `updates.html` | Siri setup = delivery channel setup |
| `widget.html` | `updates.html` | Widget setup = delivery channel setup |
| `radar.html` | `index.html` | Radar data absorbed into Today page |
| `scoop.html` | `index.html` | Scoop was already an alias for Today's Drive |
| `forecast-map.html` | `fun.html` | Fronts accessible from Fun page |

**Strategy 2: `404.html` catch-all** for any other broken links.

```html
<!-- 404.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Page Not Found - Custard Calendar</title>
  <meta http-equiv="refresh" content="3;url=index.html">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header><h1>Page Not Found</h1></header>
  <main>
    <p>This page doesn't exist. Redirecting to <a href="index.html">Today</a> in 3 seconds...</p>
  </main>
  <script>
    // Preserve known params (slug, store) when redirecting
    var params = new URLSearchParams(location.search);
    var dest = 'index.html';
    if (params.get('slug') || params.get('store')) {
      dest += '?' + params.toString();
    }
    setTimeout(function() { location.replace(dest); }, 3000);
  </script>
</body>
</html>
```

**Key decisions:**

1. Use `meta http-equiv="refresh"` as the primary redirect mechanism. It works with JS disabled.
2. Layer JS `location.replace()` on top for query param preservation and instant redirect.
3. Use `location.replace()` (not `location.href =`) so the old URL does not pollute browser history.
4. Include `<link rel="canonical">` in redirect stubs to signal permanence to search engines.
5. The 404.html uses a 3-second delay so users see the "not found" message briefly, confirming the URL was wrong.

## Compare Grid: Mobile-First Responsive Pattern

The Compare page is the most architecturally novel piece. It must work at 375px (phone in the car).

### Desktop Layout (>640px): CSS Grid Table

```
          | Today (Mon) | Tomorrow (Tue) | Wednesday  |
Store A   | [cell]      | [cell]         | [cell]     |
Store B   | [cell]      | [cell]         | [cell]     |
Store C   | [cell]      | [cell]         | [cell]     |
```

```css
.compare-grid {
  display: grid;
  grid-template-columns: minmax(100px, 0.8fr) repeat(var(--days, 3), 1fr);
  gap: 1px;
  background: var(--border);  /* Gap becomes grid lines */
}

.compare-cell {
  background: white;
  padding: 0.75rem;
}
```

### Mobile Layout (<=640px): Stacked Day Cards

At 375px, a multi-column grid is unreadable. Transform to day-first stacked cards:

```
=== Today (Monday) ===
  Store A: Butter Pecan [Rare]
  Store B: Mint Explosion [Common]
  Store C: Turtle [Uncommon]

=== Tomorrow (Tuesday) ===
  Store A: Chocolate Volcano [Ultra Rare]
  ...
```

```css
@media (max-width: 640px) {
  .compare-grid {
    display: block;  /* Collapse grid */
  }

  .compare-day-group {
    margin-bottom: 1rem;
  }

  .compare-cell {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border);
  }
}
```

**Key decisions:**

1. **Day-first on mobile, store-first on desktop.** On mobile, the user's question is "what's happening today?" not "what does Store A have all week?" The mobile layout groups by day.
2. **Use CSS `display: block` override**, not a separate HTML structure. The same DOM serves both layouts; CSS alone handles the transformation.
3. **`<details>` for cell expansion.** Each cell is a `<summary>` (flavor name + rarity chip). Tapping expands the description, directions, and historical context. This keeps the grid scannable.
4. **2-4 stores maximum, 2-3 days maximum.** Hard-cap the grid dimensions. The API supports more, but the UI should not overwhelm.
5. **`gap: 1px` with background color trick** gives table-like grid lines without borders on individual cells.

## How to Add New Pages Without Duplicating Shared Code

### Checklist for a New Page

1. Create `docs/new-page.html` with minimal boilerplate:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="...">
  <title>Page Title - Custard Calendar</title>
  <link rel="stylesheet" href="style.css">
  <!-- Cloudflare Analytics -->
  <script defer src="https://static.cloudflareinsights.com/beacon.min.js"
    data-cf-beacon='{"token": "c050ff4e79d54b2abbb60587137d0bb2"}'></script>
</head>
<body data-page="new-page">
  <header>
    <h1>Page Title</h1>
    <p>Page subtitle</p>
    <div id="shared-nav"></div>
  </header>

  <main>
    <!-- Page content -->
  </main>

  <footer>
    <p><a href="privacy.html">Privacy</a> &middot; ...</p>
    <div class="page-share-mount" id="page-share"></div>
  </footer>

  <script src="planner-shared.js"></script>
  <script src="shared-nav.js"></script>
  <script>CustardPlanner.emitPageView('new-page');</script>
  <script>CustardPlanner.initShareButton('page-share');</script>
  <!-- Page-specific JS here -->
</body>
</html>
```

2. Add `style.css` rules for page-specific styles (namespaced: `.new-page-section { ... }`).
3. If the page has significant JS, create `docs/new-page.js` as an IIFE exposing `window.CustardNewPage`.
4. Update the `NAV_ITEMS` array in `shared-nav.js` if the page should appear in navigation.

### What Shared Code Provides (no duplication needed)

| Need | Provided By | How |
|------|-------------|-----|
| Navigation | `shared-nav.js` | `<div id="shared-nav">` auto-populated |
| Store state | `planner-shared.js` | `CustardPlanner.getPrimaryStoreSlug()` |
| API base URL | `planner-shared.js` | `CustardPlanner.WORKER_BASE` |
| Flavor rendering | `cone-renderer.js` | `renderMiniConeSVG(flavor, scale)` |
| Brand constants | `planner-shared.js` | `CustardPlanner.BRAND_COLORS` |
| Telemetry | `planner-shared.js` | `CustardPlanner.emitPageView()` |
| HTML escaping | `planner-shared.js` | `CustardPlanner.escapeHtml()` |
| Rarity labels | `planner-shared.js` | `CustardPlanner.rarityLabelFromRank()` |

## Build Order (Dependency Graph)

The restructure has clear dependencies that dictate phase ordering:

```
Phase 1: Foundation (no page depends on these yet, but everything will)
  |
  +-- shared-nav.js (new file)
  +-- Store indicator CSS in style.css
  +-- Update index.html to use shared-nav.js
  +-- Test: nav renders, store indicator shows/hides
  |
Phase 2: Today Page Simplification (depends on Phase 1)
  |
  +-- Restructure index.html content: cone + flavor above fold
  +-- Week-ahead as <details> collapsed by default
  +-- Multi-store glance row
  +-- "Want this every day?" CTA
  +-- Test: progressive disclosure works, mobile layout
  |
Phase 3: Compare Page (depends on Phase 1; can parallel Phase 2)
  |
  +-- compare.html + compare-grid.js (new files)
  +-- Reads primary + secondary stores from localStorage
  +-- Grid rendering, cell expansion
  +-- Family exclusion filter
  +-- Mobile day-first card transformation
  +-- Test: grid renders at 375px, cell expansion, filter
  |
Phase 4: Nav Consolidation + Redirects (depends on Phase 1)
  |
  +-- Replace old page content with redirect stubs
  +-- 404.html catch-all
  +-- fun.html page (quiz modes + fronts + group)
  +-- updates.html page (calendar + widget + siri + alerts)
  +-- Update shared-nav.js NAV_ITEMS to final 4 items
  +-- Test: all old URLs redirect correctly, params preserved
  |
Phase 5: Polish (depends on Phases 2-4)
  |
  +-- Map page nav update + flavor family exclusion filter
  +-- First-visit geolocation flow
  +-- Visual coherence pass
  +-- Cross-page test suite
```

**Why this order:**

1. **Phase 1 first** because every other phase depends on having shared-nav.js and the store indicator in place.
2. **Phases 2 and 3 can run in parallel** -- they are independent pages that both depend only on Phase 1.
3. **Phase 4 after Phase 1** because redirects need the new destination pages to exist, and the Fun/Updates pages need the nav component.
4. **Phase 5 last** because polish should happen after all structural changes are complete.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Introducing a Build Step
**What:** Adding webpack, Vite, esbuild, or any compilation step.
**Why bad:** Violates the project constraint (GitHub Pages, no build step). Also breaks the current `git push -> live` deployment model.
**Instead:** Keep using `<script src="...">` tags and IIFE modules.

### Anti-Pattern 2: ES Modules (import/export)
**What:** Using `<script type="module">` with import/export syntax.
**Why bad:** While browser-supported, it breaks the established `window.CustardPlanner` global pattern. Every existing page uses `CustardPlanner.X` without imports. Mixing patterns creates confusion.
**Instead:** Keep using IIFE + `var CustardX = (function() { ... })();` pattern.

### Anti-Pattern 3: Fetch-Based HTML Includes
**What:** Loading `nav.html` via `fetch()` and injecting into DOM.
**Why bad:** Extra HTTP request on every page load. Flash of unstyled/missing nav on slow connections. CORS complexity if testing locally with `file://` protocol.
**Instead:** Generate nav from JS (data is 4 items -- cheaper to define in code than fetch).

### Anti-Pattern 4: Single Page Application (SPA) with Hash Routing
**What:** Making `index.html` handle all routes via `#/today`, `#/compare`, etc.
**Why bad:** Breaks GitHub Pages assumptions. Loses per-page `<title>`, `<meta>` tags for SEO/social cards. The site already has per-page OG images. Each page has unique CSP needs (map.html loads Leaflet).
**Instead:** Keep multi-page architecture. Share code via JS includes, not routing.

### Anti-Pattern 5: Over-Engineering the Compare Grid
**What:** Building a fully generic data-grid component with sorting, pagination, virtual scrolling.
**Why bad:** The grid is 2-4 stores by 2-3 days. Maximum 12 cells. No need for virtual scrolling or pagination. Keep it simple: render all cells, CSS handles layout.
**Instead:** A single IIFE module (`compare-grid.js`) that renders the specific compare UI. Not a generic grid library.

## Scalability Considerations

| Concern | At Current Scale | At 10x (10 pages) | Notes |
|---------|-----------------|-------------------|-------|
| Nav maintenance | 1 file (shared-nav.js) | Same 1 file | Solved by this restructure |
| Shared CSS | Single style.css ~3K lines | May want to split | Use CSS custom properties + BEM-like naming to avoid conflicts |
| State complexity | 4 localStorage keys | Same 4 keys | localStorage pattern is sufficient; no need for IndexedDB or state library |
| JS bundle size | ~50KB total (planner-shared + cone-renderer) | Same | No build-time tree-shaking needed at this scale |
| Page load latency | 3 script tags, each cached | Same | Browser caching handles this; no need for concatenation |

## Sources

- Current codebase analysis: `docs/planner-shared.js`, `docs/cone-renderer.js`, `docs/todays-drive.js`, `docs/style.css`, `docs/index.html`, `docs/map.html`, `docs/quiz.html`, `docs/alerts.html`, `docs/scoop.html` (HIGH confidence -- primary sources)
- [MDN: `<details>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details) (HIGH confidence)
- [CSS-Tricks: The Simplest Ways to Handle HTML Includes](https://css-tricks.com/the-simplest-ways-to-handle-html-includes/) (MEDIUM confidence)
- [freeCodeCamp: Reusable HTML Components](https://www.freecodecamp.org/news/reusable-html-components-how-to-reuse-a-header-and-footer-on-a-website/) (MEDIUM confidence)
- [GitHub Pages redirect techniques](https://opensource.com/article/19/7/permanently-redirect-github-pages) (MEDIUM confidence)
- [GitHub Pages 404.html redirect pattern](https://gist.github.com/domenic/1f286d415559b56d725bee51a62c24a7) (MEDIUM confidence)
- [CSS Grid responsive card patterns](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Common_grid_layouts) (HIGH confidence)
- [LogRocket: Styling `<details>` with modern CSS](https://blog.logrocket.com/styling-html-modern-css/) (MEDIUM confidence)

---

*Architecture analysis: 2026-03-07*
