# Pitfalls Research

**Domain:** Static site feature additions (vanilla JS, GitHub Pages, service workers)
**Project:** Custard Calendar v1.2 Feature Completion & Cleanup
**Researched:** 2026-03-09
**Confidence:** HIGH (all pitfalls verified against actual codebase files and official documentation)

## Critical Pitfalls

Mistakes that cause broken production, data loss, or cascading regressions across the existing 15-page site.

### Pitfall 1: meta http-equiv Redirects Silently Drop Query Parameters

**What goes wrong:**
The old pages (scoop.html, radar.html, calendar.html, widget.html, siri.html, alerts.html) need to redirect to new destinations while preserving query parameters like `?store=mt-horeb` or `?primary=madison-todd-drive&secondary=appleton,beloit`. Using `<meta http-equiv="refresh" content="0; url=updates.html">` drops everything after the `?` because the meta tag takes a static URL string. Users who bookmarked `calendar.html?primary=mt-horeb` land on `updates.html` with no store pre-selected, breaking their workflow.

Currently these old pages are full-content pages (e.g., scoop.html at 79 lines loads planner-shared.js, shared-nav.js, todays-drive.js and renders a complete page; calendar.html at 678 lines has full calendar subscription UI; alerts.html at 530 lines has full alert signup flow). The redirect requirement means replacing these with thin redirect stubs, but the common mistake is using meta refresh which cannot forward query strings.

**Why it happens:**
GitHub Pages has zero server-side redirect capability -- no .htaccess, no _redirects file, no rewrite rules. The obvious "just use meta refresh" approach works for path-only redirects but silently drops query strings. Developers test the redirect without parameters, see it work, and ship it. The bug only surfaces when real users with bookmarked URLs arrive.

**How to avoid:**
Use JavaScript-based redirects that explicitly read `window.location.search` and append it to the target URL. The redirect page should be minimal HTML that immediately performs `window.location.replace(targetUrl + window.location.search + window.location.hash)`. Include a `<noscript>` fallback with a manual link. Do NOT use meta refresh even as a fallback because it can fire before the JS redirect on some browsers and win the race without query params. Do NOT load planner-shared.js or shared-nav.js on redirect pages -- they are unnecessary weight and expand the attack surface.

**Warning signs:**
- Redirect pages that contain `<meta http-equiv="refresh"` without a companion JS redirect
- Tests that verify redirects only with bare URLs (no query parameters in test assertions)
- Redirect target URLs constructed as string literals instead of using `window.location.search`
- Redirect pages still loading the full JS stack (planner-shared.js, shared-nav.js, etc.)

**Phase to address:**
Early -- redirect pages are standalone HTML files with no dependency on other v1.2 features. They unblock bookmark compatibility immediately.

---

### Pitfall 2: Service Worker Serves Stale planner-shared.js After Refactor

**What goes wrong:**
The service worker (sw.js) uses stale-while-revalidate for all static assets including planner-shared.js. After the monolith refactor changes planner-shared.js's internal structure or export surface, users with an active service worker receive the OLD cached planner-shared.js on their next visit. If the refactored page scripts now depend on new exports or reorganized code that the old cached version does not provide, the site breaks with `TypeError: CustardPlanner.newFunction is not a function` or silently produces wrong behavior.

The current sw.js (line 1) uses `CACHE_VERSION = 'custard-v15'` and pre-caches a hardcoded list of 28 assets. The stale-while-revalidate strategy means the old cached planner-shared.js is served first while the new version fetches in the background -- the user sees the broken version and must refresh again to get the fix.

Additionally, the SW is currently only registered on 4 surfaces (today-page.js line 648, compare-page.js line 926, calendar.html line 674, widget.html line 966). The v1.2 requirement to register on fun.html and updates.html means those pages will START caching assets for the first time, creating a coordination point: the first SW install on those pages will cache whatever version is currently deployed.

**Why it happens:**
stale-while-revalidate is designed to show cached content immediately and update in the background. This is excellent for performance but dangerous for coordinated multi-file deployments. The SW serves file A from cache (old version) while file B loads from network (new version). If B depends on changes in A, the page breaks on the first load after deployment.

**How to avoid:**
1. Bump `CACHE_VERSION` (to 'custard-v16' or higher) in the same commit that lands the refactored files. This forces the activate handler to delete the old cache entirely and re-fetch all assets.
2. Add stores.json to the `STATIC_ASSETS` array in sw.js (already a v1.2 requirement).
3. If the refactor creates new JS files, add them to `STATIC_ASSETS` in the same commit.
4. Test the deployment sequence: deploy, open in a browser that has the old SW, verify the new SW installs and the page works correctly after one refresh.
5. For fun.html and updates.html SW registration, deploy the registration code in the same commit as the CACHE_VERSION bump so those pages cache the current (post-refactor) assets on first install.

**Warning signs:**
- CACHE_VERSION not bumped in a commit that changes pre-cached files
- New JS files referenced in HTML `<script>` tags but not in the SW STATIC_ASSETS array
- Tests pass in CI (no SW) but fail in production (active SW serves old cache)
- Users reporting "it worked after I cleared my cache"
- fun.html or updates.html caching an old version of planner-shared.js as their first SW install

**Phase to address:**
The planner-shared.js refactor and the SW changes (register on fun.html/updates.html, add stores.json to pre-cache) MUST ship in the same CACHE_VERSION bump. Do the refactor first, update sw.js asset list and bump CACHE_VERSION in the same PR, then deploy.

---

### Pitfall 3: planner-shared.js Refactor Breaks Cross-File Implicit Dependencies

**What goes wrong:**
planner-shared.js is 1,639 lines exposing ~40+ symbols on `window.CustardPlanner`. Six other JS files (shared-nav.js, compare-page.js, today-page.js, todays-drive.js, cone-renderer.js, fun-page.js) plus at least 6 HTML pages with inline scripts all reference `CustardPlanner.*` methods directly. The refactor reorganizes the monolith, but if any exported symbol's name, behavior, or initialization timing changes, consuming code breaks silently -- no build step catches the error, no TypeScript flags the missing export.

Specific high-risk implicit dependencies found in the codebase:
- `compare-page.js` lines 22-23: destructures `WORKER_BASE` and `escapeHtml` from CustardPlanner at module load time
- `shared-nav.js` line 59: conditionally calls `CustardPlanner.escapeHtml` with an inline fallback
- `calendar.html` line 127: uses `CustardPlanner.WORKER_BASE` in inline script
- `alerts.html` lines 246-248: destructures WORKER_BASE, getPrimaryStoreSlug, setPrimaryStoreSlug from CustardPlanner
- `todays-drive.js`: references getDrivePreferences, saveDrivePreferences, flushDrivePreferences, parseDriveUrlState, pickDefaultDriveStores, and more
- `cone-renderer.js`: uses a global `WORKER_BASE` variable that's NOT from CustardPlanner but set independently

**Why it happens:**
Without a module bundler or TypeScript, there is no static analysis to detect broken references. The IIFE pattern means all internal helpers were available by closure within planner-shared.js, but consuming files accessed them only through the return object (lines 1409-1470). The danger is that the refactor changes the return object's shape, renames an internal function that was indirectly depended on, or changes initialization order.

**How to avoid:**
1. The return object at lines 1409-1470 of planner-shared.js is the public API contract. Document every symbol in that return block BEFORE starting the refactor. Every symbol must continue to exist on `window.CustardPlanner` after the refactor, with the same behavior.
2. Grep every HTML and JS file in docs/ for `CustardPlanner\.` to build a complete dependency map before splitting anything.
3. Keep the IIFE pattern and single-file output. The refactor should reorganize the interior of the file (section ordering, extracting internal helper functions, reducing nesting) but NOT change the loading model. Adding new `<script>` tags to 15 HTML pages is a larger risk surface than reorganizing one file.
4. Run the full Playwright test suite (31 spec files) after every refactor step. The browser tests exercise the real page loading order and will catch missing symbols.
5. If splitting into multiple files is unavoidable, create a planner-shared.js that loads the parts and re-exports the same `window.CustardPlanner` object. This preserves the existing `<script src="planner-shared.js">` contract across all HTML pages.

**Warning signs:**
- The return object's property list changes (properties removed or renamed)
- New `<script>` tags added to HTML files (increases the coordination surface)
- Tests pass when run against a local dev server but fail on the actual deployed site (script loading order differences)
- "Works in Chrome but not Safari" reports (Safari is stricter about script execution order)

**Phase to address:**
The monolith refactor should be its own focused phase with a dedicated test-and-verify cycle. Do NOT bundle it with other feature work. Ship the refactor, verify all 32+ Playwright tests pass, then proceed to features that depend on the refactored code.

---

### Pitfall 4: Compare Page Multi-Store State Conflicts With Existing Preference System

**What goes wrong:**
The compare page currently manages store state through `custard:v1:preferences` in localStorage (compare-page.js line 131), writing to `parsed.activeRoute.stores`. The Today page and Today's Drive use the same preference object through `CustardPlanner.getDrivePreferences()` and `CustardPlanner.saveDrivePreferences()`. Adding multi-store side-by-side comparison means the compare page needs to manage 2-4 store selections simultaneously, but this writes to the same localStorage key that Today's Drive reads.

The existing code at compare-page.js lines 149-167 already has this coupling -- `saveStoreSlugs()` writes directly to `custard:v1:preferences.activeRoute.stores` and even calls `CustardPlanner.saveDrivePreferences()`. If the compare page saves 4 stores to `activeRoute.stores`, Today's Drive picks up all 4 and treats them as "drive route" stores, showing drive rankings for stores the user only wanted to compare side-by-side. This becomes more pronounced when expanding from the current store-switching behavior to true side-by-side comparison.

**Why it happens:**
The preference system was designed when "stores" meant the same thing on every page -- the user's saved stores for their daily drive route. The multi-store compare feature redefines "stores" to mean "stores I want to see side-by-side" which is a different intent. Using the same storage key for different intents causes silent data corruption across pages.

**How to avoid:**
1. Create a separate localStorage key for compare-specific store selections (e.g., `custard:v1:compare-stores`) that does NOT write to the drive preferences.
2. On compare page load, seed from the drive preferences as a default (current behavior at lines 140-144) but save compare state independently going forward.
3. Use the existing CustomEvent bridge (`sharednav:storechange`) to communicate primary store changes to other components, but do NOT propagate compare-only store additions through the drive preferences.
4. Add a Playwright test that explicitly verifies: select 4 stores on compare page, navigate to Today page, verify Today's Drive only shows the expected number of stores (not all 4 from compare).

**Warning signs:**
- The compare page's `saveStoreSlugs()` still calls `CustardPlanner.saveDrivePreferences()`
- Today's Drive suddenly shows more stores than the user selected on the Today page
- Existing Playwright tests for `drive-preferences.spec.mjs` start failing after compare changes
- Users report "my stores keep changing" across page navigations

**Phase to address:**
Address the state separation BEFORE building the multi-store comparison UI. The data model change should be a small, testable PR that updates how compare reads/writes stores, with a Playwright test verifying cross-page isolation.

---

### Pitfall 5: Hero Cone PNG Pipeline Produces Inconsistent Output at 176 Flavors

**What goes wrong:**
The current pipeline produces 40 PNGs in `docs/assets/cones/` (verified). Scaling to ~176 flavors (40 existing + ~136 new) means authoring 136 new cone profiles in `worker/src/flavor-colors.js`, then rendering each through the SVG-to-PNG pipeline. At this scale, subtle inconsistencies compound: color drift between rendering batches (if the rendering environment changes between runs), missing topping contrast checks (dove #2B1A12 on dark_chocolate #3B1F0B is nearly invisible per CONE_PROFILE_SPEC.md), inconsistent density choices, and PNG file sizes that vary wildly.

The existing 40 PNGs have been hand-verified via flavor-audit.html. At 136 new flavors, manual verification becomes impractical and batch quality issues will slip through. Additionally, per CONE_PROFILE_SPEC.md, four files must stay in sync for every color addition: `worker/src/flavor-colors.js`, `docs/cone-renderer.js`, `tidbyt/culvers_fotd.star`, and `docs/flavor-audit.html`. At 136 new profiles, the likelihood of these files drifting apart increases significantly.

**Why it happens:**
SVG-to-PNG rendering is not deterministic across environments -- different rendering engines (Chromium Skia vs. Firefox Cairo vs. Node canvas) produce slightly different anti-aliasing and color output. Cone profiles are authored by hand using CONE_PROFILE_SPEC.md, but at 136 profiles the likelihood of authoring errors (wrong base color, invisible toppings, density mismatch) increases linearly. There is no automated quality gate beyond what flavor-audit.html shows visually.

**How to avoid:**
1. Render ALL 176 PNGs in a single batch run using the same tool version and environment. Never mix PNGs from different rendering runs -- git will show diffs on existing PNGs if the environment changed.
2. Build an automated quality check script that validates each profile against CONE_PROFILE_SPEC.md rules: contrast ratio between toppings and base color, density slot count matches topping array length, ribbon-T4 conflict acknowledged.
3. Set a file size budget per PNG based on the existing 40 PNGs' median and max. Flag any new PNG exceeding 2x the median.
4. Batch-author profiles in groups of 10-15, review via flavor-audit.html, then proceed. Do NOT author all 136 at once.
5. The SW runtime-caches cone PNGs via stale-while-revalidate (sw.js lines 64-78). At 176 PNGs, the runtime cache could grow to several MB. The current approach (runtime cache, not pre-cache) is correct -- do not add cone PNGs to the pre-cache list.

**Warning signs:**
- PNG files with wildly different sizes for similar profiles (e.g., 2KB vs 50KB)
- flavor-audit.html shows "unknown topping color" or "sparse toppings" flags on new profiles
- Git diff shows binary PNG changes to EXISTING flavors (rendering environment changed)
- The four sync files (flavor-colors.js, cone-renderer.js, culvers_fotd.star, flavor-audit.html) have different color palette entries

**Phase to address:**
The cone PNG pipeline should be a dedicated batch phase after the planner-shared.js refactor. Profile authoring should happen in batches of 10-15 with flavor-audit.html review checkpoints, not as one massive commit of 136 profiles.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keeping all 6 old pages as full HTML instead of converting to thin JS redirect stubs | Old pages still "work" with full content | Maintaining 6 duplicate pages with shared-nav, analytics, full JS stack | Never -- they should be minimal redirect stubs to reduce maintenance surface |
| Skipping CACHE_VERSION bump for "small" changes | Faster deploy cycle | Users stuck on stale cached assets until browser's ~24h SW update check | Never -- every change to pre-cached files must bump the version |
| Using the same localStorage key for compare and drive store lists | No migration needed, fewer code changes | Silent cross-page state leaks that produce confusing UX bugs | Never -- the intents are different enough to warrant separate keys |
| Inlining compare multi-store CSS in compare.html instead of style.css | Faster iteration on compare feature | CSS diverges from the 37-token design system; inconsistencies across pages | Only during prototyping; must migrate to style.css before shipping |
| Authoring cone profiles without automated contrast validation | Ship faster, skip quality tooling | Invisible toppings at small sizes, inconsistent visual quality | Only for first 10-15 profiles to validate pipeline; must add validation before scaling to 136 |
| Adding `<script>` tags to HTML pages for split planner modules | Clean module separation | Every HTML page (15+) needs updating; script loading order becomes a coordination problem | Never for the refactor -- keep the single-file IIFE pattern |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Service worker + new/changed JS files | Adding new `<script>` references or changing planner-shared.js without updating STATIC_ASSETS in sw.js | Always update sw.js STATIC_ASSETS and bump CACHE_VERSION in the same commit |
| Service worker + redirect pages | SW caches old redirect pages with full content; the JS redirect never fires because the cached full-page version loads | Exclude redirect pages from SW cache entirely, OR ensure the cached version contains only the redirect logic (thin stub) |
| localStorage + CustomEvent bridge | Writing to localStorage without dispatching `sharednav:storechange` | Always dispatch the event after writing so other components react; use CustardPlanner.saveDrivePreferences() which handles both |
| GitHub Pages + CNAME + redirect URLs | Redirect target URLs using absolute paths that break if accessed via the github.io domain instead of the CNAME | Use relative URLs in redirects (e.g., `./updates.html` not `https://custard.chriskaschner.com/updates.html`) |
| Playwright tests + service worker | Tests run against local dev server without SW; production has active SW that changes behavior | Run at least one Playwright test scenario with SW active to catch cache-related regressions |
| cone-renderer.js + flavor-colors.js | Worker-side flavor-colors.js adds new colors but docs/cone-renderer.js FALLBACK_* constants are not updated | Per CONE_PROFILE_SPEC.md, four files must stay in sync: flavor-colors.js, cone-renderer.js, culvers_fotd.star, flavor-audit.html |
| Map exclusion filter + localStorage | Filter state lost on page reload; user must re-apply exclusions every session | Persist exclusion state to localStorage using the same pattern as compare-page.js lines 59-77 |
| CI repo structure check + .planning/ directory | .planning/ not listed in REPO_CONTRACT.md allowed directories; CI check fails and blocks all PRs | Update REPO_CONTRACT.md or the check script to allow .planning/ BEFORE any other work lands |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| SW runtime cache grows with 176 cone PNGs | Mobile users accumulate large cache; potential storage pressure | Current approach is correct (runtime cache, not pre-cache); monitor total cache size after deploying all 176 | At 176 PNGs at ~5-50KB each: 1-9MB total, within mobile limits but worth monitoring |
| Compare page fetches flavor data for 4 stores simultaneously | 4 parallel API calls on page load; slow on mobile networks; potential rate limiting | Stagger fetches or load the primary store first, then fetch comparison stores; show progressive loading UI | At 4 stores with 7-day data each; manageable but test on throttled 3G |
| stores.json in SW pre-cache becomes stale between deployments | stores.json cached at SW install time; new stores added after deploy are invisible | Use the existing date-based cache-bust pattern (`?v=` + ISO date) that several pages already use (compare-page.js line 174, alerts.html line 280) | When new stores are added between SW version bumps |
| 136 new cone PNGs added to git history | Repository size increases; clone times grow | At ~136 PNGs averaging 10KB each = ~1.4MB; manageable but sets precedent for future additions | Not a practical concern at this scale, but consider git LFS if pattern continues |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Redirect pages inject query params into HTML without escaping | XSS via crafted URLs like `?store=<script>alert(1)</script>` | Use `encodeURIComponent()` when appending query params; never inject query values into innerHTML |
| Old redirect pages still load the full JS stack | Unnecessary attack surface on 6 pages that should be minimal | Redirect pages should contain ONLY the redirect script -- no planner-shared.js, no shared-nav.js, no analytics |
| CSP headers inconsistent between redirect stubs and main pages | Security policy gaps on redirect pages | Either use the same CSP meta tag across all pages, or omit it from redirect stubs (they execute no meaningful user content) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Redirect flashes old page content before navigating | User sees "The Scoop" header or full calendar UI then jumps to a different page -- feels broken | Redirect pages should have a blank/minimal body ("Redirecting..."), not the old page content |
| Compare multi-store picker silently changes Today's Drive stores | User picks stores for comparison, later finds their daily drive route has extra stores they did not add | Separate localStorage keys; compare selections must not affect drive preferences |
| SW serves stale page after deployment with no user signal | User sees old version of a page; wonders if update shipped | Include a visible "New version available" toast when SW detects an update during stale-while-revalidate background fetch |
| Map flavor family exclusion filter not persisted | User sets "no mint" filter, leaves page, returns to find filter reset | Use localStorage for filter state (same pattern as compare-page.js exclusion persistence) |
| Quiz image answers not loading on slow mobile connections | User sees broken image placeholders instead of flavor choices | Use the existing SVG fallback (cone-renderer.js renderMiniConeSVG) as default; load PNG as progressive enhancement |
| Mad Libs chips have class names but no CSS definitions | Chips render as unstyled text; looks broken rather than intentionally plain | Define the CSS classes in style.css using design tokens BEFORE shipping the feature to production |

## "Looks Done But Isn't" Checklist

- [ ] **Redirect pages:** Often missing query parameter forwarding -- verify with `calendar.html?primary=mt-horeb` and confirm destination URL contains the query params
- [ ] **Redirect pages:** Often missing hash fragment forwarding -- verify `widget.html#section` forwards the hash
- [ ] **SW registration on fun.html/updates.html:** Often missing the CACHE_VERSION bump -- verify the SW version matches the latest deployment
- [ ] **SW stores.json pre-cache:** Often added to STATIC_ASSETS with wrong relative path -- verify the path matches what the browser actually requests (e.g., `./stores.json` vs `stores.json`)
- [ ] **planner-shared.js refactor:** Often passes unit tests but breaks script loading order -- verify by opening EVERY HTML page in a browser and checking console for errors
- [ ] **planner-shared.js refactor:** Often changes internal function names without updating the return object -- verify the return object (line 1409) still exports every symbol the consuming files depend on
- [ ] **Compare multi-store:** Often works for 2 stores but breaks at the MAX_COMPARE_STORES boundary (line 29: currently 4) -- verify with exactly 4 stores selected
- [ ] **Compare multi-store:** Often the state isolation works on Compare but the drive preferences spec in `drive-preferences.spec.mjs` regresses -- run that specific test
- [ ] **Cone PNGs:** Often render correctly in the pipeline tool but show wrong colors in the browser -- verify via flavor-audit.html with both API-served and fallback color palettes
- [ ] **Cone PNGs:** Often the 4 sync files drift apart -- diff the color key lists across flavor-colors.js, cone-renderer.js, culvers_fotd.star, and flavor-audit.html
- [ ] **Mad Libs chip CSS:** Often the CSS class is defined but never applied to the correct element -- verify the HTML class attribute values match the CSS selectors exactly
- [ ] **CI repo structure check:** Often fails because new directories are not in REPO_CONTRACT.md -- verify the allowlist in `scripts/check_repo_structure.py` matches the actual repo
- [ ] **Push unpushed commits:** Often succeeds locally but CI fails on the pushed branch -- verify ALL CI gates pass before considering the task done

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| SW serves stale/broken assets | LOW | Bump CACHE_VERSION, deploy, wait for browser's ~24h SW check. Can add emergency "Update available" UI that calls `registration.update()` |
| Redirect drops query params | LOW | Fix the redirect JS, deploy. No permanent data loss -- users just re-follow their bookmarked URLs |
| planner-shared.js refactor breaks a page | MEDIUM | Revert the refactor commit, deploy the pre-refactor version. The monolith is the known-good state. Risk: other features may have been committed on top, requiring careful cherry-pick |
| Compare state leaks to drive preferences | MEDIUM | Deploy fix to separate storage keys. Existing corrupted preferences need a migration function that reads old combined state and splits it. Add migration to the next page init cycle |
| Cone PNG quality issues at scale | HIGH | Must re-author affected profiles, re-render PNGs, and re-deploy. If the rendering environment changed, ALL 176 may need re-rendering for consistency |
| CI repo structure check blocks merges | LOW | Update REPO_CONTRACT.md to add .planning/ to allowed directories. Quick fix, but blocks ALL PRs until resolved -- fix this first |
| Mad Libs chips unstyled in production | LOW | Add the CSS definitions, deploy. No data loss, just visual regression. Low urgency but visible to users |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| CI repo structure check failure | Infrastructure (first task) | CI green after updating REPO_CONTRACT.md |
| Redirect query param dropping | Redirects (early, independent) | Playwright test: navigate to old URL with query params, assert destination URL contains them |
| SW stale content after refactor | SW + Refactor (must be coordinated) | Deploy to production, open in browser with old SW, verify content updates after one refresh |
| planner-shared.js breaking changes | Refactor (isolated, before features) | All 32+ Playwright tests pass; manual check of console errors on every HTML page |
| Compare state conflicts | Compare (data model first, UI second) | Playwright test: set stores on compare, navigate to Today, verify drive stores unchanged |
| Cone PNG quality at scale | Asset pipeline (after refactor, in batches) | flavor-audit.html review per batch; automated contrast/density validation script |
| SW registered on fun/updates | SW phase (with CACHE_VERSION bump) | Playwright test: load fun.html, verify SW registration succeeds |
| stores.json pre-cache | SW phase (with CACHE_VERSION bump) | Offline test: load page with SW, go offline, verify stores.json still loads |
| Map exclusion filter persistence | Map feature phase | Test: set filter, reload page, verify filter state persists |
| Mad Libs chip CSS | CSS phase (small, independent) | Visual regression test or screenshot comparison |
| Push unpushed commits | Deployment (early) | All 3 CI gates pass (Worker tests, Python tests, repo structure check) |

## Sources

- Codebase inspection: `docs/sw.js` (95 lines, CACHE_VERSION v15, 28 pre-cached assets), `docs/planner-shared.js` (1,639 lines, 40+ exported symbols), `docs/compare-page.js` (942 lines, state coupling at lines 131-167), `docs/shared-nav.js` (597 lines), `docs/scoop.html` (79 lines, full page with Today's Drive), `docs/calendar.html` (678 lines, full calendar subscription UI), `docs/alerts.html` (530 lines, full alert signup flow), `docs/cone-renderer.js` (366 lines, fallback color palettes), `CONE_PROFILE_SPEC.md` (4-file sync requirement), `REPO_CONTRACT.md` (CI gates, allowed directories), `.github/workflows/ci.yml` (3 CI jobs), `docs/assets/cones/` (40 existing PNGs, 0 SVGs)
- [Rich Harris: Stuff I wish I'd known sooner about service workers](https://gist.github.com/Rich-Harris/fd6c3c73e6e707e312d7c5d7d0f3b2f9) -- service worker lifecycle, update pitfalls, skipWaiting/claim behavior
- [Infinity Interactive: When "Just Refresh" Doesn't Work](https://iinteractive.com/resources/blog/taming-pwa-cache-behavior) -- stale-while-revalidate causing stale content, Safari vs Chrome caching differences
- [Philip Walton: Cascading Cache Invalidation](https://philipwalton.com/articles/cascading-cache-invalidation/) -- multi-file cache coordination pitfalls
- [GitHub Pages redirect approaches](https://pasdam.github.io/blog/posts/github_pages_redirect/) -- meta refresh limitations on static hosting, no query param forwarding
- [GitHub community discussion #64096](https://github.com/orgs/community/discussions/64096) -- GitHub Pages has no server-side redirect capability
- [Qodo: Refactoring Frontend Code](https://www.qodo.ai/blog/refactoring-frontend-code-turning-spaghetti-javascript-into-modular-maintainable-components/) -- monolith refactoring regression risks, importance of test coverage before refactor
- [Lexo: How to Fix SVG Rendering Issues](https://www.lexo.ch/blog/2025/01/how-to-fix-svg-rendering-issues-why-your-svgs-might-have-0x0-size-and-how-to-solve-it/) -- SVG rendering inconsistencies across engines
- [Go Make Things: Persisting state across views](https://gomakethings.com/persisting-state-across-views-in-a-multi-page-app-with-vanilla-js/) -- localStorage state management patterns for multi-page apps
- [SVG AI: SVG to PNG Conversion Guide](https://www.svgai.org/blog/guides/svg-to-png-guide) -- batch rendering consistency, color space issues

---
*Pitfalls research for: Custard Calendar v1.2 feature additions*
*Researched: 2026-03-09*
