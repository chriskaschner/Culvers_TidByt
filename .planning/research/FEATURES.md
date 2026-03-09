# Feature Landscape: v1.2 Feature Completion & Cleanup

**Domain:** Food discovery / daily flavor tracking / store comparison (milestone update)
**Researched:** 2026-03-09
**Scope:** New features only -- v1.2 active requirements carried forward from v1.0/v1.1

This document supplements the original v1.0 feature research with implementation-specific patterns for the 11 active requirements in v1.2. Existing validated features (Today page, Compare page basics, Fun page, navigation, design tokens) are not re-documented here.

---

## Table Stakes

Features that complete promises from earlier milestones. Missing = broken or incomplete product.

| Feature | Why Expected | Complexity | Dependencies on Existing | Notes |
|---------|--------------|------------|--------------------------|-------|
| Old page redirects preserving query params | 6 old URLs (scoop, radar, calendar, widget, siri, alerts) have been shared, bookmarked, and indexed by search engines. Broken links damage trust and SEO. Any site restructuring requires working redirects. | Low | All new destination pages must exist first (they do -- updates.html consolidates calendar/widget/siri/alerts; index.html replaces scoop) | GitHub Pages limitation: no server-side redirects. Must use JavaScript-based redirect in each old HTML file. |
| SW registered on fun.html and updates.html | Service worker currently controls index, calendar, forecast-map, quiz, widget, compare, fun, updates -- but the SW registration call is missing from fun.html and updates.html page scripts. Without it, those pages don't benefit from offline/cache capabilities, creating an inconsistent experience. | Low | Existing sw.js with STATIC_ASSETS list; fun.html and updates.html already in STATIC_ASSETS pre-cache list | Simple registration snippet addition. SW is already at root scope, so any page can register it. |
| stores.json in SW pre-cache | stores.json is fetched on every page that needs store data (map, compare, today, scoop) but is NOT in the STATIC_ASSETS pre-cache list. Users on slow/offline connections see loading failures on store-dependent pages. | Low | Existing sw.js STATIC_ASSETS array | One-line addition to STATIC_ASSETS. Must also bump CACHE_VERSION. |
| Fix CI repo structure check | CI check fails because .planning/ directory is not listed in REPO_CONTRACT.md. This blocks all PRs and is a process blocker, not a feature. | Low | REPO_CONTRACT.md file | Documentation/config fix only. |
| Push unpushed commits and verify deployment | Phase 8 commits exist locally but are not on origin/main. The live site at custard.chriskaschner.com is stale relative to local state. | Low | Git history, GitHub Pages deployment config | Operational task: git push, verify with curl smoke tests. |
| Mad Libs chip CSS definitions | Mad Libs fill_in_madlib question type renders tappable word-choice chips, but the CSS for `.madlib-chip` class is defined inline via `chip.style.cssText` in engine.js rather than in style.css. This breaks the "zero inline styles" commitment from v1.1. | Low | style.css design token system; existing inline styles in engine.js line ~442 | Extract inline styles to proper CSS classes using existing design tokens. |

## Differentiators

Features that improve the product beyond baseline expectations.

| Feature | Value Proposition | Complexity | Dependencies on Existing | Notes |
|---------|-------------------|------------|--------------------------|-------|
| Map flavor family exclusion filter with persistent state | The map page already has flavor family chips (mint, chocolate, caramel, cheesecake, turtle, cookie, peanut butter, berry, pecan) but they operate as INCLUSION filters -- selecting a family shows only that family. The v1.2 requirement is to add EXCLUSION semantics ("No Mint", "No Nuts") matching the Compare page pattern, with state persisted to localStorage across sessions. This serves dietary/allergy needs for the "driving around looking at the map" use case. | Med | map.html existing flavor-chip system (lines 66-78); Compare page exclusion pattern in compare-page.js; localStorage `custard-exclusions` key already used by Compare | Requires changing chip semantics from inclusion to exclusion, or adding a second chip row. Must decide whether to share localStorage key with Compare page. |
| Quiz image-based answer options on mobile | Current quiz options are text-only radio buttons/labels. Some questions have `icon` fields (e.g., `"icon": "pixel:drums"`, `"icon": "color:#7ecfa0"`) in the JSON schema but these are not rendered visually on mobile. Image-based answers improve engagement for personality quizzes -- BuzzFeed, Typeform, and every successful mobile quiz uses visual answer cards, not text lists. | Med | quizzes/engine.js renderQuestions function; quiz JSON schema with existing `icon` field; quizzes/sprites.js for pixel art rendering; 375px mobile constraint | Touch targets need 48x48px minimum. 2x2 grid layout for 4 options at 375px = ~170px per card with 8px gap. Must work for all 7 quiz modes. |
| Compare page multi-store side-by-side comparison | Currently Compare shows a day-first card stack where each day lists stores vertically. The requirement is true side-by-side: store columns next to each other for direct visual comparison. "Currently switches stores instead of side-by-side" per PROJECT.md. This is the core value prop of the Compare page. | High | compare-page.js (700+ lines); existing 3-day schedule extraction; store bar with add/remove; exclusion filter chips; accordion expand; 375px constraint | Hardest feature in this milestone. At 375px, 2 store columns barely fit. Need horizontal scroll for 3-4 stores. Day rows as the y-axis, store columns as x-axis. |
| Hero cone PNGs for remaining ~136 flavors | 40 flavor profiles exist with PNG hero images. The broader flavor catalog (observed across all stores historically) likely contains ~176+ unique flavors. Missing PNGs fall back to HD SVG rendering, which is functionally correct but visually inconsistent -- hero cones look different from SVG fallbacks. Full coverage means consistent visual treatment everywhere. | Med | scripts/generate-hero-cones.mjs pipeline; worker/src/flavor-colors.js FLAVOR_PROFILES; docs/assets/cones/ directory; cone-renderer.js heroConeSrc/renderHeroCone | The pipeline exists and works. The work is authoring ~136 new FLAVOR_PROFILES entries with base colors, toppings, and ribbon data, then running the generator. |
| planner-shared.js refactored from 1,624-line monolith | planner-shared.js is the foundation of every page -- loaded first, exposes `window.CustardPlanner`. At 1,639 lines, it contains 17+ logical sections (utilities, brand constants, normalization, haversine, similarity groups, flavor families, certainty tiers, timeline builder, action CTAs, reliability fetch, metrics context, drive preferences, signals, share button). Refactoring improves maintainability and allows targeted caching/loading. | High | Every HTML page loads planner-shared.js first; all other JS files depend on window.CustardPlanner; no build step constraint (IIFE pattern, vanilla JS); script load order matters in all 15 HTML pages | Most architecturally impactful change. Must not break any page. Every extraction must maintain the same `window.CustardPlanner` public API. |

## Anti-Features

Features to explicitly NOT build as part of v1.2.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| ES modules / import/export for refactoring | GitHub Pages has no build step. ES module `<script type="module">` would work but changes every script tag across 15 pages and alters load semantics (deferred by default, strict mode). The codebase convention is IIFE + `var` throughout. | Keep IIFE pattern. Extract to separate files that each add to `window.CustardPlanner` or set their own globals. Maintain backward-compatible public API. |
| Shared exclusion state between Map and Compare | Tempting to sync filter chips across pages via shared localStorage key. But Map exclusion and Compare exclusion serve different contexts: Map is "I'm browsing a large area" while Compare is "I'm comparing my saved stores." Coupling them creates surprising behavior. | Use separate localStorage keys: `custard-map-exclusions` vs existing `custard-exclusions` for Compare. Users may want different filters in different contexts. |
| Server-side redirects via Cloudflare Worker | The Worker could handle redirects, but the constraint is "no Worker code changes" for v1.2. Redirects must be client-side only. | JavaScript redirects in static HTML files on GitHub Pages. |
| Full catalog API for flavor profile authoring | Building an admin UI or automated pipeline to discover and profile unknown flavors. The 136-flavor gap exists because flavor profiles need hand-authored color/topping data. | Author profiles manually or semi-automatically using existing pattern. Each profile is ~10 lines of JSON. Batch the work. |
| Horizontal scroll comparison table | Classic comparison table with sticky left column + horizontal scroll. Tested in v1.0 research and rejected for this product -- at 375px with flavor names, cone images, and rarity badges, cells become too cramped. | Day-first card stack (current) with enhanced store columns within each day card. Or swipeable store cards per day. |

---

## Feature-by-Feature Implementation Patterns

### 1. Old Page Redirects Preserving Query Params

**What exists:** scoop.html, radar.html, calendar.html, widget.html, siri.html, alerts.html are full HTML pages that currently render their own content. They need to redirect to their new homes (index.html, compare.html, updates.html) while preserving any `?store=` or `?slug=` query parameters that may be in bookmarks or shared links.

**Expected behavior on static sites:**
- GitHub Pages cannot do HTTP 301/302 redirects. All redirect approaches are client-side.
- The standard pattern is a lightweight HTML file containing a `<meta http-equiv="refresh">` tag for no-JS fallback plus a JavaScript redirect that preserves `window.location.search` and `window.location.hash`.
- The JS redirect runs first (faster); the meta refresh is the fallback for JS-disabled browsers.
- Each old page should show a brief "Redirecting..." message for the 0-500ms before redirect fires, preventing a blank flash.

**Implementation pattern:**
```html
<script>
  // Preserve all query params and hash
  var target = 'updates.html' + window.location.search + window.location.hash;
  window.location.replace(target);
</script>
<noscript>
  <meta http-equiv="refresh" content="0; url=updates.html">
</noscript>
```

**Redirect mapping:**
| Old Page | New Destination | Rationale |
|----------|----------------|-----------|
| calendar.html | updates.html | Calendar subscription is now a section of Get Updates |
| widget.html | updates.html | Widget setup is now a section of Get Updates |
| siri.html | updates.html | Siri shortcut is now a section of Get Updates |
| alerts.html | updates.html | Alert signup is now a section of Get Updates |
| scoop.html | index.html | Scoop was the old Today's Drive, now the homepage |
| radar.html | index.html or compare.html | Radar was the 7-day outlook, closest to Compare |

**Key consideration:** These pages currently have full content, OG tags, and analytics. The redirect pages should retain the OG tags (for link previews in flight) and add a `<link rel="canonical" href="new-url">` for SEO.

**Complexity:** Low -- 6 files, same pattern, no logic.
**Confidence:** HIGH -- meta refresh + JS redirect on static sites is universally documented.

---

### 2. Map Flavor Family Exclusion Filter with Persistent State

**What exists:** map.html has a flavor family chip bar (line 66-78) with inclusion semantics -- clicking "Mint" shows only mint-family markers. The Compare page has exclusion chips that hide matching flavors. The v1.2 requirement is to bring exclusion semantics to the Map.

**Expected behavior for map exclusion filters:**
- Chips read "No Mint", "No Nuts", etc. -- exclusion framing.
- Active chips are visually distinct (filled background, contrasting text). Inactive chips are outlined/muted.
- Toggling a chip immediately updates marker visibility: excluded flavors get opacity 0.15 (the existing `applyFamilyFilter` pattern) or are hidden entirely.
- Filter state persists in localStorage so returning users see the same exclusions.
- Clear All button resets all exclusions.
- Chip bar should be horizontally scrollable on mobile if it wraps.

**Persistent state pattern:**
- Store as JSON array in `localStorage.getItem('custard-map-exclusions')`.
- On page load: read stored exclusions, set chip active states, apply filter.
- On chip toggle: update Set, save to localStorage, re-render markers.
- Same try/catch safety pattern used by Compare page's `restoreExclusions`/`saveExclusions`.

**Key design decision:** The map currently has TWO filter mechanisms: brand chips (Culver's, Kopp's, etc.) and flavor family chips. The exclusion filter replaces the current inclusion family chips. The brand chips remain as inclusion (you pick which brands to see). This creates a natural mental model: "Show me Culver's and Kopp's, but hide mint flavors."

**Complexity:** Med -- rewiring existing chip logic from inclusion to exclusion, adding localStorage persistence, ensuring marker opacity updates work with both brand and family filters simultaneously.
**Confidence:** HIGH -- pattern proven on Compare page; localStorage persistence is straightforward.

---

### 3. Quiz Image-Based Answer Options on Mobile

**What exists:** The quiz engine renders options as radio buttons with text labels. The JSON schema supports an `icon` field with two formats: `"color:#hex"` (solid color swatch) and `"pixel:name"` (pixel art sprite reference). A `sprites.js` file exists in the quizzes directory but icons are not currently rendered in the question UI.

**Expected behavior for image-based quiz options:**
- On mobile (375px), answer options display as tappable visual cards in a 2x2 grid (for 4 options) or single column (for 2-3 options).
- Each card shows: image/icon at top, text label below.
- Cards have 48x48px minimum touch targets (WCAG 2.5.8 recommends 44px minimum).
- Selected card gets a clear visual indicator (border highlight, checkmark, background change).
- Cards replace the default radio button rendering only when the question has `icon` data.
- Questions without icons continue to use the existing text-only radio layout.

**Layout at 375px:**
- 2x2 grid: `grid-template-columns: 1fr 1fr` with 8px gap = ~175px per card.
- Each card: icon area (64-80px height) + label text (1-2 lines) + padding = ~120-140px total height.
- For color-type icons: render a 48px colored circle or square.
- For pixel-type icons: render the sprite at appropriate size.

**Rendering approach:**
- Check `option.icon` in the renderQuestions loop.
- If icon starts with `"color:"`, create a colored div/circle.
- If icon starts with `"pixel:"`, use sprites.js to render the sprite art.
- If no icon, fall back to existing radio button layout.
- Use CSS grid with `@media (max-width: 480px)` for the 2x2 layout.
- On wider screens (tablet/desktop), cards can go 4-across in a single row.

**Interaction:**
- Tap selects the option (same as clicking a radio button).
- Visual feedback: border color change to quiz-accent, subtle scale animation.
- Commentary text reveals after selection (existing behavior).

**Complexity:** Med -- rendering logic is new but contained within the existing `renderQuestions` function. Main risk is ensuring all 7 quiz modes render correctly with mixed icon/no-icon questions.
**Confidence:** MEDIUM -- the icon field exists in the schema but sprites.js rendering needs verification. The 2x2 grid pattern at 375px is well-established.

---

### 4. Hero Cone PNGs for Remaining ~136 Flavors

**What exists:** A working pipeline in `scripts/generate-hero-cones.mjs` that:
1. Imports FLAVOR_PROFILES from `worker/src/flavor-colors.js`
2. Calls `renderConeHeroSVG(flavorName, 4)` to generate a 144x168px SVG
3. Uses `sharp` (or macOS `sips` fallback) to rasterize to 120px-wide PNG
4. Writes to `docs/assets/cones/{slug}.png`

Currently: 40 profiles = 40 PNGs. The remaining flavors fall back to HD SVG rendering via `renderHeroCone`'s `onerror` handler.

**Expected behavior for scaling the pipeline:**
- Each new flavor needs a FLAVOR_PROFILES entry defining: base color (custard flavor), topping slots (chips/pieces), ribbon colors (swirls), and cone colors.
- The creative work is mapping each flavor description to visual attributes. "Lemon Fresh Frozen Custard with blueberries and cake pieces" = lemon base + blueberry toppings + cake ribbon.
- The generate script runs all profiles in one batch. At 176 flavors, execution time ~30-60 seconds.
- Output PNGs are ~2-5KB each (pixel art at 120px width). 176 PNGs total = ~500KB, acceptable for the assets directory.
- PNGs are runtime-cached by the service worker (stale-while-revalidate on `/assets/cones/*.png` path).

**Scaling considerations:**
- The pipeline is embarrassingly parallel -- each flavor is independent. Could parallelize with Promise.all but sequential is fine for ~176 items.
- sharp's SVG rasterization uses `kernel: 'nearest'` for crisp pixel art. Do not change to bilinear/bicubic -- it blurs the pixel aesthetic.
- Filenames must match the `heroConeSrc` slugification: lowercase, non-alphanumeric to hyphens, trimmed. E.g., "OREO Cheesecake" -> `oreo-cheesecake.png`.
- Missing profiles still fall back to SVG. This is a graceful degradation -- the pipeline doesn't need 100% coverage to ship.

**Work breakdown:**
- Phase 1: Profile the ~20 most common flavors beyond the existing 40 (covers 90%+ of daily appearances).
- Phase 2: Profile the remaining ~116 long-tail flavors.
- Each profile is ~10 lines of JS object literal. Batch authoring is tedious but mechanical.

**Complexity:** Med -- the pipeline works; the work is authoring 136 color profiles. Each takes 2-5 minutes of creative decision-making. Total: ~5-10 hours of authoring work.
**Confidence:** HIGH -- pipeline is proven, 40 PNGs already generated successfully.

---

### 5. SW Registered on fun.html and updates.html

**What exists:** sw.js is at the root (`docs/sw.js`), registered by pages that include the registration snippet. The STATIC_ASSETS list already includes fun.html and updates.html, so they WILL be pre-cached -- but those pages don't register the SW themselves, meaning users who arrive directly on those pages (bookmark, shared link) won't get SW benefits until they visit a page that does register.

**Expected behavior for service worker registration:**
- Every page that benefits from caching should register the service worker.
- Registration is idempotent -- calling `navigator.serviceWorker.register` on a page where the SW is already active is a no-op.
- The registration snippet should be identical to what other pages use.
- Registration should happen after DOM content loads (non-blocking).

**Implementation:**
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
```

This goes in a `<script>` tag at the bottom of fun.html and updates.html, matching the pattern used by other pages.

**Also needed:** Add `stores.json` to the STATIC_ASSETS pre-cache list in sw.js and bump CACHE_VERSION from 'custard-v15' to 'custard-v16'.

**Complexity:** Low -- copy-paste registration snippet + one array entry + version bump.
**Confidence:** HIGH -- standard service worker registration pattern, already proven on other pages.

---

### 6. planner-shared.js Refactored from 1,624-Line Monolith

**What exists:** A single IIFE that exposes `window.CustardPlanner` with 30+ public methods and constants. Loaded as the first script on every page. Contains 17+ logical sections spanning utilities, brand data, normalization, geo math, flavor families, similarity groups, certainty tiers, timeline building, action CTAs, reliability fetching, metrics context, drive preferences, signal rendering, and share buttons.

**Expected behavior for IIFE-based refactoring without a build step:**
- Split into multiple files, each wrapped in its own IIFE.
- Each file either extends `window.CustardPlanner` or sets its own global.
- Script load order must be explicit in every HTML file's `<script>` tags.
- The public API surface (`CustardPlanner.normalize`, `CustardPlanner.WORKER_BASE`, etc.) MUST NOT CHANGE. Every consumer (compare-page.js, today-page.js, todays-drive.js, map.html inline script, quiz engine, shared-nav.js) depends on these names.

**Recommended split strategy:**

| New File | Extracted Sections | Lines (approx) | Used By |
|----------|--------------------|-----------------|---------|
| `planner-core.js` | Worker URL, localStorage keys, utilities, escapeHtml, normalizeStringList, parseLegacySecondaryStores, buildStoreLookup, seasonal detection | ~150 | Every page |
| `planner-brands.js` | Brand constants, brand colors, brand display names | ~40 | Map, Compare, shared-nav |
| `planner-flavors.js` | Normalize, similarity groups, flavor families, flavor family members, getFamilyForFlavor, findSimilarFlavors | ~200 | Map, Compare, Quiz, Today |
| `planner-geo.js` | Haversine distance, geolocation helpers | ~30 | Map, Today's Drive |
| `planner-rarity.js` | Certainty tiers, certainty vocabulary, rarityLabelFromRank, certainty strip | ~100 | Compare, Today, Map popups |
| `planner-timeline.js` | Timeline builder, progressive disclosure helpers | ~80 | Radar (legacy), Today |
| `planner-ctas.js` | Action CTA helpers (directions, calendar, alert links) | ~60 | Map, Compare, Today |
| `planner-metrics.js` | Reliability fetch, historical context, signal cards, signal rendering | ~200 | Today, Map enrichment |
| `planner-preferences.js` | Drive preferences read/write, flush debounce, page unload handler | ~100 | Today's Drive, Compare |
| `planner-share.js` | Share button mount, Web Share API / clipboard fallback | ~40 | Every page with share |
| `planner-telemetry.js` | emitPageView, emitInteractionEvent | ~50 | Every page |

**Load order pattern:**
```html
<script src="planner-core.js"></script>      <!-- Must be first -->
<script src="planner-brands.js"></script>     <!-- Extends CustardPlanner -->
<script src="planner-flavors.js"></script>    <!-- Extends CustardPlanner -->
<script src="planner-geo.js"></script>        <!-- Only where needed -->
<script src="planner-rarity.js"></script>     <!-- Only where needed -->
<!-- ... page-specific scripts ... -->
```

**Extension pattern (no build step):**
```javascript
// planner-brands.js
(function() {
  'use strict';
  var CP = window.CustardPlanner;

  CP.BRAND_COLORS = { /* ... */ };
  CP.BRAND_DISPLAY = { /* ... */ };
})();
```

**Risk:** Script order bugs. If planner-flavors.js loads before planner-core.js, `window.CustardPlanner` is undefined and the page breaks silently. Mitigation: core.js must define the global first; all extensions check for its existence.

**Alternative approach (lower risk, less benefit):** Instead of splitting into 11 files, split into 3-4 logical groups: `planner-core.js` (constants + utilities), `planner-data.js` (flavors + brands + similarity), `planner-ui.js` (CTAs + signals + share + telemetry), `planner-preferences.js` (drive prefs + store management). This reduces the HTML changes needed while still breaking the monolith.

**Complexity:** High -- touching every HTML file's script tags, maintaining backward compatibility, ensuring no regressions across 15 pages.
**Confidence:** MEDIUM -- the pattern is well-understood but the risk of load-order bugs is real. Needs comprehensive testing.

---

### 7. Compare Page Multi-Store Side-by-Side Comparison

**What exists:** Compare page shows a day-first card stack: for each of 3 days, it shows a card with all stores listed vertically within that card. Users can add/remove stores (2-4 stores), see rarity badges, expand for details, and apply exclusion filters. But "currently switches stores instead of side-by-side" -- meaning you can't see two stores' flavors next to each other for the same day.

**Expected behavior for side-by-side comparison:**
- The mental model is a matrix: rows = days (Today, Tomorrow, Day After), columns = stores.
- Each cell shows: flavor name, mini cone, rarity badge.
- Tapping a cell expands it to show description, directions, rarity detail.
- Store header row at top with store names + remove buttons.
- On desktop (>600px): true side-by-side columns, 2-4 stores visible.
- On mobile (375px): this is the hard part.

**Mobile layout strategies (375px):**
The product already rejected horizontal scroll comparison tables (anti-feature from v1.0 research). Three viable approaches:

1. **Day cards with inline store rows (current pattern, enhanced):** Each day card shows stores as compact horizontal items within the card. Store name left, flavor name right, cone icon. This IS side-by-side within a card, just not column-aligned across days.

2. **Swipeable store cards per day:** Each day shows the primary store's flavor. Swipe left/right to see the same day at other stores. A dot indicator shows which store is active. Less scannable but avoids cramming.

3. **Store columns with horizontal scroll:** Despite earlier rejection, a narrow variant could work: store name + cone + flavor name in ~170px columns. Two columns visible at 375px, scroll for more. Sticky day labels on the left edge.

**Recommendation:** Option 1 (enhanced day cards) because it fits the existing card stack architecture, works at 375px without horizontal scroll, and matches the mobile card pattern already tested. The enhancement is making store rows within a day card visually comparable -- same height, aligned cone/name/rarity, clear store differentiation.

**Complexity:** High -- requires rethinking the compare-page.js render logic (~700+ lines), changing the grid HTML structure, ensuring exclusion filters, accordion expand, and rarity nudges still work, all at 375px.
**Confidence:** MEDIUM -- the UX pattern is sound but the implementation is the most complex single feature in this milestone.

---

## Feature Dependencies (v1.2 specific)

```
Independent (no blockers, can start immediately):
  - Fix CI repo structure check
  - Push unpushed commits / verify deployment
  - Mad Libs chip CSS definitions
  - SW registration on fun.html and updates.html
  - stores.json in SW pre-cache

Depends on existing pages being stable:
  - Old page redirects (need destination pages to be final)

Independent but complex:
  - Map exclusion filter (self-contained in map.html)
  - Quiz image-based options (self-contained in engine.js)
  - Hero cone PNGs (self-contained pipeline + profiles)
  - Compare multi-store side-by-side (self-contained in compare-page.js)

Sequential:
  - planner-shared.js refactoring MUST happen BEFORE or AFTER other
    JS changes, not during. Refactoring the shared foundation while
    other features modify page scripts creates merge conflicts.
```

**Key ordering insight:** The planner-shared.js refactoring is the most disruptive change. It should either be the FIRST thing done (so all other features build on the new structure) or the LAST (after all other features are stable, refactor as cleanup). Doing it mid-milestone risks merge conflicts with every other JS-touching feature.

## MVP Recommendation (v1.2 specific)

### Ship first (quick wins, unblock deployment):
1. **Push unpushed commits + verify deployment** -- clears the operational backlog
2. **Fix CI repo structure check** -- unblocks PR workflow
3. **SW registration + stores.json pre-cache** -- two small changes, one sw.js update
4. **Mad Libs chip CSS definitions** -- extract inline styles to style.css

### Ship second (medium complexity, high value):
5. **Old page redirects** -- 6 files, same pattern, preserves SEO/bookmarks
6. **Map exclusion filter with persistent state** -- proven pattern from Compare, self-contained
7. **Quiz image-based answer options** -- visual upgrade, self-contained in engine.js

### Ship third (high complexity, highest effort):
8. **Compare multi-store side-by-side** -- highest-value UX improvement, most complex
9. **Hero cone PNGs for ~136 flavors** -- high volume of authoring work, can be parallelized
10. **planner-shared.js refactoring** -- last, after all other JS changes are stable

## Sources

- [Opensource.com - Redirect a GitHub Pages site](https://opensource.com/article/19/7/permanently-redirect-github-pages) -- HIGH confidence, standard meta refresh pattern
- [DEV Community - Setup a redirect on GitHub Pages](https://dev.to/steveblue/setup-a-redirect-on-github-pages-1ok7) -- HIGH confidence
- [rafgraph/spa-github-pages](https://github.com/rafgraph/spa-github-pages) -- MEDIUM confidence, SPA redirect pattern with query param preservation
- [MDN - Caching (Progressive Web Apps)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching) -- HIGH confidence, service worker pre-cache patterns
- [peerdh.com - Stale-while-revalidate in Service Workers](https://peerdh.com/blogs/programming-insights/implementing-stale-while-revalidate-cache-strategy-in-service-workers) -- MEDIUM confidence
- [sharp documentation](https://sharp.pixelplumbing.com/) -- HIGH confidence, SVG-to-PNG rasterization
- [techsparx.com - Convert SVG to PNG with Sharp](https://techsparx.com/nodejs/graphics/svg-to-png.html) -- MEDIUM confidence
- [fireship.dev - JavaScript Modules: IIFEs to ESM](https://fireship.dev/javascript-modules-iifes-commonjs-esmodules) -- MEDIUM confidence, IIFE refactoring patterns
- [DEV Community - From Monolith to Modules: Refactoring JS](https://dev.to/blamsa0mine/from-monolith-to-modules-refactoring-a-javascript-quiz-application-5cm0) -- MEDIUM confidence, directly relevant refactoring case study
- [LogRocket - Feature comparison table design](https://blog.logrocket.com/ux-design/ui-design-comparison-features/) -- MEDIUM confidence, side-by-side UI patterns
- [Smashing Magazine - Designing Filters That Work](https://www.smashingmagazine.com/2021/07/frustrating-design-patterns-broken-frozen-filters/) -- HIGH confidence, filter persistence and UX
- [Material Design 3 - Chips](https://m3.material.io/components/chips/guidelines) -- HIGH confidence, chip component patterns
- [Pencil & Paper - Mobile Filter UX Design Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-mobile-filters) -- MEDIUM confidence, mobile filter chip layout
- [Map UI Patterns - Attribute Filter](https://mapuipatterns.com/attribute-filter/) -- MEDIUM confidence, map-specific filter patterns
- [setproduct.com - Filter UI Design Tips](https://www.setproduct.com/blog/filter-ui-design) -- MEDIUM confidence, persistent filter state patterns
