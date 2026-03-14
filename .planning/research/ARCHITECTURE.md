# Architecture Patterns: v1.5 Visual Polish Integration

**Domain:** Visual polish, design system consolidation, cone rendering upgrade, UX fixes
**Researched:** 2026-03-13
**Confidence:** HIGH -- based on line-by-line codebase analysis of all affected files

## Executive Summary

The v1.5 Visual Polish milestone modifies four interconnected systems: the CSS design token layer, the card/button class hierarchy, the Compare page initialization flow, and the cone renderer pipeline. None require new files or new architectural patterns -- they refactor and harden existing structures. The critical constraint is that cone rendering changes must regenerate golden baselines (376 pixelmatch tests) and hero PNGs (94 files) in a coordinated sequence, and the 56-color palette is guarded by a CI sync gate across 4 files.

All changes stay within the existing vanilla JS IIFE pattern, static HTML/CSS on GitHub Pages, and no-build-step constraint.

## Current Architecture (What Exists)

### Component Map

| Component | File(s) | Size | Role |
|-----------|---------|------|------|
| Design tokens | `style.css` :root block | 51 CSS vars | 37 custom properties (color, spacing, typography, shadow, radius) |
| Card system | `style.css` .card + variants | ~20 rules | `.card` base + `--hero`, `--compare-day`, `--map-store`, `--quiz` modifiers |
| Button system | `style.css` scattered | 11+ variants | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-google`, `.btn-apple`, `.btn-search`, `.btn-retry`, `.calendar-cta-btn`, `.view-mode-btn`, `.compare-store-add-btn`, plus inline JS buttons |
| Cone renderer (client) | `cone-renderer.js` | 456 lines | Mini (9x11) and HD (18x22) SVG generation, hero PNG lookup + HD SVG fallback |
| Cone renderer (server) | `worker/src/flavor-colors.js` | ~1100 lines | Mini, HD, Premium (24x28), Hero (36x42) -- used by PNG pipeline and golden baselines |
| Golden baselines | `worker/test/golden-baselines.test.js` | 376 tests | Pixelmatch zero-tolerance regression across 4 tiers x 94 flavors |
| Hero PNG pipeline | `scripts/generate-hero-cones.mjs` | 122 lines | SVG-to-PNG via sharp at 300 DPI, nearest-neighbor resize to 144x168 |
| SharedNav | `shared-nav.js` | ~600 lines | Nav + store indicator + store picker + IP geolocation + footer injection |
| Compare page | `compare-page.js` | ~945 lines | Multi-store picker, day grid, exclusion filters, `sharednav:storechange` listener |
| Playwright cone tests | `worker/test/browser/vizp-cone-tiers.spec.mjs` | 5 tests | Hero PNG vs SVG fallback, Compare SVG-only, multi-store SVG-only |
| CI palette sync | `worker/test/palette-sync.test.js` | N/A | Verifies 56-color palette consistency across `cone-renderer.js`, `cone-profiles.js`, worker, CSS |

### Data Flow: Store Selection on Compare Page

```
User lands on compare.html
    |
    v
compare-page.js init()
    |
    +-- getSavedStoreSlugs()
    |     reads localStorage("custard:compare:stores")
    |     fallback: reads CustardPlanner.getPrimaryStoreSlug()
    |     fallback: returns []
    |
    +-- if slugs.length === 0 --> showState("empty")
    |     shows "Add stores" button
    |
    +-- else --> loadAndRender()
    |     loads stores.json + flavor-colors + per-store API data
    |     renders day cards with Mini SVG cones
    |
    v
SharedNav renders concurrently (DOMContentLoaded)
    |
    +-- if no saved primary store --> doIPGeolocation()
    |     finds nearest store, shows first-visit prompt
    |     user clicks "Looks good" --> setPrimaryStoreSlug()
    |     dispatches sharednav:storechange CustomEvent
    |
    +-- compare-page.js listens for sharednav:storechange
          adds new slug to compare list, re-renders
```

**The first-load problem:** When a user with no saved stores hits Compare, they see the Compare empty state AND the SharedNav first-visit prompt simultaneously. SharedNav offers geolocation, but Compare does not wait for it. The user must: (1) confirm a store in SharedNav, THEN (2) the `sharednav:storechange` event fires, THEN Compare re-renders. This is two interactions when it should be zero-to-one.

### Design Token Audit

The `:root` block defines 37 custom properties across 51 CSS variable declarations. However, there are approximately **216 hardcoded hex color values** scattered through `style.css` outside the `:root` block. Key categories:

| Category | Count | Example Values | Scope |
|----------|-------|----------------|-------|
| Rarity badge colors | 10 | `#fce4ec`, `#b71c1c`, `#fff3e0`, `#e65100`, `#e3f2fd`, `#1565c0` | `.rarity-badge-*`, `.popup-rarity-chip.*` |
| Certainty state colors | 14 | `#e8f5e9`/`#2e7d32` (confirmed), `#fff8e1`/`#f57f17` (watch), `#f0f0f0`/`#999` (estimated) | `.day-card-*`, `.day-card-badge-*`, `.confidence-strip-*` |
| Brand-per-chain accent | 6 | `.brand-culvers #005696`, `.brand-kopps #000000`, `.brand-gilles #EBCC35` | Map store cards |
| Signal type borders | 5 | `#e65100` (overdue), `#1565c0` (dow_pattern), `#2e7d32` (seasonal) | `.signal-card[data-signal-type=]` |
| Fronts dark-mode palette | ~60 | gradients, text, borders for the weather-map dark UI | `.fronts-*`, `.hotspot-*` section (lines 2140-2500+) |
| First-visit guide | 5 | `#d8e5f2`, `#3f4a56`, `#667085`, `#bfd3e8` | `.first-visit-guide`, `.quick-start-*` |
| Badge/chip backgrounds | 4 | `#e8f0fe` badge bg, `#e8f4e8` success toast | `.badge`, `.mobile-toast` |
| Calendar event preview | 8 | `#dadce0`, `#039be5`, `#5f6368`, `#1a73e8`, `#3c4043`, `#e8eaed` | `.cal-event-*` (Google Calendar-style) |
| Watch banner | 5 | `#fff8e1`, `#ffe082`, `#f57f17`, `#5d4037` | `.watch-banner*` |
| Historical context | 4 | `#d5e6f4`, `#fafdff`, `#14385f`, `#355977`, `#6a8199` | `.historical-context-*`, `.signal-*` |
| Misc one-offs | ~40 | Skeleton `#e8e8e8`, position dot `#4285f4`, nearest badge `#4285f4`, match `#2e7d32` | Scattered |

**Important scope note:** The Fronts dark-mode palette (~60 values, lines 2140-2500+) is a self-contained dark UI section. These are better served by a locally-scoped token namespace or data-attribute scope (e.g., `[data-theme="fronts-dark"]`) rather than polluting the :root block with ~60 dark-mode-only variables.

### Inline Style Inventory

| Source | File | Count | Examples |
|--------|------|-------|---------|
| HTML | `compare.html` | 8 | `style="color:#005696;font-size:1.5rem"`, `style="margin-top:1rem"` |
| HTML | `index.html` | 4 | `style="color:#005696;font-size:1.5rem"`, `style="display:inline"` |
| HTML | `group.html` | 19 | Mixed layout/color styles |
| HTML | `flavor-audit.html` | 17 | Audit page styles (lower priority) |
| HTML | `privacy.html` | 18 | Simple page styles |
| HTML | `map.html` | 6 | Leaflet integration styles |
| HTML | `forecast-map.html` | 5 | Map-specific styles |
| JS | `shared-nav.js` | 6 | Store indicator, nav button inline colors |
| JS | `compare-page.js` | 1 | Add-hint button style |
| JS | `today-page.js` | 3 | Inline bar/badge styles |
| JS | `todays-drive.js` | 1 | Drive card style |
| JS | `quizzes/sprites.js` | 2 | Sprite positioning |
| **Total** | | **90** | 77 in HTML + 13 in JS |

### Button Fragmentation

At least **11 distinct button definitions** exist, many sharing identical visual properties:

| Class | Background | Border | Used Where |
|-------|-----------|--------|------------|
| `.btn` | (base only: padding, radius, font, text-align) | none | Calendar subscribe page |
| `.btn-primary` | `var(--brand)` | none | Hero CTA, compare picker done, updates CTA |
| `.btn-secondary` | `var(--bg-surface)` | `1px solid var(--brand)` | Hero CTA alternate |
| `.btn-google` | `var(--brand)` | none | Calendar subscribe -- DUPLICATE of `.btn-primary` |
| `.btn-apple` | `var(--text)` | none | Calendar subscribe (dark button) |
| `.btn-search` | `var(--brand)` | none | Map search -- near-duplicate of `.btn-primary` |
| `.btn-retry` | (error-specific) | varies | Error retry states |
| `.calendar-cta-btn` | `#005696` (hardcoded!) | none | Calendar CTA card in today page |
| `.view-mode-btn` | `var(--bg-surface)` | none | Fronts confirmed/forecast toggle |
| `.compare-store-add-btn` | none | `1px dashed var(--border)` | Compare add store slot |
| inline in JS | `background:none;color:#005696` | none | Compare add-hint button |

`.btn-google` is literally `.btn-primary` under a different name. `.calendar-cta-btn` hardcodes `#005696` instead of using `var(--brand)`. `.btn-search` duplicates `.btn-primary` with a `width:100%` override.

### Cone Rendering Tier Architecture

```
Tier         Grid     Topping Slots  Ribbon Slots  Highlight/Shadow  Used By
---------    ------   -------------  ------------  ----------------  --------------------------------
Mini (L1)    9x11     4 fixed        3 diagonal    None              Map markers, Compare cells
HD   (L2)    18x22    8 fixed        6 S-curve     2px highlight     Hero fallback, Radar cards
Premium(L3)  24x28    scatter PRNG   band 7-point  Yes               OUT OF SCOPE (renders poorly)
Hero (L4)    36x42    8 fixed 2x2    9 S-curve     4px hl + 3px sh   Hero PNGs (rasterized via sharp)
```

**Premium tier (L3) is explicitly out of scope** per PROJECT.md: "Premium tier cone rendering -- exists but renders poorly; not used in production yet."

Rendering layer order (all tiers):
1. Base scoop fill (colored rects filling scoop geometry)
2. Depth shading -- highlight + shadow pixels (HD+ tiers only)
3. Toppings -- fixed-slot (L1/L2/L4) or seeded scatter (L3)
4. Ribbon -- rendered last, wins at pixel overlap with toppings
5. Cone checkerboard + tip

The Hero tier renders at scale=4 (144x168px SVG), rasterized at 300 DPI via sharp, then nearest-neighbor resized to 144x168px native. This preserves pixel-art crispness.

**The topping distribution issue:** At the Hero tier, 8 topping slots are placed at fixed coordinates spanning the scoop area. The slots alternate left-right (`[10,1], [22,3], [8,7], [26,8], [10,12], [24,13], [8,17], [23,18]`). For flavors with few toppings, only 1-2 of these 8 slots are filled, making the scoop look sparse. For flavors with many toppings, the fixed grid creates predictable patterns rather than organic scatter. This is the "topping distribution/coherence" issue the milestone targets.

### Skipped Test Inventory

13 `test.skip` calls across 5 Playwright browser test files:

| File | Skip Count | Test Names |
|------|-----------|------------|
| `index-drive-defaults.spec.mjs` | 3 | geoIP defaults, minimap pins, legacy store search propagation |
| `index-drive-error-recovery.spec.mjs` | 2 | Error recovery scenarios |
| `index-calendar-preview.spec.mjs` | 1 | Calendar preview render + update |
| `alerts-telemetry.spec.mjs` | 1 | Alert form telemetry events |
| `radar-phase2.spec.mjs` | 4 | Phase 2 badges, confirmed badge, rarity percentile, rarity suppression |

Additionally, 1 conditional skip in `palette-sync.test.js` for the `custard-tidbyt` directory presence check.

The "map-pan-stability timeout" issue mentioned in the milestone scope likely refers to flaky Playwright map tests that use `waitForSelector` with 10-15 second timeouts on Leaflet map marker rendering, which can race with tile loading.

### Data Flow: 4-File CI Sync Gate

```
worker/src/flavor-colors.js       (source of truth: 56 colors)
    |
    +--> docs/cone-renderer.js     (FALLBACK_BASE_COLORS, FALLBACK_TOPPING_COLORS, etc.)
    +--> cone-profiles.js          (if exists; profile data references color keys)
    +--> worker test palette check  (palette-sync.test.js verifies all 4 stay in sync)
    +--> CSS (indirect)             (cone colors are NOT CSS tokens; they live in JS objects)
```

**Key boundary:** The 56-color palette (23 base + 33 topping) lives in JavaScript objects, NOT in CSS custom properties. The CI sync gate (`palette-sync.test.js`) verifies these 4 JS files stay aligned. Design token consolidation in `style.css` does not interact with this sync gate at all -- they are separate color systems.

## Integration Points for v1.5 Changes

### 1. Design Token Expansion

**What changes:**
- Add ~20-30 semantic tokens to `:root` (state, rarity, brand-chain, signal-type)
- Replace ~80-100 hardcoded hex values in `style.css` rules with token references
- Scope decision for Fronts dark palette: either local `[data-theme="fronts"]` scope or dedicated section tokens

**Files modified:**
- `style.css` -- `:root` block expansion, scattered rule updates (~100 selectors)
- `shared-nav.js` -- replace 6 inline color strings with CSS classes
- `compare-page.js` -- replace 1 inline color string
- `today-page.js` -- replace 3 inline style assignments
- `compare.html` -- replace 8 inline style attributes
- `index.html` -- replace 4 inline style attributes

**Does NOT modify:**
- `cone-renderer.js` -- cone colors come from API/fallback JS objects, not CSS tokens
- `worker/src/flavor-colors.js` -- palette is server-side, managed by CI sync gate
- `worker/test/palette-sync.test.js` -- CSS tokens are separate from the 56-color palette

**Cascade:**
```
style.css :root changes
    |
    +---> Visual review of all 15+ pages (shared style.css)
    |
    +---> NO impact on CI palette sync gate
    |         (design tokens are CSS-only, 56-color palette is JS-only)
    |
    +---> Playwright tests may need selector updates
              if class names change (btn-google -> btn-primary)
```

**Key pattern:** New tokens MUST be additive. Do NOT rename existing 37 tokens. They are consumed across all 15 pages and referenced in JS innerHTML strings. Add new tokens, migrate hardcoded values to them, leave existing tokens in place.

### 2. Card/Button Unification

**What changes:**
- Strengthen `.btn` base class with all shared properties (display, padding, radius, font, cursor, text-align, border:none, line-height)
- Reduce button variants to: `.btn-primary` (fill), `.btn-secondary` (outline), `.btn-ghost` (text-only), `.btn-dark` (for Apple-style dark buttons)
- Remove or alias duplicates: `.btn-google` -> `.btn-primary`, `.calendar-cta-btn` -> `.btn-primary`, `.btn-search` -> `.btn-primary` + width utility
- Ensure all card-like elements derive from `.card` base
- Eliminate inline button styles in JS and HTML

**Files modified:**
- `style.css` -- button class consolidation, card variant cleanup
- `compare.html` -- remove 8 inline styles, update button classes
- `index.html` -- remove 4 inline styles
- `compare-page.js` -- remove `style.cssText` on add-hint elements
- `shared-nav.js` -- move 6 inline styles to CSS classes
- `today-page.js` -- move 3 inline styles to CSS classes
- Other HTML pages (group.html: 19, flavor-audit.html: 17, privacy.html: 18 -- lower priority)

**Does NOT modify:**
- `cone-renderer.js` -- no buttons or cards
- `worker/` -- no frontend CSS

**Cascade:**
```
style.css button changes
    |
    +---> Search ALL .js and .html files for old class names before renaming
    |         JS innerHTML strings do NOT get IDE refactoring
    |
    +---> Update HTML files using old class names
    |
    +---> Playwright tests clicking .btn-primary, .btn-google, etc.
    |
    +---> Visual review at 375px mobile width (all 4 primary nav pages)
```

### 3. Compare First-Load Fix

**What changes:**
- Compare page initialization coordinates with SharedNav's geolocation flow
- When Compare has no saved stores AND SharedNav is geolocating, Compare shows skeleton loading instead of empty state
- After geolocation resolves, the new store auto-populates Compare's store list
- Timeout-based fallback prevents indefinite loading state

**Files modified:**
- `compare-page.js` -- modify `init()` to detect first-visit state and defer to SharedNav
- Possibly `shared-nav.js` -- expose geolocation promise or add a "pending" state hook

**Interaction model:**
```
Current (broken):
  Compare: empty state shown immediately
  SharedNav: geolocation runs in parallel
  User: must confirm store THEN Compare re-renders (2 interactions)

Proposed:
  Compare: detects no saved stores + no primary store
  Compare: shows loading skeleton while SharedNav geolocates
  SharedNav: resolves nearest store, dispatches sharednav:storechange
  Compare: listens for event, auto-renders with that store (MIN_COMPARE_STORES=1)
  User: sees compare grid directly (0-1 interactions)
  Fallback: 3-second timeout -> show empty state with "Add stores" CTA
```

**Does NOT modify:**
- `cone-renderer.js`
- `style.css` (reuses existing skeleton classes)

### 4. Cone Rendering Quality Upgrade

**What changes:**
- Modify Hero tier (36x42) in `worker/src/flavor-colors.js` to improve topping distribution and coherence
- The current 8 fixed 2x2 topping slots create sparse/predictable patterns; improvements may include: more slots, variable slot sizes, or per-density slot count adjustments
- Possibly add `l4_toppings` arrays to individual FLAVOR_PROFILES for per-pixel placement at Hero tier (matching existing `l2_toppings` pattern used at Mini tier)
- Client-side `cone-renderer.js` HD tier (18x22) may get minor improvements
- Must maintain pixel art aesthetic: `shape-rendering="crispEdges"`, nearest-neighbor resize

**Files modified:**
- `worker/src/flavor-colors.js` -- rendering functions, possibly profile data
- `scripts/generate-hero-cones.mjs` -- may need dimension changes if grid size changes
- `docs/cone-renderer.js` -- HD topping/ribbon slot changes (if any)

**Files regenerated:**
- `docs/assets/cones/*.png` -- all 94 hero PNGs
- `worker/test/fixtures/goldens/**/*.png` -- all 376 golden baselines

**Cascade:**
```
flavor-colors.js change
    |
    +---> UPDATE_GOLDENS=1 npx vitest run golden-baselines.test.js
    |         regenerates 376 baseline PNGs (4 tiers x 94 flavors)
    |
    +---> npx vitest run golden-baselines.test.js
    |         verify zero-tolerance pass
    |
    +---> node scripts/generate-hero-cones.mjs
    |         regenerates 94 hero PNGs in docs/assets/cones/
    |
    +---> SW cache version bump (docs/sw.js CACHE_VERSION)
    |         ensures fresh PNG delivery to users
    |
    +---> Playwright vizp-cone-tiers tests
              verify PNG rendering on Today page, SVG fallback
```

**Critical constraint:** Rendering is deterministic (seeded PRNG). Zero-tolerance pixelmatch means ANY pixel change is detected. You cannot partially update -- all goldens and PNGs must regenerate together in a single pass.

### 5. Test Cleanup

**What changes:**
- Fix or remove 13 skipped Playwright browser tests across 5 files
- Address map-pan-stability timeout issues (flaky Leaflet marker wait selectors)
- Verify all tests pass in final state after phases 1-4

**Skipped tests by category:**
- **Fixable (broken by prior changes):** geoIP defaults, minimap pins, legacy store search, calendar preview, alerts telemetry
- **Deferred features:** radar phase 2 badges (4 tests) -- these test unshipped UI
- **Flaky:** error recovery scenarios (2 tests) -- timing-dependent

**Files modified:**
- `worker/test/browser/index-drive-defaults.spec.mjs` -- 3 skipped tests
- `worker/test/browser/index-drive-error-recovery.spec.mjs` -- 2 skipped tests
- `worker/test/browser/index-calendar-preview.spec.mjs` -- 1 skipped test
- `worker/test/browser/alerts-telemetry.spec.mjs` -- 1 skipped test
- `worker/test/browser/radar-phase2.spec.mjs` -- 4 skipped tests
- Various browser test files -- timeout hardening for Leaflet map tests

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `style.css` :root tokens | Design system source of truth for UI colors/spacing | All HTML pages, all JS that reads CSS vars |
| `style.css` .card/.btn | Visual component primitives | HTML class attributes, JS innerHTML strings |
| `cone-renderer.js` | Client-side SVG generation + hero PNG lookup | Today page, Compare page, multi-store row |
| `worker/src/flavor-colors.js` | Server-side SVG generation + FLAVOR_PROFILES data | PNG pipeline, golden baselines, CI sync gate |
| `shared-nav.js` SharedNav | Nav chrome, store selection, geolocation, footer | All pages via `#shared-nav` div, Compare via CustomEvent |
| `compare-page.js` | Compare grid, multi-store picker, exclusion filters | SharedNav via `sharednav:storechange`, cone-renderer.js globals |
| `scripts/generate-hero-cones.mjs` | Batch PNG generation | Reads flavor-colors.js, writes docs/assets/cones/ |
| `worker/test/golden-baselines.test.js` | Visual regression guard | Reads flavor-colors.js, reads/writes fixtures/goldens/ |
| `worker/test/palette-sync.test.js` | Color palette consistency guard | Reads 4 JS files for 56-color alignment |
| `docs/sw.js` | Service worker cache management | All pages; version bump forces PNG refresh |

## Recommended Build Order

The five workstreams have explicit dependencies:

```
Phase 1: Design Token Expansion (no deps, additive-only)
    |
    v
Phase 2: Card/Button Unification (uses new tokens from Phase 1)
    |
    v
Phase 3: Compare First-Load Fix (uses clean button/card classes from Phase 2)
    |
Phase 4: Cone Renderer Quality Upgrade (independent, last for git hygiene)
    |
    v
Phase 5: Test Cleanup (verifies final state across all phases)
```

**Why this order:**

1. **Tokens first** -- purely additive, non-breaking. Every subsequent phase can use the new tokens immediately. Zero risk of regression because no existing tokens are renamed or removed. Produces the foundation that all other CSS changes build on.

2. **Card/button second** -- consumes the new tokens (rarity, state, brand-chain) to replace hardcoded colors. Cleans up the class hierarchy that Compare and SharedNav both use. Must happen before Compare fix so the Compare page gets clean markup.

3. **Compare fix third** -- needs the clean button/card system and stable SharedNav contract. Touches the init() flow in compare-page.js and the sharednav:storechange interaction. Small scope (~20-30 lines in compare-page.js). Depends on card/button classes being settled.

4. **Cone renderer last** -- regenerates 470+ binary files (94 PNGs + 376 goldens) creating massive git diffs. Doing this last means those diffs do not conflict with CSS/JS changes from phases 1-3. Also the most self-contained: modify flavor-colors.js, regenerate, done.

5. **Test cleanup last** -- should verify the final state, not an intermediate one. Addresses skipped tests and the map-pan-stability timeout after all functional changes are complete. Some skipped tests may become fixable once phases 1-4 changes land.

## Patterns to Follow

### Pattern: Additive Token Expansion
**What:** Add new tokens to :root without renaming or removing existing ones.
**When:** Always, for design token changes.
```css
:root {
  /* EXISTING -- do not touch */
  --brand: #005696;
  --brand-hover: #004488;

  /* NEW semantic state tokens */
  --state-success-bg: #e8f5e9;
  --state-success-text: #2e7d32;
  --state-warning-bg: #fff8e1;
  --state-warning-text: #f57f17;
  --state-error-bg: #fce4ec;
  --state-error-text: #b71c1c;
  --state-info-bg: #e3f2fd;
  --state-info-text: #1565c0;

  /* NEW rarity scale tokens */
  --rarity-ultra-rare-bg: #fce4ec;
  --rarity-ultra-rare-text: #b71c1c;
  --rarity-rare-bg: #fff3e0;
  --rarity-rare-text: #e65100;
  --rarity-uncommon-bg: #e3f2fd;
  --rarity-uncommon-text: #1565c0;
  --rarity-common-bg: #f5f5f5;
  --rarity-common-text: #616161;
  --rarity-staple-bg: #e8f5e9;
  --rarity-staple-text: #2e7d32;

  /* NEW brand-per-chain tokens (used by map store cards) */
  --brand-culvers: #005696;
  --brand-kopps: #000000;
  --brand-gilles: #EBCC35;
  --brand-hefners: #93BE46;
  --brand-kraverz: #CE742D;
  --brand-oscars: #BC272C;
}
```

### Pattern: Button Consolidation via Base Class
**What:** Move shared properties to `.btn`, override only what differs per variant.
```css
.btn {
  display: inline-block;
  padding: var(--space-3) var(--space-5);
  border-radius: 6px;
  font-weight: 600;
  font-size: var(--text-base);
  cursor: pointer;
  text-decoration: none;
  text-align: center;
  border: none;
  line-height: 1.4;
}
.btn-primary { background: var(--brand); color: var(--bg-surface); }
.btn-primary:hover { background: var(--brand-hover); }
.btn-secondary { background: var(--bg-surface); color: var(--brand); border: 1px solid var(--brand); }
.btn-secondary:hover { background: var(--bg-muted); }
.btn-ghost { background: none; color: var(--brand); }
.btn-ghost:hover { background: var(--bg-muted); }
.btn-dark { background: var(--text); color: var(--bg-surface); }
.btn-dark:hover { background: var(--text-secondary); }
```

### Pattern: Compare Geolocation Race with Timeout
**What:** Show skeleton while awaiting SharedNav geolocation, fall back after timeout.
```javascript
// In compare-page.js init(), when no stores saved:
showState('loading');
var resolved = false;
var geoHandler = function(e) {
  if (resolved) return;
  resolved = true;
  document.removeEventListener('sharednav:storechange', geoHandler);
  if (e.detail && e.detail.slug) {
    _stores = [e.detail.slug];
    saveStoreSlugs(_stores);
    loadAndRender();
  } else {
    showState('empty');
  }
};
document.addEventListener('sharednav:storechange', geoHandler);
setTimeout(function() {
  if (!resolved) {
    resolved = true;
    document.removeEventListener('sharednav:storechange', geoHandler);
    showState('empty');
  }
}, 3000); // 3s timeout -- geoIP takes <2s normally, 8s worst case
```

### Pattern: Coordinated Cone Regeneration
**What:** Always regenerate all goldens and PNGs together after flavor-colors.js changes.
```bash
# 1. Regenerate all 376 golden baselines
cd worker && UPDATE_GOLDENS=1 npx vitest run golden-baselines.test.js

# 2. Verify they pass at zero tolerance
npx vitest run golden-baselines.test.js

# 3. Regenerate all 94 hero PNGs
cd .. && node scripts/generate-hero-cones.mjs

# 4. Bump SW cache version in docs/sw.js

# 5. Run Playwright cone tier tests
cd worker && npm run test:browser -- --grep "VIZP"
```

### Pattern: Fronts Dark Palette Scoping
**What:** Use a data-attribute scope for the ~60 Fronts-specific dark colors instead of :root tokens.
```css
/* Rather than adding 60 tokens to :root: */
[data-page="fronts"] {
  --fronts-bg: #0b111d;
  --fronts-text: #e5ebf6;
  --fronts-border: #2b3549;
  --fronts-card-bg: rgba(26, 33, 48, 0.88);
  /* ... */
}
/* Then use: */
.fronts-map-shell {
  background: var(--fronts-bg);
  border-color: var(--fronts-border);
}
```

## Anti-Patterns to Avoid

### Anti-Pattern: Token Rename Instead of Add
**What:** Renaming `--brand` to `--color-brand-primary`.
**Why bad:** Every page, every JS innerHTML string, every existing rule breaks. 37 tokens x 15 pages = massive blast radius with silent failures (unstyled elements revert to browser defaults).
**Instead:** Add new tokens alongside existing. If a naming scheme change is desired later, add aliases: `--color-brand-primary: var(--brand)`.

### Anti-Pattern: Partial Golden Regeneration
**What:** Updating only Hero tier goldens after changing shared rendering logic.
**Why bad:** Shared functions (getFlavorProfile, resolveHDToppingSlots, color lookups) affect all 4 tiers. Partial updates cause pixelmatch failures in CI.
**Instead:** Always run full `UPDATE_GOLDENS=1` after any change to flavor-colors.js.

### Anti-Pattern: CSS-Only Button Fix Without JS Audit
**What:** Renaming `.btn-google` to `.btn-primary` in style.css without checking JS files.
**Why bad:** JS innerHTML strings (shared-nav.js, compare-page.js) generate button class names. They do not get IDE refactoring and break silently.
**Instead:** Grep for every button class name in all .js and .html files before renaming. Update all references together in the same commit.

### Anti-Pattern: Compare Waiting Forever for Geolocation
**What:** Making Compare's loadAndRender() await SharedNav's geolocation promise with no timeout.
**Why bad:** Geolocation has an 8-second timeout. User stares at spinner for 8+ seconds on failure.
**Instead:** Race geolocation against a 3-second timeout, then fall back to empty state with CTA.

### Anti-Pattern: Inline Styles in New Code
**What:** Adding new `style="..."` attributes in HTML or `style.cssText = ...` in JS during refactoring.
**Why bad:** The entire point of phases 1-2 is to eliminate inline styles. Adding more during the same milestone is regressive.
**Instead:** Every visual property goes through a CSS class that uses design tokens.

### Anti-Pattern: Modifying Premium Tier
**What:** Touching the `renderConePremiumSVG` (24x28) function during this milestone.
**Why bad:** Premium tier is explicitly out of scope per PROJECT.md ("renders poorly; not used in production yet"). Changes would regenerate goldens for a tier that is not shipped, adding 94 more diffs for no user value.
**Instead:** Focus cone quality improvements on the Hero (36x42) and possibly HD (18x22) tiers only.

## New vs Modified Components

| Action | Component | Notes |
|--------|-----------|-------|
| MODIFY | `style.css` :root | Add ~20-30 new tokens (state, rarity, brand-chain, signal-type), do not rename existing |
| MODIFY | `style.css` button rules | Consolidate 11 variants to `.btn` base + 4 variants (primary, secondary, ghost, dark) |
| MODIFY | `style.css` rarity/badge rules | Replace hardcoded colors with `--rarity-*` tokens |
| MODIFY | `style.css` certainty/state rules | Replace hardcoded colors with `--state-*` tokens |
| MODIFY | `style.css` various rules | Replace ~80-100 hardcoded hex values with tokens |
| MODIFY | `compare.html` | Remove 8 inline styles, use CSS classes |
| MODIFY | `index.html` | Remove 4 inline styles, use CSS classes |
| MODIFY | `compare-page.js` | Fix init flow (geolocation race), remove 1 inline style |
| MODIFY | `shared-nav.js` | Move 6 inline styles to CSS classes |
| MODIFY | `today-page.js` | Move 3 inline styles to CSS classes |
| MODIFY | `worker/src/flavor-colors.js` | Hero tier rendering quality improvements (topping distribution) |
| MODIFY | `docs/cone-renderer.js` | Possibly HD tier improvements, mirror server topping changes |
| REGENERATE | `docs/assets/cones/*.png` | All 94 hero PNGs |
| REGENERATE | `worker/test/fixtures/goldens/**/*.png` | All 376 golden baselines |
| MODIFY | `docs/sw.js` | Cache version bump for fresh PNGs |
| NEW (test) | Playwright test for compare first-load | Verify geolocation race + auto-populate |
| MODIFY (test) | 13 skipped browser tests across 5 files | Fix or remove per test cleanup phase |
| MODIFY (test) | Map browser tests | Timeout hardening for Leaflet marker selectors |

## Sources

All findings from direct codebase analysis of the `custard-calendar/` directory:
- `docs/style.css` (~2500 lines): 37 design tokens in :root, 216 hardcoded hex values, 11 button variants, Fronts dark palette section at lines 2140+
- `docs/cone-renderer.js` (456 lines): 2 client-side tiers (Mini 9x11, HD 18x22), FALLBACK constants (56 colors), heroConeSrc + renderHeroCone
- `worker/src/flavor-colors.js` (~1100 lines): 4 server-side tiers (Mini, HD, Premium, Hero), FLAVOR_PROFILES, hero scoop/cone/topping/ribbon/highlight/shadow slot definitions at lines 849-926, rendering at lines 939-1008
- `scripts/generate-hero-cones.mjs` (122 lines): sharp pipeline, 300 DPI density, nearest-neighbor resize to 144x168
- `docs/compare-page.js` (~945 lines): IIFE module, init flow, sharednav:storechange listener, getSavedStoreSlugs, MIN_COMPARE_STORES=1
- `docs/compare.html` (~93 lines): 8 inline style attributes
- `docs/shared-nav.js` (~600 lines): 6 inline styles in JS string concatenation
- `docs/today-page.js` (~700 lines): 3 inline style assignments
- `docs/planner-shared.js` (117 lines): facade module, WORKER_BASE, core utilities
- `docs/planner-data.js` (~370 lines): BRAND_COLORS, FLAVOR_FAMILIES, normalize, haversine
- `docs/planner-domain.js` (~830 lines): certainty tiers, rarity labels, store persistence, drive prefs
- `docs/planner-ui.js` (~445 lines): telemetry, CTAs, signals, share button
- `worker/test/golden-baselines.test.js`: 376 pixelmatch tests, 4 tiers x 94 flavors, zero tolerance
- `worker/test/palette-sync.test.js`: CI sync gate for 56-color palette across 4 files
- `worker/test/helpers/render-to-pixels.js`: SVG-to-pixel-map parser for golden comparisons
- `worker/test/browser/*.spec.mjs`: 13 skipped tests across 5 files, extensive timeout usage for Leaflet maps
- `.planning/PROJECT.md`: v1.5 scope definition, Premium tier out of scope, constraints
