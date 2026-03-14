# Phase 20: Design Token Expansion - Research

**Researched:** 2026-03-13
**Domain:** CSS custom properties, design token systems, vanilla CSS
**Confidence:** HIGH

## Summary

Phase 20 adds ~30 new CSS custom properties to the existing `:root` block in `style.css`, covering three token domains: semantic states (confirmed/watch/estimated), rarity badges (unified to the popup palette), and interactive feedback (focus rings, hover states). The existing 37 tokens must remain untouched -- this is strictly additive.

The codebase is vanilla CSS (no preprocessor, no build step) served as static files from `docs/`. All changes are CSS-level with targeted JS fixups where JavaScript injects hardcoded hex values via `style.*` assignments or `innerHTML` strings. The quiz.html already uses `color-mix()` in five places, establishing project precedent for that CSS function.

**Primary recommendation:** Define all new tokens in the `:root` block of `style.css`, then sweep through the file replacing hardcoded hex values with `var(--token-name)` references. JS files (today-page.js, compare-page.js) need targeted hex-to-CSS-class replacements for state colors injected via `style.*`.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Rarity color scale unified to the **popup palette**: purple > blue > green > light green > gray
  - Ultra-rare: `#7b1fa2` (purple)
  - Rare: `#1565c0` (blue)
  - Uncommon: `#2e7d32` (green)
  - Common: `#e8f5e9` (light green bg) / `#2e7d32` (text)
  - Staple: `#f5f5f5` (gray bg) / `#777` (text)
- **Solid colored pills** for all badge contexts (map popups, Today, Compare) -- white text on solid background for ultra-rare through uncommon
- **Hide badges for staple and common** tiers everywhere (map popups included) -- only show uncommon and above
- The current badge palette (pink/orange/blue) on Today/Compare gets replaced with the popup palette
- **Watch state**: amber/orange palette confirmed as good (`#f9a825`, `#f57f17` range)
- **Estimated vs confirmed**: clearly different -- muted colors, dashed borders, reduced opacity for estimated
- **Quiz state colors** (--quiz-danger, --quiz-success) should use the shared semantic state tokens, not inline overrides in quiz.html
- **Focus rings**: accessibility-forward, consistent 2px outline on all focusable elements via :focus-visible (keyboard only)
- Token naming: **grouped by domain prefix** matching existing pattern:
  - `--state-confirmed`, `--state-confirmed-bg`, `--state-confirmed-text`
  - `--state-watch`, `--state-watch-bg`, `--state-watch-text`
  - `--rarity-ultra-rare`, `--rarity-ultra-rare-bg`, `--rarity-ultra-rare-text`
  - `--focus-ring`, `--hover-bg`
- **Paired bg + text tokens** for each state and rarity level
- Expected ~30 new tokens added to :root
- **Brand-specific border colors** for 6 brands tokenized as `--brand-{name}`
- Map marker states (glows, opacity layers) should derive from the shared token system

### Claude's Discretion
- Confirmed state color unification (green vs blue vs mixed)
- Hover feedback style per element type
- color-mix() vs pre-computed hex values
- Drive dashboard color inclusion
- Exact token count and any additional derived tokens needed

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DTKN-01 | All semantic state colors (confirmed, watch, warning, success) use CSS custom properties instead of hardcoded hex values | Full audit of 25+ hardcoded state color instances across style.css and JS files completed; token naming scheme defined in CONTEXT.md |
| DTKN-02 | Rarity color scale unified to one palette across all contexts (map popups, today badges, compare badges) | Identified popup palette at lines 956-960 as source of truth; today/compare badges at lines 1770-1774 use different palette that must be replaced |
| DTKN-04 | Focus/hover states use consistent rgba values derived from brand color via color-mix() | Existing :focus-visible rules at lines 2628-2641 already use `var(--brand)`; quiz.html already uses `color-mix()` in 5 places establishing project precedent |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla CSS | CSS Level 4/5 | Custom properties, color-mix() | No-build-step constraint; project uses no preprocessor |
| CSS Custom Properties | Baseline | Design token system | Already established with 37 tokens in :root |
| color-mix() | CSS Color Level 5 | Derived interactive colors | 92%+ browser support; already used in quiz.html |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Playwright | (existing) | Browser test runner | Verify tokens resolve correctly in rendered pages |
| Vitest | (existing) | Unit test runner | Verify no regressions in worker tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| color-mix() | Pre-computed hex values | Less maintainable but 100% browser support; color-mix() already used in project so this ship has sailed |
| CSS nesting | Flat selectors | Nesting has lower browser support (~87%); project uses flat selectors throughout |

## Architecture Patterns

### Token Organization in :root
```css
:root {
  /* ... existing 37 tokens unchanged ... */

  /* State tokens (DTKN-01) */
  --state-confirmed: #005696;
  --state-confirmed-bg: #f0f7ff;
  --state-confirmed-text: #005696;
  --state-watch: #f9a825;
  --state-watch-bg: #fff8e1;
  --state-watch-text: #f57f17;
  --state-watch-border: #ffe082;
  --state-estimated: #bdbdbd;
  --state-estimated-bg: #fafafa;
  --state-estimated-text: #999;
  --state-success: #2e7d32;
  --state-success-bg: #e8f5e9;
  --state-success-text: #2e7d32;
  --state-danger: #c62828;
  --state-danger-bg: #fce4ec;
  --state-danger-text: #b71c1c;
  --state-none: #e0e0e0;

  /* Rarity tokens (DTKN-02) */
  --rarity-ultra-rare: #7b1fa2;
  --rarity-ultra-rare-bg: #7b1fa2;
  --rarity-ultra-rare-text: #fff;
  --rarity-rare: #1565c0;
  --rarity-rare-bg: #1565c0;
  --rarity-rare-text: #fff;
  --rarity-uncommon: #2e7d32;
  --rarity-uncommon-bg: #2e7d32;
  --rarity-uncommon-text: #fff;

  /* Interactive tokens (DTKN-04) */
  --focus-ring: var(--brand);
  --focus-ring-offset: 2px;
  --hover-bg: color-mix(in srgb, var(--brand) 8%, transparent);
  --hover-border: color-mix(in srgb, var(--brand) 40%, var(--border));

  /* Brand tokens */
  --brand-culvers: #005696;
  --brand-kopps: #000000;
  --brand-gilles: #EBCC35;
  --brand-hefners: #93BE46;
  --brand-kraverz: #CE742D;
  --brand-oscars: #BC272C;
}
```

### Replacement Pattern: CSS Selectors
**What:** Replace hardcoded hex values in CSS rules with `var(--token)` references.
**When to use:** Every CSS rule that uses a hex color for state, rarity, brand, or interactive feedback.
**Example:**
```css
/* BEFORE */
.day-card-confirmed {
  background: #f0f7ff;
  border-left: 5px solid #005696;
}

/* AFTER */
.day-card-confirmed {
  background: var(--state-confirmed-bg);
  border-left: 5px solid var(--state-confirmed);
}
```

### Replacement Pattern: Rarity Badge Unification
**What:** Replace the divergent Today/Compare rarity palette with the popup palette tokens.
**When to use:** Lines 1770-1774 in style.css.
**Example:**
```css
/* BEFORE (Today/Compare -- pink/orange/blue palette) */
.rarity-badge-ultra-rare { background: #fce4ec; color: #b71c1c; }
.rarity-badge-rare { background: #fff3e0; color: #e65100; }
.rarity-badge-uncommon { background: #e3f2fd; color: #1565c0; }

/* AFTER (unified popup palette -- solid pills) */
.rarity-badge-ultra-rare { background: var(--rarity-ultra-rare-bg); color: var(--rarity-ultra-rare-text); }
.rarity-badge-rare { background: var(--rarity-rare-bg); color: var(--rarity-rare-text); }
.rarity-badge-uncommon { background: var(--rarity-uncommon-bg); color: var(--rarity-uncommon-text); }
```

### Replacement Pattern: JS Inline Hex
**What:** Replace JavaScript `style.*` hex assignments with CSS class toggling or `var()` references.
**When to use:** today-page.js lines 356-382, 431, 448; compare-page.js lines 797-799.
**Example:**
```javascript
// BEFORE
todayCard.style.borderLeftColor = '#bdbdbd';

// AFTER -- use CSS class that references the token
todayCard.classList.add('day-card-estimated');
// The CSS class .day-card-estimated already uses var(--state-estimated)
```

### Replacement Pattern: Quiz Token Migration
**What:** Move `--quiz-danger` and `--quiz-success` from quiz.html inline `<style>` to use shared state tokens.
**When to use:** quiz.html lines 25-26.
**Example:**
```css
/* In quiz.html inline <style>, replace: */
--quiz-danger: #b42318;
--quiz-success: #0f8a5f;

/* With references to shared tokens: */
--quiz-danger: var(--state-danger-text);
--quiz-success: var(--state-success-text);
```

### Anti-Patterns to Avoid
- **Renaming existing tokens:** The additive-only policy means ZERO renames of the existing 37. `--brand` stays `--brand`, even though `--brand-culvers` is being added.
- **Moving quiz.html's entire inline `<style>` to style.css:** Out of scope (DTKN-F2 is a future requirement). Only migrate the two quiz-danger/quiz-success definitions to use shared tokens.
- **Tokenizing the Fronts page dark-mode palette:** Explicitly deferred to DTKN-F1 (v2+).
- **Over-tokenizing one-off hex values:** Not every hex in the file needs a token. Focus on state, rarity, brand, and interactive colors. One-off structural colors (e.g., `#f8f9fa` for a hover background on one element) can stay unless they map to a semantic category.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color scale derivation | Manual alpha channel math | `color-mix(in srgb, var(--brand) N%, transparent)` | Browser-native, already used in quiz.html |
| Focus ring consistency | Per-element outline rules | Single `:focus-visible` rule using `var(--focus-ring)` | Already partially implemented at lines 2628-2641 |
| Rarity badge visibility toggling | JS-based hide/show logic | CSS `.rarity-badge-common, .rarity-badge-staple { display: none; }` | Pure CSS, simpler, no JS dependency |

**Key insight:** The project already has a working pattern for CSS custom properties. This phase extends that pattern -- it does not introduce new infrastructure.

## Common Pitfalls

### Pitfall 1: Breaking the Existing 37 Tokens
**What goes wrong:** Renaming `--brand` to `--brand-culvers` or removing `--text-muted` breaks every page.
**Why it happens:** Temptation to "clean up" while adding new tokens.
**How to avoid:** Treat the existing :root block as frozen lines 1-51. New tokens go AFTER line 51.
**Warning signs:** Any git diff showing deleted or modified lines in the existing :root block.

### Pitfall 2: Rarity Palette Divergence
**What goes wrong:** Popup rarity chips (lines 956-960) and Today/Compare badges (lines 1770-1774) use different colors because only one was updated.
**Why it happens:** Two separate CSS rule groups serve the same semantic purpose with different class names.
**How to avoid:** Both `.popup-rarity-chip.rarity-*` and `.rarity-badge-*` must reference the same `--rarity-*` tokens.
**Warning signs:** Visual inspection showing different colors for the same rarity level across pages.

### Pitfall 3: JS Overriding CSS Tokens
**What goes wrong:** JavaScript sets `element.style.borderLeftColor = '#005696'` which overrides `var(--state-confirmed)` from the CSS class.
**Why it happens:** today-page.js directly sets inline styles. Inline styles have higher specificity than class-based styles.
**How to avoid:** Replace JS `style.*` assignments with class toggling. Where JS must set a color, use `element.style.setProperty('--state-confirmed', value)` or reference the CSS class.
**Warning signs:** Elements that look right in the stylesheet but wrong in the browser.

### Pitfall 4: Hiding Common/Staple Badges Breaks Layout
**What goes wrong:** Adding `display: none` to common/staple badges shifts layout unexpectedly.
**Why it happens:** Badge elements contributed to container height or flex spacing.
**How to avoid:** Check that parent containers don't rely on badge height. Test on all three contexts: map popups, Today page, Compare page.
**Warning signs:** Elements jumping position when a badge is hidden vs shown.

### Pitfall 5: color-mix() Fallback Gap
**What goes wrong:** Very old browsers (< Chrome 111, < Safari 16.2) see no color at all.
**Why it happens:** `color-mix()` returns nothing in unsupported browsers, and the property is discarded.
**How to avoid:** For critical interactive tokens, provide a pre-computed fallback before the color-mix() declaration:
```css
--hover-bg: rgba(0, 86, 150, 0.08); /* fallback */
--hover-bg: color-mix(in srgb, var(--brand) 8%, transparent);
```
**Warning signs:** The project already uses color-mix() in quiz.html without fallbacks, so this may be an accepted tradeoff. Browser support is 92%+.

### Pitfall 6: Map Marker Glow RGBA Values
**What goes wrong:** Map marker glow uses `rgba()` values (lines 568-580) which can't directly reference a hex token.
**Why it happens:** `rgba(46, 125, 50, 0.52)` requires channel decomposition that CSS custom properties don't natively support.
**How to avoid:** Use `color-mix(in srgb, var(--state-success) 52%, transparent)` to derive semi-transparent glows from state tokens. This replaces the manual rgba decomposition.
**Warning signs:** Marker glows disappearing or becoming fully opaque after tokenization.

## Code Examples

### Complete State Token Usage (DTKN-01)

Locations in style.css that need state token replacement:

| Line(s) | Current | Replace With |
|----------|---------|-------------|
| 1004-1005 | `.day-card-confirmed { background: #f0f7ff; border-left: 5px solid #005696; }` | `var(--state-confirmed-bg)`, `var(--state-confirmed)` |
| 1009-1010 | `.day-card-watch { background: #fffde7; border-left: 4px dotted #f9a825; }` | `var(--state-watch-bg)`, `var(--state-watch)` |
| 1015-1016 | `.day-card-estimated { border-left: 3px dashed #ccc; background: #fafafa; }` | `var(--state-estimated)`, `var(--state-estimated-bg)` |
| 1051-1052 | `.day-card-badge-confirmed { background: #e8f5e9; color: #2e7d32; }` | `var(--state-success-bg)`, `var(--state-success-text)` |
| 1056-1057 | `.day-card-badge-watch { background: #fff8e1; color: #f57f17; }` | `var(--state-watch-bg)`, `var(--state-watch-text)` |
| 1061-1062 | `.day-card-badge-estimated { background: #f0f0f0; color: #999; }` | `var(--state-estimated-bg)`, `var(--state-estimated-text)` |
| 1107 | `.prediction-bar-estimated { background: #b0c4de; }` | `var(--state-estimated)` or a derived token |
| 1138-1141 | `.confidence-strip-confirmed/watch/estimated/none` | `var(--state-confirmed)`, `var(--state-watch)`, `var(--state-estimated)`, `var(--state-none)` |
| 1154-1160 | `.watch-banner` (background, border, color) | `var(--state-watch-bg)`, `var(--state-watch-border)`, `var(--state-watch-text)` |
| 1170-1171 | `.watch-banner-icon` (background) | `var(--state-watch-text)` |
| 910 | `.popup-match { background: #2e7d32; }` | `var(--state-success)` |
| 921-922 | `.popup-confirmed { background: #e8f5e9; color: #2e7d32; }` | `var(--state-success-bg)`, `var(--state-success-text)` |
| 836 | `.match-title { color: #2e7d32; }` | `var(--state-success-text)` |
| 850 | `.store-card-match { border-left: 4px solid #2e7d32; }` | `var(--state-success)` |

### Complete Rarity Token Usage (DTKN-02)

| Line(s) | Current | Replace With |
|----------|---------|-------------|
| 956-960 | `.popup-rarity-chip.rarity-*` (5 rules) | `var(--rarity-*-bg)`, `var(--rarity-*-text)` |
| 1770-1774 | `.rarity-badge-*` (5 rules) | Same tokens -- palette unification |
| New rule | -- | `.rarity-badge-common, .rarity-badge-staple { display: none; }` |
| New rule | -- | `.popup-rarity-chip.rarity-common, .popup-rarity-chip.rarity-staple { display: none; }` |

### Complete Brand Token Usage

| Line(s) | Current | Replace With |
|----------|---------|-------------|
| 854-859 | `.brand-culvers` through `.brand-oscars` hardcoded hex | `var(--brand-culvers)` through `var(--brand-oscars)` |

### Signal Card State Colors (derived)

| Line(s) | Current | Token |
|----------|---------|-------|
| 1236 | `border-left-color: #e65100` (overdue) | Could use `var(--state-watch-text)` or a new `--signal-overdue` |
| 1237 | `border-left-color: #1565c0` (dow_pattern) | `var(--rarity-rare)` |
| 1238 | `border-left-color: #2e7d32` (seasonal) | `var(--state-success)` |
| 1239 | `border-left-color: #f9a825` (active_streak) | `var(--state-watch)` |
| 1240 | `border-left-color: #7b1fa2` (rare_find) | `var(--rarity-ultra-rare)` |

### Map Marker Glow Derivation

```css
/* BEFORE */
.flavor-map-marker-match {
  --marker-state-glow: rgba(46, 125, 50, 0.52);
}

/* AFTER */
.flavor-map-marker-match {
  --marker-state-glow: color-mix(in srgb, var(--state-success) 52%, transparent);
}
```

### Interactive Focus Ring Pattern (DTKN-04)

```css
/* BEFORE (lines 2628-2641) -- already partially tokenized */
:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}

/* AFTER -- uses dedicated focus token */
:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}
```

### JS Inline Style Replacement Map

| File | Line | Current | Replacement |
|------|------|---------|-------------|
| today-page.js | 369 | `style.borderLeftColor = '#bdbdbd'` | Add class `day-card-estimated` |
| today-page.js | 378 | `style.borderLeftColor = '#e0e0e0'` | Add class `day-card-none` (new) |
| today-page.js | 382 | `style.color = '#999'` | Use `var(--text-subtle)` or class |
| today-page.js | 431 | `style="color:#2e7d32;"` in innerHTML | Use class `.week-day-confidence-confirmed` |
| today-page.js | 448 | `style="color:#999;..."` in innerHTML | Use class `.week-day-flavor-empty` |
| compare-page.js | 797-799 | Multiple inline hex values | Replace with CSS classes |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded hex in CSS rules | CSS custom properties in :root | Established in Phase 6 (v1.0) | 37 tokens currently; this phase adds ~30 more |
| Manual rgba() for transparency | color-mix() for derived colors | CSS Color Level 5 (baseline 2023) | Already used in quiz.html; safe to adopt broadly |
| Separate palettes per context | Unified semantic token palette | This phase (DTKN-02) | Rarity badges use one palette everywhere |

**Deprecated/outdated:**
- The pink/orange/blue rarity badge palette on Today/Compare (lines 1770-1774) is being replaced by the purple/blue/green popup palette per user decision

## Open Questions

1. **Confirmed state color: green, blue, or mixed?**
   - What we know: Currently uses blue (`#005696`) for card borders and confidence strips, green (`#2e7d32`) for badge backgrounds and "confirmed" text. Watch uses amber consistently.
   - What's unclear: Whether to unify confirmed to all-blue (brand-aligned) or all-green (success-semantic) or keep the current mixed approach
   - Recommendation: Claude's discretion per CONTEXT.md. Recommend blue for structural elements (borders, strips) and green for success badges, maintaining the current de facto split but making it intentional via distinct `--state-confirmed` (blue/brand) vs `--state-success` (green) tokens.

2. **Drive dashboard bucket colors: include or skip?**
   - What we know: Four drive buckets (great/ok/pass/hard_pass) at lines 3112-3119 use hardcoded hex values that partially overlap with state tokens (great=#2e7d32 = success, ok=#f9a825 = watch)
   - What's unclear: Whether these are in scope or deferred
   - Recommendation: Include them -- they directly reuse state token values, so tokenizing them is near-zero effort and prevents palette drift.

3. **Exact token count**
   - What we know: CONTEXT.md estimates ~30 new tokens
   - Current count estimate: ~28-33 depending on drive bucket inclusion and whether intermediate derived tokens are needed
   - Recommendation: Let the implementation drive the exact count; ~30 is the right ballpark.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (browser) + Vitest (unit) |
| Config file | `worker/playwright.config.mjs` + `worker/vitest.config.*` |
| Quick run command | `cd worker && npm run test:browser -- --grep "DTKN"` |
| Full suite command | `cd worker && npm test && npm run test:browser -- --workers=1` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DTKN-01 | State colors resolve from CSS custom properties on Today and Compare pages | browser (Playwright) | `cd worker && npx playwright test test/browser/dtkn-state-tokens.spec.mjs -x` | No -- Wave 0 |
| DTKN-02 | Rarity badges use unified palette across map popups, Today, Compare; common/staple hidden | browser (Playwright) | `cd worker && npx playwright test test/browser/dtkn-rarity-tokens.spec.mjs -x` | No -- Wave 0 |
| DTKN-04 | Focus rings and hover states derive from brand color via tokens | browser (Playwright) | `cd worker && npx playwright test test/browser/dtkn-interactive-tokens.spec.mjs -x` | No -- Wave 0 |
| Regression | Existing 37 tokens still resolve to their original values | browser (Playwright) | `cd worker && npx playwright test test/browser/vizp-card-system.spec.mjs -x` | Yes -- existing test verifies token resolution |

### Sampling Rate
- **Per task commit:** `cd worker && npx playwright test test/browser/dtkn-*.spec.mjs -x`
- **Per wave merge:** `cd worker && npm test && npm run test:browser -- --workers=1`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `worker/test/browser/dtkn-state-tokens.spec.mjs` -- covers DTKN-01: getComputedStyle checks that state-colored elements use CSS custom property values, not hardcoded hex
- [ ] `worker/test/browser/dtkn-rarity-tokens.spec.mjs` -- covers DTKN-02: verifies popup rarity chips and Today/Compare rarity badges resolve to same hex values; common/staple badges hidden
- [ ] `worker/test/browser/dtkn-interactive-tokens.spec.mjs` -- covers DTKN-04: verifies :focus-visible outline uses --focus-ring token; hover-bg token resolves non-empty
- [ ] Static CSS audit script (optional): grep-based check that no hardcoded hex remains for state/rarity colors in style.css

## Sources

### Primary (HIGH confidence)
- Direct codebase audit of `docs/style.css` (3833 lines) -- all hex values, :root tokens, class patterns
- Direct codebase audit of `docs/today-page.js`, `docs/compare-page.js`, `docs/planner-data.js` -- JS inline hex values
- Direct codebase audit of `docs/quiz.html` inline `<style>` block -- existing color-mix() usage
- CONTEXT.md user decisions -- locked rarity palette, state color semantics, token naming convention

### Secondary (MEDIUM confidence)
- [Can I Use: color-mix()](https://caniuse.com/mdn-css_types_color_color-mix) -- 92%+ global browser support, baseline since May 2023
- [MDN: color-mix()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/color-mix) -- function syntax and sRGB color space usage

### Tertiary (LOW confidence)
- None -- all findings are from direct codebase inspection or official browser documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- vanilla CSS with no build step, pattern already established with 37 tokens
- Architecture: HIGH -- direct extension of existing :root token pattern; no new infrastructure needed
- Pitfalls: HIGH -- identified from actual codebase patterns (JS inline styles, dual rarity palettes, rgba marker glows)

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable domain -- CSS custom properties are not evolving rapidly)
