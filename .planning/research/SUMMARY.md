# Project Research Summary

**Project:** Custard Calendar v1.2 Feature Completion & Cleanup
**Domain:** Static site feature additions (vanilla JS, GitHub Pages, Cloudflare Worker)
**Researched:** 2026-03-09
**Confidence:** HIGH

## Executive Summary

Custard Calendar v1.2 is a feature-completion milestone for an existing vanilla JS static site hosted on GitHub Pages. The 11 features span infrastructure fixes (CI check, unpushed commits), operational improvements (service worker registration, stores.json pre-cache, old page redirects), code quality (Mad Libs chip CSS extraction, planner-shared.js monolith refactoring), and new user-facing capabilities (map exclusion filter, quiz image answers, compare multi-store side-by-side, hero cone PNGs for 136 flavors). All four research files converge on the same conclusion: zero new dependencies are needed. Every feature can be built with browser APIs and patterns already proven in the codebase.

The recommended approach is to sequence work by risk and dependency: infrastructure and quick wins first (CI fix, push, SW changes, redirects, CSS extraction), then the monolith refactoring as an isolated focused phase, then independent feature work (map filter, quiz images, compare verification, cone PNGs). The monolith refactoring is the single most architecturally disruptive change -- it touches every HTML page's script tags and must preserve the `window.CustardPlanner` public API exactly. All four research files flag it as needing careful isolation. The compare page multi-store feature may already be substantially implemented based on architecture review, which would reduce the milestone's scope significantly.

The key risks are: (1) service worker cache incoherence when deploying refactored JS files -- prevented by batching all SW changes into a single CACHE_VERSION bump; (2) meta-refresh redirects silently dropping query parameters from bookmarked URLs -- prevented by using JS `location.replace()` as the primary mechanism; (3) planner-shared.js refactoring breaking implicit cross-file dependencies -- prevented by documenting the public API contract before splitting, running the full Playwright suite after every change, and keeping the refactor isolated from other feature work.

## Key Findings

### Recommended Stack

No new dependencies. All v1.2 features use technologies already at 97%+ browser support or existing in the codebase. The constraints are unchanged from v1.0: no build step, no frameworks, vanilla JS with `var` and IIFEs, single CSS file, CDN only for Leaflet.

**Core technologies:**
- **Meta refresh + JS `location.replace()`:** Client-side redirects for 6 old pages. The only option on GitHub Pages. JS handles query param preservation; meta refresh is the no-JS fallback.
- **IIFE namespace extension pattern:** Split planner-shared.js into multiple files that each attach methods to `window.CustardPlanner`. Battle-tested pattern (jQuery plugins, pre-ESM libraries). No new globals, no ES modules.
- **`aria-pressed` + localStorage:** Map exclusion filter chips. Replaces the current class-based toggle with accessible state attributes. Persistence via the same localStorage pattern already proven on the Compare page.
- **CSS Grid 2x2 + existing sprite system:** Quiz image-based answers on mobile. Layout change only; all image rendering infrastructure exists.
- **sharp 0.34.x (build-time):** Hero cone PNG generation. Pipeline exists and is proven for 40 flavors. Scaling to 176 is a data-entry task, not infrastructure.

**What NOT to add:** ES modules, Workbox, IndexedDB, CSS preprocessors, View Transitions API, WebP for cones, any new CDN library. See STACK.md for detailed rationale on each exclusion.

### Expected Features

**Must have (table stakes -- ship first):**
- Old page redirects preserving query params (6 URLs with bookmarks/SEO at stake)
- SW registered on fun.html and updates.html (consistency gap)
- stores.json in SW pre-cache (offline reliability)
- Fix CI repo structure check (blocks all PRs)
- Push unpushed commits and verify deployment (operational backlog)
- Mad Libs chip CSS definitions (inline styles violate design system)

**Should have (differentiators -- ship second):**
- Map flavor family exclusion filter with persistent state (dietary/allergy filtering)
- Quiz image-based answer options on mobile (engagement upgrade)
- Compare page multi-store side-by-side (core Compare value prop -- may already work)
- Hero cone PNGs for ~136 flavors (visual consistency across the flavor catalog)

**Must do (architectural -- isolated phase):**
- planner-shared.js refactored from 1,639-line monolith (maintainability, targeted caching)

**Anti-features (explicitly NOT building):**
- ES modules for the refactoring (too disruptive)
- Shared exclusion state between Map and Compare (different user intents)
- Server-side redirects via Cloudflare Worker (out of scope)
- Full catalog API for flavor profile authoring (manual is fine at this scale)
- Horizontal scroll comparison table (rejected in v1.0 for 375px)

### Architecture Approach

All v1.2 features are presentation-layer changes. No Worker/API modifications needed. The architecture stays multi-page with shared code via `<script src>` includes. The monolith refactoring creates 2 new files (planner-ui.js, planner-signals.js) that extend the existing `window.CustardPlanner` object. Only 2 HTML pages need new script tags (index.html, compare.html). The component boundary diagram remains clean: planner-shared.js is the foundation loaded everywhere, extension files load only where needed.

**Major components (post-refactoring):**
1. **planner-shared.js** (~900 lines) -- Core constants, utilities, brand/flavor data, rarity, certainty, preferences
2. **planner-ui.js** (~500 lines, NEW) -- Timeline, reliability, historical context, CTAs, share button
3. **planner-signals.js** (~250 lines, NEW) -- Signal cards, fetch, tracking, interaction events
4. **Redirect stubs** (6 files) -- Minimal HTML with JS query-param-preserving redirects
5. **style.css additions** -- madlib-chip classes, quiz image grid, flavor-chip exclusion state

**Key architectural finding:** The compare page multi-store feature may already be implemented. `compare-page.js` already supports 2-4 stores with parallel data fetching and a day-first card stack layout. Architecture review recommends "verify and close" rather than reimplementing.

### Critical Pitfalls

1. **Meta-refresh redirects drop query parameters (CRITICAL)** -- Use JS `location.replace(target + window.location.search + window.location.hash)` as the primary redirect. Do NOT rely on meta refresh for users with bookmarked query params. Test every redirect with actual query strings.

2. **Service worker serves stale JS after monolith refactoring (CRITICAL)** -- Bump CACHE_VERSION in the same commit that lands refactored files. Add new JS files to STATIC_ASSETS. Deploy SW registration on fun.html/updates.html in the same version bump. Without this, returning users get the old cached planner-shared.js paired with new page scripts, causing TypeError crashes.

3. **Monolith refactor breaks implicit cross-file dependencies (CRITICAL)** -- The public API at planner-shared.js lines 1409-1470 is the contract. Document every symbol before refactoring. Grep all HTML and JS files for `CustardPlanner\.` to build the dependency map. Run the full 31-spec Playwright suite after every step.

4. **Compare page store state leaks to drive preferences (CRITICAL)** -- compare-page.js writes to the same `custard:v1:preferences.activeRoute.stores` key that Today's Drive reads. Multi-store compare selections should NOT propagate to the drive route. Create a separate `custard:v1:compare-stores` localStorage key.

5. **Hero cone PNG inconsistency at scale (MODERATE)** -- Render all 176 PNGs in a single batch run to avoid environment drift. Author profiles in batches of 10-15 with flavor-audit.html review checkpoints. Do not add cone PNGs to SW pre-cache (runtime stale-while-revalidate is correct).

## Implications for Roadmap

Based on combined research, the 11 features divide into 5 phases with clear dependency ordering.

### Phase 1: Infrastructure & Quick Wins
**Rationale:** Unblocks CI, establishes clean deployment baseline, batches all SW changes into one CACHE_VERSION bump. These are all low-risk, low-complexity tasks that clear operational debt.
**Delivers:** Working CI, deployed code, SW coverage on all pages, stores.json offline support.
**Addresses:** Fix CI repo structure check, push unpushed commits, SW registration on fun.html/updates.html, stores.json in SW pre-cache.
**Avoids:** Pitfall -- multiple CACHE_VERSION bumps (batch all SW changes here). Pitfall -- CI blocking all PRs (fix first).

### Phase 2: Redirects & CSS Cleanup
**Rationale:** Redirects are independent, same-pattern-six-times work with no dependency on other features. Mad Libs chip CSS is a contained code quality fix. Both reduce maintenance surface before heavier work begins.
**Delivers:** 6 working redirect stubs preserving query params, Mad Libs chips using design tokens instead of inline styles.
**Addresses:** Old page redirects, Mad Libs chip CSS definitions.
**Avoids:** Pitfall -- meta-refresh dropping query params (use JS redirect as primary). Pitfall -- redirect pages loading full JS stack (minimal stubs only).

### Phase 3: Monolith Refactoring
**Rationale:** All four research files agree: the refactoring must be isolated. It should happen AFTER quick wins are stable and BEFORE new feature work adds more code to the monolith. This is the highest-risk change in the milestone.
**Delivers:** planner-shared.js split into 3 files (shared, ui, signals). Same public API. Targeted caching. Better maintainability.
**Addresses:** planner-shared.js refactored from 1,639-line monolith.
**Avoids:** Pitfall -- cross-file implicit dependencies (document API contract first, Playwright suite after every step). Pitfall -- stale SW cache (bump CACHE_VERSION with the refactor commit).

### Phase 4: Feature Development
**Rationale:** These are independent features that can be worked in parallel after the refactored foundation is stable. Each is self-contained in its own page module.
**Delivers:** Map exclusion filter with persistence, quiz image-based answers, verified compare multi-store behavior.
**Addresses:** Map flavor family exclusion filter, quiz image-based answer options, compare page multi-store side-by-side.
**Avoids:** Pitfall -- compare state leaking to drive preferences (separate localStorage keys). Pitfall -- quiz images not loading on slow connections (SVG fallback as default).

### Phase 5: Asset Pipeline
**Rationale:** Hero cone PNGs are independent of all other features. The SVG fallback works fine in the interim. This is high-volume authoring work (136 flavor profiles) best done in batches with quality checkpoints.
**Delivers:** ~136 new hero cone PNGs for full flavor catalog coverage.
**Addresses:** Hero cone PNGs for remaining ~136 flavors.
**Avoids:** Pitfall -- inconsistent rendering (single batch run, same environment). Pitfall -- invisible toppings (contrast validation per CONE_PROFILE_SPEC.md).

### Phase Ordering Rationale

- **Infrastructure first** because CI is blocking PRs and unpushed commits mean the live site is stale. SW changes batched early to avoid multiple cache version bumps.
- **Redirects second** because they are simple, independent, and reduce the maintenance surface (6 full pages become 6 thin stubs) before heavier work.
- **Monolith refactoring third** because it must happen after cleanup is stable but before new feature code is added. Doing it mid-feature-work creates merge conflicts. Doing it last means features add more lines to the monolith first.
- **Features fourth** because they build on the refactored foundation and are independent of each other.
- **Asset pipeline last** because it is purely data-entry work with a working fallback. It can even be parallelized with Phase 4.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Monolith Refactoring):** The exact split boundaries need validation. STACK.md recommends 6 files, FEATURES.md recommends 11 files, ARCHITECTURE.md recommends 3 files. The right answer depends on measuring actual page-specific load requirements. Start with the 3-file split (lower risk) and evaluate.
- **Phase 4 (Compare Multi-Store):** Architecture review suggests this may already be implemented. Needs hands-on testing with 2-4 stores before committing to implementation work. Could be "verify and close."

Phases with standard patterns (skip research-phase):
- **Phase 1 (Infrastructure):** SW registration is a one-liner. stores.json pre-cache is a one-line addition. CI fix is a two-file documentation update.
- **Phase 2 (Redirects & CSS):** GitHub Pages redirect pattern is well-documented. CSS chip extraction follows existing flavor-chip/brand-chip patterns exactly.
- **Phase 5 (Asset Pipeline):** Pipeline is proven for 40 flavors. Scaling is data entry, not engineering.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies already in use or at 97%+ support. No new dependencies. Recommendations based on direct codebase analysis. |
| Features | HIGH | Features directly from PROJECT.md requirements. Implementation patterns verified against existing codebase. Dependency graph is clear. |
| Architecture | HIGH | Based on direct code inspection of all relevant files. Component boundaries match existing patterns. Only uncertainty: whether compare multi-store is already done. |
| Pitfalls | HIGH | All pitfalls verified against actual codebase files (line numbers cited). Prevention strategies use patterns already proven in the codebase. Recovery costs assessed realistically. |

**Overall confidence:** HIGH

### Gaps to Address

- **Compare page completeness:** Architecture review suggests multi-store comparison may already work. This needs hands-on verification with 2-4 stores before Phase 4 planning. If confirmed, the milestone shrinks by its most complex feature.
- **Monolith split granularity:** Three different split recommendations across research files (3, 6, or 11 files). The 3-file approach from ARCHITECTURE.md is the lowest risk. Start there, evaluate whether finer splitting is warranted.
- **Shared vs. separate exclusion localStorage keys:** STACK.md recommends sharing the `custard-exclusions` key between Map and Compare. FEATURES.md recommends separate keys (`custard-map-exclusions`). ARCHITECTURE.md uses a third name (`custard-map-excluded-families`). This needs a decision before Phase 4. Recommendation: separate keys (different user intents on different pages).
- **stores.json cache-bust parameter:** ARCHITECTURE.md identifies that `?v=` cache-bust params on stores.json fetches will cause SW cache misses. Must remove `?v=` from 4 files when adding stores.json to STATIC_ASSETS. This is a hidden dependency in Phase 1.
- **Redirect page SW caching:** Old pages are in the SW pre-cache list. After conversion to redirect stubs, the SW caches the stubs. Users with old cached versions get the full old page until SW updates. Need to decide: keep redirect stubs in STATIC_ASSETS (correct behavior on next SW update) or remove them (saves cache space but means the redirect is not available offline).

## Sources

### Primary (HIGH confidence)
- MDN Web Docs: Service Worker Registration, meta refresh, location.replace(), aria-pressed
- web.dev: Service Worker Registration, PWA Service Workers
- sharp documentation (v0.34.x): SVG-to-PNG rasterization, kernel options
- Custard Calendar codebase: All findings verified against actual file contents with line numbers

### Secondary (MEDIUM confidence)
- GitHub Pages redirect guides (pasdam.github.io, DEV Community, opensource.com)
- Fireship: JavaScript module patterns (IIFEs to ESM)
- Rich Harris: Service worker lifecycle and update pitfalls
- Philip Walton: Cascading cache invalidation
- LogRocket / Smashing Magazine: Comparison table design, filter UX patterns
- Material Design 3: Chip component patterns
- Inclusive Components / Josh Collinsworth: Accessible toggle buttons

### Tertiary (LOW confidence)
- Individual blog posts on refactoring monolithic JS (used for pattern validation, not primary recommendations)

---
*Research completed: 2026-03-09*
*Ready for roadmap: yes*
