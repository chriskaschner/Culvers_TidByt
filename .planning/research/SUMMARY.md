# Project Research Summary

**Project:** Custard Calendar v1.3 -- Asset Parity
**Domain:** Pixel art rendering pipeline and flavor profile data scaling
**Researched:** 2026-03-09
**Confidence:** HIGH

## Executive Summary

Custard Calendar v1.3 is a data-and-quality milestone, not a feature milestone. The core task is scaling the flavor profile system from 38 hand-authored profiles to ~176 profiles while simultaneously fixing rendering quality issues that make current SVG and PNG output look poor. The existing architecture (4-tier pixel art renderers, sharp-based PNG pipeline, static GitHub Pages hosting) is sound and does not need structural changes. The problems are: (a) a non-integer PNG scale factor that produces uneven pixel sizes, (b) color palette drift across four files that must stay synchronized, and (c) 136 flavors rendering through a generic keyword fallback instead of proper profiles.

The recommended approach is strictly sequential: fix existing rendering quality and color drift first, validate with automated tools, then batch-author new profiles. The rendering pipeline needs only parameter changes (scale 4 to 10, density 72 to 300 DPI, integer output ratio) -- no new rasterizer, no new rendering approach. Two dev dependencies (pixelmatch, pngjs) should be added for visual regression testing. All other tooling already exists. The profile scaling is a data entry problem solved by following the existing cone-profile-spec.md, expanding the color palette by ~10 base and ~10 topping colors, and adding a flavor alias map for ~20 duplicate historical names.

The key risk is coupling rendering algorithm changes with bulk profile authoring. If mixed in the same commits, regressions become impossible to isolate -- golden hash failures could be intentional quality improvements or accidental bugs. The four-file color sync requirement (flavor-colors.js, cone-renderer.js, culvers_fotd.star, flavor-audit.html) is already drifted in production with 18+ mismatched hex values and will get worse with 136 new profiles unless automated validation is in place before authoring begins. The mitigation is strict phase ordering: fix drift and rendering first, build validation tooling, then author profiles, then generate PNGs exactly once.

## Key Findings

### Recommended Stack

No new production dependencies. The existing stack (sharp 0.33.5, vanilla JS renderers, GitHub Pages static hosting) handles 176+ profiles without modification. The quality problem is in the SVG source resolution and PNG scale factor, not in the rasterizer.

**Core technologies:**
- **sharp 0.33.5** (KEEP): SVG-to-PNG rasterization. Validated, stable. Change render parameters only (scale 10, density 300, compressionLevel 9).
- **pixelmatch 6.x + pngjs 7.x** (ADD as devDeps): Visual regression testing for 176+ PNGs. Compares raw pixel buffers in ~1ms per image. Prevents undetected quality regressions during bulk profile authoring.
- **flavor-colors.js** (MODIFY data only): Single source of truth for profiles, palettes, and rendering. Grows from 825 to ~1000 lines. No structural changes.

**Pipeline parameter changes (no code changes):**
- Render scale: 4 to 10 (produces 360x420 SVG instead of 144x168)
- Output ratio: 360/120 = clean 3:1 downsample (eliminates the current non-integer 144/120 = 1.2:1 artifact)
- Density: 72 to 300 DPI for sharper edge rasterization
- PNG compression: level 9 with adaptive filtering (smaller files, same quality)

### Expected Features

**Must have (table stakes):**
- Quality audit of existing 40 profiles for contrast, density, and visual distinctiveness issues
- Profile the 2 remaining current-rotation flavors (Georgia Peach Pecan, OREO Cookies and Cream)
- Consistent Hero-tier rendering on the Today page (no mixing of Hero PNG and HD SVG quality levels)
- Regenerate all Hero PNGs after any profile or rendering fix

**Should have (differentiators):**
- Alias map for ~20 duplicate historical flavor names (reduces unprofiled count by ~20 with zero color work)
- 10 new base colors + 10 new topping colors enabling ~60 additional historical profiles
- Top 30 historical flavors profiled by frequency (covers most future rotation appearances)
- CI test for 4-file color palette sync (prevents palette drift as colors scale from 34 to 50+)
- SVG fallback upgrade from HD (18x22) to Hero (36x42) tier in cone-renderer.js

**Defer (v2+):**
- Full 141-flavor historical coverage (profile on-demand as retired flavors resurface)
- Premium tier (24x28) adoption in production (renderer exists, adoption is separate decision)
- l2_toppings expansion beyond collision pairs found during audit
- Animated, photorealistic, or per-store rendering variants (anti-features)

### Architecture Approach

The architecture is additive-data-growth on a stable structure. All 176 profiles use the identical `{ base, ribbon, toppings, density }` schema. No new components, modules, or API endpoints are needed. Profile additions propagate automatically to all consumers (Worker API, browser renderer, PNG pipeline, social cards) because they all read from the same FLAVOR_PROFILES object. The only manual propagation required is for new color palette entries, which must be synced across four files.

**Major components (unchanged):**
1. **flavor-colors.js** -- canonical profiles, palettes, 4-tier renderers (Mini/HD/Hero/Premium)
2. **cone-renderer.js** -- browser-side Mini + HD fallback rendering with API-first, FALLBACK-second color resolution
3. **generate-hero-cones.mjs** -- sharp-based PNG pipeline iterating FLAVOR_PROFILES
4. **flavor-audit.html** -- dev-facing quality validation showing all 4 tiers with automated flags

**Key pattern:** Worker-first rendering changes, then port to browser renderer in the same commit. Profiles added to flavor-colors.js require zero code changes in any consumer.

### Critical Pitfalls

1. **Four-file color sync is already drifted** -- cone-renderer.js FALLBACK palettes have wrong hex values for 10+ colors (chocolate, mint, strawberry, caramel, peanut_butter, etc.). Three base colors (chocolate_custard, lemon, blackberry) are entirely missing from the browser fallback. Fix ALL existing drift before adding new profiles. Build a CI validation script to prevent future drift.

2. **Non-integer PNG scale factor produces uneven pixel sizes** -- Current pipeline renders at 144px (scale 4) then resizes to 120px via nearest-neighbor (1.2:1 ratio). This creates visible artifacts -- waffle cone checkerboard squares alternate between 3px and 4px wide. Fix: render at scale 10 (360px) and resize to 120px (3:1 clean ratio), or output at native integer multiple and use CSS `image-rendering: pixelated` for display sizing.

3. **Rendering algorithm changes invalidate all golden hashes and all PNGs** -- The test suite has 20 golden pixel hashes for 5 reference flavors across 4 tiers. Any rendering change breaks all of them simultaneously. Ship algorithm improvements in isolated commits BEFORE profile authoring begins, so regressions remain distinguishable from intentional changes.

4. **Dual-renderer logic drift** -- flavor-colors.js and cone-renderer.js implement the same rendering in different JS dialects. The HD scoop geometry already differs (3-step taper in canonical vs 2-step taper in browser). Every rendering fix must be ported to both files in the same commit.

5. **Bulk authoring without automated contrast validation** -- At 136 new profiles, manual contrast checking will miss invisible topping-on-base combinations (dove on dark_chocolate = 1.3:1 contrast ratio). Build a WCAG contrast validator that flags any pair below 3:1 before authoring at scale.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Fix Existing Quality and Sync Issues
**Rationale:** Every subsequent phase depends on a correct baseline. Drifted colors mean new profiles are validated against wrong fallback values. Non-integer PNG scaling means all future PNGs inherit the same artifacts. Fix the foundation first.
**Delivers:** Correct color palettes across all 4 files, fixed HD scoop geometry sync, integer PNG scale factor, clean rendering baseline for existing 40 profiles.
**Addresses:** Table-stakes quality consistency; existing 40 profiles rendering correctly everywhere.
**Avoids:** Pitfall 1 (color drift), Pitfall 5 (blurry PNGs), Pitfall 9 (HD geometry mismatch).

### Phase 2: Build Validation Tooling
**Rationale:** Bulk authoring of 136 profiles without automated guards will produce invisible toppings, missing color keys, and keyword fallback bugs that are caught too late. The tooling must exist BEFORE the data entry begins.
**Delivers:** Contrast validation script (WCAG 3:1 ratio), CI color sync test across 4 files, topping-key-existence test, cross-renderer pixel comparison test, pixelmatch visual regression baseline.
**Addresses:** CI test for 4-file sync (differentiator); automated quality flag promotion (differentiator).
**Avoids:** Pitfall 2 (invisible toppings), Pitfall 3 (golden hash confusion), Pitfall 4 (renderer drift), Pitfall 13 (topping key typos).

### Phase 3: Palette Expansion and Alias Map
**Rationale:** New profiles need new colors. Colors must exist in all 4 files BEFORE profiles reference them (missing keys are silently skipped -- no error, just invisible elements). The alias map is zero-cost deduplication that reduces the profile authoring burden by ~20 entries.
**Delivers:** ~10 new base colors (espresso, cherry, pumpkin, banana, coconut, root_beer, pistachio, orange, blue_moon, maple), ~10 new topping colors (almond, toffee, cherry_bits, graham, marshmallow_bits, pretzel, kit_kat, chocolate_chip, coconut_flake, banana_bits) synced across 4 files. FLAVOR_ALIASES map for ~20 historical duplicates. Keyword fallback cleanup (add lemon, blackberry, chocolate_custard; reorder from most-specific to least-specific).
**Addresses:** Palette expansion (differentiator); alias map (differentiator); keyword fallback bugs.
**Avoids:** Pitfall 6 (keyword ordering), Pitfall 8 (normalization inconsistencies), Pitfall 13 (missing color keys).

### Phase 4: Bulk Profile Authoring
**Rationale:** With correct rendering, validation tooling, and expanded palettes in place, profile authoring is safe and efficient. Author in batches of 10-15, validate each batch with the contrast checker and flavor-audit.html, fix violations before continuing.
**Delivers:** ~136 new FLAVOR_PROFILES entries (38 to ~176 total). 2 current-rotation profiles first, then top 30 historical by frequency, then remaining as time allows. All profiles passing contrast validation, key-existence checks, and quality flags.
**Addresses:** Current-rotation profile gaps (table stakes); high-frequency historical profiles (differentiator); full profile coverage.
**Avoids:** Pitfall 2 (contrast failures at scale), Pitfall 12 (l2_toppings misuse), Pitfall 13 (key typos).

### Phase 5: PNG Generation and Deployment
**Rationale:** PNGs are binary files that bloat git history. Generate exactly once after all profiles and rendering fixes are finalized. Bump CACHE_VERSION for service worker cache invalidation.
**Delivers:** 176+ Hero PNGs at correct integer scale (~600KB total). Updated service worker cache version. Zero HD SVG fallback for any profiled flavor.
**Addresses:** Hero PNG for every profiled flavor (table stakes); consistent rendering tier on Today page (table stakes).
**Avoids:** Pitfall 3 (intermediate PNG commits creating binary churn), Pitfall 7 (stale SW cache), Pitfall 10 (non-idempotent regeneration noise).

### Phase Ordering Rationale

- **Phase 1 before Phase 2:** Validation tools need correct color values to validate against. Building a contrast checker against drifted FALLBACK colors would encode wrong baselines.
- **Phase 2 before Phase 3:** The CI sync test catches palette expansion mistakes immediately. Without it, new colors added to flavor-colors.js but missed in cone-renderer.js go undetected.
- **Phase 3 before Phase 4:** Profiles referencing nonexistent color keys render with invisible toppings (silent failure). All colors must exist before profiles use them.
- **Phase 4 before Phase 5:** PNG generation iterates all profiles. Running it before profiles are complete wastes a regeneration cycle and produces noisy git diffs when remaining profiles are added later.
- **Phase 5 is strictly terminal:** The single-final-PNG-commit pattern avoids binary churn in git history.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** PNG scale factor decision needs testing -- should output be 108px (scale 3), 120px (scale 10 with 3:1 downsample), or 144px (scale 4 native)? Requires measuring display containers across all pages (hero, index, quiz, social card). Also: Starlark color divergence needs a policy decision -- intentional LED optimization vs. unintentional drift.
- **Phase 3:** Starlark sync scope depends on Phase 1 policy decision. Four-file sync is the bottleneck -- batch all new colors in one commit, validate immediately.

Phases with standard patterns (skip research-phase):
- **Phase 2:** Validation tooling is straightforward -- WCAG contrast formula, key-in-object assertions, pixel buffer comparison with pixelmatch. Well-documented patterns, no unknowns.
- **Phase 4:** Profile authoring follows the existing cone-profile-spec.md. Purely data entry with established schema. The spec is thorough with worked examples.
- **Phase 5:** PNG generation pipeline already exists and works. Only runs once. No research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies already in use. Sharp behavior verified via pipeline inspection. No new production dependencies -- only parameter changes to existing tools. |
| Features | HIGH | Flavor counts verified against 3 SQLite databases (178 unique, 40 profiled, ~20 aliases, ~107 truly new). Every feature complexity estimate validated against actual code. |
| Architecture | HIGH | Zero-architecture-change milestone. All additions are data (profiles) and parameters (render scale). Component boundaries and data flows verified via direct source code reading with line numbers. |
| Pitfalls | HIGH | Color drift verified by comparing actual hex values across 4 files (18+ mismatches documented with specific values). Non-integer scale factor confirmed by arithmetic. All pitfalls cite specific code locations. |

**Overall confidence:** HIGH

All four research outputs are based on direct codebase inspection rather than external documentation or community sources. The project is well-instrumented (flavor-audit.html, golden hash tests, quality flags) which makes findings verifiable.

### Gaps to Address

- **Optimal PNG output dimensions:** Research identified the non-integer scale problem but the exact target dimensions (108px, 120px, or 144px) need testing against all display contexts. This is a Phase 1 implementation detail.
- **Starlark color policy:** Is Tidbyt LED color divergence intentional? 6+ colors differ between web and Starlark renderers. Needs a product decision before Phase 1 can fully complete the 4-file sync.
- **Historical flavor frequency data:** Prioritizing which of ~107 unprofiled flavors to profile first requires frequency analysis from the backfill SQLite databases. The data exists but hasn't been queried for prioritization ranking.
- **Premium tier adoption timing:** The Premium renderer (24x28 with PRNG scatter toppings) exists and works but is not in production. Whether to wire it as SVG fallback (better quality than Hero SVG) or defer is a product decision that affects Phase 1 scope.

## Sources

### Primary (HIGH confidence)
- `worker/src/flavor-colors.js` -- 825 lines, 38 profiles, 4-tier rendering, all palette definitions
- `docs/cone-renderer.js` -- 367 lines, browser-side Mini + HD rendering, FALLBACK palettes with documented drift
- `scripts/generate-hero-cones.mjs` -- 128 lines, sharp PNG pipeline with non-integer scale factor
- `docs/cone-profile-spec.md` -- authoring spec with grid geometry, density encoding, contrast rules
- `docs/flavor-audit.html` -- quality flag system and multi-tier visual comparison
- `worker/test/flavor-colors.test.js` -- 729 lines, 20 golden hashes, structural invariants
- [sharp official documentation](https://sharp.pixelplumbing.com/) -- constructor, resize, output APIs

### Secondary (MEDIUM confidence)
- Historical flavor databases (backfill, backfill-wayback, backfill-national SQLite files) -- 178 unique flavors, ~20 aliases identified
- [pixelmatch on GitHub](https://github.com/mapbox/pixelmatch) -- pixel-level image comparison, 150 LOC, zero deps
- [sharp vs resvg-js comparison](https://github.com/thx/resvg-js/issues/145) -- performance and stability comparison
- WCAG 2.1 contrast ratio requirements -- 3:1 minimum for UI components

---
*Research completed: 2026-03-09*
*Ready for roadmap: yes*
