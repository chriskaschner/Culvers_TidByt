# Technology Stack: v1.2 Feature Completion & Cleanup

**Project:** Custard Calendar v1.2
**Researched:** 2026-03-09
**Scope:** Stack additions for 11 new features on the existing vanilla JS / GitHub Pages foundation
**Confidence:** HIGH (most recommendations extend proven patterns already in the codebase)

## Constraints (Unchanged from v1.0/v1.1)

These are inherited and non-negotiable. Repeated here because every recommendation below must fit within them:

| Constraint | Implication for v1.2 |
|------------|---------------------|
| No build step (GitHub Pages) | No bundlers, no preprocessors. Raw CSS/JS only. |
| No frameworks | Vanilla JS with `window.CustardPlanner` IIFE pattern. |
| Vanilla JS (var, IIFEs) | Must match existing code style across all 9 JS files. |
| Mobile-first at 375px | All new features (compare multi-store, quiz images, chips) must work at 375px. |
| Single CSS file (`docs/style.css`) | All new styles go here. No CSS imports. |
| CDN only for vendored libs | Leaflet is the only CDN dependency. No new CDN libraries needed for v1.2. |

## Recommended Stack Additions

### 1. Old Page Redirects (scoop, radar, calendar, widget, siri, alerts)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `<meta http-equiv="refresh">` + inline JS | HTML5 / ES5 | Redirect old URLs to new destinations while preserving query params | GitHub Pages has no server-side redirect capability. Meta refresh is the standard static-hosting approach. JS runs first to capture and forward query params; meta refresh acts as a no-JS fallback (without params). |

**Approach:** Replace each old page's full content with a minimal redirect stub. The old pages (scoop.html, radar.html, calendar.html, widget.html, siri.html, alerts.html) are full-featured pages today -- the redirect replaces their content entirely.

**How it works:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="1;url=updates.html">
  <link rel="canonical" href="https://custard.chriskaschner.com/updates.html">
  <title>Redirecting...</title>
  <script>
    // Preserve query params and hash during redirect
    var target = 'updates.html';
    var qs = window.location.search || '';
    var hash = window.location.hash || '';
    window.location.replace(target + qs + hash);
  </script>
</head>
<body>
  <p>Redirecting to <a href="updates.html">updates.html</a>...</p>
</body>
</html>
```

**Key details:**
- `window.location.replace()` (not `.href`) so the old URL does not pollute browser history
- `rel="canonical"` tells search engines the canonical URL, preventing duplicate content
- Meta refresh `content="1"` (1-second delay) gives JS time to execute; if JS is disabled, the meta tag redirects without params after 1 second
- Each old page maps to a specific new destination (see mapping table below)

**Redirect mapping:**

| Old Page | New Destination | Query Params to Preserve |
|----------|----------------|------------------------|
| scoop.html | index.html | `?store=`, any drive params |
| radar.html | index.html | `?store=`, `?days=` |
| calendar.html | updates.html | `?primary=`, `?secondary=` |
| widget.html | updates.html | `?store=` |
| siri.html | updates.html | none expected |
| alerts.html | updates.html | `?store=`, `?flavor=` |

**What NOT to use:**
- Jekyll redirect plugin (`jekyll-redirect-from`) -- requires Jekyll build step, this project uses raw HTML
- 404.html SPA-style routing -- breaks expectations, confuses crawlers
- Cloudflare Worker redirects -- out of scope (no Worker changes)

**Confidence:** HIGH. This is the universally documented approach for GitHub Pages redirects. Verified against multiple GitHub-specific guides.

---

### 2. Service Worker Registration on fun.html and updates.html

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `navigator.serviceWorker.register()` | Service Worker API | Register the existing `sw.js` on pages that currently lack registration | fun.html and updates.html do not register the service worker. The existing sw.js has root scope (`./`) and the same registration call is used on 4 other pages already. |

**Current state of SW registration across pages:**

| Page | Has SW Registration? |
|------|---------------------|
| index.html (today-page.js) | Yes |
| compare.html (compare-page.js) | Yes |
| calendar.html | Yes |
| widget.html | Yes |
| **fun.html** | **No** |
| **updates.html** | **No** |
| map.html | No (intentional -- map is heavy, SW pre-cache would slow initial load) |
| quiz.html | No (loaded via fun.html link) |

**Implementation:** Add the standard registration snippet to fun.html and updates.html, matching the pattern in today-page.js:

```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(function () {});
}
```

Place this at the end of the page's inline `<script>` block (after DOMContentLoaded or module init). Calling `register()` on an already-registered SW is a no-op -- the browser deduplicates automatically, so there is no harm in multiple pages registering the same script.

**Also needed:** Add `stores.json` to the `STATIC_ASSETS` array in `sw.js`. Currently it is fetched at runtime but not pre-cached, causing an unnecessary network dependency on repeat visits.

```javascript
// In sw.js STATIC_ASSETS array, add:
'./stores.json',
```

After adding stores.json, bump `CACHE_VERSION` (currently `'custard-v15'` -> `'custard-v16'`) to trigger a cache refresh.

**Confidence:** HIGH. The registration pattern is already proven on 4 pages. The Service Worker API documentation confirms that duplicate registrations are safely ignored.

---

### 3. planner-shared.js Refactoring Strategy

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Multiple IIFE files with `<script>` ordering | Vanilla JS | Split 1,639-line monolith into focused modules | The file currently mixes 7 distinct responsibility groups (see analysis below). Splitting preserves the IIFE pattern, requires no build step, and allows page-specific loading. |

**Current responsibility analysis of planner-shared.js (1,639 lines):**

| Responsibility Group | Lines (approx) | Functions | Consumers |
|---------------------|----------------|-----------|-----------|
| Store/localStorage management | ~120 | getPrimaryStoreSlug, setSavedStore, getFavorites, addFavorite, removeFavorite | All pages |
| Drive preferences (route, filters, URL state) | ~250 | getDrivePreferences, saveDrivePreferences, parseDriveUrlState, buildDriveUrlState, sanitize* | today-page.js, scoop.html |
| Flavor families & similarity | ~180 | FLAVOR_FAMILIES, getFamilyForFlavor, findSimilarFlavors, findSimilarToFavorites, normalizeFamilyConfig | map.html, compare-page.js, quiz engine |
| Certainty/confidence display | ~80 | certaintyTier, certaintyBadgeHTML, certaintyCardClass, confidenceStripClass | today-page.js, compare-page.js |
| Timeline building | ~100 | buildTimeline, _findForecastDay, _addDays | today-page.js |
| Telemetry | ~100 | emitInteractionEvent, emitPageView, bindInteractionTelemetry, cleanTelemetry* | All pages |
| Rarity, CTAs, historical context, signals, share | ~300 | rarityLabel*, formatCadenceText, actionCTAsHTML, historicalContextHTML, signalCardHTML, initShareButton | today-page.js, compare-page.js |
| Core utilities (escapeHtml, normalize, haversine, brand helpers) | ~80 | escapeHtml, normalize, haversineMiles, brandFromSlug | All files |

**Recommended split:**

| New File | Source Lines | Contains | Load Order |
|----------|-------------|----------|------------|
| `planner-core.js` | ~80 | Constants (WORKER_BASE, keys), escapeHtml, normalize, haversineMiles, brand helpers | 1st (all pages) |
| `planner-store.js` | ~120 | getPrimaryStoreSlug, setSavedStore, getFavorites, localStorage management | 2nd (all pages) |
| `planner-telemetry.js` | ~100 | emitInteractionEvent, emitPageView, bindInteractionTelemetry | 3rd (all pages) |
| `planner-drive.js` | ~250 | Drive preferences, URL state, sanitization | Only on today page |
| `planner-flavors.js` | ~180 | FLAVOR_FAMILIES, similarity, family lookup | Map, compare, quiz |
| `planner-display.js` | ~480 | Certainty, timeline, rarity, CTAs, historical context, signals, share | Today, compare |

**Critical constraint -- backward compatibility:** The existing public API is `window.CustardPlanner.methodName`. After splitting, each sub-module attaches its exports to the same `window.CustardPlanner` object. No consumer code needs to change.

```javascript
// planner-core.js -- loaded first, creates the namespace
var CustardPlanner = (function () {
  'use strict';
  var WORKER_BASE = 'https://custard.chriskaschner.com';
  // ... core functions ...
  return { WORKER_BASE: WORKER_BASE, escapeHtml: escapeHtml, /* ... */ };
})();

// planner-store.js -- extends CustardPlanner
(function (CP) {
  'use strict';
  function getPrimaryStoreSlug() { /* ... */ }
  // ... store functions ...
  CP.getPrimaryStoreSlug = getPrimaryStoreSlug;
  CP.setSavedStore = setSavedStore;
  // ...
})(window.CustardPlanner);
```

**Script loading in HTML:**

```html
<!-- All pages load core + store + telemetry -->
<script src="planner-core.js"></script>
<script src="planner-store.js"></script>
<script src="planner-telemetry.js"></script>

<!-- Today page additionally loads: -->
<script src="planner-drive.js"></script>
<script src="planner-flavors.js"></script>
<script src="planner-display.js"></script>

<!-- Map page only needs: -->
<script src="planner-flavors.js"></script>
```

**What NOT to do:**
- Do NOT switch to ES modules (`import/export`). Requires `type="module"` on all script tags, changes load semantics (deferred), and the SW pre-cache list would need updating. The codebase convention is `<script src>` with IIFE globals.
- Do NOT rename the `CustardPlanner` namespace. It is referenced in 9+ files. Changing the name creates unnecessary churn.
- Do NOT create a single "barrel" file that re-exports everything. That defeats the purpose of splitting.

**Confidence:** HIGH. The "extend the namespace object" pattern is exactly how jQuery plugins, Lodash mixins, and pre-ES-module libraries have worked for 15+ years. It is battle-tested and matches the codebase's existing conventions.

---

### 4. Hero Cone PNGs for Remaining ~136 Flavors

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `sharp` | 0.34.x (currently installed) | SVG-to-PNG rasterization with nearest-neighbor interpolation | Already used by `scripts/generate-hero-cones.mjs`. Supports `kernel: 'nearest'` for pixel-art-appropriate scaling. macOS `sips` fallback also exists. |
| Worker `renderConeHeroSVG()` | Existing | Generates 36x42 pixel-grid SVG at scale 4 (144x168px) | Already implemented in `worker/src/flavor-colors.js`. The pipeline is proven for 40 flavors. |

**Current state:** 40 hero cone PNGs exist in `docs/assets/cones/`. The Worker has 40 `FLAVOR_PROFILES` entries (38 uniquely named, a couple with aliases). To generate PNGs for the remaining ~136 flavors, the bottleneck is **adding FLAVOR_PROFILES entries**, not the pipeline itself.

**Scaling the pipeline:**

1. **Add profiles to `worker/src/flavor-colors.js`:** Each profile is ~5 lines (base color, ribbon, toppings, density). The 136 new entries bring the file from ~130 lines of profiles to ~800. This is tedious but mechanically simple.

2. **Run the existing generator:** `node scripts/generate-hero-cones.mjs` already iterates all profiles and outputs PNGs. No changes to the script are needed.

3. **Runtime caching via SW:** The service worker already handles hero cone PNGs via stale-while-revalidate (line 64-77 of sw.js). New PNGs are cached on first load automatically.

**Output specifications (unchanged from v1.0):**
- Input: SVG at scale 4 (144x168px pixel grid)
- Output: 120px-wide PNG via `sharp.resize({ width: 120, kernel: 'nearest' })`
- Filename: `docs/assets/cones/{slug}.png` where slug = `flavorName.toLowerCase().replace(/[^a-z0-9]+/g, '-')`

**Disk budget:** 40 PNGs currently total ~150KB. Adding 136 more at similar sizes adds ~500KB. Total asset directory ~650KB -- well within GitHub Pages limits and acceptable for a static site.

**What NOT to do:**
- Do NOT pre-cache all 176 cone PNGs in the SW `STATIC_ASSETS` array. That would bloat the install event. The runtime stale-while-revalidate strategy is correct -- only cache PNGs the user actually views.
- Do NOT switch to WebP for the cones. The pixel-art aesthetic benefits from PNG's lossless compression. WebP would save negligible bytes at these sizes (<5KB each) while complicating the fallback chain.

**Confidence:** HIGH. The pipeline exists and is proven. The work is profile authoring, not infrastructure.

---

### 5. Map Flavor Family Exclusion Filter with Persistent State

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `<button aria-pressed>` | HTML + ARIA | Toggle chips for excluding flavor families on the map | The map already has flavor family chips (`.flavor-chip` class in style.css, lines 680-701). Current behavior is "show only this family" (inclusive). The new feature inverts to "hide this family" (exclusive). |
| `localStorage` | Web Storage API | Persist exclusion state across sessions | compare-page.js already persists exclusions to `custard-exclusions`. Map should use the same key for cross-page consistency. |
| `CustardPlanner.FLAVOR_FAMILY_MEMBERS` | Existing | Family-to-flavors lookup | Already exposed from planner-shared.js and consumed by map.html. |

**Current state in map.html:** The map has `#flavor-family-chips` container (line 66), flavor chip rendering (lines 178-187), and an `activeFamily` variable that tracks a single inclusive selection. The chip CSS is defined (`.flavor-chip`, `.flavor-chip.active`).

**What changes for exclusion mode:**

The existing inclusive filter ("show only chocolate") becomes an exclusion filter ("hide chocolate, hide mint"). The key UX difference:

- **Inclusive (current):** One chip active at a time, `activeFamily = 'chocolate'`, show only matching markers
- **Exclusive (new):** Multiple chips can be active, `excludedFamilies = new Set(['chocolate', 'mint'])`, hide matching markers

**CSS change:** The existing `.flavor-chip.active` style (brand blue background, white text) already works. For exclusion semantics, rename the visual state to use `aria-pressed` instead of class toggling:

```css
/* Already exists -- keep as-is */
.flavor-chip {
  padding: 0.3rem var(--space-3);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-full);
  /* ... */
}

/* Replace .flavor-chip.active with: */
.flavor-chip[aria-pressed="true"] {
  background: var(--brand);
  color: var(--bg-surface);
  border-color: transparent;
}
```

**JS change:** Toggle `aria-pressed` on click, update `excludedFamilies` Set, filter markers, persist to localStorage:

```javascript
function toggleFamilyExclusion(familyKey, chipEl) {
  if (excludedFamilies.has(familyKey)) {
    excludedFamilies.delete(familyKey);
    chipEl.setAttribute('aria-pressed', 'false');
  } else {
    excludedFamilies.add(familyKey);
    chipEl.setAttribute('aria-pressed', 'true');
  }
  saveExclusions();  // localStorage
  refreshMapMarkers();
}
```

**Persistence:** Use the same `custard-exclusions` localStorage key that compare-page.js already uses. This means exclusions are shared between map and compare pages -- if you exclude mint on the map, it is also excluded on compare. This is the correct behavior (user preference is global).

**Confidence:** HIGH. The chip UI, family data, and localStorage patterns all exist. This is wiring them together with inverted filter logic.

---

### 6. Quiz Image-Based Answer Options on Mobile

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `QuizSprites.resolve()` | Existing (`quizzes/sprites.js`) | Render pixel-art SVG sprites for quiz option icons | The sprite system already exists and renders owls, foxes, drums, etc. Currently used for desktop quiz options via the `icon` field in quiz JSON. |
| `heroConeSrc()` / `renderHeroCone()` | Existing (`cone-renderer.js`) | Display flavor cone images in quiz results and potentially answer options | Already used for quiz results. Can be extended for answer options that reference specific flavors. |

**Current state:** Quiz answer options have an `icon` field in the JSON that can reference pixel sprites (`"icon": "pixel:owl"`) or color swatches (`"icon": "color:#7ecfa0"`). The engine (engine.js lines 493-508) renders these as small icons beside the label text. On mobile, options display as a vertical list with radio buttons.

**What "image-based answer options on mobile" means:**

Instead of small text labels with tiny icons, mobile quiz options should display as a 2x2 grid of image cards where the image is the primary visual element and the label is secondary. This makes touch targets larger and the quiz feel more visual/engaging.

**CSS needed (new):**

```css
/* Mobile: quiz options as image-first grid */
@media (max-width: 599px) {
  .quiz-options-grid.has-images {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }

  .quiz-option.has-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-3);
    min-height: 100px;
    text-align: center;
  }

  .quiz-option.has-icon .quiz-option-icon {
    width: 48px;
    height: 48px;
    margin-bottom: var(--space-2);
  }

  .quiz-option.has-icon .quiz-option-copy {
    font-size: 0.8125rem;
  }
}
```

**JS change (minimal):** In `renderQuestions()` (engine.js ~480), add a `has-images` class to the grid when all options have icons:

```javascript
var allHaveIcons = question.options.every(function(opt) { return !!opt.icon; });
if (allHaveIcons) grid.classList.add('has-images');
```

**No new libraries needed.** The existing sprite system and cone renderer provide all image assets. The change is purely layout (CSS grid for mobile) and a conditional class toggle.

**Confidence:** HIGH. All image rendering infrastructure exists. The change is CSS layout for mobile.

---

### 7. Mad Libs Chip CSS Definitions

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| CSS classes in `style.css` | CSS | Replace inline `style.cssText` on Mad Libs chips with proper CSS classes | engine.js lines 435-457 currently apply all chip styles via `style.cssText` inline. This bypasses the design system and makes theming impossible. |

**Current problem (engine.js lines 439-442):**

```javascript
chip.style.cssText = 'padding:0.375rem 0.875rem;border:1.5px solid #ccc;border-radius:999px;background:white;color:#444;font-size:0.8125rem;font-weight:600;cursor:pointer;';
```

And the selected state (lines 451):

```javascript
chip.style.background = '#005696'; chip.style.color = 'white'; chip.style.borderColor = '#005696';
```

This hardcodes colors instead of using design tokens, and the inline styles have higher specificity than any CSS class.

**CSS to add to style.css:**

```css
/* Mad Libs word chips (FUN-02) */
.madlib-chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.madlib-chip {
  padding: 0.375rem 0.875rem;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  min-height: 44px;  /* WCAG touch target */
}

.madlib-chip:hover {
  border-color: var(--text-subtle);
}

.madlib-chip.selected {
  background: var(--brand);
  color: var(--bg-surface);
  border-color: transparent;
}
```

**JS change:** Remove all `style.cssText` assignments and `style.background/color/borderColor` assignments from the Mad Libs chip code in engine.js. Replace with class toggling:

```javascript
// Before (remove):
chip.style.cssText = '...';
// After:
// (no inline styles -- CSS class handles it)

// Before (remove):
chip.style.background = '#005696'; chip.style.color = 'white';
// After:
chip.classList.add('selected');
```

Also remove the inline `chipContainer.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.5rem;'` -- the `.madlib-chip-group` class handles that.

**Confidence:** HIGH. The chip pattern is identical to existing `.flavor-chip` and `.compare-filter-chip` patterns already in style.css. This is a straightforward port from inline styles to design-token-based classes.

---

### 8. Compare Page Multi-Store Side-by-Side Comparison

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| CSS Scroll Snap | CSS Scroll Snap L1 | Horizontal swipe between store columns at 375px | Already documented in v1.0 STACK.md research. 97%+ browser support. compare.html already has the skeleton markup. |
| CSS Grid + `auto-fit` | CSS Grid L2 | Multi-column layout at wider breakpoints | Already documented and partially implemented in compare-page.js. |
| CSS Custom Property `--store-count` | CSS Variables | Dynamic column count based on selected stores | Set via JS when stores are loaded. CSS uses `repeat(var(--store-count, 2), 1fr)`. |

**Current state:** compare-page.js (line 29) defines `MAX_COMPARE_STORES = 4` and already supports a multi-store picker. The page renders a day-first card stack (days as rows, one store per card). The requirement is to show stores side-by-side instead of switching between them.

**What changes:** The compare grid needs a layout mode where each store gets its own column. The v1.0 STACK.md already fully specifies the CSS (mobile scroll-snap, medium 2-up grid, wide full matrix). That CSS should now be implemented.

**JS changes in compare-page.js:**
- Fetch flavor data for ALL selected stores in parallel (currently fetches one at a time)
- Render one column per store, each column containing the day cards for that store
- Set `--store-count` CSS custom property on the grid container

**No new libraries.** All patterns were researched in v1.0 and documented in the existing STACK.md.

**Confidence:** HIGH. The CSS patterns and JS module structure are already in place from v1.0/v1.1.

---

### 9. CI Repo Structure Check Fix

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| REPO_CONTRACT.md | Markdown | Add `.planning/` to the documented repo structure | The CI check validates that the repo structure matches REPO_CONTRACT.md. The `.planning/` directory was added but not declared in the contract. |

**No stack changes.** This is a documentation fix: add `.planning/` (and any subdirectories) to REPO_CONTRACT.md's directory listing.

**Confidence:** HIGH.

---

### 10. stores.json in SW Pre-Cache

Covered in section 2 above. Add `'./stores.json'` to `STATIC_ASSETS` in `sw.js` and bump `CACHE_VERSION`.

---

## What NOT to Add for v1.2

| Technology | Why NOT | Relevant Feature |
|------------|---------|-----------------|
| **Jekyll redirect plugin** | Requires Jekyll build step. Project uses raw HTML. | Redirects |
| **Workbox (SW toolkit)** | The 95-line hand-written sw.js is simpler, lighter, and already correct. Workbox adds 20KB+ for features this project does not need (background sync, push, etc.). | SW registration |
| **ES Modules (import/export)** | Requires `type="module"` on all script tags. Changes load order semantics. Breaks SW pre-cache expectations. Not worth the disruption for a refactor. | planner-shared.js refactoring |
| **Web Worker for image generation** | Hero cone PNGs are generated at build time via Node.js, not in the browser. No need for client-side Web Workers. | Hero cone PNGs |
| **IndexedDB** | localStorage is sufficient for all persistence needs (exclusion set, store preferences). The data is simple key-value pairs, not complex queries. | Map exclusion filter |
| **CSS preprocessor (Sass/Less)** | No build step. style.css is manageable at current size (~3500 lines). | Mad Libs chips |
| **View Transitions API** | Cross-page transitions add complexity without solving a user problem in v1.2. Defer to a polish pass. | Redirects |
| **Any new CDN library** | All v1.2 features can be built with existing browser APIs and the code already in the repo. | All features |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Redirect approach | Meta refresh + JS `location.replace()` | Cloudflare Worker redirects | Worker code is out of scope for v1.2. Worker changes add deployment complexity. |
| Redirect approach | Meta refresh + JS | 404.html catch-all | Breaks direct navigation, confuses crawlers, complex URL parsing |
| JS refactoring | Split into 6 IIFEs extending `CustardPlanner` | Convert to ES modules | `type="module"` changes load behavior (deferred), requires updating all 15 HTML files, breaks SW assumptions |
| JS refactoring | Split into 6 IIFEs | Keep as monolith, just add sections | 1,639 lines is already hard to navigate. Adding more for v1.2 features (exclusion filter, multi-store compare) would push toward 2,000+ |
| Exclusion filter persistence | `localStorage` (same key as compare) | URL query params | Exclusion is a user preference, not a shareable link state. localStorage is the right persistence for preferences. |
| Quiz image layout | CSS Grid 2x2 with existing sprites | Actual photographs of custard | No photograph assets exist. Pixel-art sprites are the established visual language. Photos would clash with the design system. |
| SW pre-cache for stores.json | Add to STATIC_ASSETS | Runtime cache only | stores.json changes infrequently (new stores added monthly). Pre-caching ensures offline access for the store picker on all pages. |

## Browser Support (v1.2 Additions)

All v1.2 features use technologies already at Baseline or universally supported:

| Feature | Technology | Support | Notes |
|---------|-----------|---------|-------|
| Redirects | `<meta http-equiv="refresh">` | 100% | HTML standard since the 90s |
| Redirects | `window.location.replace()` | 100% | ES3+ |
| SW registration | Service Worker API | 97%+ | Already used on 4 pages |
| JS refactoring | IIFE pattern | 100% | ES3+ |
| Exclusion filter | `aria-pressed`, localStorage | 100% | Already used |
| Quiz images | CSS Grid | 97%+ | Already used |
| Mad Libs chips | CSS classes, design tokens | 97%+ | Already used |
| Multi-store compare | CSS Scroll Snap, Grid | 97%+ | Already researched in v1.0 |
| Hero cone PNGs | sharp 0.34.x (build-time) | N/A (Node.js) | Already installed |

No new browser support risks for v1.2. Every technology is already in use or at 97%+ support.

## Installation

```bash
# Nothing new to install for frontend.
# All v1.2 features use existing browser APIs and codebase patterns.

# For hero cone PNG generation (already set up):
cd custard-calendar && npm install sharp  # if not already installed
node scripts/generate-hero-cones.mjs
```

**New files to create (all in `custard-calendar/docs/`):**

| File | Purpose | Pattern |
|------|---------|---------|
| `planner-core.js` | Core constants, utilities, brand helpers | `var CustardPlanner = (function() { ... })();` |
| `planner-store.js` | Store/localStorage management | `(function(CP) { ... })(window.CustardPlanner);` |
| `planner-telemetry.js` | Telemetry and interaction events | `(function(CP) { ... })(window.CustardPlanner);` |
| `planner-drive.js` | Drive preferences and URL state | `(function(CP) { ... })(window.CustardPlanner);` |
| `planner-flavors.js` | Flavor families and similarity | `(function(CP) { ... })(window.CustardPlanner);` |
| `planner-display.js` | Certainty, timeline, rarity, CTAs, signals, share | `(function(CP) { ... })(window.CustardPlanner);` |

**Files to modify:**

| File | Changes |
|------|---------|
| `sw.js` | Add `stores.json` to STATIC_ASSETS, bump CACHE_VERSION, add new JS files to STATIC_ASSETS |
| `style.css` | Add `.madlib-chip-group`, `.madlib-chip`, `.madlib-chip.selected` classes; add `quiz-options-grid.has-images` mobile layout; migrate `.flavor-chip.active` to `[aria-pressed="true"]` |
| `fun.html` | Add SW registration snippet |
| `updates.html` | Add SW registration snippet |
| `scoop.html` | Replace with redirect stub -> index.html |
| `radar.html` | Replace with redirect stub -> index.html |
| `calendar.html` | Replace with redirect stub -> updates.html |
| `widget.html` | Replace with redirect stub -> updates.html |
| `siri.html` | Replace with redirect stub -> updates.html |
| `alerts.html` | Replace with redirect stub -> updates.html |
| `map.html` | Switch flavor family chips from inclusive to exclusive filter; add localStorage persistence |
| `compare-page.js` | Implement multi-store side-by-side grid rendering |
| `quizzes/engine.js` | Remove inline styles from Mad Libs chips; add `has-images` class for image-based quiz options |
| `worker/src/flavor-colors.js` | Add ~136 new FLAVOR_PROFILES entries |
| All HTML files loading planner-shared.js | Update `<script>` tags to load split modules instead of monolith |

## Sources

- [MDN: Service Worker Registration](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register) -- HIGH confidence
- [MDN: meta refresh](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta#http-equiv) -- HIGH confidence
- [MDN: window.location.replace()](https://developer.mozilla.org/en-US/docs/Web/API/Location/replace) -- HIGH confidence
- [MDN: aria-pressed](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-pressed) -- HIGH confidence
- [web.dev: Service Worker Registration](https://web.dev/articles/service-workers-registration) -- HIGH confidence
- [web.dev: Service Workers (PWA)](https://web.dev/learn/pwa/service-workers) -- HIGH confidence
- [sharp: Resize API (kernel options)](https://sharp.pixelplumbing.com/api-resize) -- HIGH confidence (v0.34.x, `kernel: 'nearest'` confirmed)
- [sharp npm package](https://www.npmjs.com/package/sharp) -- v0.34.5, HIGH confidence
- [GitHub Pages redirect guide](https://pasdam.github.io/blog/posts/github_pages_redirect/) -- MEDIUM confidence
- [Preserving hash and query string with redirects](https://maxchadwick.xyz/blog/preserving-the-hash-and-query-string-with-jekyll-redirects) -- MEDIUM confidence
- [Inclusive Components: Toggle Buttons](https://inclusive-components.design/toggle-button/) -- HIGH confidence
- [Josh Collinsworth: Accessible Toggle Buttons](https://joshcollinsworth.com/blog/accessible-toggle-buttons) -- MEDIUM confidence
- [Fireship: JS Modules from IIFEs to ES6](https://fireship.dev/javascript-modules-iifes-commonjs-esmodules) -- MEDIUM confidence

---

*Stack research: 2026-03-09 -- v1.2 Feature Completion & Cleanup*
