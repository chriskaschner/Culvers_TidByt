# Domain Pitfalls

**Domain:** Bulk flavor profile authoring + pixel art rendering algorithm modification in a live multi-renderer system
**Project:** Custard Calendar v1.3 -- Asset Parity
**Researched:** 2026-03-09
**Confidence:** HIGH (all pitfalls verified against actual codebase files, with specific line numbers and color values)

## Critical Pitfalls

Mistakes that cause visible rendering regressions for live users, require full re-renders of 176+ PNGs, or silently break rendering consistency across surfaces.

### Pitfall 1: Four-File Color Sync Drift Is Already Happening

**What goes wrong:**
CONE_PROFILE_SPEC.md requires four files to stay in sync for every color addition: `worker/src/flavor-colors.js` (canonical), `docs/cone-renderer.js` (browser fallback), `tidbyt/culvers_fotd.star` (Tidbyt renderer), and `docs/flavor-audit.html` (seed data). At 40 profiles, drift has already occurred. At 176+ profiles with new base/topping/ribbon colors, each addition multiplies the drift risk by 4x.

**Verified drift already present in the codebase:**

| Color key | flavor-colors.js (canonical) | cone-renderer.js FALLBACK | culvers_fotd.star | Drift |
|-----------|------------------------------|--------------------------|-------------------|-------|
| chocolate (base) | `#6F4E37` | `#7B4A2E` | `#6F4E37` | cone-renderer.js wrong |
| dark_chocolate (base) | `#3B1F0B` | `#4B2E2E` | `#3B1F0B` | cone-renderer.js wrong |
| mint (base) | `#2ECC71` | `#8FD9A8` | `#2ECC71` | cone-renderer.js significantly different green |
| strawberry (base) | `#FF6B9D` | `#E88AAE` | `#FF6B9D` | cone-renderer.js muted |
| caramel (base) | `#C68E17` | `#C58A45` | `#C68E17` | cone-renderer.js slightly off |
| peach (base) | `#FFE5B4` | `#F1B37C` | `#FFE5B4` | cone-renderer.js darker |
| butter_pecan (base) | `#F2E7D1` | `#F2E7D1` | `#D4A574` | Starlark significantly different |
| chocolate_custard (base) | `#5A3825` | (missing) | (missing) | ABSENT from 2 of 4 files |
| lemon (base) | `#FFF176` | (missing) | `#FFF176` | ABSENT from cone-renderer.js |
| blackberry (base) | `#6B3FA0` | (missing) | `#6B3FA0` | ABSENT from cone-renderer.js |
| caramel (ribbon) | `#D38B2C` | `#D38B2C` | `#DAA520` | Starlark different gold |
| fudge (ribbon) | `#3B1F0B` | `#4B2E2E` | `#3B1F0B` | cone-renderer.js wrong |
| marshmallow (ribbon) | `#FFFFFF` | `#EDE3D1` | `#FFFFFF` | cone-renderer.js off-white instead of white |
| peanut_butter (ribbon) | `#D4A017` | `#9B6A3A` | `#D4A017` | cone-renderer.js significantly darker |
| andes (topping) | `#1FAE7A` | `#1FAE7A` | `#00897B` | Starlark different teal |
| dove (topping) | `#2B1A12` | `#2B1A12` | `#3B1F0B` | Starlark lighter (matches fudge) |
| pecan (topping) | `#8B5A2B` | `#8B5A2B` | `#8B6914` | Starlark yellower |
| oreo (topping) | `#1A1A1A` | `#3A2E2A` | `#1A1A1A` | cone-renderer.js brownish instead of near-black |

**Why it happens:**
The cone-renderer.js FALLBACK palettes were authored independently as "close enough" approximations before flavor-colors.js became canonical. The Starlark renderer was ported from a different Tidbyt color system with intentionally tweaked colors for the LED display (which renders colors differently than LCD screens). Nobody runs an automated diff between the four files. Adding 136 new profiles means potentially adding new base/topping/ribbon colors, and each addition is another opportunity for the files to silently diverge further.

**Consequences:**
When the Worker API is unavailable (offline, slow, error), cone-renderer.js falls back to its FALLBACK_* palettes. The user sees visibly different cone colors than when the API is serving. With 176 flavors, some users will see consistent colors (API up) and some will see wrong colors (offline/fallback), creating a confusing "sometimes it looks right" experience. The Tidbyt display already shows different colors than the web for butter_pecan, caramel ribbon, and multiple toppings.

**Prevention:**
1. Before adding any new profiles, fix the existing drift first. Update cone-renderer.js FALLBACK_* to match flavor-colors.js exactly. Add missing keys (chocolate_custard, lemon, blackberry).
2. Create a CI validation script that programmatically compares color hex values across all four files and fails if any drift is detected.
3. For Starlark, decide explicitly: should Tidbyt colors match canonical, or are Tidbyt colors intentionally different for LED display? If intentional, document the divergence in CONE_PROFILE_SPEC.md. If unintentional, fix them.
4. When adding new colors for the 136 profiles, add to all four files in the same commit.

**Detection:**
- diff the hex values in BASE_COLORS, RIBBON_COLORS, TOPPING_COLORS across all four files
- flavor-audit.html shows "unknown topping color" when a key exists in flavor-colors.js but not in the audit page's seed data
- Visually compare: load a page while online (API colors), then reload while offline (FALLBACK colors). Any visible change is a drift bug.

**Phase to address:**
First phase -- fix existing drift BEFORE adding any new profiles. New profiles authored against drifted fallbacks will bake in the wrong colors.

---

### Pitfall 2: Bulk Profile Authoring Without Automated Contrast Validation

**What goes wrong:**
At 136 new profiles, hand-authoring each profile's base/ribbon/topping/density combination introduces systematic errors that are invisible at authoring time but visible to users:
- `dove` (#2B1A12) on `dark_chocolate` (#3B1F0B): contrast ratio 1.3:1 -- invisible at any scale. Already documented in CONE_PROFILE_SPEC.md but there is no automated check preventing it.
- `cheesecake_bits` (#FFF8DC) on `cheesecake` (#FFF5E1): contrast ratio 1.02:1 -- CONE_PROFILE_SPEC.md notes "visible on cheesecake base only at HD" but this is already barely visible even at HD.
- `brownie` (#2D1700) on `dark_chocolate` (#3B1F0B): contrast ratio 1.4:1 -- near-invisible.
- `salt` (#FFFFFF) on `cheesecake` (#FFF5E1): contrast ratio 1.1:1 -- invisible.

At 40 profiles, the CONE_PROFILE_SPEC.md authoring steps ("Check contrast" at step 5) caught these cases manually. At 136 profiles, manual contrast checking will miss combinations because the author is fatigued and the possible base+topping combinations increase quadratically.

**Why it happens:**
The authoring workflow has no automated guard rail. CONE_PROFILE_SPEC.md step 5 says "Check contrast" but provides no tool to do so. The flavor-audit.html page flags "sparse toppings" and "unknown topping color" but does NOT flag low-contrast topping-on-base combinations.

**Consequences:**
Profiles that pass all existing tests (structural invariants, golden hashes) but look wrong to users. The topping pixels exist in the SVG but are invisible against the base color. This is the worst kind of bug: the tests pass, the data is correct, but the visual output is broken.

**Prevention:**
1. Build a contrast validation script that, for each profile in FLAVOR_PROFILES: resolves topping colors against the base color, computes the WCAG contrast ratio, and flags any pair below 3:1 (the minimum for "large text" per WCAG AA). This catches invisible toppings before they ship.
2. Add the contrast check to the flavor-audit.html page as a new flag column. Flag low-contrast pairs with a warning badge.
3. Establish a palette constraint: certain topping colors are PROHIBITED on certain bases. Document these in CONE_PROFILE_SPEC.md as an explicit blocklist (e.g., "never use dove on dark_chocolate or chocolate_custard").
4. Author profiles in batches of 10-15, run the contrast validator after each batch, fix violations before proceeding.

**Detection:**
- Automated contrast ratio script (WCAG luminance formula)
- flavor-audit.html visual inspection at Mini scale (1x) -- if a topping pixel is invisible at 1x, it is a contrast failure
- PNG file size comparison: profiles with invisible toppings produce smaller PNGs (fewer unique colors) than similar profiles with visible toppings

**Phase to address:**
Build the contrast validation tool BEFORE starting bulk profile authoring. Author profiles in batches with validation checkpoints.

---

### Pitfall 3: Rendering Algorithm Changes Break Existing 40 Golden Hashes and 40 PNGs

**What goes wrong:**
The test suite has golden pixel hashes for 5 reference flavors x 4 tiers = 20 golden hashes (flavor-colors.test.js lines 679-700). Any change to the rendering algorithm -- scoop geometry, topping slot positions, ribbon path, highlight/shadow parameters, cone checkerboard -- invalidates ALL golden hashes and ALL 40 existing PNGs simultaneously. The user reports that "even the best SVGs currently look terrible," implying rendering algorithm changes are needed. But changing the algorithm means:
1. All 20 golden hashes need regeneration (run UPDATE_GOLDENS=1 npm test)
2. All 40 existing PNGs need regeneration (run generate-hero-cones.mjs)
3. Every existing cone looks different than before -- users who have seen the current cones will notice the change
4. The service worker has cached the old PNGs; users see old PNGs until the SW cache updates

**Why it happens:**
The golden hash system is designed to detect unintentional rendering changes -- any pixel change anywhere in the output changes the hash. This is the correct behavior for detecting regressions, but it means intentional quality improvements also trigger every test. The temptation is to update goldens and regenerate PNGs in one large commit, making it impossible to distinguish intentional changes from accidental regressions in code review.

**Consequences:**
If rendering changes and new profile additions are mixed in the same commit:
- Cannot tell if a golden hash change is from the algorithm improvement or from a profile bug
- Cannot tell if a PNG looks different because of the algorithm or because the profile was authored wrong
- Reverting a profile bug also reverts the algorithm improvement
- Code review of "136 new profiles + algorithm change" is effectively unreviewable

**Prevention:**
1. Ship rendering algorithm improvements in their own commits, BEFORE adding new profiles. Each algorithm commit should: change the renderer, run UPDATE_GOLDENS=1 to update hashes, regenerate all 40 existing PNGs, and pass all tests. The commit diff clearly shows "algorithm changed, all outputs updated."
2. After the algorithm stabilizes (tests pass, existing 40 PNGs look good in flavor-audit.html), THEN start adding new profiles in batches. Each batch commit changes only FLAVOR_PROFILES entries, regenerates only the new PNGs, and the golden hashes for the 5 reference flavors remain stable.
3. Add more golden reference flavors. The current 5 flavors (vanilla, mint explosion, chocolate caramel twist, dark chocolate decadence, caramel chocolate pecan) cover 5 of the 13 base colors. Add at least one golden per base color to catch base-specific rendering bugs.
4. Bump CACHE_VERSION in sw.js when deploying new PNGs so the service worker picks up the regenerated assets.

**Detection:**
- Golden hash failures in CI
- Git diff showing binary PNG changes to existing flavors
- flavor-audit.html showing different rendering than cached browser version

**Phase to address:**
Algorithm improvement phase FIRST, profile authoring phase SECOND. Never mix them.

---

### Pitfall 4: cone-renderer.js and flavor-colors.js Have Duplicated Rendering Logic That MUST Stay in Sync

**What goes wrong:**
`worker/src/flavor-colors.js` contains the canonical renderers (`renderConeSVG`, `renderConeHDSVG`, `renderConePremiumSVG`, `renderConeHeroSVG`) used by the Worker API and PNG generation pipeline. `docs/cone-renderer.js` contains independently written browser-side renderers (`renderMiniConeSVG`, `renderMiniConeHDSVG`) used as SVG fallback when PNGs are unavailable. These two files implement the same rendering logic in different JavaScript dialects (ES modules with `const`/`let`/arrow functions vs. vanilla JS with `var` and string concatenation) and have DIFFERENT:

- **Scoop geometry**: flavor-colors.js Mini uses scoopRows `[[3,5],[2,6],[1,7],[1,7],[1,7]]` (5 rows). cone-renderer.js uses `[[3,5],[2,6],[1,7],[1,7],[1,7]]` (same). BUT the HD cone in flavor-colors.js has 11 scoop rows including `[4,13]` at the top and `[3,14]` at the bottom, while cone-renderer.js HD has `[[4,13],[2,15],...]` with `[2,15]` at row 1 instead of `[3,14]`. This is a subtle geometry difference that produces different scoop shapes at HD scale.
- **Color resolution**: flavor-colors.js resolves colors from exported constants directly. cone-renderer.js resolves from `flavorColorData` (API response) first, falling back to FALLBACK_* constants. The FALLBACK_* constants are already drifted (see Pitfall 1).
- **No Premium or Hero tier in cone-renderer.js**: The browser fallback only has Mini and HD renderers. If the rendering algorithm changes add a new tier or modify the HD tier, the browser fallback must be updated in lockstep.
- **Profile data flow**: flavor-colors.js reads from the in-memory `FLAVOR_PROFILES` object. cone-renderer.js reads from the API response (`flavorColorData.profiles`), which is a JSON serialization of the same object. If the profile schema changes (e.g., adding `l2_toppings`), the API response shape changes, and cone-renderer.js must handle the new fields.

**Why it happens:**
cone-renderer.js was extracted from duplicated inline code across HTML pages (per its own header comment). It was made independent of the Worker code because the docs/ directory serves from GitHub Pages with no build step -- it cannot import ES modules from worker/src/. This architectural constraint means any rendering logic change must be manually ported between the two files.

**Consequences:**
After modifying the rendering algorithm in flavor-colors.js:
- PNGs regenerated from the new algorithm look correct
- SVG fallbacks rendered by cone-renderer.js still use the OLD algorithm
- When a user's PNG fails to load (404, slow network, new flavor without a PNG), the fallback SVG looks visibly different from the PNG -- different scoop shape, different topping placement, different colors
- This is most visible on new flavors that have profiles but no PNGs yet (the user sees only the fallback SVG, which uses the old algorithm)

**Prevention:**
1. After any rendering algorithm change in flavor-colors.js, port the same change to cone-renderer.js in the same commit. The two files use different JS syntax but identical grid geometry and slot positions.
2. Add a test that renders the same flavor through both flavor-colors.js renderConeSVG and a simulated cone-renderer.js renderMiniConeSVG (using the canonical color data, not fallbacks) and asserts pixel-identical output. This catches sync drift as a test failure.
3. Consider generating cone-renderer.js from flavor-colors.js as a build step (even a simple Node script that transpiles ES module syntax to var/function syntax). This eliminates manual porting entirely.
4. If algorithm changes introduce new features (new scoop geometry, new topping placement logic, new l2_toppings override handling), verify that cone-renderer.js already handles them. The l2_toppings feature was correctly ported (cone-renderer.js lines 215-231), proving the pattern works when followed.

**Detection:**
- Render a flavor via both files at the same scale, compare the SVG output byte-for-byte
- Visual comparison in flavor-audit.html: does the SVG column match the PNG column?
- Grep for hardcoded slot positions (topping slots, ribbon slots, scoop rows) in both files and diff them

**Phase to address:**
Every rendering algorithm change commit must include the cone-renderer.js port. Do not defer porting to a later phase.

---

### Pitfall 5: Sharp Rasterization Produces Blurry PNGs at 120px Width

**What goes wrong:**
The generate-hero-cones.mjs pipeline renders Hero SVGs at scale 4 (= 144x168px) then resizes to 120px width via `sharp(svgBuffer).resize({ width: 120, kernel: 'nearest' })`. The `kernel: 'nearest'` preserves pixel art crispness (no anti-aliasing), but 120px is not an even multiple of the 36px Hero grid width: 120 / 36 = 3.33x. Nearest-neighbor resampling at a non-integer scale factor means some pixel columns are 3px wide and others are 4px wide, producing an uneven grid that looks subtly wrong -- waffle cone checkerboard lines are inconsistent widths, topping pixels are different sizes.

The user reports that "even the best SVGs currently look terrible." If the issue is this non-integer scaling, improving the SVG rendering algorithm will not fix the PNG output because the quality loss happens during rasterization.

**Why it happens:**
The scale factor (4x = 144px source, resized to 120px = 0.833x downsample) was chosen to produce a "nice round" output width (120px) without considering that pixel art requires integer scale factors to look correct. Nearest-neighbor at non-integer factors produces visible artifacts that anti-aliased resampling would smooth out -- but anti-aliasing destroys the pixel art aesthetic.

**Consequences:**
Every PNG has subtly uneven pixel sizes. The waffle cone checkerboard (the most regular pattern in the image) makes the unevenness most visible -- some checkerboard squares are 3px and others are 4px. This is likely a significant contributor to the "looks terrible" assessment.

**Prevention:**
1. Choose output dimensions that are exact integer multiples of the grid size. For the 36x42 Hero grid: scale 3 = 108x126px, scale 4 = 144x168px, scale 5 = 180x210px. Skip the resize step entirely and output at the native scale.
2. If 144px is too large for the hero image container, adjust the CSS to display the image at the desired visual size using `width`/`height` CSS properties on the `<img>` element, keeping the underlying PNG at a clean integer multiple.
3. If a specific output width is required (e.g., 120px), render the SVG at a scale that produces exactly that width. For 120px: 120 / 36 = 3.33x (bad). Instead, render at scale 3 (108px) and let the browser upscale via CSS, or render at scale 4 (144px) and let the browser downscale via CSS with `image-rendering: pixelated`.
4. Add `image-rendering: pixelated` (or `-ms-interpolation-mode: nearest-neighbor` for Edge) to the `.hero-cone-img` CSS class to ensure the browser preserves pixel art crispness during display scaling.

**Detection:**
- Zoom in on any generated PNG at 400% and check if all checkerboard squares are the same size
- Compare PNG output at 120px vs. 144px (native scale 4) -- the 144px version should look noticeably crisper
- Count unique pixel widths in a horizontal slice of the checkerboard -- should be exactly 1 width for clean scaling

**Phase to address:**
Address during the rendering algorithm improvement phase, BEFORE regenerating PNGs for all 176 flavors. Regenerating 176 PNGs at the wrong scale factor and then fixing it later means regenerating all 176 again.

---

## Moderate Pitfalls

### Pitfall 6: Keyword Fallback Ordering Bug Creates Wrong Profiles

**What goes wrong:**
`getFlavorProfile()` in flavor-colors.js (lines 126-149) uses sequential `if (key.includes(...))` checks as a keyword fallback for unknown flavors. The ordering matters: `'double butter pecan'` is checked before `'butter pecan'` (line 137 before line 145), which is correct. But `'chocolate'` (line 140) is checked before `'vanilla'` (line 146), which means a flavor like "Chocolate Vanilla Twist" matches `chocolate` first and gets a chocolate base even if the flavor is primarily vanilla.

At 136 new profiles, many of the new flavors will NOT have exact-match profiles during development (profiles are added incrementally). During the gap between "flavor appears in upstream data" and "profile added to FLAVOR_PROFILES," the keyword fallback determines what the user sees. Wrong fallback ordering means wrong base colors for days or weeks.

**Prevention:**
1. Order keyword checks from most specific to least specific. Check compound keywords first (`'double butter pecan'`, `'dark choc'`, `'butter pecan'`) before single-word keywords (`'chocolate'`, `'vanilla'`, `'mint'`).
2. Add a "fallback coverage" test that runs every known upstream flavor name through `getFlavorProfile()` and asserts the fallback base color is reasonable. This catches "chocolate vanilla twist gets chocolate instead of vanilla" before it reaches users.
3. Consider adding a `lemon` keyword check (currently missing -- lemon flavors fall back to vanilla).
4. Consider adding a `blackberry` keyword check (currently missing).

**Detection:**
- New flavors appearing with obviously wrong base colors (e.g., a lemon flavor showing as vanilla because there is no keyword fallback for lemon)
- Test that exercises every keyword path with a flavor name that should match

**Phase to address:**
Add missing keyword checks and reorder existing ones at the start of the profile authoring phase, before any new profiles are added.

---

### Pitfall 7: Service Worker Caches Old PNGs After Regeneration

**What goes wrong:**
The service worker (sw.js) uses stale-while-revalidate for runtime-fetched assets including cone PNGs. When PNGs are regenerated (either from algorithm changes or new profiles), users with an active service worker continue seeing the OLD cached PNGs until the SW's background revalidation completes. For algorithm changes that alter every existing cone, this means every returning user sees the old rendering on their first visit after deployment.

At 176 PNGs, the SW runtime cache holds potentially 176 x ~10KB = ~1.8MB of PNG data. The stale-while-revalidate strategy serves all of these from cache immediately and fetches updates in the background. The user sees stale cones until their next page load.

**Prevention:**
1. Bump CACHE_VERSION in sw.js whenever PNGs are regenerated. This triggers the activate handler to delete the old cache entirely.
2. For algorithm changes that affect all existing PNGs, the CACHE_VERSION bump is mandatory.
3. For new-profile-only additions (new PNGs, no changes to existing PNGs), a CACHE_VERSION bump is optional but recommended for consistency.
4. Do NOT add cone PNGs to the SW pre-cache list (STATIC_ASSETS). They belong in the runtime cache. Pre-caching 176 PNGs would add ~1.8MB to the initial SW install payload.

**Detection:**
- Users reporting "cones look different after I refresh" (stale-while-revalidate serving old version first)
- CACHE_VERSION not bumped in a commit that regenerates PNGs

**Phase to address:**
Every deployment that includes PNG regeneration must bump CACHE_VERSION.

---

### Pitfall 8: Flavor Name Normalization Inconsistencies Across Renderers

**What goes wrong:**
The canonical renderer (flavor-colors.js) normalizes flavor names via `getFlavorProfile()` which lowercases and normalizes unicode curly quotes. The browser-side renderer (cone-renderer.js) normalizes via `normalizeFlavorKey()` which additionally strips TM/R symbols and normalizes whitespace. The Starlark renderer uses its own normalization (Python `.lower()`). If upstream flavor data contains characters that one normalizer handles and another doesn't, the renderers produce different profile lookups for the same flavor name.

At 136 new profiles, the chance of encountering flavor names with non-ASCII characters, trademark symbols, or unusual whitespace increases. Culver's flavor names are known to use unicode curly quotes (e.g., "Reese's" with `\u2019`).

**Prevention:**
1. Ensure all three normalizers handle the same character set: lowercase, strip TM/R, normalize curly quotes, collapse whitespace.
2. Add test cases with TM/R symbols, curly quotes, and multiple spaces to the flavor-colors.test.js suite.
3. When adding new profiles, use the exact lowercase name as it appears in upstream data as the profile key, and verify it matches what each normalizer produces.

**Detection:**
- A flavor name matches a profile in flavor-colors.js but not in cone-renderer.js (or vice versa)
- A flavor shows correct colors on the Worker-rendered social card but wrong colors on the browser-rendered SVG fallback

**Phase to address:**
Harmonize normalizers before starting profile authoring. Test with known problematic names from upstream data.

---

### Pitfall 9: HD Scoop Geometry Inconsistency Between Canonical and Browser Renderers

**What goes wrong:**
The HD cone scoop geometry differs subtly between the two renderers. In flavor-colors.js `renderConeHDSVG()`, the scoopRows start with `[4, 13]` at row 0, then `[3, 14]` at row 1, then `[2, 15]` for rows 2-9, then `[2, 15]` at row 10 (which is labeled as "12px, full-width bottom"). In cone-renderer.js `renderMiniConeHDSVG()`, the scoopRows are `[[4,13],[2,15],[2,15],...,[2,15]]` -- 11 rows but row 1 jumps directly from `[4,13]` to `[2,15]`, skipping the intermediate `[3,14]` taper.

This means the canonical HD cone has a 3-step taper (row 0: 10px, row 1: 12px, row 2+: 14px) while the browser fallback HD cone has a 2-step taper (row 0: 10px, row 1+: 14px). The browser fallback produces a slightly different scoop shape -- wider at the top.

**Consequences:**
When a PNG fails to load and the browser falls back to `renderMiniConeHDSVG()`, the resulting SVG has a different scoop shape than the PNG it replaces. This is visible when both PNGs and SVGs appear on the same page (e.g., some flavors have PNGs and others fall back to SVG).

**Prevention:**
1. Copy the exact scoopRows from flavor-colors.js `renderConeHDSVG()` to cone-renderer.js `renderMiniConeHDSVG()`.
2. Add a cross-renderer pixel comparison test.

**Detection:**
- Render the same flavor through both HD renderers at scale 1 and compare the pixel maps

**Phase to address:**
Fix during the rendering sync phase (same as Pitfall 1 fix).

---

### Pitfall 10: Batch PNG Generation Without Idempotency Produces Inconsistent Git History

**What goes wrong:**
Running `generate-hero-cones.mjs` multiple times should produce identical PNGs. But sharp's SVG rasterization is not guaranteed to be bit-identical across different versions of sharp, libvips, or even between macOS and Linux. If one developer generates PNGs on macOS with sharp 0.33 and another generates on Linux with sharp 0.34, the resulting PNGs are visually identical but byte-different, producing noisy git diffs where every PNG shows as "modified" even though nothing changed visually.

At 176 PNGs, a full regeneration that produces byte-different (but visually identical) output creates a commit with 176 binary file changes, making it impossible to identify which PNGs actually changed visually.

**Prevention:**
1. Pin the sharp version in package.json (not a range).
2. Document the required OS/architecture for generation (or use a container).
3. Only regenerate PNGs that have changed profiles. Add a script that diffs FLAVOR_PROFILES against the last generation run and only regenerates changed/new profiles.
4. Consider storing a generation metadata file (e.g., `docs/assets/cones/manifest.json`) that records the profile hash for each PNG. Only regenerate when the profile hash changes.

**Detection:**
- Git diff shows binary changes to PNGs whose profiles did not change
- CI shows hundreds of PNG file changes in a commit that only added 10 new profiles

**Phase to address:**
Implement selective regeneration before scaling to 176 flavors. At 40 flavors, full regeneration is quick. At 176, it is wasteful and produces noisy diffs.

---

## Minor Pitfalls

### Pitfall 11: Missing chocolate_custard in Keyword Fallback Chain

**What goes wrong:**
`getFlavorProfile()` has no keyword fallback for `chocolate_custard`. Flavors with "custard" in the name (e.g., "Chocolate Custard Surprise") would match `chocolate` (line 140) and get the lighter `#6F4E37` base instead of the deeper `#5A3825` custard base. This is visually wrong -- chocolate custard flavors should use the richer, deeper brown.

**Prevention:**
Add a keyword check for `'custard'` before the `'chocolate'` check, returning `chocolate_custard` base.

**Phase to address:**
Fix during keyword fallback cleanup (Pitfall 6).

---

### Pitfall 12: l2_toppings Override Only Exists for One Flavor

**What goes wrong:**
The `l2_toppings` per-pixel override feature (precise topping placement for specific flavors) was added for `blackberry cobbler` and is handled correctly in both flavor-colors.js and cone-renderer.js. But if multiple new flavors need precise placement (e.g., flavors where the fixed slot positions produce poor results), the l2_toppings format must be documented and tested for edge cases: positions outside scoop bounds, duplicate positions, positions that collide with ribbon slots.

**Prevention:**
1. Add test cases for l2_toppings edge cases: position at scoop boundary, position outside scoop, empty array.
2. Document the l2_toppings format in CONE_PROFILE_SPEC.md (currently undocumented -- it only exists in the code).
3. Validate l2_toppings positions against the scoop mask in the contrast validation script.

**Phase to address:**
Address when authoring profiles that need l2_toppings overrides.

---

### Pitfall 13: Topping Color Key Mismatches Between Profile and Palette

**What goes wrong:**
A profile can reference a topping key (e.g., `'pretzel'`) that does not exist in `TOPPING_COLORS`. The renderer silently skips the topping (`if (!color) continue;`). The profile appears valid, the tests pass (structural invariants only check that pixels are within bounds, not that all toppings rendered), but the cone is missing a topping.

At 136 new profiles, the risk of typos in topping keys increases. A profile with `toppings: ['peanut_butter_cup']` would silently produce no topping because the key is `reeses` not `peanut_butter_cup`.

**Prevention:**
1. Add a test that iterates all profiles and asserts every topping key exists in TOPPING_COLORS.
2. Add a test that iterates all profiles and asserts every base key exists in BASE_COLORS and every ribbon key exists in RIBBON_COLORS.
3. Run this test as part of CI so typos are caught before merge.

**Detection:**
- flavor-audit.html flags "unknown topping color"
- Cone renders with fewer toppings than expected (topping pixel count < density slot count)

**Phase to address:**
Add the validation test before starting profile authoring.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Fix existing color drift | Updating FALLBACK colors in cone-renderer.js but missing Starlark | Diff all four files as a validation step before committing |
| Rendering algorithm improvement | All 20 golden hashes break, all 40 PNGs regenerated | Ship algorithm changes in their own commit, separate from profile additions |
| PNG scale factor fix | Choosing a new output size breaks CSS layout | Test the new PNG dimensions in all display contexts (hero, index, quiz, social card) |
| Keyword fallback cleanup | Adding new keywords that shadow existing ones | Test with ALL known upstream flavor names, not just the new ones |
| Batch profile authoring (first 15) | Low-contrast toppings pass tests but look invisible | Run contrast validator, review in flavor-audit.html at Mini scale |
| Batch profile authoring (16-136) | Fatigue-driven errors -- wrong base, wrong density, typo in topping key | Use the automated validation suite (contrast, key existence, structural invariants) on every batch |
| PNG generation for new profiles | Sharp version difference produces byte-different PNGs for existing unchanged profiles | Pin sharp version, only regenerate changed profiles |
| Service worker update | Users see old PNGs until next page load | Bump CACHE_VERSION in the same commit as PNG deployment |
| cone-renderer.js port | Porting rendering changes misses a subtle geometry difference | Add cross-renderer pixel comparison test |
| New base/topping/ribbon colors | Adding to flavor-colors.js but forgetting cone-renderer.js FALLBACK or Starlark | CI script that diffs color keys across all four files |

## "Looks Done But Isn't" Checklist

- [ ] **All four sync files updated:** Check that flavor-colors.js, cone-renderer.js, culvers_fotd.star, and flavor-audit.html all have the same color palette keys and hex values
- [ ] **Contrast validation passes:** Every topping/base combination in all 176 profiles has >= 3:1 contrast ratio
- [ ] **No silent topping drops:** Every topping key in every profile exists in TOPPING_COLORS
- [ ] **PNG scale factor is integer:** Output PNG dimensions are exact integer multiples of the grid dimensions (36x42 for Hero)
- [ ] **Golden hashes stable after profile additions:** Adding new profiles should NOT change golden hashes for existing reference flavors. If they change, the algorithm changed too (unintentional regression)
- [ ] **cone-renderer.js HD geometry matches:** Scoop rows in renderMiniConeHDSVG match renderConeHDSVG exactly
- [ ] **Keyword fallback coverage:** All 13 base color keys have a keyword fallback path (currently missing: lemon, blackberry, chocolate_custard)
- [ ] **CACHE_VERSION bumped:** sw.js CACHE_VERSION updated in the same commit as any PNG regeneration
- [ ] **flavor-audit.html shows zero warnings:** All profiles render correctly, no "unknown topping color" or "sparse toppings" flags
- [ ] **Offline fallback matches online rendering:** Load page with API available, note cone colors. Reload offline. Colors should be identical.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Color drift in fallback palettes | LOW | Update FALLBACK_* in cone-renderer.js to match flavor-colors.js; deploy |
| Invisible toppings (low contrast) | MEDIUM | Re-author affected profiles with different base or topping colors; regenerate PNGs; deploy |
| Rendering algorithm regression after goldens updated | HIGH | Cannot distinguish intentional from accidental changes. Must manually inspect each reference flavor's rendering. Prevention (separate commits) is far cheaper than recovery. |
| Wrong PNG scale factor baked into 176 PNGs | HIGH | Must regenerate ALL 176 PNGs at the correct scale. If the old PNGs are already deployed, bump CACHE_VERSION to flush them from SW cache. |
| cone-renderer.js out of sync after algorithm change | MEDIUM | Port the algorithm change; deploy. Risk: users saw inconsistent rendering between PNG and SVG fallback during the gap. |
| Topping key typo in 30+ profiles | MEDIUM | Find and fix all typos; regenerate affected PNGs. Automated key validation test prevents this entirely. |
| Service worker serving stale PNGs | LOW | Bump CACHE_VERSION; deploy. Users get new PNGs on next page load after SW updates. |

## Sources

- Codebase inspection: `worker/src/flavor-colors.js` (826 lines, 4 renderer tiers, 40 profiles), `docs/cone-renderer.js` (367 lines, 2 renderer tiers, FALLBACK color palettes), `tidbyt/culvers_fotd.star` (120+ lines inspected, independent color palettes), `worker/test/flavor-colors.test.js` (729 lines, 20 golden hashes, structural invariants for all tiers x all flavors), `scripts/generate-hero-cones.mjs` (128 lines, sharp pipeline with nearest-neighbor resampling at non-integer scale), `CONE_PROFILE_SPEC.md` (268 lines, authoring workflow, 4-file sync requirement), `docs/flavor-audit.html` (audit page with quality flags), `docs/assets/cones/` (40 existing PNGs)
- WCAG 2.1 contrast ratio requirements: minimum 3:1 for large text/UI components
- sharp documentation: nearest-neighbor resampling behavior at non-integer scale factors
- Existing v1.2 PITFALLS.md: service worker caching patterns, CACHE_VERSION bump requirements

---
*Pitfalls research for: Custard Calendar v1.3 Asset Parity -- bulk flavor profiles + rendering quality*
*Researched: 2026-03-09*
