# Feature Research: v1.5 Visual Polish

**Domain:** Design system consolidation, component unification, and asset quality for a static-site custard calendar app
**Researched:** 2026-03-13
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

These are the minimum requirements for v1.5 to be meaningful. Without them, the milestone does not deliver on its "visual polish" promise.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Rarity scale unification | Two contradictory color palettes for the same concept (map popup vs. today badge) break user mental model | MEDIUM | Token consolidation | `.popup-rarity-chip.rarity-ultra-rare` uses purple (#7b1fa2) while `.rarity-badge-ultra-rare` uses pink (#fce4ec/#b71c1c). `.popup-rarity-chip.rarity-rare` uses blue (#1565c0) while `.rarity-badge-rare` uses orange (#fff3e0/#e65100). Same labels, completely different visual meaning on different pages |
| Hardcoded color elimination in CSS | ~100+ hardcoded hex values in style.css property values outside `:root` despite claiming "37 tokens fully consumed" | MEDIUM | New semantic tokens must be defined first | Error states, signal cards, confidence strips, drive dots, rarity badges all use raw hex. Each needs a semantic token name |
| .card base consistency | `.card` class exists with proper tokens but `.panel`, `.error-card`, `.compare-nudge`, `.updates-cta-card` all duplicate card-like styling with raw values | LOW | Token consolidation | Some "cards" use `background: var(--bg-surface)` correctly; others use `background: #fff` or `background: #f8f9fa` |
| Button system consolidation | Five distinct button patterns: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-search`, `.btn-retry` plus page-specific variants like `#nearby-btn`, `.btn-google`, `.btn-apple` | MEDIUM | None | `.btn-primary` (line 1504) and `.btn` (line 297) define padding, border-radius, font-weight independently with different values. `.btn-retry` uses hardcoded `#c62828` |
| Inline style elimination in compare.html | 8 inline style attributes including `style="color:#005696"` on the header h1 | LOW | Token consolidation | compare.html header uses `style="color:#005696"` when `var(--brand)` already equals `#005696` |
| Test cleanup: fix/remove dead skipped tests | 10 `test.skip` calls across 4 browser spec files | LOW | None | alerts-telemetry (1), index-calendar-preview (1), index-drive-defaults (3), radar-phase2 (4), index-drive-error-recovery (2) |
| Map pan stability test timeout fix | map-pan-stability.spec.mjs uses `expect.poll` which can timeout on slow CI | LOW | None | Test works but relies on timing-sensitive marker count assertions |

### Differentiators (Competitive Advantage)

These features go beyond maintenance and deliver visible quality improvements.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Cone rendering quality upgrade (hero tier) | Current hero tier (36x42 grid) uses flat-fill base with only 4 highlight + 3 shadow pixels. Premium tier (24x28 grid, unused) has per-pixel texture hash, scatter toppings with collision detection, and shaped pieces | HIGH | Regenerate all 94 PNGs + update 376 golden baselines | Path forward: port premium-tier rendering features into the hero-tier 36x42 grid. Larger canvas + better techniques = best outcome |
| Compare page first-load flow fix (dual store picker) | First-time visitors see two overlapping picker flows: shared nav "Find your store" AND compare page "Add stores" empty state. Two pickers, different capabilities | MEDIUM | Store manifest loading, shared-nav.js coordination | Shared nav picker is single-select; compare picker is multi-select. Need to coordinate so first-time visitors get one coherent "pick your stores" flow |
| Semantic state tokens | No tokens for success, warning, error, info states. Each component hardcodes its own green/yellow/red | MEDIUM | Must define before consuming | Signal cards: 5 border-left colors. Error card: `#c62828`. Toast: `#e8f4e8/#4caf50`. Confidence strips: `#005696/#f9a825/#bdbdbd/#e0e0e0`. All should map to `--state-*` tokens |
| Topping distribution coherence | Hero tier has 8 fixed positions (4 left, 4 right). Center 12 columns of the 28px-wide scoop area are topping-free. Explosion/double density modes produce predictable patterns | MEDIUM | Cone renderer refactor | Premium tier solved this with Mulberry32 PRNG scatter + collision detection. Backporting to hero grid gives unique, reproducible layouts per flavor |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Dark mode token layer | "Modern apps support dark mode" | Doubles token surface area, requires testing every component in both modes, out of scope per PROJECT.md | Ship light-only. Name tokens semantically so dark layer can be added later without renaming |
| Premium tier cone rendering | Already implemented in flavor-colors.js | Explicitly rejected in PROJECT.md ("renders poorly; not used in production yet"). 24x28 grid is smaller than hero 36x42, meaning less detail at display size | Backport premium techniques (texture hash, scatter, shapes) into the hero 36x42 grid |
| CSS preprocessor (Sass/PostCSS) | "Would make token management easier" | No build step on GitHub Pages. Adding build pipeline is disruptive and explicitly out of scope | Use CSS custom properties directly. ~50-60 tokens is manageable without tooling |
| Screenshot-based visual regression | "Catch all visual regressions automatically" | Flaky across platforms (OS fonts, GPU differences). Current pixelmatch against deterministic SVG-to-pixel rendering is far more reliable | Keep pixelmatch golden baselines for cones. Keep Playwright for DOM structure/behavior |
| Component-scoped CSS (Shadow DOM) | "Prevent style leaks" | Shadow DOM requires JS component model. CSS modules require build step. Neither works with static HTML + vanilla JS | BEM-style naming (.card, .card--hero) which project already follows |
| Responsive hero cone sizes | "Retina support" | Doubles PNG asset count to 188 | `image-rendering: pixelated` for browser scaling. Pixel art looks good at integer multiples |

## Feature Dependencies

```
[Semantic State Tokens]  <-- DEFINE FIRST
    |
    +--> [Hardcoded Color Elimination]
    |         |
    |         +--> [Rarity Scale Unification] (needs unified rarity tokens)
    |         |
    |         +--> [Inline Style Elimination] (uses new tokens)
    |         |
    |         +--> [Button System Consolidation] (error buttons need state tokens)
    |
    +--> [Card Base Consistency] (card variants use state colors)

[Cone Rendering Quality Upgrade]  <-- INDEPENDENT TRACK
    |
    +--> [PNG Regeneration] (all 94 hero PNGs must be rebuilt)
    |
    +--> [Golden Baseline Update] (376 pixelmatch tests need new baselines)
    |
    +--> [Contrast Checker Re-validation] (132 tests)

[Compare First-Load Flow Fix]  <-- INDEPENDENT (JS/UX, not CSS)
    |
    +--> [Shared Nav Picker Coordination] (shared-nav.js changes)

[Test Cleanup]  <-- FULLY INDEPENDENT
[Map Pan Stability Fix]  <-- FULLY INDEPENDENT
```

### Dependency Notes

- **Hardcoded Color Elimination requires Semantic State Tokens:** Cannot replace `background: #c62828` with `var(--state-error)` until `--state-error` exists. Tokens must come first.
- **Rarity Scale Unification requires Token Consolidation:** Two competing palettes must reconcile into one set of rarity tokens before both components can consume them.
- **Cone Rendering Quality requires full PNG Regeneration:** Any change to the hero SVG renderer invalidates all 94 PNGs and 376 golden baselines. This is atomic -- do it all at once.
- **Compare First-Load Flow is independent of design tokens:** JS/UX change, not CSS. Can parallel with token work.
- **Test Cleanup is fully independent:** No dependencies on any other feature.

## Phase Sequencing (v1.5 Implementation Order)

### Phase A: Foundations (do first)

- [ ] Define semantic state tokens (`--state-success`, `--state-warning`, `--state-error`, `--state-info` with bg/text pairs)
- [ ] Define unified rarity tokens (`--rarity-ultra-rare-bg`, `--rarity-ultra-rare-text`, etc.)
- [ ] Test cleanup: triage 10 skipped tests (remove dead, fix fixable)
- [ ] Map pan stability: add explicit waitForSelector or increase poll timeout

### Phase B: Token Consumption (do second)

- [ ] Replace ~100+ hardcoded hex values in style.css with tokens
- [ ] Unify rarity badge classes: single set consumed by map popups and today page
- [ ] Button consolidation: `.btn` base + `.btn--primary`, `.btn--secondary`, `.btn--danger` modifiers
- [ ] Card consolidation: `.panel`, `.error-card`, `.compare-nudge` extend `.card` base

### Phase C: UX and Rendering (can parallel with Phase B)

- [ ] Compare page first-load: coordinate shared nav + compare picker into single flow
- [ ] Cone rendering: backport premium techniques into hero 36x42 grid
- [ ] Regenerate 94 hero PNGs with updated renderer
- [ ] Update 376 golden baselines

### Phase D: Cleanup

- [ ] Eliminate inline styles in compare.html (8) and remaining HTML files (~77 total across 7 files)
- [ ] Final audit: grep for remaining hardcoded hex values
- [ ] SW cache version bump for new PNG assets

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Risk | Priority |
|---------|------------|---------------------|------|----------|
| Rarity scale unification | HIGH | MEDIUM | LOW | P1 |
| Semantic state tokens | MEDIUM (enables other work) | LOW | LOW | P1 |
| Hardcoded color elimination | MEDIUM (maintainability) | MEDIUM | LOW | P1 |
| Compare first-load flow | HIGH (confusing first-visit UX) | MEDIUM | MEDIUM | P1 |
| Button system consolidation | MEDIUM | MEDIUM | LOW | P1 |
| Test cleanup (skipped tests) | LOW (developer confidence) | LOW | LOW | P1 |
| Map pan stability fix | LOW (CI reliability) | LOW | LOW | P1 |
| Cone rendering quality | MEDIUM (visible improvement) | HIGH | HIGH | P2 |
| Card base consistency | LOW (mostly invisible) | LOW | LOW | P2 |
| Inline style elimination | LOW (maintenance hygiene) | LOW | LOW | P2 |

**Priority key:**
- P1: Must have for v1.5 -- addresses stated goals directly
- P2: Should have -- meaningful improvement, can defer if time-constrained

## Existing Asset Inventory

### Design Token System (37 tokens in :root)

| Category | Tokens | Status |
|----------|--------|--------|
| Brand colors | `--brand`, `--brand-dark`, `--brand-hover` | Complete |
| Text colors | `--text`, `--text-muted`, `--text-primary`, `--text-subtle`, `--text-secondary`, `--text-dim`, `--text-faint` | Overlap: `--text` and `--text-primary` both `#1a1a1a` |
| Background | `--bg`, `--bg-tint`, `--bg-surface`, `--bg-muted` | Complete |
| Border | `--border`, `--border-light`, `--border-input` | Complete |
| Typography | `--text-xs` through `--text-3xl` (8 sizes) | Complete |
| Spacing | `--space-1` through `--space-6` (6 sizes) | Complete |
| Shadows | `--shadow-sm`, `--shadow-md`, `--shadow-lg` | Complete |
| Radius | `--radius`, `--radius-lg`, `--radius-full` | Complete |
| State colors | NONE | **Gap** -- needs success/warning/error/info tokens |
| Rarity colors | NONE | **Gap** -- needs unified rarity token set |
| Signal/forecast colors | NONE | **Gap** -- signal cards, confidence strips, prediction bars all hardcoded |

### Cone Rendering Tiers (4 tiers)

| Tier | Grid | Used Where | Quality |
|------|------|------------|---------|
| Mini (standard) | 9x11 | Compare cells, multi-store rows | Functional, low-detail |
| HD | 18x22 | SVG fallback when PNG missing | Highlight, ribbon S-curve, 8 topping slots |
| Hero | 36x42 | Hero card PNG via sharp pipeline | Flat-fill base, 4 highlight + 3 shadow pixels, 8 fixed 2x2 topping slots, 9-point ribbon |
| Premium | 24x28 | **Unused in production** | Per-pixel texture hash, Mulberry32 scatter, per-piece shapes (dot/chunk/sliver), collision detection |

### Rarity Color Inconsistency (the core problem)

**Map popup palette (.popup-rarity-chip):**
| Tier | Background | Text |
|------|-----------|------|
| Ultra Rare | #7b1fa2 (purple) | #fff |
| Rare | #1565c0 (blue) | #fff |
| Uncommon | #2e7d32 (green) | #fff |
| Common | #e8f5e9 (light green) | #2e7d32 |
| Staple | #f5f5f5 (gray) | #777 |

**Today/compare palette (.rarity-badge):**
| Tier | Background | Text |
|------|-----------|------|
| Ultra Rare | #fce4ec (pink) | #b71c1c (red) |
| Rare | #fff3e0 (light orange) | #e65100 (orange) |
| Uncommon | #e3f2fd (light blue) | #1565c0 (blue) |
| Common | #f5f5f5 (gray) | #616161 (dark gray) |
| Staple | #e8f5e9 (light green) | #2e7d32 (green) |

These share zero colors between them. Unifying them is the single highest-impact token consolidation task.

### Button Variants (current, fragmented)

| Class | Padding | Radius | Background | Issues |
|-------|---------|--------|------------|--------|
| `.btn` (line 297) | `--space-3` / `--space-5` | 6px | varies | Base class not used as base for others |
| `.btn-primary` (line 1504) | `--space-3` / `--space-6` | 6px | `var(--brand)` | Different padding from `.btn` |
| `.btn-secondary` (line 1521) | `--space-3` / `1.25rem` | 6px | `var(--bg-surface)` | Raw `1.25rem` instead of token |
| `.btn-search` (line 672) | custom | custom | custom | Fully independent |
| `.btn-retry` (line 2612) | `--space-2` / `--space-5` | 4px | `#c62828` | Hardcoded color, different radius |
| `#nearby-btn` (line 146) | `--space-2` / `--space-4` | 4px | `var(--bg-surface)` | ID-scoped, not reusable |

### Skipped Tests Inventory

| File | Skip Count | What |
|------|------------|------|
| alerts-telemetry.spec.mjs | 1 | Telemetry event emission |
| index-calendar-preview.spec.mjs | 1 | Calendar preview rendering |
| index-drive-defaults.spec.mjs | 3 | GeoIP defaults, minimap pins, legacy search |
| radar-phase2.spec.mjs | 4 | Next best store, confirmed badges, percentile rarity, suppression |
| index-drive-error-recovery.spec.mjs | 2 | Error recovery scenarios |
| palette-sync.test.js | 1 | Conditional skip (custard-tidbyt directory presence) |

## Sources

### Direct codebase inspection (HIGH confidence)
- `custard-calendar/docs/style.css` -- 37 tokens in `:root`, two rarity scales at lines 956-960 and 1770-1774, ~100+ hardcoded hex values, card system at line 67, button variants at lines 297/1504/1521/2612
- `custard-calendar/docs/cone-renderer.js` -- Client-side 4-tier renderer with hero PNG fallback to HD SVG
- `custard-calendar/worker/src/flavor-colors.js` -- Server-side hero (36x42) and premium (24x28) renderers with full topping/shape/collision code
- `custard-calendar/scripts/generate-hero-cones.mjs` -- sharp pipeline at 300 DPI, nearest-neighbor resize to 144x168
- `custard-calendar/docs/compare-page.js` -- First-load flow, getSavedStoreSlugs() with primary store fallback at lines 140-146, dual picker issue
- `custard-calendar/docs/compare.html` -- 8 inline styles including hardcoded brand color
- `worker/test/browser/*.spec.mjs` -- 10 test.skip calls across 5 files

### Web research (MEDIUM confidence)
- [MDN: Crisp pixel art look with image-rendering](https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look) -- `image-rendering: pixelated` for nearest-neighbor browser scaling
- [CSS Variables Guide: Design Tokens & Theming 2025](https://www.frontendtools.tech/blog/css-variables-guide-design-tokens-theming-2025) -- Primitive/semantic/component token layers
- [The developer's guide to design tokens and CSS variables](https://penpot.app/blog/the-developers-guide-to-design-tokens-and-css-variables/) -- Token naming patterns
- [Building a Scalable CSS Architecture With BEM and Utility Classes](https://css-tricks.com/building-a-scalable-css-architecture-with-bem-and-utility-classes/) -- BEM + modifier patterns for card/button systems
- [sharp: SVG to PNG conversion](https://github.com/lovell/sharp/issues/1421) -- density parameter and nearest-neighbor kernel

---
*Feature research for: v1.5 Visual Polish milestone*
*Researched: 2026-03-13*
