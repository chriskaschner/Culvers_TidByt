---
status: awaiting_human_verify
trigger: "Compare page switches stores instead of enabling multi-store comparison. The page should let users select multiple stores and show flavors side-by-side, but instead clicking 'change' just switches the single active store."
created: 2026-03-09T12:00:00Z
updated: 2026-03-09T12:15:00Z
---

## Current Focus

hypothesis: CONFIRMED -- compare page had no multi-store management; relied on SharedNav single-store picker which writes to wrong storage key
test: All 24 browser tests pass (14 existing + 10 new); no regressions
expecting: User confirms fix works in production
next_action: Await human verification on live site

## Symptoms

expected: Compare page lets you select multiple stores and shows their flavors side-by-side for comparison
actual: Clicking "change" on the Compare page switches the current store instead of adding a second store. Page shows empty "Add stores" / "Compare your stores" state with only one store selected.
errors: None visible in the UI
reproduction: Go to custard.chriskaschner.com/compare.html, try to add/compare stores
started: Pre-existing issue discovered during Phase 7 deployment verification

## Eliminated

## Evidence

- timestamp: 2026-03-09T12:01:00Z
  checked: compare-page.js getSavedStoreSlugs() (line 114-125)
  found: Reads from localStorage 'custard:v1:preferences' -> activeRoute.stores array; requires 2+ stores to show comparison grid
  implication: If activeRoute.stores has <2 entries, compare page always shows empty state

- timestamp: 2026-03-09T12:02:00Z
  checked: shared-nav.js store picker selection handler (lines 446-457)
  found: On store select, calls CustardPlanner.setPrimaryStoreSlug(slug) which writes to 'custard-primary' (a single string). Does NOT update 'custard:v1:preferences' activeRoute.stores array.
  implication: SharedNav picker sets one primary store, but compare page reads from a different key (activeRoute.stores). They never sync in the add direction.

- timestamp: 2026-03-09T12:03:00Z
  checked: planner-shared.js _writeDrivePrefsToStorage (lines 357-367)
  found: saveDrivePreferences -> _writeDrivePrefsToStorage writes to BOTH custard:v1:preferences AND custard-primary. But setPrimaryStoreSlug only writes to custard-primary.
  implication: The sync is one-way: preferences -> primary (on save), but NOT primary -> preferences (on SharedNav picker)

- timestamp: 2026-03-09T12:04:00Z
  checked: compare-page.js "Add stores" button handler (lines 569-575)
  found: Button calls SharedNav.showStorePicker() -- the same single-store picker used on all pages. No multi-store selection capability.
  implication: There is no UI anywhere on the compare page to add a second store to the comparison. The entire multi-store management flow is missing.

- timestamp: 2026-03-09T12:10:00Z
  checked: Browser tests (24 total: 14 existing + 10 new)
  found: All 24 pass. 11 pre-existing failures in unrelated tests (drive-preferences, minimap, todays-drive) -- not introduced by this change.
  implication: Fix is stable and does not regress existing functionality.

## Resolution

root_cause: The compare page delegates store selection to SharedNav's single-store picker, which calls setPrimaryStoreSlug() writing to 'custard-primary' localStorage. But compare-page.js reads from 'custard:v1:preferences' -> activeRoute.stores (a different key). These keys are never synced in the "add store" direction. Additionally, the SharedNav picker replaces the single active store rather than adding to a multi-store list. The compare page has no multi-store management UI -- it requires 2+ stores in activeRoute.stores but provides no way to get them there.
fix: Built compare-specific multi-store picker with checkbox UI for selecting 2-4 stores. Added store management bar above grid showing selected stores with remove buttons and "Add store" button. Wired "Add stores" button in empty state to open new picker. SharedNav storechange events now add stores to comparison list instead of replacing. Store selections saved to custard:v1:preferences via saveDrivePreferences for proper sync.
verification: 24/24 browser tests pass (14 existing + 10 new). No regressions.
files_changed:
  - custard-calendar/docs/compare-page.js
  - custard-calendar/docs/compare.html
  - custard-calendar/docs/style.css
  - custard-calendar/worker/test/browser/compare-picker.spec.mjs
