# Architecture Patterns: v1.2 Feature Integration

**Domain:** Static site feature integration (GitHub Pages + Cloudflare Worker)
**Researched:** 2026-03-09
**Confidence:** HIGH (based on direct codebase analysis, no external APIs changing)

---

## Overview

All v1.2 features are presentation-layer changes. No Worker/API modifications are needed. The integration challenge is fitting 11 features into the existing static-site architecture without introducing a build step, breaking the IIFE global pattern, or creating service worker cache incoherence.

This document maps each feature to concrete integration points, identifies new vs. modified components, and recommends a build order that respects dependency chains.

---

## Feature Integration Maps

### 1. Old Page Redirects (scoop, radar, calendar, widget, siri, alerts)

**Problem:** GitHub Pages has no server-side redirects. The six old pages (scoop.html, radar.html, calendar.html, widget.html, siri.html, alerts.html) need to redirect to new locations while preserving query parameters.

**Integration Pattern: Client-Side Meta Refresh + JS Redirect**

GitHub Pages supports exactly three redirect mechanisms:
1. **`<meta http-equiv="refresh">`** -- works without JS, no query param forwarding
2. **Inline JS redirect** -- preserves `window.location.search`
3. **Jekyll `redirect_from` plugin** -- not available on GitHub Pages without build step

Use a combined approach: a `<meta>` tag for no-JS fallback, and an inline `<script>` that forwards query params.

**Component Changes:**

| File | Change | Type |
|------|--------|------|
| `scoop.html` | Replace full page with redirect stub to `index.html` | MODIFY (rewrite) |
| `radar.html` | Replace full page with redirect stub to `index.html` or remove | MODIFY (rewrite) |
| `calendar.html` | Redirect stub to `updates.html` | MODIFY (rewrite) |
| `widget.html` | Redirect stub to `updates.html` | MODIFY (rewrite) |
| `siri.html` | Redirect stub to `updates.html` | MODIFY (rewrite) |
| `alerts.html` | Redirect stub to `updates.html` | MODIFY (rewrite) |

**Redirect Template:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=updates.html">
  <title>Redirecting...</title>
  <script>
    (function() {
      var target = 'updates.html';
      var qs = window.location.search;
      window.location.replace(target + qs);
    })();
  </script>
</head>
<body>
  <p>Redirecting to <a href="updates.html">updates</a>...</p>
</body>
</html>
```

**Redirect Mapping:**

| Old Page | Destination | Rationale |
|----------|-------------|-----------|
| `scoop.html` | `index.html` | Scoop was the old "Today's Drive" home |
| `radar.html` | `index.html` | Radar was 7-day outlook, now on index |
| `calendar.html` | `updates.html` | Calendar subscription moved to Get Updates |
| `widget.html` | `updates.html` | Widget setup moved to Get Updates |
| `siri.html` | `updates.html` | Siri setup moved to Get Updates |
| `alerts.html` | `updates.html` | Alert signup moved to Get Updates |

**Query Param Preservation:** The JS redirect appends `window.location.search` directly. The destination pages already read `URLSearchParams` -- for example, `updates.html` can accept `?slug=mt-horeb` to pre-select a store. The `scoop.html` currently accepts no meaningful params, but preserving them is zero-cost insurance.

**Service Worker Interaction:** The old page URLs are already in the SW pre-cache list (calendar.html, widget.html are listed). After the redirect rewrite, these entries still work -- the SW caches the redirect stubs. Users who have old cached versions will get the full old page until the SW updates. The `skipWaiting()` + `clients.claim()` pattern ensures the update happens on next visit. Remove old pages from `STATIC_ASSETS` in `sw.js` after redirect stubs are deployed and stable.

**Risk:** Search engines have indexed old URLs. The JS redirect is not ideal for SEO -- Google processes `<meta http-equiv="refresh" content="0">` as a 301, which is acceptable. The `content="0"` (zero delay) is treated as a permanent redirect by Google.

---

### 2. Map Flavor Family Exclusion Filter with Persistent State

**Problem:** The map page has flavor family filter chips (mint, chocolate, caramel, etc.) but they: (a) currently work as inclusion-only (highlight matching stores), (b) reset on every `refreshResults()` call, and (c) have no persistent state across page loads.

**Current Architecture:**
- `activeFamily` variable in map.html inline script (line 189)
- `applyFamilyFilter()` adjusts marker opacity (0.15 for non-matching, 1 for matching)
- `storeMatchesFamily()` uses `CustardPlanner.FLAVOR_FAMILY_MEMBERS` reverse lookup
- Filter resets to 'all' on every `refreshResults()` call (line 331-333)

**Integration Pattern: Exclusion Toggle + localStorage Persistence**

Change the chip semantics from "show only this family" to "exclude these families" (multi-select). This matches the Compare page's exclusion chip pattern (`custard-exclusions` in localStorage).

**Component Changes:**

| File | Change | Type |
|------|--------|------|
| `map.html` | Refactor `activeFamily` to `excludedFamilies: Set`, update chip click handlers, add localStorage read/write | MODIFY |
| `style.css` | Add `.flavor-chip.excluded` state (strikethrough + muted) to differentiate from `.flavor-chip.active` | MODIFY |

**Data Flow:**
```
User taps "Mint" chip
  -> toggles "mint" in excludedFamilies Set
  -> saves Set to localStorage('custard-map-excluded-families')
  -> calls applyFamilyFilter()
  -> markers with mint family get opacity 0.15
  -> results list filters out excluded family cards
```

**Persistence Key:** Use `custard-map-excluded-families` (JSON array in localStorage). Separate from `custard-exclusions` used by Compare page because the Compare exclusions are ingredient-based ("No Nuts") while Map exclusions are family-based ("Chocolate").

**State Restoration Flow:**
```
Page load
  -> read localStorage('custard-map-excluded-families')
  -> parse JSON array into excludedFamilies Set
  -> apply .excluded class to matching chip buttons
  -> applyFamilyFilter() runs after first refreshResults()
```

**Key Change:** Remove the filter reset on lines 331-333 of map.html. The family filter should persist across search refreshes -- users set exclusions once and expect them to stick as they browse the map.

---

### 3. Quiz Image-Based Answer Options on Mobile

**Problem:** Quiz answer options are currently text-only labels. On mobile, image-based options (e.g., showing cone images for "which looks most appealing?") improve engagement and reduce reading fatigue.

**Current Architecture:**
- Quiz engine `renderQuestions()` (engine.js line 330) creates `<label class="quiz-option">` elements
- Already supports `option.icon` via `window.QuizSprites.resolve(option.icon, 4)` which renders SVG sprites
- The `has-icon` class is added to labels with icons (line 502)
- Question type `multiple_choice` is the default path

**Integration Pattern: Extend Existing Icon System with Cone Renderer**

The quiz engine already has an icon slot. The gap is that `window.QuizSprites` is either undefined or only handles sprite-sheet icons. For image-based answers, connect `cone-renderer.js` (already loaded on quiz page? No -- it is NOT currently loaded on quiz.html).

**Component Changes:**

| File | Change | Type |
|------|--------|------|
| `quiz.html` | Add `<script src="cone-renderer.js"></script>` before engine.js | MODIFY |
| `quizzes/engine.js` | In multiple_choice renderer, check for `option.image_type === 'cone'` and render via `renderMiniConeSVG()` instead of QuizSprites | MODIFY |
| `quizzes/quiz-*.json` | Add `image_type: "cone"` and `image_flavor: "Mint Explosion"` fields to options that should show cone images | MODIFY |
| `style.css` or `quiz.html <style>` | Add `.quiz-option-cone` class for sizing the inline SVG at mobile-friendly dimensions | MODIFY |

**Rendering Path:**
```
For option with image_type === 'cone':
  1. Call renderMiniConeSVG(option.image_flavor, 6) for a ~48px cone
  2. Wrap in <span class="quiz-option-cone">
  3. Place before the text label inside .quiz-option-copy

For option with option.icon (existing):
  4. Existing QuizSprites path, no change

For text-only option:
  5. No change
```

**Mobile Layout:** The `.quiz-options-grid` already uses CSS grid. For image options, switch to a 2-column grid at 375px (currently text options stack vertically). Add a media query or a `.quiz-options-grid.has-images` modifier that sets `grid-template-columns: repeat(2, 1fr)`.

**Dependency:** cone-renderer.js depends on planner-shared.js (already loaded) and the `loadFlavorColors()` async init. The quiz page must call `loadFlavorColors()` before rendering questions with cone images.

---

### 4. Hero Cone PNGs for Remaining ~136 Flavors

**Problem:** The flavor catalog has ~176 flavors, but only 40 have FLAVOR_PROFILES entries in `worker/src/flavor-colors.js`. The remaining ~136 need profile entries before `generate-hero-cones.mjs` can produce their PNGs.

**Current Architecture:**
- `FLAVOR_PROFILES` object in `worker/src/flavor-colors.js` -- 40 entries
- `generate-hero-cones.mjs` in `scripts/` -- iterates FLAVOR_PROFILES, calls `renderConeHeroSVG()` at scale 4, rasterizes via `sharp` (or macOS `sips` fallback)
- Output: `docs/assets/cones/{slug}.png` at 120px width
- `cone-renderer.js` in browser falls back to SVG if no PNG exists
- SW has runtime caching for `/assets/cones/*.png` (stale-while-revalidate)

**Integration Pattern: Batch Profile Creation + Pipeline Run**

This is primarily a data entry task, not an architecture change. Each new flavor needs a `FLAVOR_PROFILES` entry with: `base`, `ribbon`, `toppings[]`, `density`.

**Component Changes:**

| File | Change | Type |
|------|--------|------|
| `worker/src/flavor-colors.js` | Add ~136 new FLAVOR_PROFILES entries | MODIFY |
| `docs/assets/cones/*.png` | ~136 new PNG files generated by pipeline | NEW |
| `scripts/generate-hero-cones.mjs` | No changes needed -- already iterates all profiles | NO CHANGE |

**Pipeline Execution:**
```bash
cd custard-calendar
node scripts/generate-hero-cones.mjs
# Output: docs/assets/cones/ will have ~176 PNGs
```

**Scaling Concern:** The pipeline processes flavors sequentially. At ~40 flavors it takes seconds; at ~176 flavors it should still complete in under a minute since each SVG render + PNG rasterization is fast (in-memory, no network). No parallelization needed.

**Storage Impact:** Current 40 PNGs total ~250KB. At ~176 PNGs, expect ~1.1MB total in `docs/assets/cones/`. This is within GitHub Pages limits (1GB soft, 100MB per file hard). The SW caches these at runtime (not pre-cached), so initial page loads are not affected.

**Data Entry Strategy:** Profile entries can be templated. Most Culver's flavors follow patterns:
- Chocolate base + toppings: `base: 'chocolate'`
- Vanilla base + flavored ribbon: `base: 'vanilla', ribbon: '[flavor]'`
- Fruit base: `base: '[fruit]'`

Use the existing flavor catalog endpoint (`/api/flavors/catalog`) to get the full list, then categorize. A helper script could generate skeleton entries from flavor names.

---

### 5. Service Worker Registration on fun.html and updates.html

**Problem:** SW is only registered on 4 pages (index.html via today-page.js, compare.html via compare-page.js, calendar.html, widget.html). fun.html and updates.html are missing SW registration.

**Current Registration Points:**
| Page | Registration Location |
|------|----------------------|
| index.html | today-page.js line 647 |
| compare.html | compare-page.js line 925 |
| calendar.html | inline script line 673 |
| widget.html | inline script line 965 |
| fun.html | **MISSING** |
| updates.html | **MISSING** |

**Integration Pattern: Add Registration to Page JS Modules**

Each page has a dedicated JS module. Add SW registration to the init functions.

**Component Changes:**

| File | Change | Type |
|------|--------|------|
| `fun-page.js` | Add SW registration in `init()` | MODIFY |
| `updates-page.js` | Add SW registration in `init()` | MODIFY |

**Registration Code (same pattern as existing):**
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(function () {});
}
```

**Why Not a Shared Registration Module?** The SW registration is a one-liner. Creating a shared module adds a script tag and a network request for minimal code reuse. The existing pattern (one-liner in each page JS) is the right trade-off for a no-build-step static site.

**Lifecycle Consideration:** SW scope is path-based. Since `sw.js` is at `docs/` root, registering from any page in `docs/` gives the same scope (`/`). Multiple registrations from different pages are idempotent -- the browser only registers once per scope.

---

### 6. planner-shared.js Refactored from 1,624-Line Monolith

**Problem:** `planner-shared.js` is a single 1,639-line IIFE containing: scoring helpers, brand constants, similarity groups, flavor families, certainty vocabulary, timeline building, reliability fetching, historical context, action CTAs, interaction events, signal cards, and share button. This makes maintenance difficult and change risk high.

**Current Architecture:**
- Single `var CustardPlanner = (function() { ... })();` IIFE
- Exposes ~50 public methods/properties on `window.CustardPlanner`
- Loaded via `<script src="planner-shared.js">` on every page
- No module system -- all consumers access `window.CustardPlanner.X`

**Integration Pattern: Extract to Separate IIFEs, Extend Shared Object**

The constraint is no build step. ES modules (`import`/`export`) are supported via `<script type="module">`, but the codebase uses `var` declarations and IIFEs. A full migration would touch every HTML page and every consuming JS file -- too large a change surface.

**Recommended Approach: Two-file extraction**

Split planner-shared.js into a core file (keeps the return object) plus 2 extension files that attach methods to the existing `window.CustardPlanner` object. This minimizes HTML changes (only pages that use the extracted features need new script tags).

**Proposed Split:**

| File | Contents | Approx Lines |
|------|----------|--------------|
| `planner-shared.js` | Core: constants, normalize, localStorage helpers, haversine, brand/flavor data, rarity/certainty helpers, drive preferences | ~900 |
| `planner-ui.js` | Timeline building, reliability fetch/banner, historical context fetch/HTML, action CTAs (directions/calendar/alert URLs + CTA HTML), share button | ~500 |
| `planner-signals.js` | Signal card HTML, fetchSignals, trackSignalViews, IntersectionObserver setup, interaction events, page view tracking | ~250 |

**Extension Pattern:**
```javascript
// planner-ui.js
(function() {
  'use strict';
  var CP = window.CustardPlanner;

  function buildTimeline(/* ... */) { /* ... */ }
  function fetchReliability(/* ... */) { /* ... */ }
  // ...

  CP.buildTimeline = buildTimeline;
  CP.fetchReliability = fetchReliability;
  CP.actionCTAsHTML = actionCTAsHTML;
  CP.initShareButton = initShareButton;
  // etc.
})();
```

**Script Loading in HTML:**
```html
<!-- Every page (no change for most pages) -->
<script src="planner-shared.js"></script>
<script src="shared-nav.js"></script>

<!-- Pages with card UIs: index.html, compare.html -->
<script src="planner-ui.js"></script>

<!-- Pages with signals: index.html -->
<script src="planner-signals.js"></script>
```

**HTML Pages Requiring Script Tag Additions:**

| Page | Needs planner-ui.js | Needs planner-signals.js |
|------|--------------------|-----------------------|
| index.html | YES | YES |
| compare.html | YES | NO |
| map.html | NO (CTAs built inline) | NO |
| fun.html | NO | NO |
| updates.html | NO | NO |
| quiz.html | NO | NO |
| Redirect stubs | NO | NO |

**Critical Constraint:** `window.CustardPlanner` must remain the single access point. The core IIFE creates the object; extension IIFEs attach to it. No new globals introduced.

**Testing Strategy:** The public API surface does not change. All existing Playwright and Python tests should pass without modification. Add a lightweight test that verifies every method in the original return object is still accessible after the split.

**Component Changes:**

| File | Change | Type |
|------|--------|------|
| `planner-shared.js` | Remove UI and signal code (~740 lines removed) | MODIFY |
| `planner-ui.js` | Timeline, reliability, historical context, CTAs, share | NEW |
| `planner-signals.js` | Signal cards, fetch, tracking, events | NEW |
| `index.html` | Add 2 script tags | MODIFY |
| `compare.html` | Add 1 script tag | MODIFY |
| `sw.js` | Add planner-ui.js and planner-signals.js to STATIC_ASSETS | MODIFY |

---

### 7. Compare Page Multi-Store Side-by-Side Comparison

**Problem:** The Compare page currently "switches stores" according to the project brief. The requirement is side-by-side comparison of 2-4 stores.

**Current Architecture Assessment:**

After code review, the multi-store comparison **already appears to be implemented**:
- `MAX_COMPARE_STORES = 4`, `MIN_COMPARE_STORES = 2`
- `getSavedStoreSlugs()` returns array of up to 4 slugs
- `loadCompareData(slugs)` fetches all stores in parallel
- `renderGrid()` renders all store rows inside each day card
- Store picker modal with search, add, and remove is implemented
- `renderStoreBar()` shows selected stores with management controls

**What may need attention:**

| Concern | Status | Action Needed |
|---------|--------|---------------|
| Day-first card stack layout | Implemented | Verify works at 375px with 4 stores |
| Store-as-columns for desktop | Not implemented | Optional: CSS grid with store columns at 768px+ |
| Empty state (0-1 stores) | Shows "Add stores" CTA | Working |
| Store add/remove UX | Picker modal with search | Working |

**If desktop column layout is desired:**

```css
@media (min-width: 768px) {
  .compare-grid-desktop {
    display: grid;
    grid-template-columns: auto repeat(var(--compare-store-count), 1fr);
    gap: var(--space-2);
  }
}
```

This would be a new render path for desktop only. Mobile keeps the current day-first card stack.

**Recommendation:** Test the existing implementation with 2-4 stores. If the day-first layout is acceptable (the PROJECT.md says "Day-first card stack for Compare" was a deliberate decision), this feature may already be complete. File as "verify and close" rather than "implement."

---

### 8. Push Unpushed Commits and Verify Deployment

Not an architecture concern. Git operation + GitHub Pages auto-deploy verification.

**Verification:** `git log --oneline origin/main..HEAD`, `git push origin main`, then smoke test all 5 primary pages via curl.

---

### 9. Fix CI Repo Structure Check

**Component Changes:**

| File | Change | Type |
|------|--------|------|
| `scripts/check_repo_structure.py` | Add `'.planning'` to `ALLOWED_DIRS` set | MODIFY |
| `REPO_CONTRACT.md` | Add `.planning/` row to Allowed Top-Level Directories table | MODIFY |

One-line fix in two files. No architecture implications.

---

### 10. Mad Libs Chip CSS Definitions

**Problem:** `.madlib-chip` and `.madlib-chip-group` classes are applied in engine.js but styled entirely via inline `style.cssText` assignments. Selected/deselected states use direct style manipulation rather than class toggling. This violates the project's CSS token pattern.

**Current State (engine.js lines 434-476):**
- Container: `chipContainer.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.5rem;...'`
- Chip: `chip.style.cssText = 'padding:0.375rem 0.875rem;border:1.5px solid #ccc;...'`
- Selected: `chip.style.background = '#005696'; chip.style.color = 'white';`
- Deselected: `chip.style.background = 'white'; chip.style.color = '#444';`

**Integration Pattern: Move to CSS Classes Using Design Tokens**

Follow the existing `.brand-chip` / `.flavor-chip` patterns (style.css lines 635-700).

**Component Changes:**

| File | Change | Type |
|------|--------|------|
| `style.css` | Add `.madlib-chip-group`, `.madlib-chip`, `.madlib-chip:hover`, `.madlib-chip.selected` rules | MODIFY |
| `quizzes/engine.js` | Remove all `style.cssText` assignments; replace inline style toggling with `classList.add/remove('selected')` | MODIFY |

**CSS Definitions:**
```css
.madlib-chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.madlib-chip {
  padding: 0.375rem 0.875rem;
  border: 1.5px solid var(--border-input);
  border-radius: var(--radius-full);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.madlib-chip:hover {
  border-color: var(--text-subtle);
}

.madlib-chip.selected {
  background: var(--brand);
  color: var(--bg-surface);
  border-color: var(--brand);
}
```

---

### 11. stores.json in SW Pre-Cache

**Problem:** `stores.json` (213KB) is fetched by multiple pages but not in the SW pre-cache list.

**Component Changes:**

| File | Change | Type |
|------|--------|------|
| `sw.js` | Add `'./stores.json'` to STATIC_ASSETS array | MODIFY |
| `sw.js` | Bump CACHE_VERSION from `custard-v15` to `custard-v16` | MODIFY |

**Cache-Bust Interaction:** Pages fetch `stores.json?v=2026-03-09` but the pre-cached URL is `./stores.json`. The SW's `caches.match()` does not match URLs with different query strings by default.

**Resolution:** Remove the `?v=` cache-bust param from all `stores.json` fetches. The SW handles freshness via stale-while-revalidate, making the manual cache-bust redundant.

**Files to Update (remove `?v=` from stores.json fetch):**

| File | Function |
|------|----------|
| `map.html` | `loadBrandStores()` |
| `compare-page.js` | `loadStores()` |
| `scoop.html` | `initScoop()` (if not already a redirect stub) |
| `shared-nav.js` | `loadStoreManifest()` |

---

## Component Boundary Diagram

```
HTML Pages (15)
  |
  |-- <script src="planner-shared.js">     (every page)
  |     -> window.CustardPlanner { core, flavor, rarity, certainty, prefs }
  |
  |-- <script src="planner-ui.js">         (index, compare)
  |     -> extends CustardPlanner { timeline, reliability, CTAs, share }
  |
  |-- <script src="planner-signals.js">    (index)
  |     -> extends CustardPlanner { signalCards, fetchSignals, events }
  |
  |-- <script src="shared-nav.js">         (every page)
  |     -> window.SharedNav { render, storeChange events }
  |
  |-- <script src="cone-renderer.js">      (index, compare, map, quiz)
  |     -> window functions { renderMiniConeSVG, loadFlavorColors }
  |
  |-- Page-specific modules:
  |     today-page.js, compare-page.js, fun-page.js,
  |     updates-page.js, quizzes/engine.js
  |
  |-- sw.js (registered from page JS modules)
  |     -> pre-caches STATIC_ASSETS incl. stores.json
  |     -> runtime-caches /assets/cones/*.png
  |
  |-- stores.json (213KB, pre-cached by SW)
  |-- assets/cones/*.png (~176 files, runtime-cached by SW)
```

---

## New vs. Modified Files Summary

### New Files

| File | Purpose | Created By Feature |
|------|---------|-------------------|
| `docs/planner-ui.js` | UI helpers extracted from monolith | #6 Refactoring |
| `docs/planner-signals.js` | Signal helpers extracted from monolith | #6 Refactoring |
| `docs/assets/cones/*.png` (~136 new) | Hero cone images | #4 PNG pipeline |

### Modified Files

| File | Features Touching It |
|------|---------------------|
| `docs/sw.js` | #3 (stores.json), #6 (new static assets), #11 (stores.json pre-cache) |
| `docs/planner-shared.js` | #6 (refactoring -- code removal) |
| `docs/style.css` | #2 (excluded chip state), #3 (quiz cone options), #10 (madlib chips) |
| `docs/map.html` | #2 (exclusion filter), #11 (remove ?v= from stores.json) |
| `docs/quizzes/engine.js` | #3 (cone image options), #10 (madlib chip CSS) |
| `docs/quiz.html` | #3 (add cone-renderer.js script tag) |
| `docs/fun-page.js` | #5 (SW registration) |
| `docs/updates-page.js` | #5 (SW registration) |
| `docs/index.html` | #6 (add planner-ui.js, planner-signals.js script tags) |
| `docs/compare.html` | #6 (add planner-ui.js script tag) |
| `docs/compare-page.js` | #11 (remove ?v= from stores.json) |
| `docs/shared-nav.js` | #11 (remove ?v= from stores.json) |
| `docs/scoop.html` | #1 (redirect stub) |
| `docs/radar.html` | #1 (redirect stub) |
| `docs/calendar.html` | #1 (redirect stub) |
| `docs/widget.html` | #1 (redirect stub) |
| `docs/siri.html` | #1 (redirect stub) |
| `docs/alerts.html` | #1 (redirect stub) |
| `scripts/check_repo_structure.py` | #9 (add .planning) |
| `REPO_CONTRACT.md` | #9 (add .planning) |
| `worker/src/flavor-colors.js` | #4 (add ~136 FLAVOR_PROFILES) |

---

## Recommended Build Order

Dependencies flow downward. Features higher in the list are prerequisites or risk-reducers for features below.

### Phase A: Foundation (no user-visible changes, reduces risk)

1. **Fix CI repo structure check** (#9) -- Unblocks CI. 2 files, 2 lines. Zero risk.
2. **Push unpushed commits** (#8) -- Establishes clean baseline. Verify deployment.
3. **stores.json in SW pre-cache** (#11) -- Touch sw.js once here, avoid multiple cache version bumps later. Also remove `?v=` cache-bust params from 4 files.

### Phase B: Cleanup (low-risk, high-value)

4. **Old page redirects** (#1) -- 6 files replaced with stubs. Low risk since old pages become trivial.
5. **Mad Libs chip CSS** (#10) -- Inline styles to style.css. Low risk, code quality improvement.
6. **SW registration on fun.html and updates.html** (#5) -- Two one-liner additions. Zero risk.

### Phase C: Core Refactoring (moderate risk)

7. **planner-shared.js refactoring** (#6) -- Extract planner-ui.js and planner-signals.js. Largest change. Must be done before adding new shared functionality. Run full Playwright suite after.

### Phase D: Feature Development (independent features, can parallelize)

8. **Map exclusion filter** (#2) -- Modify map.html inline JS. Independent of other features.
9. **Compare page multi-store verification** (#7) -- May already work. Test with 2-4 stores.
10. **Quiz image-based answers** (#3) -- Add cone-renderer.js to quiz page, modify engine.js.

### Phase E: Asset Pipeline (independent, can run in parallel)

11. **Hero cone PNGs** (#4) -- Bulk data entry in FLAVOR_PROFILES then run pipeline. Independent of all other features. Fallback (SVG rendering) works fine in the interim.

**Ordering Rationale:**
- CI fix and push first because nothing else can deploy without them
- SW changes batched early (Phase A) to minimize cache version bumps
- Redirects early because they simplify the site (fewer pages to maintain)
- Monolith refactoring before new feature work because new features add code
- Asset pipeline last because it is independent and the fallback works

---

## Anti-Patterns to Avoid

### Multiple SW Version Bumps
Bumping CACHE_VERSION in separate commits for each feature forces users to re-download all cached assets each time. Batch all SW changes (stores.json, new static assets, version bump) into a single deployment.

### Breaking the Public API During Refactoring
Splitting planner-shared.js and changing how methods are accessed would break every consuming page. Keep `window.CustardPlanner.methodName` as the sole access pattern. Extension files attach to the existing object.

### Adding Build Steps
Introducing concatenation, bundling, or transpilation violates the core constraint (static files on GitHub Pages, no build step). Use multiple `<script>` tags with deterministic load order.

### Redirect Loops
After creating redirect stubs, search all HTML for links to old page URLs (calendar.html, widget.html, siri.html, alerts.html) and update them to point to the new destinations. Navigation and footer links are the most likely sources.

### Stale Cache-Bust Params After SW Pre-Cache
If stores.json is pre-cached but fetched with `?v=date`, the SW cache miss means two copies in cache. Remove the `?v=` param from all fetch calls when adding stores.json to STATIC_ASSETS.

---

## Sources

- All findings based on direct codebase analysis of custard-calendar repository (HIGH confidence)
- GitHub Pages redirect behavior: `<meta http-equiv="refresh" content="0">` treated as permanent redirect by search engines (MEDIUM confidence -- based on documented Google crawler behavior)
- Service worker lifecycle and `caches.match()` query string behavior: Web platform specifications (HIGH confidence)
- CSS custom properties and design token patterns: observed in style.css :root block (HIGH confidence)
