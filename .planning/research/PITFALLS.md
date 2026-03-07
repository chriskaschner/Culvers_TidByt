# Domain Pitfalls

**Domain:** Presentation-layer restructuring of a static site (11 pages to 4, GitHub Pages, vanilla JS)
**Project:** Custard Calendar site restructuring
**Researched:** 2026-03-07

## Critical Pitfalls

Mistakes that cause rewrites, broken production, or user abandonment.

### Pitfall 1: Service Worker Serves Stale Pages After Restructuring

**What goes wrong:** The existing `sw.js` uses stale-while-revalidate with a hardcoded `STATIC_ASSETS` list that names specific pages (`index.html`, `calendar.html`, `forecast-map.html`, `quiz.html`, `widget.html`). After the restructuring, users who visited the site before the change will have the old service worker cached. That old worker will intercept requests for the new pages and serve cached versions of the old layout -- or worse, serve the old `index.html` markup when the user navigates to the restructured Today page. The `CACHE_VERSION` is currently `custard-v7` and requires a manual bump.

**Why it happens:** The service worker installs on first visit and only updates when the browser detects a byte-level change to `sw.js`. Even then, the new worker waits for all tabs to close before activating (the current code uses `skipWaiting()` which helps, but the stale-while-revalidate fetch strategy means cached responses are served first, with network updates happening in the background). A user who opens the site infrequently may see the old layout for an entire session before the background revalidation takes effect.

**Consequences:** Users see the old 11-item nav and old page layout after you've deployed the new 4-item nav. Returning users -- the exact audience you're trying to serve better -- get the worst experience. The site appears "broken" if the cached HTML references CSS classes or JS functions that no longer exist in the updated stylesheets/scripts. The `compare.html` and `updates.html` pages won't be in the old cache at all, so those new pages load fresh while the homepage serves stale markup. This inconsistency is deeply confusing.

**Prevention:**
1. Bump `CACHE_VERSION` to `custard-v8` (or higher) in every deployment that changes HTML/JS/CSS. This is already noted in `CONCERNS.md` but has no automation.
2. Update the `STATIC_ASSETS` array in `sw.js` to include new pages (`compare.html`, `updates.html`) and remove pages that become redirect stubs.
3. Add a cache-busting version query param to the `sw.js` registration in all HTML pages (e.g., `navigator.serviceWorker.register('sw.js?v=8')`) -- while the browser does byte-level comparison regardless, this prevents intermediate HTTP caches from serving a stale `sw.js`.
4. Consider adding a "new version available" banner that triggers when the new service worker is waiting: listen for the `controllerchange` event and prompt the user to reload.
5. Test by loading the old site in a browser, deploying the new version, and verifying the update cycle works without manual cache clearing.

**Detection:** After any deployment, open the site in a browser that has previously visited it. If you see the old nav or old page layout, the service worker is serving stale content.

**Phase:** Must be addressed in Phase 1 (T1.4 Nav Consolidation at latest). Every subsequent deployment should bump the version. The service worker update should be part of the deployment checklist, not an afterthought.

---

### Pitfall 2: Meta-Refresh Redirects Silently Drop Query Parameters

**What goes wrong:** The restructuring plan (T3.1) calls for redirecting 6 old URLs to their new locations. The planned approach is `<meta http-equiv="refresh">` (the only server-side-like redirect available on GitHub Pages). Meta refresh uses a hardcoded destination URL. Query parameters from the original request (`?stores=mt-horeb`, `?store=madison-todd-drive`) are silently dropped -- they are not forwarded to the destination.

This matters because the site actively uses URL parameters for store context. The existing `scoop.html` renders Today's Drive for a `?stores=` param. The `radar.html` page accepts `?store=`. Calendar subscription pages may be bookmarked with store slugs. iOS widgets and Siri Shortcuts that deep-link to these pages with query params will break.

**Why it happens:** Meta refresh is a client-side instruction with a static URL. There is no mechanism in the HTML spec to say "forward whatever query string came with this request." The restructuring plan mentions "preserving query params" as a requirement but does not specify how. A developer implementing T3.1 will naturally reach for `<meta http-equiv="refresh" content="0; url=index.html">` and not realize query params are lost until someone tests a bookmarked link.

**Consequences:** Every bookmarked link with a query parameter stops working as expected. The user lands on the correct new page but without their store context, so they see a generic "pick your store" prompt instead of their saved store's data. For iOS widgets and Siri Shortcuts that construct URLs with query parameters, this is a silent regression: the widget still "works" (no error) but shows the wrong content.

**Prevention:**
1. Use JavaScript redirects instead of meta refresh for all pages that accept query parameters. The redirect page should contain a small script that reads `window.location.search` and appends it to the destination URL.
2. The redirect script pattern:
   ```javascript
   var dest = 'index.html';
   if (window.location.search) dest += window.location.search;
   if (window.location.hash) dest += window.location.hash;
   window.location.replace(dest);
   ```
3. Use `window.location.replace()` rather than `window.location.href =` so the redirect page does not appear in browser history (user can't "back" into the redirect).
4. Include a meta refresh as a no-JS fallback, but accept that query params will be lost for that rare case.
5. Add a `<link rel="canonical">` to the redirect page pointing to the new destination.
6. Write Playwright tests that verify redirects preserve query parameters: navigate to `scoop.html?stores=mt-horeb` and assert the final URL is `index.html?stores=mt-horeb`.

**Detection:** Test every redirect with a query parameter before deploying. Check iOS widget deep links manually (or in a simulator).

**Phase:** Phase 3 (T3.1 Redirects), but the redirect pattern should be decided and documented in Phase 1 so that any early-phase work that links to redirect destinations uses consistent patterns.

---

### Pitfall 3: Compare Grid Unreadable at 375px (4 Stores x 3 Days = 12 Cells)

**What goes wrong:** The Compare page grid needs to display 4 stores x 3 days at 375px viewport width. With 16px padding on each side (32px total), the usable width is 343px. Dividing by 3 day-columns gives ~114px per column; by 4 gives ~86px. A flavor name like "Chocolate Caramel Twist" is ~22 characters. At 14px font size, this is roughly 154px wide. The content physically cannot fit in the available space without wrapping to 2-3 lines per cell, creating a visual mess where every cell is a different height and the grid becomes impossible to scan.

**Why it happens:** The PROJECT.md explicitly defers the mobile grid layout decision: "Leave to implementation -- try and iterate." This is reasonable, but without a fallback strategy, the first implementation attempt will be a literal grid that looks fine on desktop and is unusable on mobile. The developer will spend time trying to make it work, discover it can't, and then need to rethink the entire interaction pattern -- wasting a sprint.

**Consequences:** The core use case (UC1: "Where should we go?" -- family in the car at 375px) becomes unusable. The Compare page was designed specifically for this scenario. If it doesn't work on mobile, the feature fails at its primary use case.

**Prevention:**
1. Do not attempt a 4-column grid at 375px. The math doesn't work. Accept this constraint upfront.
2. Use a **day-swipe pattern** on mobile: show one day at a time as a full-width card stack (all 4 stores for today), with horizontal swipe or tab navigation for tomorrow/day-after. This gives each store card the full 343px width -- enough for flavor name, cone, and rarity tag.
3. Alternative: show a **2-column layout** (2 stores visible, horizontal scroll for more) with days as rows. This is the "comparison table rotated 90 degrees" approach.
4. At wider viewports (768px+), switch to the full grid.
5. Build a quick HTML/CSS prototype of the mobile layout *before* wiring up API data. Verify it works with the longest real flavor names in the system (query the API for the longest names: some Culver's flavors like "Crazy for Cookie Dough" or "Chocolate Caramel Twist" are 20+ characters).
6. Use CSS `container queries` if you want the component to self-adapt, but media queries are fine for this scope.

**Detection:** Open `compare.html` on a real phone (not just DevTools, which doesn't account for browser chrome, touch target sizes, or system font scaling). If any cell requires more than 2 lines of text, the layout needs rethinking.

**Phase:** Phase 1 (T1.3 Compare Page). The mobile layout pattern must be decided before building the page, not after.

---

### Pitfall 4: planner-shared.js Breakage Cascades to Every Page

**What goes wrong:** `planner-shared.js` is a 1,624-line monolith loaded by every HTML page. It exposes `window.CustardPlanner` with store persistence, API calls, escapeHtml, haversine math, signal rendering, reliability banners, share buttons, and more. The restructuring plan touches this file in multiple tickets (T1.1 store indicator, T1.3 compare grid data formatter, T2.1 store context passing). A regression in this shared module breaks every page simultaneously, and there are zero unit tests for it.

**Why it happens:** The file grew organically over time. Each new page needed a utility, so it went into the shared module. Without tests, developers cannot verify that a change for the Compare page doesn't break the Map page's store lookup. The restructuring plan requires adding new functionality (store indicator component, geolocation prompt, grid data formatter) to this already-fragile file.

**Consequences:** A change to support the new store indicator in the header (T1.1) silently breaks the existing map.html store lookup. A change to the API call format for the Compare grid (T1.3) silently breaks the Today page. These regressions are only caught by manual testing of every page, which won't happen consistently.

**Prevention:**
1. Before modifying `planner-shared.js`, add targeted tests for the functions you're about to change. You don't need 100% coverage -- test `getStores()`, `buildStoreLookup()`, `escapeHtml()`, `fetchFlavorsForStore()`, and the localStorage read/write path.
2. Use the existing Vitest setup in the worker directory as a template for frontend JS tests. Or add a minimal test runner (even inline `<script>` assertions on a test HTML page served by a local server).
3. For new functionality (store indicator component, grid data formatter), consider creating a new file (e.g., `store-indicator.js`, `compare-grid.js`) rather than adding to the monolith. These can still depend on `CustardPlanner` but keep the new code isolated.
4. After each ticket that modifies `planner-shared.js`, manually verify that the following pages still work: index.html, map.html, radar.html, alerts.html, quiz.html. This is the minimum cross-page regression check.

**Detection:** If any page shows a JavaScript console error referencing `CustardPlanner`, the shared module is broken. Add a simple try/catch wrapper around page initialization that shows a user-visible error message rather than a silent failure.

**Phase:** Phase 1 (T1.1 is the first ticket that modifies this file). The test infrastructure should be set up before T1.1, not after.

---

## Moderate Pitfalls

### Pitfall 5: Nav Consolidation Confuses Returning Users Who Memorized Old Labels

**What goes wrong:** Returning users have learned that "Radar" shows multi-store comparison, "Calendar" sets up calendar subscriptions, and "Alerts" manages email notifications. The restructuring replaces 11 nav items with 4 new labels (Today, Compare, Map, Fun). Users who type "custard.chriskaschner.com/radar.html" from memory or click a browser autocomplete suggestion land on a redirect page. Users who look at the nav can't find their feature because the label changed.

Research from Baymard Institute shows that findability drops by over 40% when navigation doesn't match user expectations. However, the opposite research from Center Centre shows that clicks don't predict task success -- clarity and feedback do. The key insight: the transition is the danger zone, not the destination.

**Why it happens:** The old labels are weather-metaphor-based ("Radar", "Forecast", "Fronts") while the new labels are function-based ("Compare", "Today", "Fun"). This is the right long-term choice (clarity over cleverness), but the transition creates a temporary findability gap for the existing user base.

**Prevention:**
1. On redirect pages, include a clear message: "Flavor Radar has moved to Compare" with a prominent link. Do not auto-redirect so fast that the user can't read the message. Use a 3-second delay or a manual "Take me there" button alongside the auto-redirect.
2. For the first 4-8 weeks after launch, add subtitle text under new nav labels: "Compare" with "(was Radar)" in smaller text beneath. Remove the subtitles after the transition period.
3. Ensure the browser's autocomplete/history shows the new page titles. Each redirect page should have a `<title>` that includes the new name: "Redirecting to Compare (was Radar)".
4. Keep old URLs working indefinitely. Do not delete old HTML files. GitHub Pages doesn't charge for extra files.

**Detection:** After deploying the nav change, monitor the redirect pages for traffic. If `radar.html` continues receiving significant direct traffic after 8 weeks, users haven't learned the new structure.

**Phase:** Phase 1 (T1.4 Nav Consolidation). The redirect messaging should be part of T1.4, not deferred to T3.1.

---

### Pitfall 6: Progressive Disclosure Hides the Week-Ahead Data That Power Users Need

**What goes wrong:** The restructuring plan (T1.2) collapses the week-ahead schedule into a `<details>` element, hidden by default. The rationale is good (above-the-fold simplicity for the "quick glance" use case). But power users -- the people who visit daily and plan their week around specific flavors -- lose instant access to the data they came for. If "Chocolate Caramel Twist" is coming on Thursday, a power user wants to see that without an extra tap.

Research from NNGroup and IxDF confirms: progressive disclosure's main danger is "making incorrect assumptions about your users." The quick-glance user and the weekly-planner user have opposite needs, and the current design assumes the quick-glance user is the majority without validation.

**Why it happens:** The restructuring plan is correctly optimizing for the "family in the car" use case (UC2: "What's the flavor right now?"). But the existing site's most engaged users are likely the weekly planners who check the site regularly. Hiding their primary view behind a disclosure requires them to learn a new interaction pattern and perform an extra action every visit.

**Consequences:** Power users feel the redesign is a downgrade. They may switch to alternative channels (calendar feed, email alerts) or simply stop visiting the site. Since these are the most engaged users, losing their traffic and engagement disproportionately hurts.

**Prevention:**
1. Make the `<details>` element remember its state in localStorage. If a user expands the week-ahead once, keep it expanded for subsequent visits. This gives power users one extra tap on their first visit, then automatic behavior matches their preference.
2. Use `<details open>` as the default if the user has multiple stores saved (a reasonable proxy for "power user").
3. Ensure the collapsed state has a clear affordance: "This week's flavors" as the summary text with a count indicator (e.g., "This week's flavors (7 days)") so users know what's hidden.
4. Do not collapse additional elements beyond the week-ahead. The "one contextual CTA" and "one signal" should remain visible. Over-collapsing creates "progressive frustration."

**Detection:** If you have analytics (Cloudflare Web Analytics is already integrated), track clicks on the `<details>` summary element. If >50% of page views include an expand click, the default-collapsed state is wrong and it should be open by default.

**Phase:** Phase 1 (T1.2 Today Page Simplification). The localStorage persistence for disclosure state should be part of T1.2, not a follow-up.

---

### Pitfall 7: Scope Creep into Worker/API Changes Disguised as "Presentation Needs"

**What goes wrong:** During implementation, developers discover that the existing API response doesn't quite have the data shape the new Compare grid needs. Or the store indicator wants a lightweight "store metadata" endpoint that doesn't exist. Or the exclusion filter wants server-side filtering. Each of these feels like a small, reasonable change -- "just one endpoint" -- but they violate the project's core constraint: no Worker changes.

Research shows 52% of software projects experience scope creep, with an average 27% budget overrun. Frontend redesign projects are especially susceptible because UI changes reveal data shape mismatches that feel like they need backend fixes.

**Why it happens:** The restructuring plan explicitly scopes out Worker changes, but the boundary is tested whenever the frontend code needs to work around an API limitation. The `/api/v1/drive` endpoint already supports multi-store and multi-day, but the Compare grid may want data organized differently (by day instead of by store). A developer naturally thinks "it would be easier if the API returned..." and the scope boundary weakens.

**Consequences:** Worker changes require a separate deployment pipeline (`npx wrangler deploy`), a different test suite (810+ Worker tests), and a different failure mode (Worker downtime affects all consumers, not just the site). What starts as "one small endpoint" becomes a cascade: the new endpoint needs tests, rate limiting, CORS configuration, and documentation. The presentation-layer project is now blocked on a Worker deployment.

**Prevention:**
1. Write a one-line rule at the top of every implementation ticket: "If this requires a change to any file in `worker/src/`, stop and open a separate ticket."
2. When the frontend needs data in a different shape, transform it in JavaScript on the client side. The API already returns comprehensive data; the restructuring is about presentation, not data.
3. The specific API endpoints that the restructuring plan depends on all exist: `/api/v1/drive` (Compare), `/api/v1/today` (Today page), `/api/v1/flavors` (general), `/api/v1/nearby-flavors` (geolocation). If any of these don't have the right shape, transform client-side.
4. Keep the Worker code in a separate mental category: "that's a different project." The out-of-scope list in PROJECT.md is explicit and comprehensive -- reference it when tempted.

**Detection:** Any PR that modifies files in `custard-calendar/worker/src/` is a scope creep signal. The CI pipeline only runs Worker tests in the `worker/` directory, so a presentation-layer PR should never trigger Worker test failures.

**Phase:** All phases. This is a discipline pitfall, not a phase-specific one. Most likely to surface during Phase 1 (T1.3 Compare Page) when building the grid data formatter.

---

## Minor Pitfalls

### Pitfall 8: Inconsistent Nav Across Partially-Deployed Phases

**What goes wrong:** The restructuring is phased. Phase 1 creates the Compare page and changes the nav to 4 items. But if T1.3 (Compare page) ships before T1.2 (Today page simplification), the nav points to a Compare page that exists while the Today page still has the old "junk drawer" layout. Users clicking between the polished Compare page and the cluttered Today page get a jarring inconsistency.

**Prevention:**
1. Follow the dependency graph strictly: T1.1 (store indicator) then T1.2 (Today) then T1.3 (Compare) then T1.4 (nav). Deploy them as a batch, not individually.
2. If incremental deployment is necessary, don't update the nav until all Phase 1 pages are ready. Ship the new pages at their URLs but keep the old nav until T1.4.
3. Use feature flags (a CSS class on `<body>` or a localStorage toggle) to preview the new nav without shipping it to all users.

**Phase:** Phase 1 (T1.4 is the gating ticket).

---

### Pitfall 9: Redirect Pages Still Appear in Search Results

**What goes wrong:** Google indexes the old URLs (`radar.html`, `calendar.html`, etc.). After the restructuring, these pages become redirect stubs. Google treats `<meta http-equiv="refresh" content="0">` as a 301 redirect (eventually), but the timeline is "a few days" according to Google's documentation. During that window, users clicking Google results land on redirect pages instead of the actual content.

**Prevention:**
1. Add `<meta name="robots" content="noindex, nofollow">` to every redirect page so Google de-indexes them.
2. Add `<link rel="canonical" href="https://custard.chriskaschner.com/compare.html">` to each redirect page pointing to the new destination.
3. Provide a readable fallback message on the redirect page (not just a blank page with a meta refresh) so users who arrive from search see "This page has moved to Compare" with a clickable link.

**Phase:** Phase 3 (T3.1 Redirects).

---

### Pitfall 10: Multi.html and Flavor-Audit.html Are Unlisted but Potentially Bookmarked

**What goes wrong:** The `docs/` directory contains pages not mentioned in the restructuring plan: `multi.html` (760 bytes, minimal), `flavor-audit.html` (53KB), and `masterlock-audit.html` (15KB). These pages may be bookmarked by the developer or shared in links. The restructuring plan accounts for the 11 main pages but doesn't address these edge-case pages. If the nav is updated everywhere *except* these files, they'll have a stale nav that confuses anyone who visits them.

**Prevention:**
1. Audit all `.html` files in `docs/` before T1.4 (Nav Consolidation). The full list: `index.html`, `calendar.html`, `map.html`, `alerts.html`, `radar.html`, `forecast-map.html`, `quiz.html`, `group.html`, `siri.html`, `widget.html`, `scoop.html`, `privacy.html`, `multi.html`, `flavor-audit.html`, `masterlock-audit.html`.
2. Decide for each: (a) update nav, (b) add redirect, (c) mark as developer-only (no nav, just a back link). The audit pages are likely developer-only.
3. Update the `STATIC_ASSETS` list in `sw.js` to match reality.

**Phase:** Phase 1 (T1.4 Nav Consolidation). Capture the full page inventory during planning, not during implementation.

---

### Pitfall 11: CSS Class Name Collisions Between Old and New Layouts

**What goes wrong:** The single `style.css` file (53KB) serves all pages. The restructuring adds new page layouts (Compare grid, Get Updates cards, simplified Today page) that need new CSS. If new class names collide with existing ones (e.g., `.card`, `.grid`, `.row`), the new styles inadvertently affect old pages that haven't been restructured yet. Since old pages coexist with new pages during the phased rollout, both old and new CSS must work simultaneously.

**Prevention:**
1. Namespace new CSS classes with a page prefix: `.compare-grid`, `.compare-cell`, `.today-hero`, `.updates-card` rather than generic `.grid`, `.cell`, `.hero`, `.card`.
2. Do not remove old CSS classes during Phases 1-2. Old pages still reference them. Remove them in Phase 3 cleanup.
3. Consider whether `style.css` needs to be split into a shared base plus page-specific stylesheets. At 53KB it's manageable but growing. A `compare.css` loaded only on `compare.html` would prevent any cross-page leakage.

**Phase:** Phase 1 (starts with T1.2/T1.3 when new page-specific styles are first written).

---

## Phase-Specific Warnings

| Phase / Ticket | Likely Pitfall | Mitigation |
|---|---|---|
| T1.1 Store Indicator | planner-shared.js modification breaks existing pages (Pitfall 4) | Add tests for affected functions before modifying |
| T1.2 Today Page | Progressive disclosure hides too much (Pitfall 6) | localStorage persistence for `<details>` state |
| T1.3 Compare Page | Grid unreadable at 375px (Pitfall 3); scope creep into API changes (Pitfall 7) | Prototype mobile layout first; transform API data client-side |
| T1.4 Nav Consolidation | Service worker serves stale pages (Pitfall 1); returning users confused (Pitfall 5) | Bump CACHE_VERSION; add "was X" subtitles to new nav labels |
| T2.1 Get Updates | Redirect pages created without query param forwarding (Pitfall 2) | Use JS redirect pattern, not meta refresh alone |
| T3.1 Redirects | Query params dropped (Pitfall 2); redirect pages in search results (Pitfall 9) | JS redirect with param forwarding; add noindex meta tags |
| All Phases | Scope creep into Worker changes (Pitfall 7) | One-line rule: "worker/src/ changes = separate ticket" |
| All Phases | Inconsistent deployment of partially-completed phases (Pitfall 8) | Batch Phase 1 deploys; don't ship new nav until all Phase 1 pages ready |

## Sources

- [Redirect a GitHub Pages site with this HTTP hack](https://opensource.com/article/19/7/permanently-redirect-github-pages) -- meta refresh limitations
- [Redirecting static pages (TheOrangeOne)](https://theorangeone.net/posts/redirecting-static-pages/) -- static site redirect patterns
- [GitHub Pages does not support routing for SPAs](https://github.com/orgs/community/discussions/64096) -- GitHub Pages routing constraints
- [Stuck in Cache Hell: A Service Worker Nightmare](https://medium.com/@ankit-kaushal/stuck-in-cache-hell-a-service-worker-nightmare-c878ae33abf4) -- service worker stale cache pitfalls
- [Stuff I wish I'd known sooner about service workers (Rich Harris)](https://gist.github.com/Rich-Harris/fd6c3c73e6e707e312d7c5d7d0f3b2f9) -- service worker gotchas
- [Removing buggy service workers (Chrome/Workbox)](https://developer.chrome.com/docs/workbox/remove-buggy-service-workers) -- service worker recovery
- [Progressive Disclosure (NNGroup)](https://www.nngroup.com/articles/progressive-disclosure/) -- progressive disclosure best practices
- [Progressive Disclosure in UX Design (LogRocket)](https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases/) -- common progressive disclosure mistakes
- [Homepage & Navigation UX Best Practices 2025 (Baymard)](https://baymard.com/blog/ecommerce-navigation-best-practice) -- nav consolidation research
- [How Users Navigate a Website: UX Guide 2026](https://www.parallelhq.com/blog/how-users-move-through-information-or-navigate-pages-of-website) -- user navigation patterns
- [CSS Responsive Tables: Complete Guide 2025](https://dev.to/satyam_gupta_0d1ff2152dcc/css-responsive-tables-complete-guide-with-code-examples-for-2025-225p) -- mobile grid layout strategies
- [Responsive Web Design Challenges 2026](https://medium.com/@akashnagpal112/responsive-web-design-challenges-you-cant-ignore-in-2026-552d8e9d7b73) -- 375px layout challenges
- [How to Avoid Scope Creep in Website Redesign Projects](https://www.f22labs.com/blogs/how-to-avoid-scope-creep-in-website-redesign-projects/) -- scope creep in redesign projects
- [What is Scope Creep (Asana)](https://asana.com/resources/what-is-scope-creep) -- scope creep statistics (52% of projects, 27% cost overrun)
- [Persisting state across views in a multi-page app with vanilla JS](https://gomakethings.com/persisting-state-across-views-in-a-multi-page-app-with-vanilla-js/) -- localStorage state patterns
- Custard Calendar codebase: `docs/sw.js`, `docs/planner-shared.js`, `docs/scoop.html`, `.planning/codebase/CONCERNS.md`

---

*Pitfalls audit: 2026-03-07*
