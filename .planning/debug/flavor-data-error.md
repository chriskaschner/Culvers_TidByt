---
status: diagnosed
trigger: "Red error box: Something went wrong loading the flavor data -- after changing store via SharedNav picker on index.html"
created: 2026-03-07T18:00:00Z
updated: 2026-03-07T18:05:00Z
---

## Current Focus

hypothesis: selectStore() early-returns at line 516 when allStores.find() cannot match the SharedNav-supplied slug, because CustardDrive.mount() fires onPrimaryStoreChange during init() which calls selectStore and loadForecast for the auto-picked store -- if loadForecast fails, the error state shows. When user later changes store via SharedNav picker, selectStore is called but either the allStores guard bails or loadForecast fails again.
test: confirmed via static analysis; browser reproduction needed for definitive proof
expecting: console.error("Forecast load error:", ...) showing the actual thrown error
next_action: return diagnosis

## Symptoms

expected: On index.html, after changing store via SharedNav picker, flavor data loads for the new store with no errors
actual: Red error box: "Something went wrong loading the flavor data"
errors: "Something went wrong loading the flavor data" visible on page
reproduction: Test 4 in UAT -- on index.html, change store via SharedNav picker
started: Discovered during UAT after Plan 01-02 deployed SharedNav

## Eliminated

- hypothesis: SharedNav dispatches event with wrong slug format
  evidence: SharedNav and index.html both load from same stores.json; slug comes from data-slug attribute which matches stores.json verbatim
  timestamp: 2026-03-07T18:00:00Z

- hypothesis: Worker API returns errors for valid slugs
  evidence: curl tests for multiple slugs (albertville-al-mathis-mill, mt-horeb, fargo-25th) all return HTTP 200 with valid JSON from /api/v1/flavors, /api/v1/today; /api/v1/forecast returns 200 for stores with forecast data and gracefully-handled 404 for stores without
  timestamp: 2026-03-07T18:00:00Z

- hypothesis: CORS blocks cross-origin API calls
  evidence: GitHub Pages CNAME is custard.chriskaschner.com; Worker API also at custard.chriskaschner.com. Same origin via Cloudflare routing. CORS not applicable.
  timestamp: 2026-03-07T18:00:00Z

- hypothesis: DOM elements null causing TypeError in loadForecast or renderTodayCard
  evidence: All 20+ referenced DOM IDs confirmed present in index.html markup
  timestamp: 2026-03-07T18:00:00Z

- hypothesis: Service worker caches stale API responses
  evidence: sw.js bypasses caching for url.pathname.startsWith('/api/')
  timestamp: 2026-03-07T18:00:00Z

- hypothesis: CustardPlanner functions missing or throwing
  evidence: All functions (buildTimeline, confidenceStripClass, actionCTAsHTML, fetchReliability, watchBannerHTML, fetchSignals) confirmed exported with proper null handling
  timestamp: 2026-03-07T18:00:00Z

- hypothesis: CSP blocks fetch to Worker API
  evidence: CSP connect-src 'self' https: allows all HTTPS connections
  timestamp: 2026-03-07T18:00:00Z

- hypothesis: renderMiniConeSVG throws for certain flavor names
  evidence: Function handles null/undefined gracefully, all string-building with no throw paths
  timestamp: 2026-03-07T18:00:00Z

## Evidence

- timestamp: 2026-03-07T18:00:00Z
  checked: Event dispatch in shared-nav.js updateStoreIndicator() (line 220-228)
  found: Dispatches CustomEvent 'sharednav:storechange' with {slug, store} when store && store.slug is truthy
  implication: Event always has a valid slug when dispatched

- timestamp: 2026-03-07T18:00:00Z
  checked: Listener registration in index.html init() (line 1044)
  found: Registered AFTER await Promise.all([loadStores(), loadFlavorColors()]) and AFTER CustardDrive.mount(). SharedNav auto-inits on DOMContentLoaded and may fire sharednav:storechange BEFORE init() completes.
  implication: Initial sharednav:storechange may be lost; subsequent user-triggered events are caught

- timestamp: 2026-03-07T18:00:00Z
  checked: selectStore() guard (index.html line 513-516)
  found: Sets currentSlug FIRST (line 514), then checks allStores.find(). Early return at line 516 does NOT clear errorState, does NOT call loadForecast.
  implication: If allStores lookup fails, error state persists and loadForecast is never called

- timestamp: 2026-03-07T18:00:00Z
  checked: CustardDrive.mount() during init() (index.html line 1031)
  found: makeController() calls init() internally, which fires onPrimaryStoreChange with auto-picked store slug. This calls selectStore -> loadForecast DURING CustardDrive.mount(), before the sharednav listener is registered.
  implication: Initial flavor loading is triggered by Drive, not SharedNav

- timestamp: 2026-03-07T18:00:00Z
  checked: CustardDrive default store selection (todays-drive.js line 235-237)
  found: With no saved prefs, defaults to first 2 stores in culversStores (alphabetically sorted from stores.json). First store is albertville-al-mathis-mill.
  implication: Explains UAT Test 1 report of "Albertville, AL" showing instead of a nearby WI store

- timestamp: 2026-03-07T18:00:00Z
  checked: API responses for default store
  found: /api/v1/flavors?slug=albertville-al-mathis-mill returns 200 with 60 flavors. /api/v1/today?slug=albertville-al-mathis-mill returns 200 with today's flavor.
  implication: API works for the auto-picked store. If loadForecast fails, the error is in rendering, not fetching.

- timestamp: 2026-03-07T18:00:00Z
  checked: loadForecast try/catch scope (index.html line 613-668)
  found: catch block at line 663 catches ALL errors from the try block, including rendering. The try block includes renderTodayCard, renderWeekStrip, fetchReliability, and fetchSignals calls. Any throw in these shows the error message.
  implication: The "Something went wrong" error could come from a rendering failure, not just a fetch failure

- timestamp: 2026-03-07T18:00:00Z
  checked: CustardDrive.mount() error handling in init()
  found: NOT wrapped in try/catch. If mount() throws, lines 1043-1071 never execute: listener never registered, savedSlug check never runs. The only loadForecast call would be from Drive's onPrimaryStoreChange (if it fired before the throw).
  implication: A CustardDrive error could leave the page with no event bridge and a stale error

- timestamp: 2026-03-07T18:05:00Z
  checked: Git diff for commit 7ead475 (the bridge commit)
  found: Added sharednav:storechange listener, hid legacy location-bar, removed geolocateAndSort() auto-call. Only 18 lines added. The listener is correctly structured.
  implication: The bridge code itself is correct; the issue is in the broader init() flow and error state management

## Resolution

root_cause: |
  The sharednav:storechange event bridge between SharedNav and index.html has a
  fragile dependency chain that fails when loadForecast() throws for any reason,
  combined with selectStore()'s early-return guard that prevents error recovery.

  Specific failure chain:

  1. On page load, CustardDrive.mount() auto-picks stores (alphabetical default:
     albertville-al-mathis-mill) and fires onPrimaryStoreChange, which calls
     selectStore() -> loadForecast(). If loadForecast's try block throws (rendering
     error, unexpected API response shape, etc.), the catch block shows the error
     state (errorState.hidden = false).

  2. When user changes store via SharedNav picker, the sharednav:storechange
     listener calls selectStore(newSlug). selectStore sets currentSlug = newSlug
     FIRST (line 514), then checks allStores.find(). The find() should succeed
     since both use the same stores.json. selectStore then calls loadForecast(newSlug).

  3. If loadForecast succeeds for the new store, the error clears. If it fails
     again (same rendering issue, or different problem), the error persists.

  The bug has two vulnerabilities that make it fragile:

  A. selectStore() sets currentSlug before the allStores guard (line 514 vs 516).
     If the guard triggers (!store), currentSlug is already set to the new slug,
     preventing any future retry via the listener's slug !== currentSlug check.
     loadForecast is never called and the error state is never cleared.

  B. The sharednav:storechange listener (line 1044) is registered INSIDE init()
     after CustardDrive.mount(). If mount() throws, the listener is never
     registered, making the SharedNav bridge completely non-functional.

  The most likely IMMEDIATE cause of the error message is a throw inside
  loadForecast's try block during rendering (renderTodayCard or renderWeekStrip),
  which cannot be definitively identified through static analysis alone. Browser
  console output showing the actual error (line 664: console.error('Forecast load
  error:', err)) would confirm the specific throw.

fix: ""
verification: ""
files_changed: []
