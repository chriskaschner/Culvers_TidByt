# Technology Stack: v1.5 Visual Polish

**Project:** Custard Calendar v1.5
**Researched:** 2026-03-13
**Confidence:** HIGH -- no new dependencies; all work uses existing tools and native CSS/JS capabilities

---

## Recommended Stack

### No New Dependencies Required

v1.5 is a consolidation milestone. Every feature uses the existing stack with zero new production or dev dependencies. The challenge is technique and design discipline, not tooling.

| Technology | Installed Version | Purpose | v1.5 Role |
|------------|-------------------|---------|-----------|
| Vanilla JS | ES5 (var, IIFEs) in `docs/`; ES modules in `worker/` | Client-side rendering, page logic | Modify cone renderer geometry (worker-side), compare-page.js init flow (client-side) |
| CSS custom properties | Native | Design token system | Add ~25 semantic tokens to :root, replace ~216 hardcoded hex values across 3833-line style.css |
| `color-mix()` | Native (Baseline since May 2023) | Derived color generation | Generate hover/active/disabled states from semantic tokens. Already in use in quiz.html (5 instances) |
| `image-rendering: pixelated` | Native (Baseline since Jan 2020) | Crisp pixel art display | Already applied on `.mini-cone` and `.hero-cone-img` in style.css |
| sharp | 0.33.5 (via miniflare/vitest-pool-workers) | SVG-to-PNG rasterization | Regenerate 94 hero PNGs after cone renderer geometry changes |
| Pixelmatch | 7.1.0 | Visual regression testing | Regenerate 376 golden baselines after cone changes |
| pngjs | 7.0.0 | PNG buffer manipulation for pixelmatch | No changes needed |
| Playwright | 1.58.2 | Browser integration tests | New test for compare first-load; fix/remove 10 skipped tests; address map-pan-stability timeout |
| Vitest | 3.2.4 | Unit/integration tests, golden baseline runner | Run regenerated golden baselines |
| wrangler | 4.67.0 | Cloudflare Worker dev/deploy | No changes (Worker is out of scope) |

### Constraints (Inherited, Non-Negotiable)

| Constraint | Impact on v1.5 |
|------------|----------------|
| No build step (GitHub Pages) | All CSS changes go directly in `style.css`. No PostCSS, no Sass, no token transformation pipeline. |
| Vanilla JS (var, IIFEs) in `docs/` | Cone renderer client-side code and compare-page.js stay ES5. No arrow functions, no const/let, no template literals. Worker-side `flavor-colors.js` uses ES modules freely. |
| No frameworks | Button/card system is pure CSS classes. No component library. |
| 4-file palette sync gate | Cone color changes must stay in sync across `flavor-colors.js`, `cone-renderer.js`, `flavor-audit.html`, `culvers_fotd.star`. CI gate catches drift. Design tokens are CSS-only and separate from this. |
| Zero-tolerance pixelmatch | Any pixel diff in 376 golden baselines is a real regression. Cone renderer changes must regenerate ALL baselines atomically via `npm run bless:cones`. |

---

## Specific Techniques by Feature

### 1. Compare Page First-Load Flow Fix

**Problem:** First-time visitors to compare.html see an empty state with an "Add stores" button. The shared nav already geolocates and sets a primary store, but the compare page requires at least 1 store in its own `custard:compare:stores` localStorage key (separate from the Today page's store).

**Stack needed:** No new tools. This is a JS logic change in `compare-page.js` to detect when `custard:compare:stores` is empty but the shared nav has geolocated a store, and seed the compare store list from that. The `sharednav:storechange` CustomEvent bridge (already used by Today and index pages) provides the integration point.

**Technique:** Listen for `sharednav:storechange` in the compare page init path. If compare stores list is empty and a store event fires, auto-populate with that store. This matches the v1.4 pattern where `MIN_COMPARE_STORES` was lowered to 1 specifically to support single-store initialization.

**Confidence:** HIGH -- uses existing event system and initialization patterns.

### 2. Design Token Consolidation

#### Current State

The `:root` block has 37 tokens. But ~216 raw hex values remain hardcoded in `style.css` because:

- Two divergent rarity color scales (`.popup-rarity-chip` on map and `.rarity-badge` on today/compare) use 10 different hex pairs for the same 5 rarity levels
- Component-specific colors (`.mobile-toast`, `.cal-event-*`, `.signal-card`, brand borders) use ~40 one-off hex values
- Flavor Fronts dark-mode section (~60 dark-theme hex values) is its own visual scope
- State colors (success green `#2e7d32`, warning amber `#f57f17`, error red) appear raw in 15+ places
- Inline styles in compare.html (8 occurrences), group.html (19), privacy.html (18), and others

#### Technique: Flat Token Namespace with Naming Prefixes

Use a single expanded `:root` block with prefixed semantic tokens. No formal layer separation needed at ~60 total tokens.

```css
:root {
  /* --- Existing 37 tokens unchanged --- */

  /* Rarity -- unified scale (replaces both popup-rarity-chip and rarity-badge palettes) */
  --rarity-ultra-rare: #7b1fa2;
  --rarity-ultra-rare-bg: #f3e8ff;
  --rarity-rare: #1565c0;
  --rarity-rare-bg: #e3f2fd;
  --rarity-uncommon: #2e7d32;
  --rarity-uncommon-bg: #e8f5e9;
  --rarity-common: #616161;
  --rarity-common-bg: #f5f5f5;
  --rarity-staple: #2e7d32;
  --rarity-staple-bg: #e8f5e9;

  /* Semantic states */
  --color-success: #2e7d32;
  --color-success-bg: #e8f5e9;
  --color-warning: #f57f17;
  --color-warning-bg: #fff8e1;
  --color-error: #c00;
  --color-error-bg: #fce4ec;

  /* Interactive states */
  --btn-primary-active: color-mix(in srgb, var(--brand) 85%, #000);
  --color-disabled: color-mix(in srgb, var(--brand) 40%, var(--bg));
  --color-focus-ring: color-mix(in srgb, var(--brand) 25%, transparent);

  /* Brand borders */
  --brand-culvers: #005696;
  --brand-kopps: #000000;
  --brand-gilles: #EBCC35;
  --brand-hefners: #93BE46;
  --brand-kraverz: #CE742D;
  --brand-oscars: #BC272C;
}
```

**Rarity scale decision:** Adopt the `.popup-rarity-chip` scale (purple-blue-green-gray) because purple=legendary/ultra-rare follows the convention used in gaming and collectible rarity systems. The `.rarity-badge` scale (pink-orange-blue) is non-standard and confusing (rare=orange contradicts common convention).

**Fronts dark colors:** Scope under `.fronts-map-shell` class selector rather than `:root`. The project already uses scoped custom properties in quiz theming via `[data-quiz-mode]` attribute selectors.

```css
.fronts-map-shell {
  --fronts-bg: #101726;
  --fronts-bg-card: rgba(26, 33, 48, 0.88);
  --fronts-text: #e5ebf6;
  --fronts-text-muted: #a5b4cc;
  --fronts-accent: #7dd3fc;
}
```

**Confidence:** HIGH -- CSS custom properties and `color-mix()` have universal browser support. Project already uses both.

### 3. Card and Button System Unification

#### Cards: Current State

At least 12 card-like component classes exist: `.card` (with 4 variants), `.panel`, `.store-card`, `.day-card`, `.near-me-card`, `.drive-card`, `.today-card`, `.action-card`, `.compare-day-card`, `.signal-card`, `.error-card`, `.updates-cta-card`. Many duplicate background, border, border-radius, and shadow declarations.

**Technique:** Enforce `.card` as the base class on all card-like elements. Each component class retains only layout properties unique to it (flex direction, gap, alignment). Shared visual properties come from `.card`. Migration is gradual -- one component at a time.

```html
<!-- Before: standalone class with duplicated properties -->
<div class="near-me-card">...</div>

<!-- After: base + component-specific -->
<div class="card near-me-card">...</div>
```

#### Buttons: Current State

14 button definitions exist. Multiple are functionally `.btn-primary` with different padding:

| Button | Effectively | Difference |
|--------|-------------|------------|
| `.btn-google` | `.btn-primary` | padding: space-3 space-5, font: 0.875rem |
| `.btn-search` | `.btn-primary` | padding: space-2 space-5, radius: 4px |
| `.calendar-cta-btn` | `.btn-primary` | padding: 0.375rem space-3, font: 0.8125rem |
| fun.html inline `.btn-primary` | `.btn-primary` | padding: space-2 1.25rem, radius: var(--radius) |
| compare.html inline styles | `.btn-primary` | padding: 0.5rem 1.25rem, hardcoded #005696 |

**Technique:** Reduce to 3 core types + size modifiers:

```css
/* 3 types */
.btn-primary   { /* filled brand button */ }
.btn-secondary { /* outlined brand button */ }
.btn-ghost     { /* borderless text button */ }

/* Size modifiers */
.btn-sm { padding: var(--space-1) var(--space-3); font-size: var(--text-sm); }
.btn-md { padding: var(--space-2) var(--space-4); font-size: var(--text-base); }
.btn-lg { padding: var(--space-3) var(--space-5); font-size: var(--text-md); }

/* Block width */
.btn-block { display: block; width: 100%; }
```

**Critical cleanup:** The duplicate `.btn-primary` definition inside `fun.html` `<style>` block (lines 126-141) overrides the global definition and must be removed. The `.btn-primary` in `updates.html` `<style>` (line 75) scoped as `.cal-action a.btn-primary` can be replaced by the size modifier approach.

**Inline style elimination:** compare.html has 8 inline `style=""` attributes, including a fully inline-styled CTA button at line 73 (`style="display:inline-block;padding:0.5rem 1.25rem;background:#005696;color:white;border-radius:0.5rem;text-decoration:none;font-weight:600;"`). These must be replaced with class-based styling.

**Confidence:** HIGH -- pure CSS class consolidation. Gradual migration possible.

### 4. Cone Rendering Quality Upgrade

#### Current State

The hero cone renderer (`renderConeHeroSVG` in `worker/src/flavor-colors.js`) uses a 36x42 pixel grid at scale 4 (= 144x168px). It has:
- 22 scoop rows (rows 0-21), most spanning cols 4-31 (28px wide)
- 4 specular highlight pixels and 3 shadow pixels
- 8 fixed topping slots at cols 8-11 (left) and 22-27 (right) -- center 12 columns empty
- 9-point ribbon S-curve (cols 14-19), each segment 2px wide
- 18 cone rows (rows 22-39) with checkerboard + 2-row tip

#### Technique: Expanded Topping Distribution

**Problem:** 8 topping slots clustered at left and right edges create a "two columns of dots" look. The center scoop area is devoid of toppings.

**Fix:** Expand to 12-16 slots distributed across cols 6-29, staggered to avoid the ribbon path (cols 14-19). This is a pure data change -- only the coordinate arrays change. The rendering loop stays identical.

```javascript
// Proposed: 12 slots covering full scoop width
const _HERO_TOPPING_SLOTS_V2 = [
  [ 9,  1],  [24,  2],   // top row pair
  [ 7,  4],  [21,  4],  [27,  5],  // upper-mid
  [11,  8],  [23,  9],   // mid
  [ 6, 11],  [26, 11],   // center
  [ 9, 14],  [22, 15],   // lower-mid
  [ 7, 18],  [25, 17],   // bottom pair
];
```

**Deterministic:** No runtime randomness. Pixelmatch baselines remain stable across regenerations because the same profile always produces the same pixel layout.

#### Technique: Enhanced Scoop Depth

Expand highlight from 4 to 6-8 pixels along upper-left curve. Expand shadow from 3 to 5-6 pixels along lower-right edge. Uses existing `lightenHex(base, 0.25)` and `darkenHex(base, 0.12)` functions.

#### Technique: Shaped Topping Pieces (Optional)

Per-topping shape templates instead of uniform 2x2 squares. The premium renderer already has `_PREM_SHAPE_MAP` with this concept. Adapting to 36x42 grid requires manual visual tuning.

**Risk:** MEDIUM -- proven in premium renderer at 54x63 grid, but 36x42 offers less room for shape expression. Recommend limiting to 3-4 shape categories.

#### Sharp Pipeline: No Changes

The existing pipeline is correct:
```javascript
sharp(svgBuffer, { density: 300 })
  .resize({ width: 144, height: 168, kernel: 'nearest' })
  .png()
  .withMetadata({ density: 300 })
  .toBuffer();
```

Run: `node scripts/generate-hero-cones.mjs` to regenerate all 94 PNGs, then `npm run bless:cones` to update golden baselines.

**Confidence:** HIGH for topping distribution and depth expansion (data-only changes). MEDIUM for shaped toppings (visual tuning needed).

### 5. Test Cleanup

#### 10 Skipped Tests

| File | Count | Skip Reason | Action |
|------|-------|-------------|--------|
| `index-drive-error-recovery.spec.mjs` | 2 | CustardDrive removed from index.html in Phase 2 (TDAY-07) | DELETE -- tests validate removed feature |
| `alerts-telemetry.spec.mjs` | 1 | alerts.html is now a redirect stub to updates.html | DELETE -- page no longer exists |
| `index-drive-defaults.spec.mjs` | 3 | CustardDrive removed from index.html | DELETE -- tests validate removed feature |
| `index-calendar-preview.spec.mjs` | 1 | Calendar preview feature not implemented | DELETE or re-target to updates.html |
| `radar-phase2.spec.mjs` | 3 | Radar Phase 2 features not yet implemented | KEEP as skipped (future feature) |

**Recommendation:** Delete the 7 tests for removed features. Keep the 3 radar-phase2 skips as they test future features. This is a Playwright-only change -- no new tooling.

#### map-pan-stability Timeout

The `map-pan-stability.spec.mjs` test has a `30_000ms` default timeout (from playwright.config.mjs). The test simulates 3 repeated coordinate searches via `page.evaluate(async () => { await window.doSearch(true); })`. If the map tile loading is slow, the `expect.poll()` at line 81 can timeout.

**Fix options (no new tools needed):**
1. Increase test-specific timeout to 60s (least invasive)
2. Add `waitForLoadState('networkidle')` after goto
3. Mock the tile layer to eliminate external HTTP dependency

**Recommendation:** Option 3 (mock tiles) because it eliminates flakiness from external tile server latency. The test is about marker persistence during search cycles, not tile rendering. Playwright's `page.route()` can intercept tile requests and return a 1x1 PNG.

**Confidence:** HIGH -- all approaches use existing Playwright APIs.

---

## What NOT to Add

| Category | Do Not Add | Why |
|----------|-----------|-----|
| CSS preprocessor | Sass, PostCSS, Lightning CSS | No build step constraint. `color-mix()` covers derived colors natively. |
| Token management tool | Style Dictionary, Tokens Studio | These transform tokens at build time. No build step means no transform. |
| Component library | Tailwind, Bootstrap, Shoelace | Existing card/button system needs consolidation, not replacement. |
| CSS-in-JS | Styled Components, Emotion | No framework to host CSS-in-JS. Vanilla JS constraint. |
| Canvas/WebGL | For cone rendering | SVG rects are the natural pixel-art primitive. Canvas breaks the sharp pipeline. |
| CSS nesting | `&` selector nesting | While Baseline since Dec 2023, introducing nesting into a flat 3833-line CSS creates mixed conventions. Not worth the inconsistency. |
| Container queries | `@container` | No layout changes in v1.5. Existing `@media (max-width: 600px)` breakpoints suffice. |
| Test framework change | Cypress, Puppeteer | Playwright 1.58.2 is current and working for all 49+ browser tests. |
| Linting tool | Stylelint, ESLint | Would be valuable long-term but is tooling overhead, not v1.5 scope. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Token management | Hand-maintained :root vars | Style Dictionary | No build step. GitHub Pages serves raw CSS. |
| Rarity scale | Purple-blue-green (popup-rarity-chip) | Pink-orange-blue (rarity-badge) | Purple=legendary convention is more widely understood. |
| Card composition | Multi-class `.card .near-me-card` | Single monolithic classes | Multi-class eliminates duplication and makes consistency enforceable. |
| Button consolidation | 3 types + size modifiers | Keep all 14 definitions | 14 buttons is unmaintainable. Size modifiers cover all padding variations. |
| Topping distribution | More fixed slots (12-16 positions) | Seeded PRNG scatter | Fixed slots are deterministic; PRNG needs seed management and complicates golden baselines. |
| Scoop depth | More highlight/shadow pixels | SVG gradient fills | Gradients break pixel-art aesthetic. Discrete pixels preserve the style. |
| Fronts dark colors | Class-scoped custom properties | Global :root dark-mode tokens | Fronts is the only dark section. Scoping avoids polluting :root. |
| Map-pan test flakiness | Mock tile layer | Increase timeout | Mocking eliminates external dependency rather than just waiting longer. |
| Dead test cleanup | Delete tests for removed features | Keep all skipped | Skipped tests for deleted features add confusion and maintenance drag. |

---

## Installation

```bash
# Nothing to install. All dependencies already exist.
# Verify existing setup:
cd worker && npm test              # 1351 vitest tests + 376 golden baselines
npm run test:browser               # 49+ Playwright browser tests
node ../scripts/generate-hero-cones.mjs  # regenerate 94 hero PNGs
npm run bless:cones                # update pixelmatch golden baselines
```

---

## Sources

### Official Documentation (HIGH confidence)
- sharp 0.33.5 -- confirmed installed via `npm ls sharp` (transitive through miniflare)
- Playwright 1.58.2 -- confirmed installed via `npm ls @playwright/test`
- Vitest 3.2.4 -- confirmed installed via `npm ls vitest`
- Pixelmatch 7.1.0 + pngjs 7.0.0 -- confirmed via `npm ls pixelmatch pngjs`
- [MDN: color-mix()](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix) -- Baseline since May 2023
- [MDN: image-rendering](https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering) -- Baseline since January 2020
- [sharp resize API](https://sharp.pixelplumbing.com/api-resize/) -- `kernel: 'nearest'` for pixel-art preservation

### Direct Codebase Inspection (HIGH confidence)
- `docs/style.css`: 3833 lines, 37 tokens in :root, ~216 hardcoded hex values, 12+ card classes, 14+ button definitions
- `docs/cone-renderer.js`: 456 lines, client-side renderers (mini 9x10, HD 18x22, hero PNG lookup + fallback)
- `worker/src/flavor-colors.js`: renderConeHeroSVG at line 939, 36x42 grid, 8 topping slots, 9-point ribbon
- `scripts/generate-hero-cones.mjs`: sharp pipeline, 300 DPI + nearest-neighbor resize, 94 flavors
- `docs/compare-page.js`: IIFE with MIN_COMPARE_STORES=1, separate localStorage key, sharednav:storechange bridge
- `docs/compare.html`: 8 inline style attributes, duplicate CTA with hardcoded #005696
- `docs/fun.html`: duplicate .btn-primary definition in inline `<style>` block (lines 126-141)
- `docs/updates.html`: scoped .btn-primary override in inline `<style>` (line 75)
- `docs/quiz.html`: 5 color-mix() instances confirming browser compatibility
- 10 skipped tests: 7 for removed features (delete), 3 for future radar-phase2 (keep)
- `map-pan-stability.spec.mjs`: flaky due to external tile server latency in poll assertion

### Design Token Patterns (MEDIUM confidence)
- [GitLab Design Tokens Usage Guide](https://design.gitlab.com/product-foundations/design-tokens-using/) -- semantic naming conventions
- [Imperavi: Designing Semantic Colors](https://imperavi.com/blog/designing-semantic-colors-for-your-system/) -- state color architecture
