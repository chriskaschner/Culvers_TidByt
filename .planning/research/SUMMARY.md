# Project Research Summary

**Project:** Custard Calendar v1.5 Visual Polish
**Domain:** Design system consolidation, pixel art asset quality, and UX refinement on a static vanilla JS/CSS site
**Researched:** 2026-03-13
**Confidence:** HIGH

## Executive Summary

v1.5 is a consolidation milestone on an existing working product. There are no new dependencies, no new architectural patterns, and no new pages. The work is four parallel refactoring tracks: design token expansion (eliminating 216 hardcoded hex values from a 3833-line `style.css`), card/button CSS unification (reducing 14 button definitions to 3 base types), compare page first-load UX fix (geolocation race condition), and cone renderer quality upgrade (expanding hero tier topping density and scoop depth). All four tracks operate within a strict constraint set: no build step (GitHub Pages), vanilla JS (ES5 in `docs/`, ES modules in `worker/`), no frameworks, and zero-tolerance pixelmatch visual regression testing on 376 golden baselines covering 4 rendering tiers x 94 flavors.

The recommended approach is strict phase sequencing with all CSS/JS work completed before any cone renderer changes. Design token expansion must happen first because every subsequent phase consumes the new tokens to replace inline styles and hardcoded colors. Card/button unification follows (requires tokens), then inline style elimination, then the Compare UX fix, and finally the cone renderer upgrade in complete isolation. The cone rendering phase regenerates 470+ binary files (94 hero PNGs + 376 golden baselines), and interleaving this with CSS/JS work creates unresolvable git conflicts on binary files.

The top risks are: (1) renaming existing CSS tokens instead of adding new ones alongside them -- this breaks all 15 pages silently with no console errors because the 37 existing token names are consumed across every page, every JS innerHTML string, and all 3833 lines of `style.css`; (2) regenerating only the modified cone rendering tier instead of all four tiers after any `flavor-colors.js` change, causing CI failure because shared rendering functions cascade across tiers; (3) the Compare page blocking on SharedNav geolocation indefinitely -- SharedNav has an 8-second timeout and the UX fix must race against a 3-second compare-side timeout. All three are avoidable with explicit phase rules and targeted verification steps.

## Key Findings

### Recommended Stack

v1.5 adds zero new dependencies. All work uses CSS custom properties, `color-mix()` (baseline since May 2023, already used in quiz theming), `image-rendering: pixelated` (baseline since Jan 2020, already applied on `.hero-cone-img`), and the existing sharp/Pixelmatch/Playwright/Vitest toolchain. The key constraint is that CSS tokens must be hand-maintained in `:root` with no build-time token transformation -- Style Dictionary and similar tools are incompatible with GitHub Pages' raw-CSS serving.

**Core technologies:**
- CSS custom properties: design token system -- additive-only, never rename or remove the existing 37 tokens
- `color-mix()`: derive hover/active/disabled states from semantic tokens without introducing new raw hex values
- `image-rendering: pixelated`: already applied; enforces nearest-neighbor browser scaling for pixel art
- sharp 0.33.5 + `kernel: 'nearest'`: SVG-to-PNG at 300 DPI -- pipeline already validated, no changes needed
- Pixelmatch: zero-tolerance visual regression on 376 baselines -- full 4-tier regeneration required after any renderer change
- Playwright: new test needed for Compare first-load geolocation race; existing 40 browser specs catch button/class regressions

### Expected Features

**Must have (table stakes):**
- Consistent topping distribution across all 94 hero cone flavors -- current 8 fixed slots leave center 12 columns of scoop empty
- Rarity color scale unification -- two incompatible palettes exist for the same labels (map popups vs compare/today badges)
- Semantic state tokens (success, warning, error, disabled, focus-ring) -- currently hardcoded in 15+ places
- Compare first-load auto-populate -- geolocation already resolves a store but empty state still shows, requiring 2 user interactions
- Inline style elimination from compare.html (8 instances) and compare-page.js -- minimum viable cleanup scope

**Should have (differentiators):**
- Per-topping multi-pixel shapes at hero scale (port from premium renderer's `_PREM_SHAPE_MAP`)
- Sub-pixel texture variation on scoop base (deterministic `texHash()` approach from premium renderer)
- Expanded topping slot count (12-16 slots vs current 8) with collision detection
- Card/button system reduced from 14 button definitions to 3 base types + size modifiers
- Full inline style audit across all 11 HTML files (group.html has 19 instances)

**Defer (v2+):**
- Premium tier cone rendering in production (renders poorly; explicitly out of scope per PROJECT.md)
- Dark mode token layer (would double every color token; "ship light" policy)
- Responsive hero cone sizes / retina 2x assets (use `image-rendering: pixelated` at integer multiples instead)
- Animated cone rendering (requires sprite sheets, fights pixel art rendering)

### Architecture Approach

v1.5 is a refactoring milestone with a four-tier cone rendering architecture already in place (Mini 9x11, HD 18x22, Premium 24x28, Hero 36x42). No new components are introduced. Changes are contained to: `style.css` (tokens, card/button rules), `compare-page.js` (init flow, inline styles), `shared-nav.js` (inline styles), `worker/src/flavor-colors.js` (Hero renderer geometry), with regenerated outputs to `docs/assets/cones/` and `worker/test/fixtures/goldens/`. The Compare page communicates with SharedNav exclusively via the `sharednav:storechange` CustomEvent -- the UX fix must be a race-with-timeout pattern, not a direct promise dependency.

**Major components:**
1. `style.css` `:root` block -- design system source of truth; grows from 37 to ~60 tokens after rarity/state additions
2. `worker/src/flavor-colors.js` -- server-side Hero renderer (36x42 grid); 4-file palette sync constraint means cone colors are independent of CSS tokens
3. `compare-page.js` + `shared-nav.js` -- Compare initialization race: SharedNav dispatches `sharednav:storechange`; Compare must listen with 3-second timeout fallback, then clean up listener after first resolution
4. Golden baseline + PNG pipeline -- full coordinated regeneration (all 4 tiers + all 94 PNGs + SW cache bump) required after any renderer change; partial regeneration always fails CI

### Critical Pitfalls

1. **Token rename instead of token add** -- renaming any existing token breaks all 15 pages silently (no console errors, elements revert to browser defaults). Add new tokens only; alias if needed: `--color-brand-primary: var(--brand)`. The 37 existing names are load-bearing infrastructure.

2. **Partial golden baseline regeneration** -- any change to `flavor-colors.js` shared functions (color lookup, topping resolution, scoop geometry) affects all 4 rendering tiers. Always run `UPDATE_GOLDENS=1 npx vitest run golden-baselines.test.js` (all 376), then verify at zero tolerance, then regenerate 94 hero PNGs, then bump SW cache version -- all in the same commit.

3. **Cone changes interleaved with CSS/JS work** -- the 470+ binary file diff from cone regeneration cannot be merged with text-based CSS/JS changes. Cone phase must be last, in its own isolated commit, with no other changes in flight.

4. **Compare geolocation hang** -- SharedNav has an 8-second IP geolocation timeout. Compare must race `sharednav:storechange` against a 3-second timeout, fall back to empty state with CTA, and remove the event listener after resolution to prevent double-render.

5. **Rarity unification breaks map popups** -- two rarity color scales exist for a reason (saturated chips on dark map popup vs pastel badges on white cards). Test `.popup-rarity-chip` rarity chips on the map page after token changes, not just Compare/Today pages.

## Implications for Roadmap

Based on combined research, the phase ordering is architecturally constrained -- not arbitrary. Each phase depends on the previous one being stable.

### Phase 1: Design Token Expansion
**Rationale:** Purely additive, zero regression risk, and every subsequent phase depends on the new tokens being present. Non-negotiable first position.
**Delivers:** ~20 new CSS tokens (rarity scale unified via `--rarity-*`, semantic states via `--color-success/warning/error`, interactive states via `color-mix()`); rarity color scales converged in `:root`; Fronts dark palette scoped under `.fronts-map-shell` class
**Addresses:** 216 hardcoded hex values (partial start), two incompatible rarity color scales, missing state and interactive tokens
**Avoids:** Token rename pitfall -- additive-only policy established as phase rule #1 before any CSS is touched
**Verification:** Map popup rarity chips AND compare/today rarity badges tested after change; `grep -c 'var(--'` count does not decrease

### Phase 2: Card and Button Unification
**Rationale:** Consumes tokens from Phase 1. Cleans up the class hierarchy that Compare and SharedNav both generate via JS innerHTML -- must be stable before Phase 3 touches those files.
**Delivers:** 14 button definitions reduced to 3 base types (`.btn-primary`, `.btn-secondary`, `.btn-ghost`) + size modifiers; `.btn-google` aliased to `.btn-primary`; `.calendar-cta-btn` hardcoded `#005696` replaced; `.card` base class applied to all card-like components; all class renames audited across every `.js` file before committing
**Addresses:** Button fragmentation, `.card` base class gaps, `.btn-retry` duplication
**Avoids:** CSS-only rename without JS innerHTML audit -- grep required for every renamed class before commit; Playwright nav tests run after any SharedNav change

### Phase 3: Inline Style Elimination
**Rationale:** Can only run after tokens (Phase 1) and clean button classes (Phase 2) exist to replace the inline styles. Starting here would require inventing tokens mid-phase.
**Delivers:** compare.html 8 inline styles removed; compare-page.js `style.cssText` removed (line 797); shared-nav.js 5 inline styles moved to CSS classes (lines 153, 169-172, 572); `style=""` attribute count in compare.html reduced to zero
**Addresses:** 77 inline style attributes (minimum: compare.html and the two JS files); `#005696` and `#888`/`#ccc` hardcoded in JS strings replaced with token-based classes
**Avoids:** Adding new inline styles during elimination -- `grep -rc 'style="' docs/*.html` baseline established before phase starts

### Phase 4: Compare First-Load UX Fix
**Rationale:** Needs clean button/card markup from Phases 2-3 (the add-hint element requires a CSS class replacement of inline styles). Small scope but needs stable SharedNav contract first.
**Delivers:** Compare shows loading skeleton instead of empty state on first visit; `sharednav:storechange` race with 3-second timeout fallback auto-populates compare grid; new Playwright test with geolocate API returning 500 (verifies fallback to empty state within 3 seconds); event listener removed after first resolution
**Addresses:** Two-interaction first-load flow, empty state shown despite primary store resolving, indefinite spinner risk
**Avoids:** Infinite geolocation await; double-render from unremoved listener

### Phase 5: Cone Renderer Quality Upgrade
**Rationale:** Last among functional changes because it generates 470+ binary files. All CSS/JS committed and stable before this phase starts. The massive binary diff must be clean and isolated.
**Delivers:** Hero tier (36x42 grid) expanded from 8 to 12-16 topping slots covering full scoop width (cols 6-28 vs current 8-11 and 22-27); highlight pixels expanded from 4 to 6-8 along upper-left arc; shadow pixels expanded from 3 to 5-6 along lower-right edge; all 376 golden baselines regenerated atomically; all 94 hero PNGs regenerated; SW cache version bumped -- all in one commit
**Addresses:** Center 12 columns of scoop topping-free, "two columns of dots" look, minimal scoop depth at hero display size
**Avoids:** Partial golden regeneration; interleaving with CSS/JS (this is the final functional phase)

### Phase 6: Test Cleanup
**Rationale:** Verifies final state of the milestone, not intermediate states. Must follow all functional changes.
**Delivers:** 11 `test.skip` calls reviewed (each fixed and unskipped, or documented with permanent skip rationale); map-pan-stability.spec.mjs timeout addressed; golden baseline count confirmed at 376
**Addresses:** Dead test code, flaky timeouts, undocumented skip reasons

### Phase Ordering Rationale

- Token expansion is strictly first: all other phases consume the new tokens to replace hardcoded values
- Card/button unification precedes inline style elimination: provides the CSS classes that replace the inline styles
- Inline style elimination precedes Compare UX fix: the Compare add-hint element needs clean CSS classes before its JS can be refactored
- Compare UX fix precedes cone work: JS changes produce reviewable text diffs; cone work produces 470+ binary diffs that must not mix with text changes
- Cone work is last and isolated: binary file diffs from golden regeneration cannot coexist with in-flight CSS/JS changes
- Test cleanup is terminal: verifies the whole milestone's final state

### Research Flags

Phases with well-documented patterns (skip additional research-phase):
- **Phase 1** (Design Tokens): CSS custom property expansion is straightforward; additive-only policy eliminates regression risk; `color-mix()` already used in project
- **Phase 2** (Card/Button): Pure CSS class consolidation; `.card` base already exists at line 67; pattern is mechanical grep-and-replace with verification
- **Phase 3** (Inline Styles): Mechanical extraction; tokens from Phase 1 provide the replacements
- **Phase 5** (Cone Renderer): Coordinate array changes only; renderer logic unchanged; pipeline validated with 94 flavors

Phases that benefit from deeper review during planning:
- **Phase 4** (Compare UX): Geolocation race condition has multiple failure modes (API down, browser geolocation denied, no stores in manifest, event fires before Compare JS initializes). The 3-second timeout + event listener cleanup pattern is specified in ARCHITECTURE.md but edge cases should be prototyped and tested before writing the Playwright spec.
- **Phase 6** (Test Cleanup): The 11 `test.skip` calls need individual investigation -- causes unknown without reading each spec file.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies; all tools verified against official docs (MDN, sharp API); `color-mix()` already in use |
| Features | HIGH | All gaps identified via direct grep/inspection with verified line numbers and counts |
| Architecture | HIGH | Direct code analysis of all affected files; data flow diagrams based on actual function names and line numbers |
| Pitfalls | HIGH | All pitfalls verified against actual codebase; line numbers and file locations confirmed; counts grep-verified |

**Overall confidence:** HIGH

### Gaps to Address

- **Rarity color choice for unified scale**: Two scales exist (purple/blue/green vs pink/orange/blue). STACK.md recommends the popup-rarity-chip scale (purple = ultra-rare convention from gaming/collectibles) but this is a design decision. The token infrastructure supports either choice; pick one and test in both visual contexts.
- **Shaped topping system at hero scale**: Porting `_PREM_SHAPE_MAP` to the 36x42 grid is proven in concept (premium renderer at 24x28) but requires manual visual tuning at the smaller grid. Treat per-topping shapes as a Phase 5 stretch goal, not required scope. Start with expanded slot positions (12-16 slots, full-width distribution) and evaluate whether 2x2 squares need differentiation.
- **Full inline style elimination scope**: 77 inline styles across 11 HTML files identified. Phase 3 targets compare.html and JS files (highest priority). group.html with 19 inline styles and remaining pages are deferred to a cleanup pass -- document this boundary explicitly in the phase plan.
- **Fronts dark-mode palette**: ~60 hardcoded hex values under the Fronts visual scope. Technique is documented (class-scoped tokens under `.fronts-map-shell`) but the exact token list requires implementation-time audit of which values cluster into shared groups vs remain unique.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `docs/style.css` (3833 lines, 216 hardcoded hex values verified), `worker/src/flavor-colors.js` (~1100 lines, Hero renderer at line 939), `docs/compare-page.js` (945 lines, init at line 922), `docs/shared-nav.js` (597 lines, geolocation at line 303), `docs/compare.html` (93 lines, 8 inline style attributes), `worker/test/golden-baselines.test.js` (376 tests)
- MDN: `image-rendering` -- Baseline widely available since January 2020
- MDN: `color-mix()` -- Baseline widely available since May 2023
- sharp API docs: nearest-neighbor kernel via `kernel: 'nearest'`; 300 DPI SVG input via density option

### Secondary (MEDIUM confidence)
- GitLab Design Tokens Usage Guide -- semantic naming conventions
- Imperavi: Designing Semantic Colors -- state color architecture
- Penpot: Developer's Guide to Design Tokens -- three-layer token architecture rationale
- CSS-Tricks: Building Scalable CSS with BEM and Utility Classes -- base + modifier composition
- Smashing Magazine: Battling BEM Common Problems -- when full BEM is overkill
- Derek Yu: Pixel Art Tutorial -- sub-pixel techniques, anti-aliasing at small scales
- NN/g: Progressive Disclosure -- "show one, add more" interaction pattern for Compare first-load

---
*Research completed: 2026-03-13*
*Ready for roadmap: yes*
