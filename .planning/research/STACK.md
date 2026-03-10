# Technology Stack: v1.3 Asset Parity

**Project:** Custard Calendar v1.3
**Researched:** 2026-03-09
**Scope:** Stack changes for improving SVG rendering quality, scaling flavor profiles to 176+ flavors, and ensuring consistent visual output across Mini/HD/Hero/Premium tiers
**Confidence:** HIGH

## Constraints (Inherited -- Non-Negotiable)

| Constraint | Implication for v1.3 |
|------------|---------------------|
| No build step (GitHub Pages) | Asset generation is a local script (`scripts/generate-hero-cones.mjs`), not a CI pipeline. PNGs are committed to git. |
| Sharp stays | sharp 0.33.5 is the validated rasterizer. Do NOT switch to resvg-js or another renderer (see Alternatives Considered). |
| Vanilla JS client (var, IIFEs) | `docs/cone-renderer.js` must stay var-based IIFE. No ESM imports on the frontend. |
| Worker code frozen | `worker/src/flavor-colors.js` is the canonical renderer. No architectural changes to the Worker API layer. |
| 4 color palettes in sync | BASE_COLORS, RIBBON_COLORS, TOPPING_COLORS, CONE_COLORS must stay identical across `flavor-colors.js`, `cone-renderer.js`, `flavor-audit.html` seeds, and `culvers_fotd.star`. |

## Recommended Stack

### Core Rendering (KEEP -- no changes)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| sharp | 0.33.5 | SVG-to-PNG rasterization | Already validated. Handles `shape-rendering="crispEdges"` correctly via libvips/rsvg. Upgrading to 0.34.x adds `svg.highBitdepth` and `svg.stylesheet` options but is unnecessary -- our SVGs are simple rect grids with no gradients, filters, or text that would benefit from 32-bit rendering. Stay on 0.33.5 unless a specific bug surfaces. |
| flavor-colors.js | N/A (source) | Algorithmic SVG generation (Mini 9x11, HD 18x22, Premium 24x28, Hero 36x42) | Single source of truth for all cone rendering. All quality improvements happen HERE, not in the rasterizer. |
| cone-renderer.js | N/A (source) | Client-side SVG rendering with API data fallback | Mirrors flavor-colors.js rendering logic for browser-side display. Must stay in sync. |

### Quality Improvement: Render Pipeline Changes (MODIFY)

The primary quality issue is NOT sharp or the rasterizer. The SVGs themselves are the quality bottleneck. The current `generate-hero-cones.mjs` pipeline works correctly:

1. Renders a 36x42 pixel-grid SVG at scale 4 (= 144x168 SVG viewport)
2. Rasterizes via sharp with `kernel: 'nearest'` (correct for pixel art)
3. Resizes to 120px wide output PNG

The quality problems are:

- **Grid resolution**: Even at Hero tier (36x42), the pixel art has limited detail. At 120px wide display, each "pixel" is ~3.3 real pixels. This is fine for pixel art aesthetic but the project description says "best current SVGs still look terrible."
- **Scale mismatch**: The script renders at scale 4 (144px) then downscales to 120px. This is a non-integer scale which introduces slight artifacts even with nearest-neighbor.
- **Missing profiles**: 136 of ~176 flavors have no explicit profile and fall through to generic keyword-matching fallbacks, producing visually indistinct cones.

**Recommended pipeline changes (no new dependencies):**

| Change | What | Why |
|--------|------|-----|
| Increase render scale | Change `renderConeHeroSVG(flavorName, 4)` to `renderConeHeroSVG(flavorName, 10)` (= 360x420 SVG) | Rasterize at higher resolution before downscaling. This gives sharp's resize more pixels to work with and avoids the non-integer 144->120 scale. At scale 10, downscaling to 120px is a clean 3:1 ratio (360/120 = 3). |
| Match output to integer scale | Set output width to 120px (from 360px source = exactly 3x downsample) | Integer scaling ratios preserve pixel-art crispness with nearest-neighbor interpolation. |
| Add `density` option | Pass `{ density: 300 }` to sharp constructor when loading SVG buffer | Forces libvips to rasterize the SVG at 300 DPI instead of default 72 DPI. For simple rect-grid SVGs this produces cleaner edges at the native resolution before any resize. |
| PNG compression | Use `.png({ compressionLevel: 9, adaptiveFiltering: true })` | Smaller file sizes for 176+ PNGs committed to git. No visual quality impact (PNG is lossless). |

```javascript
// BEFORE (current pipeline)
const svg = renderConeHeroSVG(flavorName, 4);  // 144x168
const png = await sharp(Buffer.from(svg))
  .resize({ width: 120, kernel: 'nearest' })
  .png()
  .toBuffer();

// AFTER (recommended)
const svg = renderConeHeroSVG(flavorName, 10);  // 360x420
const png = await sharp(Buffer.from(svg), { density: 300 })
  .resize({ width: 120, kernel: 'nearest' })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer();
```

### Quality Validation: New Dev Dependencies (ADD)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pixelmatch | ^6.0.0 | Pixel-level image comparison | Regression testing: compare newly generated PNGs against baseline snapshots to detect unintended visual changes when modifying rendering logic or profiles. |
| pngjs | ^7.0.0 | PNG decode/encode for Node.js | Required by pixelmatch to read PNG buffers into raw pixel arrays for comparison. |

**Why pixelmatch:** When scaling from 40 to 176+ profiles, you need automated visual regression detection. Manual eyeballing does not scale. pixelmatch is 150 lines, zero dependencies (beyond pngjs for I/O), and produces diff images showing exactly which pixels changed. Use it in a test script, not in production.

**Integration approach:**
```javascript
// scripts/test-cone-quality.mjs (new file)
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import sharp from 'sharp';

// Compare newly generated PNG against baseline
const baseline = PNG.sync.read(readFileSync('baseline/vanilla.png'));
const current = PNG.sync.read(readFileSync('docs/assets/cones/vanilla.png'));
const diff = new PNG({ width: baseline.width, height: baseline.height });

const mismatch = pixelmatch(
  baseline.data, current.data, diff.data,
  baseline.width, baseline.height,
  { threshold: 0.0 }  // Exact match for pixel art
);

if (mismatch > 0) {
  console.error(`vanilla.png: ${mismatch} pixels differ`);
  PNG.sync.write(diff, 'diffs/vanilla-diff.png');
}
```

### Batch Profiling Tools (NO new dependencies)

Scaling from 40 to 176+ profiles is a **data entry problem**, not a technology problem. The existing profile schema (`{ base, ribbon, toppings, density }`) is sufficient. What is needed:

| Need | Solution | New Dependency? |
|------|----------|-----------------|
| List of unprofiled flavors | Query D1 `SELECT DISTINCT flavor FROM flavor_snapshots` or parse the KV flavor catalog | No -- use existing Worker API |
| Profile authoring | Manual entry in `flavor-colors.js` following cone-profile-spec.md | No |
| Quality validation | `flavor-audit.html` already renders all tiers side-by-side with quality flags | No |
| Batch generation | `generate-hero-cones.mjs` already iterates `Object.keys(FLAVOR_PROFILES)` | No |
| New base/topping colors | Add to `BASE_COLORS` / `TOPPING_COLORS` + sync across 4 files | No |

**Expected new colors for 176+ coverage:**

Based on the Culver's catalog and independent brand flavors, profiles for ~136 new flavors will likely require:
- 2-4 new base colors (e.g., `pumpkin`, `coffee`, `cookie_butter`)
- 3-6 new topping colors (e.g., `sprinkles`, `graham_cracker`, `toffee`, `white_chocolate`, `pumpkin_spice`, `coconut`)
- 1-2 new ribbon colors (e.g., `strawberry`, `lemon`)

These are added to existing palette objects -- no structural changes needed.

### Sharp Upgrade Path (DEFER)

| Version | Key Changes | Recommendation |
|---------|-------------|----------------|
| 0.33.5 (current) | Stable, validated, libvips 8.16.x | KEEP for v1.3 |
| 0.34.5 (latest stable) | libvips 8.17.3, `svg.highBitdepth`, `svg.stylesheet`, MKS resize kernels | DEFER -- our SVGs are trivial rect grids. No benefit from 32-bit rendering or CSS injection. MKS kernels are irrelevant when we use `nearest`. |
| 0.35.0-rc.0 (prerelease) | Unknown, still RC | SKIP -- never use prerelease in production asset pipeline |

**Upgrade trigger:** Upgrade to 0.34.x only if:
- A security CVE is reported in the libvips version bundled with 0.33.x
- A specific SVG rendering bug is encountered that is fixed in 0.34.x
- The project moves to more complex SVGs (gradients, filters, text) where `svg.highBitdepth` matters

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| SVG rasterizer | sharp 0.33.5 | @resvg/resvg-js 2.6.2 | resvg-js produces higher SVG spec compliance but crashes on batches >400 SVGs (documented stability issue). Our SVGs are trivially simple rect grids -- spec compliance differences are invisible. Sharp is 3x faster for batch conversion. resvg-js also hasn't been published in 2+ years (last: 2.6.2). |
| SVG rasterizer | sharp 0.33.5 | @resvg/resvg-wasm | WASM backend is even slower than the native resvg-js. Only useful in browser/edge environments. We run this locally on macOS. |
| SVG rasterizer | sharp 0.33.5 | sips (macOS) | Already exists as fallback in generate-hero-cones.mjs. Lower quality than sharp, macOS-only, no density control. Fine as emergency fallback, not primary. |
| Visual regression | pixelmatch | Playwright screenshot comparison | Playwright is already in devDeps but comparing screenshots adds browser startup overhead per image. pixelmatch compares raw PNG buffers in ~1ms per image. For 176+ images, pixelmatch is the right tool. |
| Visual regression | pixelmatch | looks-same (by Gemini) | Higher-level API but 10x more dependencies. pixelmatch is 150 LOC with zero deps. |
| Batch profiling | Manual entry | LLM-assisted profile generation | Flavor-to-profile mapping is subjective (which toppings? which density?). LLM output would still need human review per the cone-profile-spec.md authoring rules. Manual entry against the spec is faster than review-and-fix. |
| PNG output format | PNG (120x140) | WebP | GitHub Pages serves WebP fine, but browser `<img onerror>` fallback in cone-renderer.js would need format detection. Added complexity for marginal file size savings on small images (~2-5KB each). Not worth it for 176 images. |

## Installation

```bash
# In worker/ directory (where sharp is already installed)
cd worker

# Quality validation tools (dev only)
npm install -D pixelmatch@^6.0.0 pngjs@^7.0.0
```

No production dependencies change. pixelmatch and pngjs are devDependencies for the local asset generation/validation workflow only.

## Integration Points

### Existing Pipeline (generate-hero-cones.mjs)

The script already has the right structure. Changes are parameter-level:

1. **Input**: `renderConeHeroSVG(flavorName, scale)` -- change scale from 4 to 10
2. **Processing**: `sharp(svgBuffer)` -- add `{ density: 300 }` option
3. **Resize**: `.resize({ width: 120, kernel: 'nearest' })` -- no change
4. **Output**: `.png()` -- add `{ compressionLevel: 9, adaptiveFiltering: true }`

### Existing Validation (flavor-audit.html)

Already renders all tiers (Tidbyt 1x, Mini 5x, HD 8x, Hero PNG, Premium) side-by-side with automatic quality flags for:
- Sparse toppings
- Unknown topping/ribbon colors
- Missing profiles
- Contrast issues

No changes needed to the audit page itself. It will automatically pick up new profiles added to the flavor-colors.js FLAVOR_PROFILES object.

### Client-Side Rendering (cone-renderer.js)

No changes to this file for v1.3. The client renderer serves two purposes:
1. **Live rendering**: Mini and HD SVGs in the browser
2. **PNG fallback**: `renderHeroCone()` tries PNG first, falls back to HD SVG on load error

Once all 176+ flavors have PNGs, the HD SVG fallback path becomes rare (only for newly added flavors before the next PNG generation run).

### Four-File Sync Requirement

When adding new BASE_COLORS, TOPPING_COLORS, or RIBBON_COLORS:

| File | Location | Format |
|------|----------|--------|
| `worker/src/flavor-colors.js` | Canonical source | ESM exports |
| `docs/cone-renderer.js` | Client fallback | `var FALLBACK_*` globals |
| `docs/flavor-audit.html` | Audit seed data | Inline `SEED_*` constants |
| `tidbyt/culvers_fotd.star` | Tidbyt renderer | Starlark dicts |

All four must stay in sync. The flavor-audit.html page flags mismatches between API-served and seed palette colors.

## Summary

**What changes:** Render scale (4 -> 10), density option (72 -> 300), PNG compression settings, add pixelmatch+pngjs as devDeps for quality regression testing.

**What does NOT change:** sharp version, SVG generation approach, client-side renderer, four-file sync pattern, flavor-audit.html, service worker caching.

**Why this is sufficient:** The rendering quality problem is not in the rasterizer (sharp produces clean output from the SVGs it receives). The problems are: (a) insufficient source resolution before downscaling, (b) non-integer scale ratio causing sub-pixel artifacts, and (c) missing flavor profiles causing generic fallbacks. All three are solved by parameter changes and data entry, not new libraries.

## Sources

- [sharp official documentation](https://sharp.pixelplumbing.com/) -- constructor, resize, and output API references (HIGH confidence)
- [sharp resize API - kernel options](https://sharp.pixelplumbing.com/api-resize/) -- nearest, lanczos3, MKS kernels (HIGH confidence)
- [sharp constructor API - density and SVG options](https://sharp.pixelplumbing.com/api-constructor/) -- density 1-100000, svg.highBitdepth, svg.stylesheet (HIGH confidence)
- [sharp output API - PNG options](https://sharp.pixelplumbing.com/api-output/) -- compressionLevel, adaptiveFiltering, palette (HIGH confidence)
- [sharp changelog v0.34.5](https://sharp.pixelplumbing.com/changelog/v0.34.5/) -- SVG input parameters exposed in 0.34.x (HIGH confidence)
- [sharp vs resvg-js comparison](https://github.com/thx/resvg-js/issues/145) -- sharp 3x faster, resvg-js crashes >400 SVGs (MEDIUM confidence)
- [sharp vs resvg-js benchmark](https://github.com/privatenumber/sharp-vs-resvgjs) -- performance and DPI handling comparison (MEDIUM confidence)
- [pixelmatch on GitHub](https://github.com/mapbox/pixelmatch) -- 150 LOC, zero deps, pixel-level comparison (HIGH confidence)
- [resvg-js on GitHub](https://github.com/thx/resvg-js) -- shapeRendering crispEdges support, last published 2+ years ago (MEDIUM confidence)
- [Culver's Flavor of the Day catalog](https://www.culvers.com/flavor-of-the-day) -- ~30 official Culver's flavors as of March 2026 (HIGH confidence)
