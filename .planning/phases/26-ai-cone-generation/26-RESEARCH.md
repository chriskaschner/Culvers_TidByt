# Phase 26: AI Cone Generation - Research

**Researched:** 2026-03-18
**Domain:** AI image generation (gpt-image-1), image post-processing (sharp), prompt engineering for pixel art
**Confidence:** HIGH

## Summary

Phase 26 generates L5-quality AI pixel art cone PNGs for all 94 profiled flavors using OpenAI's gpt-image-1 model. The project already has substantial infrastructure: a generation script (`tools/generate_ai_sprites.mjs`) with retry logic and rate limiting, a prompt template system (`masterlock-flavor-fills.json`), a sharp-based post-processing pipeline (`scripts/generate-hero-cones.mjs`), and a proof-of-concept L5 image (blackberry cobbler at 512x768).

The primary gap is that only 1 of 94 flavors has a premium treatment override (the richly descriptive prompt text that makes L5 quality possible). The remaining 93 must be authored. Additionally, `docs/flavors.json` only contains 40 of 94 flavors, so 54 flavor descriptions are missing from the prompt data pipeline. The generation script needs modification to support gpt-image-1's `background: 'transparent'` parameter and the new quality settings (`low`/`medium`/`high` instead of DALL-E 3's `standard`/`hd`).

**Primary recommendation:** Extend the existing generation and post-processing scripts rather than building new ones. The biggest creative work is authoring 93 premium treatment overrides -- structured text describing marbling, chunk details, and texture per flavor.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Pixel art style matching blackberry cobbler L5 proof-of-concept -- crisp pixel edges, 32-64px density, clearly pixel-based
- Premium treatment overrides for ALL 94 flavors (not just canonical auto-generated treatments) -- marbling, realistic chunks, sauce ribbons, per-flavor texture notes
- Author 93 premium treatment overrides (blackberry cobbler already has one)
- Transparent backgrounds via gpt-image-1 native `background: 'transparent'` -- no post-processing background removal
- Cone tip same tone as rest of waffle cone (no darkened tip)
- Soft studio lighting from upper left, gentle highlight across scoop, subtle shadow under scoop lip
- Trial run first: 3 representative flavors, 3 candidates each at BOTH medium and high quality
- User reviews trial output to decide medium vs high quality for the full batch
- After quality decision: 3 candidates per flavor for all 94 flavors (~282 total candidates)
- PNG format (drop-in replacement, no heroConeSrc() changes needed)
- Post-processing via sharp pipeline: trim, resize, optimize
- gpt-image-1 model (DALL-E 3 deprecated May 2026)
- HTML gallery with accept/reject per flavor -- shows all 3 candidates side by side
- Click to accept one candidate per flavor, flag others for regeneration
- Gallery writes selections to a manifest file
- Quality bar: "reads as the right flavor" -- correct base color, visible toppings match the profile, recognizable as ice cream cone
- 94/94 approval required before integration phases begin

### Claude's Discretion
- Generation resolution (1024x1024 vs 1024x1536)
- Final post-processed PNG dimensions (144x168 current vs larger for detail)
- Trial flavor selection (3 representative flavors covering different base colors and topping densities)
- Sharp post-processing parameters (trim threshold, resize kernel)
- Rate limiting / delay between API calls
- QA gallery HTML design and interaction patterns

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GEN-01 | All 94 profiled flavors have L5-quality AI-generated pixel art PNGs with transparent backgrounds | gpt-image-1 API with `background: 'transparent'`, premium treatment overrides for all 94 flavors, existing generation script as foundation |
| GEN-02 | Generation prompts are version-controlled in a prompt manifest file per flavor | Extend `masterlock-flavor-fills.json` with 93 new premium treatment overrides, generation manifest tracks model/prompt/params/timestamp per output |
| GEN-03 | QA gallery HTML page displays all 94 generated PNGs side-by-side for visual review before deploy | Static HTML gallery with accept/reject UI, writes selections to manifest JSON, existing `masterlock-audit.html` as design reference |
| GEN-04 | Generated PNGs are post-processed (trimmed, resized, optimized) via sharp pipeline | sharp 0.33.5 already installed in worker, adapt `generate-hero-cones.mjs` pattern: trim + resize (nearest-neighbor kernel) + PNG optimize |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai (npm) | 6.32.0 | OpenAI API client for gpt-image-1 image generation | Official SDK, handles auth/retries/response parsing |
| sharp | 0.33.5 | Post-processing: trim, resize, optimize PNGs | Already installed in worker/node_modules, project has existing sharp patterns |
| Node.js | 23.7.0 | Runtime for generation and post-processing scripts | Already the project runtime for tools/ and scripts/ |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fs/promises | built-in | Async file I/O for reading prompts, writing PNGs | All file operations in generation/post-processing |
| path | built-in | Path construction for output directories | Asset path resolution |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| openai npm SDK | Raw fetch (current pattern) | Raw fetch already works in generate_ai_sprites.mjs; SDK adds type safety but is an extra dependency. Either works -- existing raw fetch pattern is simpler for this use case |
| sharp | Pillow (Python) | Project convention is Node.js for asset tooling; sharp already installed |
| gpt-image-1 | gpt-image-1.5 | 1.5 is newer/better quality but potentially higher cost and may have different behavior; user locked gpt-image-1 |

**Installation:**
```bash
# sharp already available via worker/node_modules
# For openai SDK (if switching from raw fetch):
cd worker && npm install openai
# OR continue using raw fetch as in existing generate_ai_sprites.mjs
```

**Version verification:** sharp 0.33.5 confirmed installed in worker/node_modules. openai 6.32.0 is the latest npm version as of 2026-03-18. Node.js 23.7.0 confirmed on system.

## Architecture Patterns

### Recommended Project Structure
```
tools/
  generate_ai_sprites.mjs      # Extended: gpt-image-1 support, transparent bg, multi-candidate
  generate_masterlock_prompts.mjs  # Extended: 93 new premium treatment overrides
  postprocess_ai_cones.mjs     # New: sharp pipeline for AI-generated PNGs
docs/
  assets/
    cones/{slug}.png            # Final post-processed PNGs (94 files, overwrite existing SVG-rasterized)
    ai-candidates/{slug}/       # Raw API outputs: {slug}-1.png, {slug}-2.png, {slug}-3.png
    masterlock-flavor-fills.json  # Extended with 93 premium overrides
    ai-generation-manifest.json  # Tracks model, prompt, params, timestamp per flavor
  ai-cone-qa.html              # QA gallery for human review
```

### Pattern 1: Generation Resolution and Post-Processing Dimensions

**Recommendation:** Generate at 1024x1024 (square), post-process to 288x336 (2x current 144x168).

**Rationale:**
- The L5 reference image (blackberry cobbler) is 512x768 -- not square. But gpt-image-1 produces better-composed centered subjects at 1024x1024 since the prompt says "1:1 aspect ratio"
- 1024x1536 (portrait) costs 50% more per image ($0.063 vs $0.042 at medium quality) and the extra vertical space may introduce unwanted negative space
- Post-processing to 288x336 (2x) preserves detail while keeping file sizes reasonable. The existing 144x168 was designed for SVG rasterization; AI PNGs benefit from 2x for retina displays
- The `heroConeSrc()` integration (Phase 27) can use CSS `width: 144px; height: 168px` on the 288x336 images for built-in retina support
- If the user prefers keeping 144x168 exactly, nearest-neighbor downscale from 1024x1024 still works well for pixel art

### Pattern 2: Trial Run Workflow

**What:** Generate 3 candidates each at medium AND high quality for 3 representative flavors (18 images total)
**Trial flavor recommendations:**
1. **Vanilla** -- pure base, no toppings (tests clean scoop rendering)
2. **Mint Explosion** -- explosion density, 3 different toppings: oreo + andes + dove (tests complex multi-ingredient)
3. **Caramel Turtle** -- fudge ribbon + 3 toppings, caramel base (tests ribbon visibility and warm tones)

**Cost:** 18 images at medium ($0.042) = $0.76. 18 at high ($0.167) = $3.01. Total trial: ~$3.77

### Pattern 3: Batch Generation with Rate Limiting

**What:** Sequential generation with configurable delay between requests
**Rate limits by tier:**
| Tier | Images Per Minute (IPM) |
|------|------------------------|
| Tier 1 | 5 IPM (12s delay) |
| Tier 2 | 20 IPM (3s delay) |
| Tier 3 | 50 IPM (1.2s delay) |

**Implementation:** Check `x-ratelimit-remaining-requests` header to auto-tune delay. Default to 5s delay (safe for Tier 2+).

**Batch timing estimates (282 candidates at 3 per flavor):**
- Tier 1 (5 IPM): ~57 minutes
- Tier 2 (20 IPM): ~15 minutes
- Tier 3 (50 IPM): ~6 minutes

### Pattern 4: QA Gallery Accept/Reject

**What:** Static HTML page that loads all candidates per flavor in a grid
**Interaction:**
- Each flavor row shows 3 candidate images side by side
- Click to select winner, selection state persists in localStorage
- "Export manifest" button dumps selections to JSON
- Status bar shows X/94 approved
- Filter: show only unreviewed, only flagged for regen
- Keyboard navigation: arrow keys to move between flavors, 1/2/3 to select candidate

### Anti-Patterns to Avoid
- **Generating without premium overrides:** The canonical auto-generated treatments produce generic results. Every flavor MUST have a premium treatment override for L5 quality
- **Transparent background on vanilla/white-heavy scoops:** The gpt-image-1 transparency engine can punch holes in white interior areas. Mitigate with prompt instruction: "Ensure there is no transparency within the ice cream or cone itself"
- **Generating all 282 candidates before reviewing any:** The trial run exists specifically to catch prompt/quality issues early
- **Overwriting existing cones/ PNGs before QA approval:** Keep AI candidates in a separate directory until accepted

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image resize/trim | Manual pixel manipulation | sharp `.trim()` + `.resize({ kernel: 'nearest' })` | Edge cases with alpha channels, DPI metadata, color space preservation |
| Background removal | Post-processing alpha extraction | gpt-image-1 `background: 'transparent'` parameter | Native API support avoids color-matching edge cases |
| Rate limiting | setTimeout loops | Token bucket with header inspection (`x-ratelimit-*`) | Existing pattern in generate_ai_sprites.mjs handles 429 + retry-after |
| PNG optimization | Manual compression tuning | sharp `.png({ compressionLevel: 9, palette: true })` | Automated optimization with no quality loss |
| Flavor descriptions for 54 missing flavors | Manual text authoring | Extend DESCRIPTION_FALLBACK in generate_masterlock_prompts.mjs | Script already has this pattern for 2 flavors; need 54 more |

**Key insight:** The existing tooling (`generate_ai_sprites.mjs`, `generate_masterlock_prompts.mjs`, `generate-hero-cones.mjs`) already solves 80% of the problem. The work is extending, not rebuilding.

## Common Pitfalls

### Pitfall 1: Transparency Holes in Light-Colored Scoops
**What goes wrong:** gpt-image-1's `background: 'transparent'` can make white/cream areas inside the subject transparent
**Why it happens:** The model uses aggressive white-space detection that does not distinguish background from subject interior
**How to avoid:** Add explicit prompt text: "Ensure there is no transparency within the ice cream scoop or waffle cone itself, only around the isolated subject." Check vanilla and cheesecake-base flavors carefully in QA
**Warning signs:** PNG has visible "holes" when rendered on a colored background

### Pitfall 2: Inconsistent Style Across 94 Flavors
**What goes wrong:** AI-generated images drift in style (some look painterly, some too photorealistic, some too cartoony) across a large batch
**Why it happens:** Stochastic generation means each image starts from noise; prompt alone cannot guarantee pixel-perfect consistency
**How to avoid:** Lock the style section of the prompt (already done in masterlock template). Generate 3 candidates per flavor to have selection options. QA gallery enables side-by-side comparison to catch outliers
**Warning signs:** Some cones look like they belong to a different game/app than others

### Pitfall 3: Missing Flavor Descriptions Block Pipeline
**What goes wrong:** `generate_masterlock_prompts.mjs` throws an error for any flavor key without a description in `flavors.json` or `DESCRIPTION_FALLBACK`
**Why it happens:** 54 of 94 flavors are not in `docs/flavors.json` (only 40 are present) and only 2 are in `DESCRIPTION_FALLBACK`
**How to avoid:** Before running the prompt generator, either: (a) populate `DESCRIPTION_FALLBACK` with all 54 missing descriptions, or (b) extend `docs/flavors.json` with all 94 flavors. Option (a) is faster and self-contained
**Warning signs:** Script crashes with "No description available for flavor key"

### Pitfall 4: Cost Overrun from Regeneration Cycles
**What goes wrong:** Initial batch quality is poor, requiring multiple full-batch regenerations that multiply API costs
**Why it happens:** Prompt template issues, wrong quality setting, or inadequate premium overrides
**How to avoid:** Trial run with 3 flavors first (costs <$4). Only proceed to full batch after trial approval. Budget for 1 regeneration cycle of ~20% of flavors (56 images at ~$2-$9)
**Warning signs:** More than 20% of trial images need rejection

### Pitfall 5: Sharp Trim Removes Too Much
**What goes wrong:** `sharp.trim()` with default threshold (10) removes semi-transparent edge pixels from the cone tip or scoop edges
**Why it happens:** AI-generated PNGs may have subtle anti-aliased edges that read as "near background"
**How to avoid:** Use a conservative trim threshold (e.g., `{ threshold: 5 }`) or skip trim entirely since the images already have transparent backgrounds. Test on trial images first
**Warning signs:** Trimmed images have clipped edges or missing cone tips

### Pitfall 6: Existing Cone PNGs Overwritten Before QA
**What goes wrong:** The 94 existing SVG-rasterized PNGs in `docs/assets/cones/` get replaced by unreviewed AI images
**Why it happens:** Generation script writes directly to the same directory
**How to avoid:** Write AI candidates to `docs/assets/ai-candidates/` during generation. Only copy accepted candidates to `docs/assets/cones/` after QA approval
**Warning signs:** Site displays broken/wrong cone images during development

## Code Examples

### Generating an Image with gpt-image-1 (Transparent Background)
```javascript
// Adapted from existing generate_ai_sprites.mjs pattern
// Uses raw fetch (no openai SDK needed)
async function generateImage(apiKey, prompt, quality = 'medium') {
  const body = {
    model: 'gpt-image-1',
    prompt,
    n: 1,
    size: '1024x1024',
    quality,                    // 'low', 'medium', or 'high'
    background: 'transparent',  // Native transparent bg support
    output_format: 'png',       // Required for transparency
  };

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    const retry = parseInt(res.headers.get('retry-after') || '60', 10);
    throw Object.assign(new Error('rate_limited'), { retryAfter: retry });
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);

  const json = await res.json();
  return Buffer.from(json.data[0].b64_json, 'base64');
}
```
Source: Adapted from existing `tools/generate_ai_sprites.mjs` + [OpenAI Image Generation API docs](https://developers.openai.com/api/docs/guides/image-generation)

### Post-Processing Pipeline (Sharp)
```javascript
// Adapted from existing scripts/generate-hero-cones.mjs
import sharp from 'sharp';

async function postprocessCone(inputPath, outputPath) {
  await sharp(inputPath)
    .trim({ threshold: 5 })           // Conservative trim of transparent edges
    .resize({
      width: 288,                       // 2x of 144 for retina
      height: 336,                      // 2x of 168 for retina
      fit: 'contain',                   // Preserve aspect ratio, pad if needed
      kernel: 'nearest',               // Preserve pixel art crispness
      background: { r: 0, g: 0, b: 0, alpha: 0 },  // Transparent padding
    })
    .png({
      compressionLevel: 9,             // Maximum lossless compression
      palette: false,                   // Keep full RGBA for transparency
    })
    .withMetadata({ density: 300 })    // Match existing DPI convention
    .toFile(outputPath);
}
```
Source: Adapted from `scripts/generate-hero-cones.mjs` + [sharp resize API](https://sharp.pixelplumbing.com/api-resize/)

### Premium Treatment Override Structure
```javascript
// Example override for one flavor -- 93 of these need authoring
const PREMIUM_TREATMENT_OVERRIDES = {
  'mint explosion': {
    base: 'Cool mint custard with subtle green-white marbling (#2ECC71 lightened with cream streaks).',
    swirls: 'None -- pure base with dense inclusions.',
    chunks: 'Dark OREO cookie chunks with visible cream filling layers; bright Andes mint pieces with green-white striping; glossy dark chocolate dove chunks with subtle cocoa sheen.',
    texture: 'Dense inclusion field with layered depth. Each ingredient clearly readable against mint base. Andes pieces catch light differently than OREO chunks.',
  },
};
```
Source: Pattern from existing `tools/generate_masterlock_prompts.mjs` PREMIUM_TREATMENT_OVERRIDES

### Generation Manifest Entry
```json
{
  "flavor_key": "mint explosion",
  "slug": "mint-explosion",
  "model": "gpt-image-1",
  "quality": "medium",
  "size": "1024x1024",
  "background": "transparent",
  "prompt_hash": "sha256:abc123...",
  "candidates": [
    { "file": "mint-explosion-1.png", "generated_at": "2026-03-19T10:00:00Z" },
    { "file": "mint-explosion-2.png", "generated_at": "2026-03-19T10:00:13Z" },
    { "file": "mint-explosion-3.png", "generated_at": "2026-03-19T10:00:26Z" }
  ],
  "selected": "mint-explosion-2.png",
  "status": "approved"
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DALL-E 3 (`dall-e-3`) | gpt-image-1 | Apr 2025 | Better prompt adherence, transparent bg support, pixel art quality |
| `response_format: 'b64_json'` | `output_format: 'png'` | gpt-image-1 launch | Different parameter name for GPT image models |
| `quality: 'standard'/'hd'` | `quality: 'low'/'medium'/'high'` | gpt-image-1 launch | Three-tier quality vs two-tier |
| No background control | `background: 'transparent'/'opaque'/'auto'` | gpt-image-1 launch | Native transparency without post-processing |
| DALL-E 3 sizes: 1024x1024, 1792x1024, 1024x1792 | gpt-image-1 sizes: 1024x1024, 1024x1536, 1536x1024 | gpt-image-1 launch | Slightly different portrait/landscape ratios |

**Deprecated/outdated:**
- DALL-E 3: Deprecated May 2026. Do not use for new generation work
- `response_format` parameter: Replaced by `output_format` for gpt-image-1 models
- gpt-image-1.5 exists but is not in scope (user locked gpt-image-1)

## Open Questions

1. **What is the user's OpenAI API tier?**
   - What we know: Rate limits range from 5 IPM (Tier 1) to 250 IPM (Tier 5)
   - What's unclear: Which tier the user's account is on
   - Recommendation: Start the generation script with auto-detection via rate limit headers. Default to conservative 5s delay (safe for Tier 2+). The trial run will naturally reveal the effective rate limit

2. **Should post-processed dimensions be 144x168 (current) or 288x336 (2x retina)?**
   - What we know: Current SVG-rasterized cones are 144x168. L5 reference is 512x768. ENH-02 in future requirements mentions retina PNGs
   - What's unclear: Whether to future-proof now or match existing exactly
   - Recommendation: Generate at 1024x1024, post-process to 288x336 (2x). `heroConeSrc()` already uses CSS sizing, so a larger PNG just means sharper rendering on retina displays. This is Claude's discretion per CONTEXT.md

3. **How will 54 missing flavor descriptions be sourced?**
   - What we know: `docs/flavors.json` has 40 flavors. 54 more exist in FLAVOR_PROFILES. The prompt generator needs descriptions for all 94
   - What's unclear: Whether descriptions exist elsewhere in the codebase or need to be written
   - Recommendation: The 54 missing flavors are likely historical/seasonal Culver's flavors. Descriptions can be inferred from FLAVOR_PROFILES data (base, toppings, density) using a template like "{Base} Fresh Frozen Custard with {toppings}." This is a pre-requisite task before generation can begin

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0+ (worker tests) + pytest (Python tests) |
| Config file | worker/vitest.config.ts |
| Quick run command | `cd worker && npx vitest run --reporter=verbose` |
| Full suite command | `cd worker && npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GEN-01 | 94 PNG files exist at docs/assets/cones/{slug}.png with transparent bg and correct dimensions | smoke | `node scripts/verify-cone-assets.mjs` | No -- Wave 0 |
| GEN-02 | ai-generation-manifest.json has entries for all 94 flavors with required fields | unit | `node scripts/verify-cone-assets.mjs --manifest` | No -- Wave 0 |
| GEN-03 | QA gallery HTML loads and renders all 94 cones without errors | smoke | `npx playwright test tests/ai-cone-qa.spec.mjs` (optional) | No -- Wave 0 |
| GEN-04 | Post-processed PNGs have correct dimensions (288x336 or 144x168) and are optimized | unit | `node scripts/verify-cone-assets.mjs --dimensions` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `node scripts/verify-cone-assets.mjs` (check file counts, dimensions, manifest integrity)
- **Per wave merge:** `cd worker && npm test` (ensure no regressions to existing tests)
- **Phase gate:** Full suite green + 94/94 human QA approval before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/verify-cone-assets.mjs` -- verification script that checks: 94 PNGs exist, all have transparent backgrounds, dimensions match target, manifest JSON is complete
- [ ] 54 missing flavor descriptions in DESCRIPTION_FALLBACK or flavors.json
- [ ] 93 premium treatment overrides in PREMIUM_TREATMENT_OVERRIDES

## Sources

### Primary (HIGH confidence)
- [OpenAI GPT Image 1 Model](https://developers.openai.com/api/docs/models/gpt-image-1) - Pricing, rate limits, supported sizes, quality tiers
- [OpenAI Image Generation Guide](https://developers.openai.com/api/docs/guides/image-generation) - API parameters, transparent background support
- [OpenAI Create Image API Reference](https://developers.openai.com/api/reference/resources/images/methods/generate/) - Exact parameter names and values
- [sharp resize API](https://sharp.pixelplumbing.com/api-resize/) - Kernel options, trim API, PNG optimization
- Existing codebase: `tools/generate_ai_sprites.mjs`, `tools/generate_masterlock_prompts.mjs`, `scripts/generate-hero-cones.mjs` - Established patterns

### Secondary (MEDIUM confidence)
- [OpenAI Cookbook: Generate Images with GPT Image](https://developers.openai.com/cookbook/examples/generate_images_with_gpt_image/) - Code examples, best practices
- [OpenAI Community: gpt-image-1 quality parameter](https://community.openai.com/t/gpt-image-1-quality-parameter/1246424) - Quality tier behavior details

### Tertiary (LOW confidence)
- [OpenAI Community: gpt-image-1 Transparency bug](https://community.openai.com/t/gpt-image-1-transparency-remove-background-also-cuts-out-other-white-spots-of-the-image/1273481) - Transparency hole issue in white areas (may be fixed in newer API versions, needs validation during trial run)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools already in use in the project, versions verified against npm registry
- Architecture: HIGH - Extends existing patterns (generate_ai_sprites.mjs, generate-hero-cones.mjs), minimal new architecture
- Pitfalls: HIGH - Transparency bug documented by multiple community reports; missing-data gap verified by direct code inspection (40/94 flavors in JSON)
- API parameters: HIGH - Verified against official OpenAI model documentation (pricing, sizes, quality tiers, rate limits)
- Cost estimates: HIGH - Calculated from official per-image pricing on developers.openai.com

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (30 days -- gpt-image-1 API is stable; gpt-image-1.5 exists but is out of scope)
