# Phase 22: Inline Style Elimination - Research

**Researched:** 2026-03-14
**Domain:** CSS class migration, inline style elimination, design token consumption
**Confidence:** HIGH

## Summary

Phase 22 replaces all inline `style=""` attributes across compare.html, index.html, and forecast-map.html with CSS classes that consume design tokens defined in Phase 20/21. The phase also converts `.style.*` assignments in compare-page.js, shared-nav.js, and today-page.js to use `classList` operations with CSS classes.

The codebase is well-prepared for this work. The CSS already has `header h1` and `header p` rules (lines 254-262 of style.css) that provide the exact same styling the inline attributes specify -- meaning the header inline styles can be simply removed. The `.hidden { display: none !important; }` pattern exists via `[hidden] { display: none !important; }` (line 103-105). The `.updates-cta-card` class is already defined with flex layout, gap, and typography (lines 2090-2113). Design tokens for spacing (`--space-*`), text sizes (`--text-*`), and colors (`--brand`, `--text-muted`) are all available.

**Primary recommendation:** This is largely a deletion exercise for HTML inline styles (existing CSS rules already cover most cases) plus targeted CSS class additions for compare-specific components and JS refactoring from `.style.*` to `classList.toggle('hidden')`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Shared classes in style.css (not page-specific) -- all 3 pages use identical header pattern
- Use classList.toggle('hidden') with existing .hidden class for visibility toggling
- Opportunistic cleanup: convert .style.display toggles in other JS files beyond compare-page.js and shared-nav.js when encountered
- CTA card text (color:#666, font-size:0.875rem) shares classes with header subtitle text -- same visual treatment = same class (DRY)
- Spacing values MUST use design tokens (var(--space-2) instead of raw 0.5rem) -- consistent with Phase 20/21 token approach

### Claude's Discretion
- Header class naming convention (semantic vs utility)
- Brand blue token strategy (existing vs new)
- display:inline heading class approach
- Dynamic JS style assignment handling (CSS custom properties vs .style)
- .hidden !important behavior for classList.toggle pattern
- CTA card layout class approach (dedicated vs composable modifiers)
- CTA heading class naming
- Footer disclaimer class naming

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DTKN-03 | All 77 inline styles across compare.html, index.html, and forecast-map.html headers replaced with CSS classes using design tokens | Complete inventory of 13 HTML inline styles across 3 files; 14+ JS .style.* assignments across 4 JS files; existing CSS rules already cover header h1/p styling; design tokens available for all remaining values |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla CSS | N/A | All styling via style.css with CSS custom properties | No-build-step constraint; project uses no preprocessors |
| Python (pytest) | 9.0.2 | Static analysis tests for inline style enforcement | Existing test infrastructure from Phase 20/21 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `uv` | Project default | Python env/package management | Running tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS classes | CSS Modules / SCSS | Out of scope per REQUIREMENTS.md: "No new CSS framework or preprocessor" |
| classList.toggle | jQuery .toggle() | No jQuery in project; classList is native and already used |

## Architecture Patterns

### Recommended Approach: CSS-Already-Covers-This

The most important finding: **the CSS already has rules that make most header inline styles redundant**.

```css
/* style.css lines 254-262 -- ALREADY EXISTS */
header h1 {
  color: var(--brand);       /* = #005696 */
  font-size: 1.5rem;
}

header p {
  color: var(--text-muted);  /* = #666 */
  margin-top: var(--space-2); /* = 0.5rem, close to 0.25rem */
}
```

The inline `style="color:#005696;font-size:1.5rem;"` on all three `<h1>` elements is **identical** to what `header h1` already provides. Similarly, `style="color:#666;margin-top:0.25rem;font-size:0.875rem;"` on the `<p>` elements is close to `header p` but has `margin-top: 0.25rem` (vs `0.5rem`) and adds `font-size: 0.875rem`.

**Strategy:**
1. For h1: Simply remove the inline style -- CSS rule covers it exactly
2. For subtitle p: Remove inline style, add a shared class for the slight differences (font-size: 0.875rem, margin-top: 0.25rem vs 0.5rem)

### Complete Inline Style Inventory

#### HTML inline styles to eliminate (13 total across 3 files):

**compare.html** (6):
| Line | Element | Style Value | Resolution |
|------|---------|-------------|------------|
| 25 | `<h1>` | `color:#005696;font-size:1.5rem;` | Remove -- covered by `header h1` CSS rule |
| 26 | `<p>` | `color:#666;margin-top:0.25rem;font-size:0.875rem;` | Remove, add subtitle class |
| 35 | `<p>` | `font-size:1.25rem;font-weight:600;margin-bottom:0.5rem;` | Add `.compare-empty-heading` or similar class |
| 70 | `<section>` | `text-align:center;margin:1.5rem auto;padding:1rem;max-width:24rem;` | Absorb into `.updates-cta-card` class (compare variant) |
| 72 | `<p>` | `margin:0.5rem 0;font-size:0.875rem;color:#666;` | Shares class with subtitle (DRY per decision) |
| 79 | `<p>` | `margin-top:0.5rem;` | Add footer disclaimer class |

**index.html** (4):
| Line | Element | Style Value | Resolution |
|------|---------|-------------|------------|
| 25 | `<h1>` | `color:#005696;font-size:1.5rem;` | Remove -- covered by `header h1` CSS rule |
| 26 | `<p>` | `color:#666;margin-top:0.25rem;font-size:0.875rem;` | Remove, add subtitle class |
| 126 | `<h2>` | `display:inline;` | Add utility class (e.g., `.d-inline`) |
| 142 | `<p>` | `margin-top:0.5rem;` | Add footer disclaimer class |

**forecast-map.html** (3):
| Line | Element | Style Value | Resolution |
|------|---------|-------------|------------|
| 25 | `<h1>` | `color:#005696;font-size:1.5rem;` | Remove -- covered by `header h1` CSS rule |
| 26 | `<p>` | `color:#666;margin-top:0.25rem;font-size:0.875rem;` | Remove, add subtitle class |
| 138 | `<p>` | `margin-top:0.5rem;` | Add footer disclaimer class |

#### JS `.style.*` assignments to eliminate:

**compare-page.js** (2 occurrences):
| Line | Code | Resolution |
|------|------|------------|
| 660 | `item.style.display = '';` | classList.remove('hidden') |
| 671 | `item.style.display = match ? '' : 'none';` | classList.toggle('hidden', !match) |

**shared-nav.js** (2 occurrences):
| Line | Code | Resolution |
|------|------|------------|
| 407 | `item.style.display = '';` | classList.remove('hidden') |
| 418 | `item.style.display = match ? '' : 'none';` | classList.toggle('hidden', !match) |

**today-page.js** (3 occurrences -- dynamic brand color):
| Line | Code | Resolution |
|------|------|------------|
| 360 | `todayCard.style.borderLeftColor = '';` | Claude's discretion: CSS custom property via JS or keep .style for truly dynamic values |
| 362 | `todayFlavor.style.color = '';` | Same as above |
| 366 | `todayCard.style.borderLeftColor = color;` | Same -- brand color varies per store |

**forecast-map.html inline JS** (10 occurrences):
| Lines | Code | Resolution |
|-------|------|------------|
| 261-262 | `tick.style.fontWeight/color` | Add CSS classes for confirmed vs default tick states |
| 880-881, 893-894, 914-915, 917-918 | `timelineCard/flavorBlock.style.display = 'none'/''` | classList.toggle('hidden') |

**Opportunistic -- updates-page.js** (3 occurrences):
| Line | Code | Resolution |
|------|------|------------|
| 82 | `statusEl.style.color = '#2e7d32';` | Add `.text-success` / `.text-danger` classes |
| 86 | `statusEl.style.color = '#c62828';` | Same |
| 91 | `statusEl.style.color = '#c62828';` | Same |

### Pattern: Existing CSS Classes to Leverage

Classes already defined in style.css that can absorb inline styles:

1. **`header h1`** (line 254): `color: var(--brand); font-size: 1.5rem;` -- matches all `<h1>` inline styles exactly
2. **`header p`** (line 259): `color: var(--text-muted); margin-top: var(--space-2);` -- close to subtitle inline styles
3. **`.updates-cta-card`** (line 2090): Already has `display: flex; flex-direction: column; gap: var(--space-2);` -- can absorb compare.html CTA layout
4. **`[hidden]`** (line 103): `display: none !important;` -- replaces `.style.display = 'none'` pattern
5. **`.forecast-header`** (line 1454): `text-align: center; padding: var(--space-5) 0 var(--space-4);`

### New CSS Classes Needed

| Class Name | Properties | Used By | Design Tokens |
|------------|-----------|---------|---------------|
| `.header-subtitle` | `font-size: var(--text-base); margin-top: var(--space-1); color: var(--text-muted);` | Header subtitle `<p>` on all 3 pages + compare CTA text (DRY) | --text-base, --space-1, --text-muted |
| `.compare-empty-heading` | `font-size: var(--text-lg); font-weight: 600; margin-bottom: var(--space-2);` | compare.html empty state heading | --text-lg, --space-2 |
| `.footer-disclaimer` | `margin-top: var(--space-2);` | Footer disclaimer text on all 3 pages (+ map.html) | --space-2 |
| `.d-inline` | `display: inline;` | index.html "Week Ahead" `<h2>` inside `<summary>` | N/A (utility) |
| `.fronts-tick--confirmed` | `font-weight: 700; color: var(--brand);` | forecast-map.html confirmed day tick | --brand |
| `.fronts-tick--default` | `font-weight: 400; color: #9fb1d1;` | forecast-map.html non-confirmed ticks | (fronts dark theme, hardcoded OK per allowlist) |

### Anti-Patterns to Avoid
- **Replacing inline styles with equally specific selectors that bypass the cascade:** New classes should be generic and reusable, not element-ID-targeted
- **Over-engineering dynamic styles:** For truly dynamic per-store brand colors (today-page.js borderLeftColor), CSS custom properties set via JS (`el.style.setProperty('--brand-color', color)`) are preferable to direct `.style.borderLeftColor` only if the same pattern repeats. For a single usage, a clean `.style` assignment may be acceptable
- **Forgetting the hidden attribute pattern:** The project already uses `[hidden] { display: none !important; }`. The `hidden` HTML attribute works like `.hidden` class. JS code using `el.hidden = true/false` works but `classList.toggle('hidden')` requires a CSS class. CONTEXT.md specifies classList.toggle('hidden') -- so a `.hidden` CSS class is needed alongside `[hidden]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Visibility toggling | Custom show/hide functions | `classList.toggle('hidden')` with `.hidden { display: none !important; }` | Standard pattern, already decided by user |
| Text color tokens | New color values | Existing `--text-muted`, `--text-secondary`, `--brand` tokens | Tokens already defined in :root |
| Spacing values | Raw rem/px values | `--space-1` through `--space-6` tokens | User explicitly requires token usage |
| Brand color | Hardcoded `#005696` | `var(--brand)` token | Already tokenized in Phase 20 |

## Common Pitfalls

### Pitfall 1: Subtle margin-top difference on header subtitle
**What goes wrong:** The existing `header p` rule sets `margin-top: var(--space-2)` (0.5rem), but inline styles set `margin-top: 0.25rem` (--space-1). Simply removing the inline style would double the spacing.
**Why it happens:** Easy to assume inline style matches the CSS rule without checking values.
**How to avoid:** Create a `.header-subtitle` class with `margin-top: var(--space-1)` and `font-size: var(--text-base)` to get exact values. Apply this class specifically to subtitle paragraphs.
**Warning signs:** Visual regression in header spacing after removing inline styles.

### Pitfall 2: Missing font-size on header subtitle
**What goes wrong:** The existing `header p` rule does NOT set `font-size`. The inline style adds `font-size: 0.875rem`. Removing the inline style without adding the font-size to a class will change the subtitle text size.
**Why it happens:** The CSS rule only sets color and margin, not size.
**How to avoid:** The `.header-subtitle` class must include `font-size: var(--text-base)` (which equals 0.875rem).

### Pitfall 3: .style.display filter pattern needs .hidden class (not [hidden] attribute)
**What goes wrong:** The compare-page.js and shared-nav.js search filter patterns use `item.style.display = match ? '' : 'none'`. Converting to `classList.toggle('hidden', !match)` requires a `.hidden` CSS class, not the `[hidden]` attribute selector.
**Why it happens:** The project currently uses `[hidden]` attribute (line 103-105) but not a `.hidden` class. CONTEXT.md says `.hidden { display: none !important; }` exists at style.css:104 -- but actually the rule is `[hidden] { display: none !important; }`.
**How to avoid:** Add a `.hidden` CSS class OR use `el.hidden = true/false` (setting the HTML attribute directly). CONTEXT.md specifies classList.toggle('hidden'), so add the CSS class.

### Pitfall 4: compare.html updates-cta-card has different layout than index.html
**What goes wrong:** In compare.html, the `#updates-cta` section IS the card (has both `class="card updates-cta-card"` and inline layout styles). In index.html, `#updates-cta` wraps a child `.card.updates-cta-card`. The compare version adds `text-align:center;margin:1.5rem auto;padding:1rem;max-width:24rem;` as inline styles.
**Why it happens:** Two pages evolved independently with slightly different CTA card structures.
**How to avoid:** Absorb the compare-specific layout into `.updates-cta-card` CSS (centering, max-width) or create a modifier. Check that index.html CTA still renders correctly.

### Pitfall 5: forecast-map.html inline JS has complex view-mode toggling
**What goes wrong:** The forecast-map.html inline script toggles timeline card and flavor block visibility based on view mode (confirmed vs forecast). This appears in 3 places (event handlers + init function). Converting to classList.toggle('hidden') must hit all 3 code paths consistently.
**Why it happens:** The logic is duplicated across mode-confirmed click, mode-forecast click, and applyViewModeVisibility().
**How to avoid:** Refactor to single applyViewModeVisibility() call that uses classList.toggle, then call it from both event handlers.

### Pitfall 6: today-page.js brand color is truly dynamic
**What goes wrong:** `todayCard.style.borderLeftColor = color` where `color` comes from `BRAND_COLORS[brand]` -- this varies per store brand (Culver's blue vs Kopp's black vs Gille's yellow). A single CSS class cannot represent all brand colors.
**Why it happens:** Dynamic per-store theming requires runtime style values.
**How to avoid:** Use CSS custom property approach: `todayCard.style.setProperty('--card-brand', color)` with CSS rule `.today-card { border-left-color: var(--card-brand, var(--brand)); }`. This keeps the cascade clean while allowing JS to set runtime values. Alternatively, since this is truly dynamic, keeping `.style.borderLeftColor` is acceptable (Claude's discretion per CONTEXT.md).

## Code Examples

### Removing redundant header inline styles
```html
<!-- BEFORE -->
<h1 style="color:#005696;font-size:1.5rem;">Custard Forecast</h1>
<p style="color:#666;margin-top:0.25rem;font-size:0.875rem;">Today's flavor and the week ahead</p>

<!-- AFTER -->
<h1>Custard Forecast</h1>
<p class="header-subtitle">Today's flavor and the week ahead</p>
```

### New CSS class consuming tokens
```css
/* style.css -- new shared class */
.header-subtitle {
  font-size: var(--text-base);     /* 0.875rem */
  margin-top: var(--space-1);      /* 0.25rem */
  color: var(--text-muted);        /* #666 */
}
```

### classList.toggle pattern for search filtering
```javascript
// BEFORE (compare-page.js line 671)
item.style.display = match ? '' : 'none';

// AFTER
item.classList.toggle('hidden', !match);
```

### CSS class for .hidden
```css
/* style.css -- add alongside [hidden] rule */
.hidden {
  display: none !important;
}
```

### Footer disclaimer class
```css
.footer-disclaimer {
  margin-top: var(--space-2);
}
```

### Dynamic brand color via CSS custom property
```javascript
// BEFORE (today-page.js)
todayCard.style.borderLeftColor = color;

// AFTER (option A -- CSS custom property)
todayCard.style.setProperty('--card-brand', color);
// With CSS: .today-card { border-left-color: var(--card-brand, var(--brand)); }

// AFTER (option B -- keep .style for truly dynamic)
todayCard.style.borderLeftColor = color;
// Acceptable per Claude's discretion for dynamic per-store values
```

### forecast-map.html tick styling via classes
```javascript
// BEFORE
tick.style.fontWeight = hasConfirmed ? '700' : '400';
tick.style.color = hasConfirmed ? '#005696' : '#9fb1d1';

// AFTER
tick.classList.toggle('fronts-tick--confirmed', hasConfirmed);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline style attributes | CSS classes + design tokens | Phase 20-21 (2026-03) | Maintainable, themeable styling |
| `.style.display = 'none'` | `classList.toggle('hidden')` / `el.hidden = true` | Phase 21 pattern | Consistent visibility toggling |
| Hardcoded hex colors | `var(--brand)`, `var(--text-muted)` etc. | Phase 20 (2026-03) | All colors from tokens |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 9.0.2 |
| Config file | pyproject.toml |
| Quick run command | `cd custard-calendar && uv run pytest tests/test_design_tokens.py tests/test_card_button_unification.py -v` |
| Full suite command | `cd custard-calendar && uv run pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DTKN-03a | compare.html has zero style="" attributes | unit (static analysis) | `cd custard-calendar && uv run pytest tests/test_inline_style_elimination.py::test_compare_zero_inline_styles -x` | Wave 0 |
| DTKN-03b | index.html header inline styles replaced with CSS classes | unit (static analysis) | `cd custard-calendar && uv run pytest tests/test_inline_style_elimination.py::test_index_zero_inline_styles -x` | Wave 0 |
| DTKN-03c | forecast-map.html header inline styles replaced with CSS classes | unit (static analysis) | `cd custard-calendar && uv run pytest tests/test_inline_style_elimination.py::test_forecast_map_zero_inline_styles -x` | Wave 0 |
| DTKN-03d | compare-page.js has zero .style.display assignments | unit (static analysis) | `cd custard-calendar && uv run pytest tests/test_inline_style_elimination.py::test_no_style_display_in_compare_js -x` | Wave 0 |
| DTKN-03e | shared-nav.js has zero .style.display assignments | unit (static analysis) | `cd custard-calendar && uv run pytest tests/test_inline_style_elimination.py::test_no_style_display_in_shared_nav_js -x` | Wave 0 |
| DTKN-03f | today-page.js and forecast-map.html JS have no .style.cssText or direct property assignments (with exception for truly dynamic values per discretion) | unit (static analysis) | `cd custard-calendar && uv run pytest tests/test_inline_style_elimination.py::test_no_inline_style_assignments -x` | Wave 0 |
| DTKN-03g | New CSS classes consume design tokens (var(--*)) | unit (static analysis) | `cd custard-calendar && uv run pytest tests/test_inline_style_elimination.py::test_new_classes_use_tokens -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd custard-calendar && uv run pytest tests/test_inline_style_elimination.py -v`
- **Per wave merge:** `cd custard-calendar && uv run pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_inline_style_elimination.py` -- covers DTKN-03 (zero inline styles in HTML + zero .style.* in JS)
- [ ] `.hidden` CSS class in style.css -- required for classList.toggle('hidden') pattern

### Pre-existing Test Failures (NOT caused by this phase)
- `test_no_hardcoded_colors`: 4 violations (.nearest-badge, .user-position-dot) -- known, documented in STATE.md
- `test_no_hardcoded_spacing`: 1 violation (.nearest-badge margin-left) -- known, documented in STATE.md

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of compare.html, index.html, forecast-map.html, style.css, compare-page.js, shared-nav.js, today-page.js, forecast-map.html inline JS, updates-page.js
- style.css :root token definitions (lines 1-95)
- style.css header h1 / header p rules (lines 254-262)
- style.css .updates-cta-card rules (lines 2090-2113)
- style.css [hidden] rule (lines 103-105)
- Existing test files: test_design_tokens.py, test_card_button_unification.py
- Test run output confirming 15 passing, 2 pre-existing failures

### Secondary (MEDIUM confidence)
- CONTEXT.md user decisions and discretion areas
- Phase 20/21 patterns documented in STATE.md

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - vanilla CSS, no build tools, all verified in codebase
- Architecture: HIGH - complete inventory of every inline style and JS .style.* assignment
- Pitfalls: HIGH - verified each CSS rule against inline style values, identified margin-top discrepancy and missing font-size
- Test strategy: HIGH - follows established Phase 21 baseline-count pattern

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable -- vanilla CSS, no framework changes expected)
