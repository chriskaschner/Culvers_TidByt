---
status: diagnosed
trigger: "First-time visitor sees Albertville AL default instead of geolocated WI store; no 'Showing flavors' prompt; legacy store indicator format"
created: 2026-03-07T17:50:00Z
updated: 2026-03-07T17:55:00Z
---

## Current Focus

hypothesis: CONFIRMED -- Race condition between todays-drive.js default store selection and SharedNav DOMContentLoaded initialization
test: Traced code execution order through script loading, async await, DOMContentLoaded timing
expecting: n/a -- root cause confirmed
next_action: Return diagnosis

## Symptoms

expected: Clear localStorage, reload page. See compact prompt with nearest WI store based on IP geolocation. "Showing flavors for [Store] -- change?" prompt in new SharedNav blue bar.
actual: User sees "Albertville, AL" (first alphabetical store, not geolocated). "Showing flavors" prompt not visible. Store indicator shows "Albertville, AL, Albertville, AL change" in legacy format.
errors: "Something went wrong loading the flavor data" (separate CORS issue from UAT test 4)
reproduction: Clear localStorage, reload index.html on localhost:4173
started: Discovered during UAT

## Eliminated

- hypothesis: CORS blocks geolocate endpoint from localhost
  evidence: Worker has localhost exception at line 274 of worker/src/index.js -- regex /^https?:\/\/localhost(:\d+)?$/ matches localhost:4173 and returns correct ACAO header. Confirmed with curl.
  timestamp: 2026-03-07T17:51:00Z

- hypothesis: CustardPlanner.haversineMiles not available to findNearestStore
  evidence: haversineMiles is exported in planner-shared.js public API (line 1411). planner-shared.js loads before shared-nav.js (lines 211-212 of index.html). By the time findNearestStore runs (async, after fetch resolves), CustardPlanner is definitely available.
  timestamp: 2026-03-07T17:51:30Z

- hypothesis: SharedNav first-visit prompt code is broken
  evidence: buildFirstVisitPromptHTML and showFirstVisitPrompt are correctly implemented in shared-nav.js (lines 235-279). They produce correct "Showing flavors for..." text. The code is never reached because SharedNav takes the saved-slug path.
  timestamp: 2026-03-07T17:52:00Z

## Evidence

- timestamp: 2026-03-07T17:49:00Z
  checked: Worker geolocate endpoint from this machine's IP
  found: Returns {"lat":42.96083,"lon":-89.46984,"state":"WI","stateName":"Wisconsin","city":"Fitchburg","country":"US"} -- correct WI location
  implication: Geolocation endpoint works correctly; problem is not with the data source

- timestamp: 2026-03-07T17:49:30Z
  checked: CORS headers from Worker when Origin is http://localhost:4173
  found: access-control-allow-origin: http://localhost:4173 -- Worker allows localhost (line 274-276 in worker/src/index.js)
  implication: CORS is not blocking geolocate from localhost:4173 when using "localhost" (not 127.0.0.1)

- timestamp: 2026-03-07T17:50:00Z
  checked: stores.json format and first entries
  found: Array of 1012 stores sorted alphabetically. First store is albertville-al-mathis-mill (Albertville, AL). Store name field is "Albertville, AL" (city+state already in name).
  implication: Any code that defaults to stores[0] will select Albertville, AL

- timestamp: 2026-03-07T17:50:30Z
  checked: todays-drive.js default store selection (lines 232-237)
  found: When drive preferences are empty (localStorage cleared), activeRoute.stores falls back to culversStores.slice(0, 2) -- the first two alphabetical stores (Albertville AL, Auburn AL)
  implication: CustardDrive.mount always defaults to Albertville when no saved prefs exist

- timestamp: 2026-03-07T17:51:00Z
  checked: todays-drive.js init flow (lines 1059-1077)
  found: init() synchronously calls onPrimaryStoreChange(stores[0]) at line 1073-1074. This triggers index.html selectStore() which saves to localStorage at line 528.
  implication: As soon as CustardDrive.mount completes, Albertville slug is in localStorage

- timestamp: 2026-03-07T17:51:30Z
  checked: Script loading order in index.html
  found: planner-shared.js (211), shared-nav.js (212), cone-renderer.js (215), todays-drive.js (216), inline script (217). SharedNav registers DOMContentLoaded listener during script eval. Inline script calls async init() which awaits loadStores().
  implication: Script loading order is correct but async timing creates a race

- timestamp: 2026-03-07T17:52:00Z
  checked: Race condition between init() await and DOMContentLoaded
  found: init() awaits loadStores() which fetches stores.json. If stores.json is in service worker cache (sw.js caches it at line 3), the fetch resolves almost instantly as a microtask. Microtasks drain BEFORE DOMContentLoaded (a macrotask) fires. This means CustardDrive.mount() can complete and save Albertville to localStorage BEFORE SharedNav's DOMContentLoaded handler runs.
  implication: When stores.json is cached, todays-drive wins the race and pollutes localStorage before SharedNav checks it

- timestamp: 2026-03-07T17:52:30Z
  checked: SharedNav renderNav() slug check (line 509-541)
  found: renderNav checks getPrimaryStoreSlug() from localStorage. If slug exists, it shows store indicator (not first-visit geolocation). If stores.json cache causes todays-drive to save Albertville before DOMContentLoaded, SharedNav finds it and shows indicator.
  implication: SharedNav correctly reads localStorage but gets the wrong value planted by todays-drive race condition

- timestamp: 2026-03-07T17:53:00Z
  checked: SharedNav buildStoreIndicatorHTML for Albertville store data
  found: Store data has name="Albertville, AL", city="Albertville", state="AL". buildStoreIndicatorHTML produces: "Albertville, AL" + ", Albertville, AL" + " change" = "Albertville, AL, Albertville, AL change"
  implication: Explains exact user-reported text; the duplicate city/state is because store.name already contains city+state and the code appends them again

- timestamp: 2026-03-07T17:53:30Z
  checked: Service worker caching of stores.json
  found: sw.js has stores.json (implicitly via './' caching of static assets) and uses stale-while-revalidate strategy. On repeat visits, stores.json comes from cache nearly instantly.
  implication: After first visit, stores.json is always cached, making the race condition reliably reproducible

## Resolution

root_cause: |
  Race condition between todays-drive.js and SharedNav initialization.

  **Mechanism:** When the user clears localStorage and reloads:

  1. Inline script calls async `init()` which awaits `loadStores()` (fetches stores.json)
  2. If stores.json is in service worker cache, the fetch resolves as a microtask
  3. Microtasks drain before DOMContentLoaded fires
  4. `CustardDrive.mount()` runs, finds empty drive preferences, defaults to `culversStores.slice(0, 2)` -- Albertville AL (first alphabetical)
  5. Calls `onPrimaryStoreChange('albertville-al-mathis-mill')` -> `selectStore()` -> `localStorage.setItem('custard-primary', 'albertville-al-mathis-mill')`
  6. DOMContentLoaded fires. SharedNav's `renderNav()` reads localStorage -> finds Albertville slug -> takes the saved-store path instead of first-visit geolocation path
  7. SharedNav shows store indicator for Albertville, not the "Showing flavors for..." prompt

  **Three sub-issues:**

  A. **Race condition (primary):** todays-drive.js defaults to Albertville and saves to localStorage before SharedNav initializes. SharedNav's DOMContentLoaded handler finds the stale default and skips geolocation entirely.

  B. **Duplicate city/state in indicator:** Store manifest has `name: "Albertville, AL"` (already includes city+state). `buildStoreIndicatorHTML()` appends `city + ", " + state` again, producing "Albertville, AL, Albertville, AL".

  C. **No "Showing flavors" prompt:** Direct consequence of (A). SharedNav takes the saved-slug path, which shows a store indicator, not the first-visit prompt with "Showing flavors for..." text.

fix: ""
verification: ""
files_changed: []
