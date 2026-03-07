# Project Research Summary

**Project:** Custard Calendar Site Restructuring
**Domain:** Presentation-layer restructuring of a static vanilla JS site (11 pages to 4 views, GitHub Pages)
**Researched:** 2026-03-07
**Confidence:** HIGH

## Executive Summary

This project is a presentation-layer restructuring of an existing static site hosted on GitHub Pages, consolidating 11+ pages into 4 primary views (Today, Compare, Map, Fun). The codebase enforces hard constraints: no build step, no frameworks, vanilla ES5-style JavaScript with IIFE modules, a single shared CSS file, and zero new npm dependencies. Research across stack, features, architecture, and pitfalls confirms that the existing technology stack and patterns are the right foundation. The recommended approach is to extend what already works -- CSS Grid for the comparison layout, `<details>/<summary>` for progressive disclosure, IIFE modules for new page scripts -- rather than introducing any new paradigms.

The Compare page (store x day grid) is the single highest-risk, highest-value deliverable. The core use case is a family in the car at 375px deciding where to go. Research from NNGroup and UX Matters confirms that a literal 4-column grid is physically unreadable at that width. The mobile layout must use a day-first card stack with full-width store entries, switching to a proper grid at 640px+. This layout decision must be prototyped in HTML/CSS before any API wiring begins. The product's genuine competitive moat -- 10+ years of rarity data across 971+ stores -- should be surfaced as contextual rarity tags on every flavor mention, not buried in dashboards.

The most dangerous pitfalls are operational, not technical. A stale service worker will serve old markup to returning users after deployment (the exact audience the restructure aims to help). Meta-refresh redirects silently drop query parameters that iOS widgets and bookmarks rely on. And `planner-shared.js`, a 1,600-line monolith with zero tests, is loaded by every page -- any regression cascades everywhere. All three require preventive action in Phase 1, before the structural work begins.

## Key Findings

### Recommended Stack

Zero new dependencies. All layout work uses modern CSS with 93%+ browser support; all JS follows the existing IIFE-on-window-global pattern. The only technologies that need careful handling are `interpolate-size` (Chromium-only, progressive enhancement only) and `<details name="">` exclusive accordion (~85% support, degrades gracefully).

**Core technologies:**
- **CSS Grid + `auto-fit`/`minmax()`:** Comparison grid layout. Handles 1-4 columns natively based on viewport. 97%+ support.
- **CSS Scroll Snap:** Mobile swipe for Compare columns at 375px. Each store column snaps into view. 97%+ support.
- **CSS Subgrid:** Align card content (flavor name, rarity badge) across sibling comparison columns. 95%+ support.
- **Container Queries:** Cards adapt to their container width, not viewport. Critical for cards reused in narrow scroll-snap columns vs full-width sections. 93%+ support.
- **`<details>/<summary>`:** Progressive disclosure for week-ahead, cell expansion, quiz mode selection. Zero JS needed, accessible by default, already styled in codebase.
- **`:has()` selector:** Content-aware card styling (rarity-colored borders) without JS class toggling. 97%+ support.
- **IIFE Revealing Module pattern:** New JS modules (`CustardCompare`, `CustardNav`, `CustardFun`) follow the exact same `var X = (function() { return { mount, destroy }; })();` convention as existing code.
- **`CustomEvent` dispatch:** Cross-component communication (store changed, filter applied) without module coupling.

**What NOT to use:** CSS preprocessors, Tailwind, Web Components, ES modules, SPA routing, CSS `@layer`, View Transitions API, any build step. See STACK.md for detailed rationale on each exclusion.

### Expected Features

**Must have (table stakes -- 10 features):**
- Instant answer on load (geolocate + show flavor immediately)
- Single-store today view above fold (cone + flavor + description, nothing else)
- Multi-store comparison grid (2-4 stores x 2-3 days, the core new feature)
- Rarity/scarcity indicators on every flavor mention
- Flavor family exclusion filters (toggle chips: "No Nuts", "No Mint")
- Mobile-optimized decision flow (375px is the primary target)
- Clear 4-item navigation (Today, Compare, Map, Fun)
- Persistent store selection with compact header indicator
- Week-ahead view (collapsed by default, remembers expand state)
- Directions/navigation link (one tap from any store mention)

**Should have (differentiators -- Phase 2):**
- Get Updates consolidation (one page for Calendar/Widget/Siri/Alerts)
- Map exclusion filter (same chip pattern as Compare)
- Fun page quiz UX overhaul (visual mode cards, image-based answers)
- Contextual flavor signals ("Peaks on Sundays" inline on cards)

**Defer (v2+):**
- Old page redirects (Phase 3 -- needs all new pages to exist first)
- Visual coherence audit (Phase 3 -- after structural changes settle)
- Fronts, Group Vote, Mad Libs UX (accessible from Fun, already built)

**Explicitly NOT building:** User accounts, analytics dashboards, AI recommendations, social features, push notifications, loyalty gamification, dark mode toggle, distance radius slider, hamburger menu.

### Architecture Approach

The architecture is multi-page (separate HTML files per view) with shared code via `<script src>` includes. A new `shared-nav.js` IIFE renders the 4-item nav + persistent store indicator into a `<div id="shared-nav">` placeholder on every page, eliminating nav duplication across 14 files. New page modules (`compare-grid.js`, etc.) follow the existing `var CustardX = (function() { ... })();` pattern. State management remains in localStorage via `CustardPlanner` -- no new state mechanism needed. Old pages become redirect stubs with JS-based forwarding that preserves query parameters.

**Major components:**
1. **CustardPlanner** (`planner-shared.js`) -- State, API client, scoring, constants. Existing, no structural changes.
2. **CustardNav** (`shared-nav.js`, NEW) -- Renders nav bar + store indicator. Single definition, all pages.
3. **CompareGrid** (`compare-grid.js`, NEW) -- Store x day grid, cell expansion, family exclusion filter.
4. **ConeRenderer** (`cone-renderer.js`) -- SVG cone generation. Existing, no changes.
5. **CustardDrive** (`todays-drive.js`) -- Drive ranking UI. Existing, minor refactoring.

**Key architectural decisions:**
- Day-first layout on mobile, store-first on desktop (same DOM, CSS-only transformation)
- `<details>` for cell expansion in Compare grid (no `name` attribute -- users may want multiple cells open)
- JS `location.replace()` for redirects (preserves query params, avoids history pollution)
- No fetch-based HTML includes (extra HTTP request, CORS issues with `file://` testing)

### Critical Pitfalls

1. **Service worker serves stale pages (CRITICAL):** The existing `sw.js` has a hardcoded `STATIC_ASSETS` list. After restructuring, returning users see old markup until the background revalidation completes. **Prevention:** Bump `CACHE_VERSION` on every deployment, update `STATIC_ASSETS` array, add "new version available" reload prompt.

2. **Meta-refresh redirects drop query parameters (CRITICAL):** `<meta http-equiv="refresh">` uses a static destination URL. iOS widgets and bookmarks with `?stores=mt-horeb` lose their store context silently. **Prevention:** Use JS `location.replace()` as primary redirect mechanism with `window.location.search` forwarding. Meta refresh as no-JS fallback only.

3. **Compare grid unreadable at 375px (CRITICAL):** 4 stores x 3 days = 12 cells at ~86px each. Flavor names like "Chocolate Caramel Twist" need ~154px minimum. The math does not work. **Prevention:** Do not attempt a multi-column grid at 375px. Use day-first card stack on mobile, grid at 640px+. Prototype with real flavor names before wiring API data.

4. **planner-shared.js regression cascades (CRITICAL):** 1,624-line monolith with zero tests, loaded by every page. Any modification for the restructure risks breaking existing pages. **Prevention:** Add targeted tests for functions being modified before touching the file. Put new functionality in new files (`shared-nav.js`, `compare-grid.js`).

5. **Scope creep into Worker/API changes (MODERATE but pervasive):** The Compare grid may need data reshaped. The temptation is "just one endpoint." 52% of projects experience scope creep. **Prevention:** Hard rule: any change to `worker/src/` is a separate project. Transform API data client-side.

## Implications for Roadmap

Based on combined research, the restructure divides into 5 phases with clear dependencies.

### Phase 1: Foundation
**Rationale:** Every subsequent phase depends on shared navigation and the store indicator. This must exist before any page restructuring begins. Also the right time to set up test infrastructure for `planner-shared.js` before modifying it.
**Delivers:** `shared-nav.js` (new IIFE module), store indicator CSS, updated `index.html` to use shared nav, service worker version bump.
**Addresses:** Persistent store indicator (table stake), nav consolidation groundwork.
**Avoids:** Pitfall 4 (planner-shared.js breakage) by adding tests first; Pitfall 1 (stale service worker) by establishing the version-bump discipline.

### Phase 2: Core Pages (Today + Compare)
**Rationale:** These are the two primary use cases (UC1: "where should we go?", UC2: "what's the flavor right now?"). They can be built in parallel since both depend only on Phase 1. The Compare page is the highest-risk item and should be prototyped at 375px before full implementation.
**Delivers:** Restructured Today page (cone + flavor above fold, week-ahead collapsed), Compare page with grid + cell expansion + exclusion filters, mobile-responsive layouts for both.
**Addresses:** 6 of 10 table-stakes features (instant answer, today view, comparison grid, rarity tags, exclusion filters, mobile optimization).
**Avoids:** Pitfall 3 (grid at 375px) by prototyping mobile layout first; Pitfall 6 (progressive disclosure hiding power-user data) by persisting `<details>` state in localStorage; Pitfall 7 (scope creep) by transforming API data client-side.

### Phase 3: Nav Consolidation + Supporting Pages
**Rationale:** The nav cannot switch to 4 items until all destination pages exist. This phase creates `fun.html` and `updates.html`, then activates the new navigation across all pages.
**Delivers:** Fun page (quiz modes, Mad Libs, Fronts access, Group Vote access), Get Updates page (consolidated Calendar/Widget/Siri/Alerts setup), final 4-item nav activated.
**Addresses:** Fun page quiz UX (differentiator), Get Updates consolidation (differentiator), clear navigation (table stake).
**Avoids:** Pitfall 8 (inconsistent nav during partial deployment) by shipping nav change only after all destination pages exist; Pitfall 5 (returning users confused) by adding transitional "was Radar" subtitles.

### Phase 4: Redirects + Map Enhancement
**Rationale:** Old URLs must redirect only after new destinations exist and the nav is live. Map exclusion filter is independent work that fits naturally here.
**Delivers:** Redirect stubs for 7 old pages (with JS query-param forwarding), 404.html catch-all, Map page exclusion filter chips, Map page nav update.
**Addresses:** URL preservation for bookmarks and widgets, UC3 (dietary filtering on Map).
**Avoids:** Pitfall 2 (query params dropped) by using JS redirects, not meta-refresh alone; Pitfall 9 (redirect pages in search results) by adding `noindex` meta tags and canonical links.

### Phase 5: Polish + Visual Coherence
**Rationale:** Polish should happen after all structural changes are complete. First-visit geolocation flow, unified card system, cone rendering consistency, and cross-page testing.
**Delivers:** First-visit geolocation prompt, visual coherence audit (unified `.card` class replacing `.store-card`/`.day-card`/`.cal-event`), contextual flavor signals on cards, cross-page regression test suite.
**Addresses:** Contextual flavor signals (differentiator), visual consistency, first-visit experience.
**Avoids:** Pitfall 11 (CSS class collisions) by namespacing all new classes with page prefixes during Phases 1-4 and unifying in Phase 5.

### Phase Ordering Rationale

- **Foundation first** because shared-nav.js and the store indicator are hard dependencies for every other phase.
- **Today + Compare in parallel** because they are independent pages that only depend on Phase 1. Compare is highest-risk, so starting it early gives time for iteration.
- **Nav consolidation after core pages** because you cannot point a 4-item nav at pages that do not exist yet.
- **Redirects after nav** because redirect destinations must exist and the nav must be live before old URLs are retired.
- **Polish last** because visual coherence decisions made before structural changes settle will need to be redone.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Compare page):** The mobile layout needs an HTML/CSS prototype tested at 375px with real flavor name lengths before committing to a pattern. Two candidate approaches (day-first card stack vs horizontal scroll-snap) should be evaluated side by side.
- **Phase 3 (Fun page):** Quiz image assets are undefined. Mode card design needs mockups. Mad Libs word selection UI is a new interaction pattern that may need UX iteration.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** JS-rendered nav is a well-documented pattern. Store indicator is simple localStorage read + DOM render.
- **Phase 4 (Redirects):** GitHub Pages redirect techniques are well-documented. The JS redirect pattern is simple and proven.
- **Phase 5 (Polish):** Unified card system and container queries are standard CSS patterns with excellent documentation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies are Baseline 2023+ with 93%+ browser support. Sources are MDN, Can I Use, and reputable CSS authors. Only `interpolate-size` is low-confidence (Chromium-only) and is correctly scoped as progressive enhancement. |
| Features | HIGH | Table stakes validated against NNGroup, Baymard, and competitive analysis of DoorDash/Untappd/Yelp. Anti-features list is well-reasoned against the product's non-transactional model. |
| Architecture | HIGH | Architecture is grounded in direct analysis of the existing codebase (`planner-shared.js`, `todays-drive.js`, `style.css`). Patterns extend what already works rather than introducing new paradigms. |
| Pitfalls | HIGH | Critical pitfalls (service worker, query params, 375px grid) are specific, testable, and have concrete prevention strategies. Sources include direct codebase analysis and well-documented failure patterns. |

**Overall confidence:** HIGH

### Gaps to Address

- **Compare grid mobile layout:** Two candidate approaches (day-first card stack vs scroll-snap columns) need prototype testing at 375px with real flavor data before committing. Neither research nor intuition can resolve this -- only a rendered prototype will.
- **Quiz image assets:** What imagery do image-based answer cards use? The quiz engine exists but the visual overhaul depends on assets that are undefined.
- **Flavor family taxonomy completeness:** The exclusion filter depends on well-defined family boundaries. How many families exist? Are the boundaries clean or do some flavors span families?
- **Cone rendering tiers:** The `cone-renderer.js` produces SVG cones at different detail levels. Which tier is used where (Today hero vs Compare cell vs Map marker) affects visual coherence and performance.
- **Service worker update verification:** The prevention strategy for Pitfall 1 needs a manual test procedure (load old site, deploy new version, verify update cycle) that should be documented as a deployment checklist item.
- **Unlisted pages inventory:** `multi.html`, `flavor-audit.html`, and `masterlock-audit.html` need disposition decisions (update nav, redirect, or mark developer-only) before Phase 3 nav consolidation.

## Sources

### Primary (HIGH confidence)
- MDN Web Docs: CSS Grid, Subgrid, Scroll Snap, Container Queries, `:has()`, `<details>`, `::details-content`
- Can I Use: Browser support data for all recommended technologies
- NNGroup: Mobile Tables, Progressive Disclosure, Navigation UX
- Baymard Institute: Food Delivery UX, E-commerce Navigation Best Practices
- UX Matters: Designing Mobile Tables
- Custard Calendar codebase: `docs/planner-shared.js`, `docs/cone-renderer.js`, `docs/todays-drive.js`, `docs/style.css`, `docs/sw.js`, all HTML pages

### Secondary (MEDIUM confidence)
- Josh W. Comeau: CSS Subgrid patterns, `:has()` utility patterns
- CSS-Tricks: Scroll snapping, HTML includes approaches
- LogRocket: Comparison table design, `<details>` styling
- Pencil & Paper / BricxLabs: Mobile filter UX patterns, chip design specs
- Storemapper / Map UI Patterns: Store locator best practices
- GitHub Pages community: Redirect techniques, 404.html patterns
- Go Make Things / FED Mentor / Piccalilli: Accessible disclosure components

### Tertiary (LOW confidence)
- Goama: Food app gamification (marketing-heavy source, conclusions validated by higher-quality sources)
- Medium articles: Responsive design challenges, service worker pitfalls (individual experiences, not systematic research)

---
*Research completed: 2026-03-07*
*Ready for roadmap: yes*
