# Feature Landscape: v1.3 Asset Parity

**Domain:** Pixel art flavor profiling and cone asset rendering quality
**Researched:** 2026-03-09
**Scope:** Cone rendering quality and flavor profile coverage -- bringing every flavor to consistent Hero-tier visual quality

---

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Quality audit of existing 40 profiles | Profiles were authored incrementally; some have contrast failures (dove on dark_chocolate), incorrect density, or visually indistinguishable results at Mini tier | Low | `flavor-audit.html` for visual QA; `FLAVOR_PROFILES` in `flavor-colors.js` | Systematic pass through all 40 entries at all 4 tiers. Fix-as-you-go. |
| Profile remaining current-rotation flavors | "Georgia Peach Pecan" and "OREO Cookies and Cream" appear in `flavors.json` catalog but have NO FLAVOR_PROFILES entry. They fall through keyword fallback -> generic peach/vanilla cone. Users see these flavors on the Today page. | Low | Existing base/topping palettes cover both flavors (peach + pecan; vanilla + oreo) | 2 new profiles, each ~1 line of JSON. Then re-run `generate-hero-cones.mjs`. |
| Consistent rendering tier on Today page | Today page mixes Hero PNG (profiled flavors) with HD SVG fallback (unprofiled). Two quality levels side by side looks unfinished. | Med | Hero PNGs for all flavors that appear in rotation; `renderHeroCone()` fallback path | Achieving this for current 40+2 flavors is table stakes. Achieving it for all 178 historical flavors is a differentiator. |
| Regenerate Hero PNGs after profile fixes | Any profile changes (contrast fix, density update, base color correction) invalidate the existing PNG. Must re-run the pipeline. | Low | `generate-hero-cones.mjs`; `sharp` dependency | Single command: `node scripts/generate-hero-cones.mjs`. ~30s for 40 profiles. |
| Hero PNG for every profiled flavor | `renderHeroCone()` tries PNG first, falls back to HD SVG on `onerror`. If a profile exists but no PNG was generated, users get the lower-quality SVG. | Low | Pipeline exists, just needs to run after profile additions | Currently 40 PNGs at 320KB total. Each PNG is ~2-8KB. |

## Differentiators

Features that set the product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Alias map for historical flavor name deduplication | ~20 unprofiled flavors are just alternate spellings of existing profiles ("Choc Heath Crunch" = "Chocolate Heath Crunch"). An alias map resolves these without creating duplicate profiles. | Low | `getFlavorProfile()` in `flavor-colors.js` | Add a `FLAVOR_ALIASES` map before the keyword fallback. Reduces "unprofiled" count from 141 to ~120 with zero new color work. |
| High-frequency historical flavor profiles | Flavors like "Cookies & Cream", "Raspberry Cream", "Chocolate Eclair", "Pumpkin Pecan" appear in historical data and may return to rotation. Profiling them preemptively means they render correctly on first appearance. | Med | Some need new base colors (espresso, pumpkin, cherry) and new topping colors (see palette expansion below) | Prioritize by frequency in backfill data. Top ~30 historical flavors cover most future appearances. |
| New base color palette expansion | 10 new base colors enable profiling ~60 additional historical flavors: espresso, cherry, pumpkin, banana, coconut, root_beer, pistachio, orange, blue_moon, maple | Med | 4-file sync: `flavor-colors.js`, `cone-renderer.js`, `culvers_fotd.star`, `flavor-audit.html` | Each new base color is 1 hex value across 4 files. The sync is the risk, not the color choice. |
| New topping color palette expansion | 10 new topping colors: pretzel, kit_kat, marshmallow_bits, almond, graham, toffee, cherry_bits, rice_krispie, coconut_flake, chocolate_chip | Med | Same 4-file sync as base colors | Some colors are near-duplicates of existing ones (marshmallow_bits vs salt = both white). Shape differentiation at HD+ tier may be needed. |
| CI test for 4-file color palette sync | Automated check that `flavor-colors.js`, `cone-renderer.js`, `culvers_fotd.star`, and `flavor-audit.html` all define the same set of base/topping/ribbon color keys | Med | CI pipeline; ability to parse color keys from all 4 files | Prevents palette drift as the system scales from 34 to 50+ colors. Currently manual via `flavor-audit.html` "unknown topping color" flag. |
| l2_toppings per-pixel overrides for visually similar flavors | At Mini 9x11 tier, "Turtle" and "Caramel Turtle" are nearly identical (same toppings, different density). `l2_toppings` allows precise pixel placement that makes them distinguishable even at 1px scale. | Med | Only affects Mini tier; HD/Hero/Premium use slot-based placement | Currently only Blackberry Cobbler uses l2_toppings. Selectively expand to 5-10 collision pairs identified via flavor-audit.html. |
| Premium tier (24x28) adoption in production | `renderConePremiumSVG()` is built and renders in flavor-audit.html but no production page uses it. Features: seeded PRNG scatter toppings, per-pixel texture hash, collision detection, shaped topping pieces. Looks significantly better than HD. | Low | Renderer exists; need to wire into `renderHeroCone()` or a new display context | Could replace HD SVG as the fallback when Hero PNG is missing. |
| Automated quality flag promotion to CI | `qualityFlags()` in `flavor-audit.html` catches: sparse toppings, unknown topping colors, pure density with toppings listed, long names. Promoting this to a CI test prevents quality regressions. | Med | Extract `qualityFlags()` logic into a testable module; run against all FLAVOR_PROFILES in CI | Currently requires manual browser-based audit. |
| Full historical flavor coverage (141 remaining) | Every flavor ever served at any tracked store renders with a real profile, not keyword fallback | High | ~10 new base colors, ~10 new topping colors, ~80 new profiles, alias map for ~20 duplicates, ~11 closure entries filtered | Many are retired and may never appear again. Profile on-demand as they surface, not speculatively. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Auto-generated profiles from flavor names | NLP/heuristic profile generation produces plausible but wrong results. "Espresso Toffee Bar" is espresso base with toffee topping -- not toffee base with espresso topping. Wrong colors are worse than generic fallback. | Author profiles manually using the cone-profile-spec.md. Use keyword fallback only for completely unknown flavors. |
| Photorealistic cone rendering | Pixel art is the design language (Tidbyt, retro aesthetic). Photorealism conflicts with the brand and adds enormous complexity. | Stay with the 4-tier pixel grid system. Improve within the pixel art constraints. |
| Per-store custom cone variants | Stores don't serve different versions of the same-named flavor. The profile system is flavor-keyed, not store-keyed. Adding store dimension would explode the matrix. | Single canonical profile per normalized flavor name. |
| User-contributed profile authoring | Quality control impossible. Topping contrast, density encoding, and multi-tier consistency require understanding the rendering system. Community input would create inconsistent visual quality. | Central authoring in `flavor-colors.js`. Use `flavor-audit.html` for QA. |
| Dynamic SVG composition at request time | Server-side cone rendering per request adds Worker complexity (out of scope), latency, and breaks the static site model. | Pre-render to PNG at build time. SVG fallback is client-side only. |
| Animated cone rendering | Moving pixels distract from the core information ("what flavor is it"). Adds JS complexity and accessibility concerns. | Static cones at all tiers. |
| Speculative profiling of all 141 historical flavors | Many are retired (Drum...Stixxx!, Bailey's Irish Cream, Spumoni & Chocolate Chip Cookie Dough). Profiling them all upfront is wasted effort for flavors that may never appear again. | Profile on-demand when a flavor surfaces in current data. Maintain alias map for known duplicates. Batch-profile the top 30 by historical frequency. |

---

## Detailed Feature Analysis

### 1. Quality Audit of Existing 40 Profiles

**What needs checking per profile:**

| Check | What to Look For | Fix Pattern |
|-------|-----------------|-------------|
| Base-topping contrast | `dove` (#2B1A12) on `dark_chocolate` (#3B1F0B) = invisible. `salt` (#FFFFFF) on `cheesecake` (#FFF5E1) = invisible. | Swap to higher-contrast topping or change base shade. |
| Density-topping count match | `explosion` density with only 1 topping in the list = sparse rendering. `pure` density with toppings listed = toppings silently ignored. | Adjust density or add/remove toppings. |
| Visual distinctiveness | Turtle vs Caramel Turtle vs Turtle Cheesecake vs Turtle Dove should be distinguishable at Mini tier. | Use l2_toppings override or differentiate via ribbon/density. |
| Ribbon-T4 conflict awareness | Profiles with ribbon + 4 toppings: the 4th topping is silently dropped at Mini tier. | Remove 4th topping from list or accept it renders only at HD+ tiers. |
| Hero tier visual quality | Check generated PNG at 120px width. Are shading pixels (4 highlight, 3 shadow) visible? Does the ribbon S-curve read as a swirl? | Adjust if needed, but most Hero renders look good. |

**Known issues in current profiles (from code review):**

| Profile | Issue | Suggested Fix |
|---------|-------|---------------|
| `devil's food cake` | Base is `chocolate_custard` but flavor is dark chocolate per the description | Change base to `dark_chocolate` |
| `raspberry cheesecake` | Has `double` density but only 1 topping (`raspberry`). Double doubles the first topping, so this produces 2 raspberry pixels -- intentional but check visual. | Looks acceptable -- raspberry dominance matches the flavor. |
| `strawberry cheesecake` | Has `double` density with `strawberry_bits`. Similar to raspberry cheesecake pattern. | Acceptable -- consistent family pattern. |
| `oreo cookie cheesecake` vs `oreo cheesecake` | Two profiles that look nearly identical (cheesecake base + oreo topping). Only difference: cookie cheesecake is `double`, oreo cheesecake is `double`. They are currently the same visually. | Differentiate one -- perhaps oreo cheesecake gets a fudge ribbon. |

### 2. Alias Map for Historical Duplicates

Approximately 20 historical flavor names are just alternate spellings or abbreviations of existing profiles. An alias map handles these without new profile entries:

```javascript
const FLAVOR_ALIASES = {
  "choc heath crunch": "chocolate heath crunch",
  "choc volcano": "chocolate volcano",
  "choc oreo": "chocolate oreo volcano",
  "choc covered cherry": "chocolate covered cherry",  // if profiled
  "choc m&m": "chocolate volcano",  // closest match
  "oreo overload": "oreo cookie overload",
  "reese's peanut butter cup": "really reese's",
  "reese's peanutbutter cup": "really reese's",
  "reese's choc lover": "really reese's",
  "cookie's and cream": "oreo cookie cheesecake",  // closest
  "cookies & cream": "oreo cookie cheesecake",
  "ande's mint": "andes mint avalanche",
  "mint oreo": "mint explosion",
  "mint oreo explosion": "mint explosion",
  "mint chip": "mint cookie",
  "mint choc chip": "mint cookie",
  "mint chocolate chip": "mint cookie",
  "heath bar": "chocolate heath crunch",
  "devil\u2019s food cake": "devil's food cake",  // curly quote
  "really reese\u2019s": "really reese's",  // curly quote
};
```

**Integration point:** Add alias lookup between exact match and keyword fallback in `getFlavorProfile()`:

```javascript
if (FLAVOR_PROFILES[key]) return FLAVOR_PROFILES[key];
if (FLAVOR_ALIASES[key]) return FLAVOR_PROFILES[FLAVOR_ALIASES[key]];
// ... existing keyword fallback
```

**Complexity:** Low. No new colors, no new renderers. Just a lookup table.

### 3. Palette Expansion for Historical Coverage

**New base colors needed (prioritized by flavor frequency):**

| Priority | Color Key | Hex | Flavors It Enables | Count |
|----------|-----------|-----|-------------------|-------|
| 1 | `espresso` | `#3E2723` | Espresso Toffee Bar, Cappuccino Cookie Crumble, Cappuccino Almond Fudge, Tiramisu, Mocha Almond Fudge | 5 |
| 2 | `cherry` | `#C62828` | Cherry Chocolate Chip, Chocolate Covered Cherry, Burgundy Cherry, Cherry Cheesecake, Cherry Pecan, Cherry Amaretto Cheesecake | 6 |
| 3 | `pumpkin` | `#E65100` | Pumpkin Pecan, Pumpkin Pie | 2 |
| 4 | `banana` | `#FFE082` | Banana Cream Pie, Chocolate Covered Banana, Peanut Butter Chocolate Banana, Salted Caramel Banana Nut | 4 |
| 5 | `coconut` | `#EFEBE9` | Coconut Cream Pie, Coconut Chocolate Almond Crunch | 2 |
| 6 | `root_beer` | `#4E342E` | Root Beer Float | 1 |
| 7 | `pistachio` | `#AED581` | Pistachio | 1 |
| 8 | `orange` | `#FF9800` | Orange Creamsicle | 1 |
| 9 | `blue_moon` | `#64B5F6` | Blue Moon | 1 |
| 10 | `maple` | `#A1887F` | Maple Pecan | 1 |

**New topping colors needed (prioritized):**

| Priority | Color Key | Hex | Flavors It Enables |
|----------|-----------|-----|-------------------|
| 1 | `almond` | `#BCAAA4` | Chocolate Almond, Cappuccino Almond Fudge, Hershey Almond Fudge, Coconut Chocolate Almond Crunch, Heath Chocolate Almond |
| 2 | `toffee` | `#F9A825` | English Toffee, Midnight Toffee, Toffee Pecan, Pecan Toffee Crunch |
| 3 | `cherry_bits` | `#B71C1C` | Cherry Chocolate Chip, Chocolate Covered Cherry, Burgundy Cherry |
| 4 | `graham` | `#D7CCC8` | Bonfire S'mores, Key Lime Custard Pie |
| 5 | `marshmallow_bits` | `#FAFAFA` | Double Marshmallow Oreo, Bonfire S'mores |
| 6 | `pretzel` | `#8D6E63` | Chocolate Pretzel Crunch |
| 7 | `kit_kat` | `#D32F2F` | Kit Kat Bar, Kit Kat Swirl |
| 8 | `chocolate_chip` | `#3E2723` | Chocolate Chip Cookie Dough, Cherry Chocolate Chip, Mint Chocolate Chip |
| 9 | `coconut_flake` | `#F5F5F5` | Coconut Cream Pie, Coconut Chocolate Almond Crunch |
| 10 | `banana_bits` | `#FFD54F` | Banana Cream Pie, Chocolate Covered Banana |

**4-file sync burden:** Each new color requires updating:
1. `worker/src/flavor-colors.js` (canonical)
2. `docs/cone-renderer.js` (client-side fallback `FALLBACK_*_COLORS`)
3. `custard-tidbyt/apps/culversfotd/culvers_fotd.star` (Starlark)
4. `docs/flavor-audit.html` (`SEED_*` constants)

**Risk mitigation:** Add all new colors in a single batch commit, then immediately run `flavor-audit.html` to verify no "unknown color" flags. Follow with CI sync test.

### 4. Density System at Scale

The current 5-value density system handles 176+ flavors without modification:

| Density | Current Count (40) | Expected at 176+ | Coverage |
|---------|-------------------|-------------------|----------|
| `pure` | 2 (5%) | ~9 (5%) | Plain bases: Vanilla, Dark Chocolate Decadence, Strawberry, Pistachio, etc. |
| `standard` | 22 (55%) | ~97 (55%) | Most flavors: 1-2 toppings with optional ribbon |
| `double` | 7 (18%) | ~35 (20%) | "Double" in name, or dominant single topping emphasis |
| `explosion` | 7 (18%) | ~26 (15%) | Multi-ingredient: Avalanche, Volcano, Explosion names |
| `overload` | 2 (5%) | ~9 (5%) | "Overload" in name, single topping saturating all slots |

No new density values are needed. The density is a rendering instruction, not a topping count. Even complex historical flavors like "Spumoni & Chocolate Chip Cookie Dough" map cleanly to `explosion` with a multi-topping list.

### 5. SVG Rendering Quality Gap

The PROJECT.md states: "Improve SVG rendering quality overall (best current SVGs still look terrible)."

**Root cause analysis:**

| SVG Tier | Grid | At Scale 5 | At Scale 8 | Assessment |
|----------|------|-----------|-----------|------------|
| Mini (9x11) | 45x55px | Intended use | Overly blocky | Designed for Tidbyt/map markers. Should not be used for hero display. |
| HD (18x22) | 90x110px | Good for radar | Acceptable for hero | Current fallback when Hero PNG is missing. Looks ok but lacks shading. |
| Hero (36x42) | 144x168px (scale 4) | Good | Very good | Used for PNG generation. Has highlight + shadow. The PNG version looks great; the SVG version is only used internally. |
| Premium (24x28) | 144x168px (scale 6) | Good | Very good | Has texture hash, scatter toppings, shaped pieces. Not in production. |

**Why SVG looks worse than PNG:** The HD SVG at scale 6-8 is the fallback when Hero PNG is missing. It has no shading (no highlight/shadow pixels) and uses 1-pixel toppings at a grid that shows individual pixel boundaries. The Hero SVG (36x42) looks much better but is only used as input to the PNG pipeline, not rendered client-side.

**Fix options:**

| Option | Effort | Impact |
|--------|--------|--------|
| A. Generate PNGs for all profiled flavors (already planned) | Low | Eliminates the SVG fallback for profiled flavors entirely |
| B. Use Hero SVG (36x42) as fallback instead of HD SVG (18x22) | Low | Better SVG quality when PNG is missing. Change `renderMiniConeHDSVG` to `renderConeHeroSVG` in `renderHeroCone()`. |
| C. Wire Premium SVG (24x28) as fallback | Low | Best SVG quality. Has texture and shaped toppings. |
| D. Improve HD SVG renderer with shading | Med | Add highlight/shadow pixels to `renderConeHDSVG`. Breaks backward compatibility with existing sprite exports. |

**Recommendation:** Option A (more PNGs) + Option B (upgrade fallback to Hero SVG). This is the lowest-effort path to eliminating the quality gap. Option C is even better visually but Premium is the newest renderer and may have edge cases.

### 6. Rendering Pipeline Scaling

**Current pipeline performance:**
- 40 profiles -> 40 PNGs at 320KB total in ~30 seconds
- Each PNG: 120px wide, ~2-8KB, `sharp` with `kernel: 'nearest'` (crisp pixel art)
- Sequential processing (not parallelized)

**At 176 profiles:**
- ~176 PNGs at ~1.4MB total in ~90-120 seconds
- Still sequential, still fast enough
- Service worker caches PNGs with stale-while-revalidate on `/assets/cones/*.png`
- GitHub Pages serves them as static assets -- no build step needed beyond running the generator

**Asset size budget:**
| Count | Estimated Total Size | Impact on First Load | Impact on SW Cache |
|-------|---------------------|---------------------|-------------------|
| 40 (current) | 320KB | None -- lazy loaded per flavor | Minimal |
| 80 (milestone target) | ~640KB | None -- lazy loaded | Acceptable |
| 176 (full coverage) | ~1.4MB | None -- lazy loaded | Acceptable -- SW pre-caches only the first load's flavor |

PNGs are loaded on-demand via `<img>` tags, not pre-fetched. Only the current flavor's PNG loads. Total asset size does not affect page performance.

---

## Feature Dependencies

```
Quality audit of 40 profiles
  -> Profile fixes (density, contrast, base color corrections)
    -> Regenerate Hero PNGs (must re-run pipeline after any profile change)

Profile "Georgia Peach Pecan" + "OREO Cookies and Cream"
  -> Regenerate Hero PNGs (adds 2 new PNGs)

Alias map (FLAVOR_ALIASES)
  -> Independent of profiles -- purely matching logic in getFlavorProfile()

New base/topping colors
  -> 4-file sync (flavor-colors.js, cone-renderer.js, culvers_fotd.star, flavor-audit.html)
    -> New flavor profiles using those colors
      -> Regenerate Hero PNGs

CI color sync test
  -> Independent, but should be in place BEFORE palette expansion

SVG fallback upgrade (HD -> Hero)
  -> Change in cone-renderer.js renderHeroCone() function
  -> Independent of profiling work

Premium tier adoption
  -> Depends on SVG fallback upgrade decision
  -> Wire into renderHeroCone() or new display context
```

**Key ordering:** 4-file sync is the bottleneck. Batch all new colors into a single commit, validate with flavor-audit.html, then author profiles that use those colors.

---

## MVP Recommendation

### Phase 1: Quality Parity for Current Rotation (ship first)

1. **Audit existing 40 profiles** for contrast, density, and visual distinctiveness at all 4 tiers. Fix issues found. (~2 hours)
2. **Profile 2 remaining current-rotation flavors** (Georgia Peach Pecan, OREO Cookies and Cream). (~15 min)
3. **Regenerate all Hero PNGs** after fixes. (~5 min)
4. **Upgrade SVG fallback** from HD (18x22) to Hero (36x42) in `cone-renderer.js`. (~30 min)

**Outcome:** Every flavor a user sees on the Today page renders at consistent Hero quality.

### Phase 2: Historical Coverage Foundation (ship second)

5. **Add alias map** for ~20 duplicate historical names. (~1 hour)
6. **Add CI test** for 4-file color palette sync. (~2 hours)
7. **Batch-add 5 highest-priority base colors** (espresso, cherry, pumpkin, banana, coconut) across all 4 files. (~2 hours)
8. **Batch-add 5 highest-priority topping colors** (almond, toffee, cherry_bits, graham, marshmallow_bits) across all 4 files. (~2 hours)
9. **Profile top 30 historical flavors by frequency** using new palette. (~3 hours)
10. **Regenerate all Hero PNGs.** (~5 min)

**Outcome:** ~72 profiled flavors (40 current + 2 new + 30 historical). Coverage for the vast majority of flavors users will ever encounter.

### Defer

- **Full 141-flavor historical coverage**: Profile on-demand as retired flavors resurface. Many never will.
- **Premium tier production integration**: Wire in after Hero quality parity is proven. The renderer exists and works; adoption is a separate decision.
- **l2_toppings expansion**: Only for Mini-tier collision pairs identified during audit. Most flavors are distinguishable without per-pixel overrides.
- **Remaining 5 base colors + 5 topping colors**: Only needed for long-tail historical flavors (Pistachio, Blue Moon, Root Beer Float, etc.).

---

## Sources

- `worker/src/flavor-colors.js` -- 40 `FLAVOR_PROFILES`, 13 base colors, 21 topping colors, 5 ribbon colors, 4 renderers (Mini/HD/Hero/Premium) [HIGH confidence]
- `docs/cone-renderer.js` -- client-side fallback renderer, `renderHeroCone()` PNG-first-SVG-fallback logic [HIGH confidence]
- `docs/cone-profile-spec.md` -- full authoring spec: grid geometry, density encoding, contrast rules, color palettes, worked examples [HIGH confidence]
- `scripts/generate-hero-cones.mjs` -- PNG pipeline using sharp, iterates `FLAVOR_PROFILES`, outputs to `docs/assets/cones/` [HIGH confidence]
- `docs/flavor-audit.html` -- quality flag system (`qualityFlags()`), multi-tier visual comparison, collision detection, before/after diff [HIGH confidence]
- `data/backfill/flavors.sqlite` -- 116 historical flavors from local Milwaukee stores [HIGH confidence]
- `data/backfill-wayback/flavors.sqlite` -- 115 historical flavors from Wayback Machine archives [HIGH confidence]
- `data/backfill-national/flavors.sqlite` -- 30 national Culver's flavors [HIGH confidence]
- `docs/flavors.json` -- 40-flavor current catalog, matches FLAVOR_PROFILES 1:1 [HIGH confidence]
- `worker/src/flavor-catalog.js` -- seed catalog (40 entries) + KV accumulation for discovered flavors [HIGH confidence]
- `worker/src/flavor-matcher.js` -- `FLAVOR_FAMILIES` (9 families), `SIMILARITY_GROUPS`, normalization logic [HIGH confidence]
- Combined historical analysis: 178 unique flavors across all 3 databases, minus 11 closure entries = 167 real flavors, minus 40 profiled = 127 unprofiled, minus ~20 aliases = ~107 truly new profiles needed [HIGH confidence]
