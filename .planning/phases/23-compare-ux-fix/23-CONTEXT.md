# Phase 23: Compare UX Fix - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a coherent first-load experience on the Compare page. Eliminate competing store pickers (SharedNav vs Compare) on first visit. Auto-populate from IP geolocation. Fix the header "change" button to open Compare's multi-store picker. Requirements: COMP-01, COMP-02, COMP-03.

</domain>

<decisions>
## Implementation Decisions

### First-visit onboarding flow
- Show existing loading skeleton immediately with a brief "Finding nearest store..." label while geolocation runs
- No artificial delays, no staged reveals -- swap to grid the instant data arrives
- Store bar (chips with store names + add/remove buttons) appears immediately on resolve -- no extra toast or confirmation banner needed
- SharedNav's first-visit prompt is suppressed on Compare page -- Compare owns onboarding
- Auto-populating on Compare also sets `custard-primary` for cross-page benefit (Today, Map pages get the store too)

### Geolocation failure fallback
- On geo failure or timeout: show existing `#compare-empty` state ("Compare your stores" + "Add stores" button)
- No location-specific error messaging -- keep it neutral and actionable
- 3-second timeout before falling back to empty state (matches success criteria)

### Store seeding strategy
- Seed 1 nearest store on auto-populate (not 2-3) -- gets data on screen fastest
- Store bar shows the 1 store chip plus the existing "Add store" button -- passive invitation to compare more
- Compare picker minimum reduced from 2 to 1 store -- avoids blocking the user and stays consistent with auto-seed behavior

### Header change button
- On Compare page, compare-page.js overrides the header "change" button click handler to open `showCompareStorePicker()` instead of SharedNav's single-store picker
- Picker opens with currently selected stores pre-checked
- Minimal SharedNav changes -- Compare does the override

### Claude's Discretion
- SharedNav/Compare coordination mechanism (page flag, event, or direct check)
- Geo-success-but-API-fail: error state with retry vs empty state
- Header "change" button label on Compare (keep "change" or relabel to "stores")
- Loading skeleton label styling and positioning
- Whether SharedNav geo result is reused or Compare runs its own geo call

</decisions>

<specifics>
## Specific Ideas

- "I want folks to get answers fast" -- no artificial loading theater, honest skeleton only while real work happens
- Store bar is the confirmation -- no need for extra UI elements to tell the user what happened
- Cross-page store seeding: user picks up a store on Compare, it carries to Today and Map pages too

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `#compare-empty` / `#compare-loading` / `#compare-error` / `#compare-grid` state sections already exist in compare.html
- `showState(stateName)` function in compare-page.js toggles visibility between states
- `showCompareStorePicker()` in compare-page.js (lines 515-693) -- full multi-store picker with checkboxes, search, status bar
- `doIPGeolocation()` in shared-nav.js (lines 303-329) -- fetches `/api/v1/geolocate`, finds nearest store via haversine
- `findNearestStore(lat, lon, stores)` in shared-nav.js (lines 126-145) -- haversine distance calculation
- `.hidden { display: none !important; }` class for classList.toggle pattern (Phase 22)
- `renderStoreBar()` in compare-page.js -- store chips with remove/add buttons
- `CustardPlanner.setPrimaryStoreSlug(slug)` in planner-domain.js -- writes to `custard-primary`
- `getSavedStoreSlugs()` / `saveStoreSlugs()` in compare-page.js -- manages `custard:compare:stores`

### Established Patterns
- classList.toggle('hidden') for visibility toggling (Phase 22)
- Token-based styling with CSS custom properties (Phase 20-22)
- `sharednav:storechange` custom event bridges SharedNav and Compare
- IP geolocation is passive (no browser permission prompt)

### Integration Points
- shared-nav.js `renderNav()` -- needs Compare-aware suppression of first-visit prompt
- compare-page.js `init()` / `loadAndRender()` -- needs geo-aware auto-populate path
- Header "change" button binding -- needs Compare-specific override
- `custard-primary` and `custard:compare:stores` localStorage keys -- both written on auto-populate

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 23-compare-ux-fix*
*Context gathered: 2026-03-14*
