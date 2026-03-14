# Phase 20: Design Token Expansion - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Add semantic state, rarity, and interactive tokens to the design system so every color -- state indicators, rarity badges, and interactive feedback -- uses a CSS custom property instead of a hardcoded hex value. The existing 37 tokens remain unchanged (additive-only policy). Requirements: DTKN-01, DTKN-02, DTKN-04.

</domain>

<decisions>
## Implementation Decisions

### Rarity color scale
- Unified to the **popup palette**: purple > blue > green > light green > gray
  - Ultra-rare: `#7b1fa2` (purple)
  - Rare: `#1565c0` (blue)
  - Uncommon: `#2e7d32` (green)
  - Common: `#e8f5e9` (light green bg) / `#2e7d32` (text)
  - Staple: `#f5f5f5` (gray bg) / `#777` (text)
- **Solid colored pills** for all badge contexts (map popups, Today, Compare) -- white text on solid background for ultra-rare through uncommon
- **Hide badges for staple and common** tiers everywhere (map popups included) -- only show uncommon and above
- The current badge palette (pink/orange/blue) on Today/Compare gets replaced with the popup palette

### State color semantics
- **Watch state**: amber/orange palette confirmed as good (`#f9a825`, `#f57f17` range)
- **Estimated vs confirmed**: clearly different -- muted colors, dashed borders, reduced opacity for estimated. Users should never mistake a prediction for a confirmed flavor
- **Quiz state colors** (--quiz-danger, --quiz-success) should use the shared semantic state tokens, not inline overrides in quiz.html

### Confirmed state unification
- Claude's discretion on whether confirmed uses all-green, all-blue, or the current mixed approach
- Goal: coherent visual language, whatever the specific choice

### Interactive feedback
- **Focus rings**: accessibility-forward, consistent 2px outline on all focusable elements via :focus-visible (keyboard only)
- **Hover behavior**: Claude's discretion per element type (color shift, elevation, or both depending on context)
- **color-mix() adoption**: Claude's discretion on whether to use color-mix() or pre-computed hex values based on browser support posture
- **Map marker states** (glows, opacity layers) should derive from the shared token system, not standalone hardcoded rgba values

### Token naming convention
- **Grouped by domain prefix**, matching existing pattern (--text-*, --bg-*, --shadow-*):
  - `--state-confirmed`, `--state-confirmed-bg`, `--state-confirmed-text`
  - `--state-watch`, `--state-watch-bg`, `--state-watch-text`
  - `--rarity-ultra-rare`, `--rarity-ultra-rare-bg`, `--rarity-ultra-rare-text`
  - `--focus-ring`, `--hover-bg`
- **Paired bg + text tokens** for each state and rarity level (primary color, background, and text color)
- Expected ~30 new tokens added to :root

### Scope inclusions
- **Brand-specific border colors** for 6 custard brands (Culver's, Kopp's, Gille's, Hefner's, Kraverz, Oscar's) -- tokenize as `--brand-{name}`
- **Drive dashboard forecast bucket colors** (great/ok/pass/hard_pass) -- Claude's discretion on whether to include

### Claude's Discretion
- Confirmed state color unification (green vs blue vs mixed)
- Hover feedback style per element type
- color-mix() vs pre-computed hex values
- Drive dashboard color inclusion
- Exact token count and any additional derived tokens needed

</decisions>

<specifics>
## Specific Ideas

- Rarity should feel like a "heat" gradient: purple (hot/rare) cooling down to gray (cold/common)
- Solid pills are scannable -- rarity should jump out, not require squinting
- Hiding staple/common badges reduces visual noise and keeps attention on interesting flavors
- Estimated flavors should be "obviously lower confidence" -- no risk of mistaking a prediction for confirmed

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- 37 existing CSS custom properties in :root (style.css) covering colors, typography, spacing, shadows, radii
- `--marker-ring`, `--marker-state-glow`, `--marker-glow` CSS variables already exist for map markers (partial token usage)
- `--quiz-danger` and `--quiz-success` defined inline in quiz.html -- should be migrated to style.css tokens

### Established Patterns
- `:root` block in style.css is the single source of truth for tokens
- Tokens follow flat prefix-grouped naming: `--text-muted`, `--bg-surface`, `--shadow-md`
- State classes use `.day-card-confirmed`, `.day-card-watch`, `.day-card-estimated` pattern
- Rarity classes use `.popup-rarity-{level}` and `.rarity-badge-{level}` patterns
- Brand border classes use `.brand-border-{name}` pattern (6 brands, lines 854-859)

### Integration Points
- style.css :root block -- all new tokens added here
- Map popup rarity chips (lines 956-960) -- replace hardcoded hex with rarity tokens
- Today/Compare rarity badges (lines 1770-1774) -- replace with unified rarity tokens
- State-colored elements across Today and Compare pages -- replace hardcoded hex with state tokens
- quiz.html inline `<style>` block -- migrate to shared tokens
- Map marker glow values (lines 568-580) -- derive from state tokens
- Focus/hover patterns scattered across style.css -- unify to interactive tokens

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 20-design-token-expansion*
*Context gathered: 2026-03-13*
