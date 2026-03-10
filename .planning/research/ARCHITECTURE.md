# Architecture Patterns

**Domain:** Flavor profile scaling and cone rendering quality for Custard Calendar v1.3
**Researched:** 2026-03-09
**Confidence:** HIGH (all findings from direct source code analysis)

---

## Current Architecture (As-Is)

### Component Map

```
                     FLAVOR_PROFILES (38 entries)
                     worker/src/flavor-colors.js (825 lines)
                            |
         +------------------+------------------+
         |                  |                  |
    Worker API         Build Script       Tidbyt Star
  /api/v1/flavor-colors    |            (separate repo,
         |           generate-hero-cones.mjs   reads via API)
         |                  |
         v                  v
  cone-renderer.js     docs/assets/cones/
  (browser, 367 lines)   (40 PNGs)
         |
         v
  today-page.js, compare-page.js,
  map.html, radar.html, quiz engine
```

### Component Responsibilities

| Component | File | Responsibility | Lines |
|-----------|------|---------------|-------|
| **Flavor Profile Store** | `worker/src/flavor-colors.js` | FLAVOR_PROFILES object, color palettes (BASE, RIBBON, TOPPING, CONE), profile lookup with fuzzy matching, density resolvers | 825 total |
| **Server Renderers** | `worker/src/flavor-colors.js` | renderConeSVG (9x11), renderConeHDSVG (18x21), renderConeHeroSVG (36x42), renderConePremiumSVG (24x28) | (same file) |
| **Browser Renderer** | `docs/cone-renderer.js` | Duplicates Mini (9x11) + HD (18x21) rendering, heroConeSrc PNG lookup + HD SVG fallback | 367 |
| **Hero PNG Generator** | `scripts/generate-hero-cones.mjs` | Imports renderConeHeroSVG from Worker source, rasterizes via sharp to 120px-wide PNGs | 128 |
| **Flavor Colors API** | `worker/src/index.js` handleFlavorColors() | Serves FLAVOR_PROFILES + all color palettes as JSON at /api/v1/flavor-colors | ~15 |
| **Social Card Generator** | `worker/src/social-card.js` | Renders 1200x630 OG SVGs with embedded HD cones | ~200 |
| **Flavor Catalog** | `worker/src/flavor-catalog.js` | SEED_CATALOG (38 entries) + KV accumulation of new flavors | ~140 |
| **Flavor Audit Tool** | `docs/flavor-audit.html` | Dev-facing page showing all 4 tiers side-by-side with quality flags | ~600 |

### 4-Tier Rendering System

```
Tier         Grid     Topping Slots  Ribbon Slots  Used By
---------    ------   -------------  ------------  --------------------
Mini (L1)    9x11     4 fixed        3 diagonal    Tidbyt, map markers, widget
HD   (L2)    18x21    8 fixed        6 S-curve     Radar cards, social cards, hero fallback
Hero (L3)    36x42    8 fixed 2x2    9 S-curve     Hero PNGs (rasterized), OG cards
Premium(L4)  24x28    scatter PRNG   band 7-point  Audit page (experimental)
```

**Rendering layer order (all tiers):**
1. Base scoop fill (colored rects filling scoop geometry)
2. Depth shading -- highlight + shadow pixels (HD+ tiers only)
3. Toppings -- fixed-slot (L1/L2/L3) or seeded scatter (L4)
4. Ribbon -- rendered last, wins at pixel overlap with toppings
5. Cone checkerboard + tip

### Data Flow: Profile to Rendered Pixel

```
1. FLAVOR_PROFILES['dark chocolate pb crunch']
   -> { base: 'dark_chocolate', ribbon: 'peanut_butter',
        toppings: ['butterfinger'], density: 'standard' }

2. getFlavorProfile('Dark Chocolate PB Crunch')
   -> lowercases, unicode normalizes, exact lookup
   -> Falls back to keyword matching (includes('mint') -> mint generic)
   -> Falls back to DEFAULT_PROFILE (vanilla, no toppings, standard)

3. resolveToppingSlots(profile) or resolveHDToppingSlots(profile)
   -> density determines how toppings array maps to slot count
   -> 'standard' = as-is, 'double' = primary x2,
      'explosion' = fill all, 'overload' = single x6

4. BASE_COLORS[profile.base] -> hex for scoop fill
   TOPPING_COLORS[key] -> hex for each topping pixel
   RIBBON_COLORS[profile.ribbon] -> hex for ribbon pixels

5. renderCone*SVG(flavorName, scale) -> SVG string
   -> Each pixel = one <rect> at (col*scale, row*scale)
```

### PNG Pipeline

```
generate-hero-cones.mjs
  1. import { FLAVOR_PROFILES, renderConeHeroSVG } from flavor-colors.js
  2. For each flavor in Object.keys(FLAVOR_PROFILES):
     a. renderConeHeroSVG(flavorName, 4) -> SVG string (144x168px)
     b. sharp(svgBuffer).resize({width: 120, kernel: 'nearest'}).png()
     c. Write to docs/assets/cones/{slug}.png
  3. Fallback: macOS sips if sharp unavailable

Browser hero cone loading (cone-renderer.js renderHeroCone()):
  1. heroConeSrc(flavorName) -> 'assets/cones/{slug}.png'
  2. new Image().src = path
  3. img.onerror -> renderMiniConeHDSVG(flavorName, 6)  // HD SVG fallback
```

### Dual-File Rendering Duplication

`flavor-colors.js` (Worker, ES modules, const/let, template literals) and `cone-renderer.js` (browser, var, string concatenation, no imports) duplicate Mini and HD rendering logic. The browser file also contains:

- FALLBACK_*_COLORS objects (hardcoded palette copies for offline use)
- loadFlavorColors() fetch to /api/v1/flavor-colors
- heroConeSrc() + renderHeroCone() PNG-first-then-SVG logic

**Sync points that must stay aligned:**
1. Color palette values (BASE_COLORS, TOPPING_COLORS, RIBBON_COLORS, CONE_COLORS)
2. Scoop geometry row definitions
3. Topping slot positions
4. Ribbon slot positions
5. Density resolver logic
6. l2_toppings override handling

---

## Problem Analysis: Scaling to 176+ Profiles

### Current State

- **38 profiles** in FLAVOR_PROFILES (flavor-colors.js)
- **38 entries** in SEED_CATALOG (flavor-catalog.js)
- **40 PNG files** in docs/assets/cones/ (2 extra from historical/renamed)
- **~176 total flavors** observed across the platform (seed + KV accumulated)
- **Gap: ~136 flavors** render via keyword fallback or DEFAULT_PROFILE (vanilla, no toppings)

### Why Keyword Fallback is Inadequate

`getFlavorProfile()` falls back to keyword matching when no exact profile exists:

```javascript
if (key.includes('mint')) return { base: 'mint', ribbon: null, toppings: [], density: 'standard' };
if (key.includes('caramel')) return { base: 'caramel', ribbon: 'caramel', toppings: [], density: 'standard' };
```

"Caramel Apple Crumble" matches `includes('caramel')` and gets a generic caramel cone with no toppings -- visually wrong. "S'mores" matches nothing and gets vanilla DEFAULT_PROFILE. At 38 profiles this affects most displayed flavors. At 176 profiles the keyword path becomes a true edge case for genuinely new flavors from KV accumulation.

### File Size Projection

FLAVOR_PROFILES at 38 entries occupies ~52 lines. At 176 entries: ~230 lines. Combined with rendering code (~700 lines) and palettes (~55 lines), flavor-colors.js grows from 825 to ~1000 lines. Large but manageable for a single-file architecture.

---

## Recommended Architecture: What Changes for v1.3

### Decision: Keep Profiles Inline (Do Not Extract to Separate File)

**Recommendation: Add all 176 profiles directly to FLAVOR_PROFILES in flavor-colors.js.**

Reasons:
1. Worker code structural changes are out of scope for v1.3 (PROJECT.md: "Worker/API layer changes" excluded)
2. 1000 lines is large but not problematic -- the file is well-sectioned with clear headers
3. flavor-colors.js is already documented as the single source of truth (CONE_PROFILE_SPEC.md)
4. No import path changes means generate-hero-cones.mjs, social-card.js, cone-renderer.js all work unchanged
5. Future milestone can extract profiles to a JSON or separate JS file with zero functional change

### New Components: None Required

v1.3 is purely additive data + quality fixes within the existing architecture. No new files, no new modules, no new API endpoints.

### Modified Components

| Component | What Changes | Risk | Sync Required |
|-----------|-------------|------|---------------|
| `worker/src/flavor-colors.js` | FLAVOR_PROFILES grows 38->176. Possibly new palette entries. Possible rendering function quality fixes. | LOW -- additive data, rendering fixes in-place | Yes -- palette additions must sync |
| `docs/cone-renderer.js` | Must mirror any new palette entries in FALLBACK_*_COLORS. Must mirror any Mini/HD rendering fixes. | MEDIUM -- manual sync risk | Bidirectional with flavor-colors.js |
| `docs/flavor-audit.html` | Must mirror new palette entries in embedded SEED_* constants | LOW -- dev tool only | Unidirectional from flavor-colors.js |
| `worker/src/flavor-catalog.js` | SEED_CATALOG should include descriptions for all 176 flavors | LOW -- additive | Independent |
| `scripts/generate-hero-cones.mjs` | No code changes. Re-run produces all PNGs. | NONE | n/a |
| `docs/assets/cones/` | Grows from 40 to 176+ PNG files | NONE -- static assets | Generated from flavor-colors.js |

---

## Integration Points

### How Profile Changes Propagate

```
1. Add profile to FLAVOR_PROFILES in flavor-colors.js
   |
   +-> Worker API /api/v1/flavor-colors automatically includes it
   |     (handleFlavorColors() returns entire FLAVOR_PROFILES object)
   |
   +-> cone-renderer.js picks it up at runtime via loadFlavorColors() fetch
   |     (no code change needed in browser -- profiles come from API)
   |
   +-> generate-hero-cones.mjs picks it up on next run
   |     (iterates Object.keys(FLAVOR_PROFILES))
   |
   +-> social-card.js picks it up immediately
         (imports getFlavorProfile() which reads FLAVOR_PROFILES)
```

**Key insight:** Adding profiles to FLAVOR_PROFILES is a zero-code-change operation for all consumers. The only manual steps are:
1. Add the profile entry (data)
2. Re-run PNG generation (build step)
3. Deploy Worker (includes updated FLAVOR_PROFILES)

### How New Color Palette Entries Propagate

```
Add new BASE_COLORS entry (e.g., 'pumpkin': '#E67E22') in flavor-colors.js
   |
   +-> MUST also add to cone-renderer.js FALLBACK_BASE_COLORS
   |     (browser uses fallback when API unavailable)
   |
   +-> MUST also add to flavor-audit.html SEED_BASE_COLORS
   |     (audit page uses seed when running offline)
   |
   +-> SHOULD also add to custard-tidbyt Starlark renderer
         (Tidbyt pixel art uses its own color constants)
```

**This is the primary sync risk.** Missing a color in cone-renderer.js means offline users see wrong colors. Missing in flavor-audit.html means the dev tool shows wrong previews. The existing CONE_PROFILE_SPEC.md documents this 4-file sync requirement.

### How Rendering Quality Fixes Propagate

```
Fix in renderConeHeroSVG() (36x42 grid):
  -> Re-run generate-hero-cones.mjs to update all PNGs
  -> social-card.js sees fix immediately (same import)
  -> NO browser-side mirroring needed (Hero only exists server-side)

Fix in renderConeHDSVG() (18x21 grid):
  -> MUST mirror in cone-renderer.js renderMiniConeHDSVG()
  -> social-card.js sees fix immediately
  -> Affects: Radar cards (client), hero fallback (client), OG cards (server)

Fix in renderConeSVG() (9x11 grid):
  -> MUST mirror in cone-renderer.js renderMiniConeSVG()
  -> Affects: map markers (client), widget previews (client), Tidbyt (separate)
```

---

## Build Order (Dependency-Aware)

### Phase 1: Profile Authoring

Add ~136 missing flavor profiles to FLAVOR_PROFILES in flavor-colors.js.

**Dependencies:** None. Can start immediately.
**Validates with:** flavor-audit.html (each new profile appears in audit grid with quality flags).
**Output:** 176+ entries in FLAVOR_PROFILES.

**Strategy for bulk authoring:**
- Use Culver's flavor descriptions from SEED_CATALOG and culvers.com to determine base, ribbon, toppings, density
- Follow CONE_PROFILE_SPEC.md authoring guide strictly
- Batch by flavor family (all mint variants, all chocolate, all caramel, etc.) for visual consistency
- Validate each batch in flavor-audit.html before continuing
- Check contrast: would toppings disappear on chosen base? (e.g., dove on dark_chocolate = invisible)

### Phase 2: Color Palette Expansion (parallel with Phase 1)

New profiles may need colors not in current palettes. Examples: pumpkin, banana, maple, coffee, coconut, s'mores, cookie butter, red velvet.

**Dependencies:** Discovered during Phase 1 authoring.
**Must sync across 4 files (in this order):**
1. `worker/src/flavor-colors.js` -- canonical source
2. `docs/cone-renderer.js` -- browser fallback palettes
3. `docs/flavor-audit.html` -- embedded seed constants
4. `custard-tidbyt/.../culvers_fotd.star` -- Starlark renderer

**Critical rule:** Add colors BEFORE adding profiles that reference them. The rendering code silently skips missing color keys -- no error, just invisible toppings/ribbons.

### Phase 3: Rendering Quality Fixes (needs Phase 1 test data)

Fix SVG rendering quality. PROJECT.md notes "best current SVGs still look terrible."

**Dependencies:** Phase 1 should be partially complete so fixes can be validated against diverse profiles, not just the original 38.

**Quality fix propagation:**

| Fix Location | Mirror Required | Rerun PNGs? |
|-------------|----------------|-------------|
| renderConeHeroSVG() | No -- Hero is server-only | YES |
| renderConePremiumSVG() | No -- Premium is server-only | No |
| renderConeHDSVG() | YES -- cone-renderer.js renderMiniConeHDSVG() | No (SVG is live) |
| renderConeSVG() | YES -- cone-renderer.js renderMiniConeSVG() | No (SVG is live) |
| Topping slot positions | YES -- both files | YES if Hero slots change |
| Scoop geometry | YES -- both files | YES if Hero geometry changes |

### Phase 4: PNG Regeneration (depends on Phases 1, 2, 3)

Re-run `node scripts/generate-hero-cones.mjs` to produce PNGs for all 176+ profiles.

**Dependencies:** All profile data and rendering fixes must be final.
**Output:** 176+ PNG files in docs/assets/cones/
**Verification:** Every flavor on every page shows Hero PNG, never HD SVG fallback.

```bash
cd custard-calendar
node scripts/generate-hero-cones.mjs
# Expected output: "Generating hero cone PNGs for 176 flavors..."
# Verify: ls docs/assets/cones/ | wc -l  -> 176+
```

### Phase 5: SEED_CATALOG Sync (parallel with Phases 1-3)

Update SEED_CATALOG in flavor-catalog.js to include descriptions for all 176 flavors.

**Dependencies:** Phase 1 (need the full flavor list).
**Impact:** flavor-audit.html and subscription UI show all flavors even when KV is empty.

### Dependency Graph

```
Phase 1 (Profiles) ----+
                        |
Phase 2 (Colors) -------+--> Phase 3 (Quality) --> Phase 4 (PNGs)
                        |
Phase 5 (Catalog) ------+

Phases 1, 2, 5: can proceed in parallel
Phase 3: needs representative set from Phase 1
Phase 4: final step after everything else is stable
```

---

## Patterns to Follow

### Pattern 1: Additive Data Growth
**What:** Add entries to FLAVOR_PROFILES without changing data shape.
**When:** Scaling from 38 to 176 profiles.
**Why:** All consumers handle the shape already. Zero code changes in consumers.

```javascript
// Existing shape -- every new entry uses exactly this shape
'new flavor name': {
  base: 'chocolate',       // key into BASE_COLORS
  ribbon: 'caramel',       // key into RIBBON_COLORS or null
  toppings: ['pecan'],     // keys into TOPPING_COLORS, ordered by visual priority
  density: 'standard'      // pure|standard|double|explosion|overload
},
```

### Pattern 2: Color-Before-Profile
**What:** Add palette entries before profiles that reference them.
**When:** A new flavor needs a color key that doesn't exist.
**Why:** Missing keys produce invisible elements silently. The rendering code does `if (!color) continue;` -- no error, just wrong output that's hard to debug.

### Pattern 3: Worker-First Rendering Fixes
**What:** Fix rendering in flavor-colors.js, then mirror to cone-renderer.js.
**When:** Any change to scoop geometry, topping slots, ribbon paths, or color logic.
**Why:** Worker uses ES modules, const/let, template literals. Browser uses var and string concatenation. Porting Worker->browser is straightforward; browser->Worker requires additional refactoring.

### Pattern 4: Single Final PNG Commit
**What:** Generate and commit PNGs exactly once after all profiles and quality fixes are finalized.
**When:** Phase 4, the final step.
**Why:** PNG files are binary -- every regeneration creates a full diff in git. Avoid churning binary objects with intermediate commits.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Profile Data in cone-renderer.js
**What:** Putting flavor profile definitions in the browser renderer.
**Why bad:** cone-renderer.js gets profiles from the API at runtime. It does NOT contain FLAVOR_PROFILES. Adding profiles there creates a second source of truth that diverges when the API is available.
**Instead:** All profiles in flavor-colors.js only. Browser gets them via /api/v1/flavor-colors.

### Anti-Pattern 2: l2_toppings Overrides for Most New Profiles
**What:** Using per-pixel `l2_toppings` arrays for new profiles.
**Why bad:** l2_toppings requires exact [col, row, colorKey] coordinates, must be maintained in BOTH flavor-colors.js and cone-renderer.js, and is only needed for edge cases where default topping slots produce bad results (Blackberry Cobbler is the only current user).
**Instead:** Use standard profile shape. Only add l2_toppings if flavor-audit.html shows a problem at Mini tier that density/topping reordering cannot fix.

### Anti-Pattern 3: Incremental PNG Regeneration During Authoring
**What:** Re-running generate-hero-cones.mjs and committing PNGs after each batch of 10-20 new profiles.
**Why bad:** Binary diffs bloat git history. If a rendering fix later changes every PNG, early commits are wasted.
**Instead:** Author all profiles, finalize quality fixes, generate PNGs once, commit once.

### Anti-Pattern 4: Fixing Only Hero Tier and Ignoring Mini/HD
**What:** Improving renderConeHeroSVG quality but leaving Mini and HD unchanged.
**Why bad:** Users see HD SVG fallback when a PNG hasn't loaded yet (slow connection, first visit). If HD looks bad while Hero PNG looks good, the loading transition is jarring. Radar cards always use HD -- they never get Hero PNGs.
**Instead:** Quality improvements should flow to all tiers that display the same flavor on the same page.

---

## Data Flow Changes at Scale

### Response Size Impact

| Metric | At 38 profiles | At 176 profiles | Concern? |
|--------|---------------|-----------------|----------|
| /api/v1/flavor-colors JSON | ~5KB | ~15-20KB | No -- gzipped ~3-4KB |
| Worker bundle size | 825 lines | ~1000 lines | No -- trivial cold start impact |
| Client memory | 38 objects | 176 objects | No -- negligible |
| PNG disk (docs/assets/cones/) | 40 files, ~120KB | 176 files, ~600KB | No -- well within GitHub Pages limits |
| Git repo (binary PNGs) | ~120KB | ~600KB one-time | Manageable -- commit once |

### Keyword Fallback Elimination

At 38 profiles, ~136 flavors hit the keyword fallback path producing generic cones. At 176 profiles, nearly all flavors get exact matches. This is the **primary quality improvement** -- flavors that showed a generic vanilla cone with no toppings will now show their actual color/topping profile.

The keyword fallback code in getFlavorProfile() should remain for truly unknown flavors (new Culver's creations accumulated via KV that haven't been manually profiled yet). It becomes a safety net rather than the common path.

---

## Scalability Considerations

| Concern | At 38 (now) | At 176 (v1.3) | At 500+ (future) |
|---------|------------|---------------|-------------------|
| Profile data | 52 lines inline | ~230 lines inline | Extract to JSON, import |
| API response | ~5KB | ~20KB | Gzip handles; paginate if >100KB |
| PNG disk | 40 files, 120KB | 176 files, 600KB | Consider CDN or on-demand raster |
| Rendering perf | Instant | Instant | Instant (O(1) lookup, fixed rect count) |
| Dual-file sync | Manageable | Palette sync is main risk | Eliminate duplication via build step |
| Profile authoring | Ad-hoc | Needs spec + audit tool | Needs generator from descriptions |
| Quality validation | Manual audit page | Manual audit page | Automated screenshot comparison |

---

## Sources

- `worker/src/flavor-colors.js` -- 825 lines, 38 profiles, 4 rendering functions (read directly)
- `docs/cone-renderer.js` -- 367 lines, Mini + HD browser duplicates (read directly)
- `scripts/generate-hero-cones.mjs` -- 128 lines, PNG pipeline (read directly)
- `worker/src/flavor-catalog.js` -- 38-entry SEED_CATALOG + KV accumulation (read directly)
- `worker/src/social-card.js` -- imports renderConeHDSVG for OG cards (read directly)
- `worker/src/index.js` -- handleFlavorColors() API endpoint (read directly)
- `CONE_PROFILE_SPEC.md` -- authoring guide with grid geometry and color rules (read directly)
- `ASSET_SPEC.md` -- asset catalog with tier assignments and surfaces (read directly)
- `ARCHITECTURE.md` (project) -- 3-layer model and data flow (read directly)
- `PROJECT.md` -- v1.3 scope, constraints, out-of-scope items (read directly)
