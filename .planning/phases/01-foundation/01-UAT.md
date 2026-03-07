---
status: complete
phase: 01-foundation
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md]
started: 2026-03-07T17:30:00Z
updated: 2026-03-07T17:30:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. First Visit Geolocation
expected: Clear localStorage, reload. See compact store prompt or fallback text prompt. No dimmed overlay, no browser permission popup.
result: issue
reported: "I see a failure message, I see a non geoip (should this work, I'm in wisconsin and this is showing me AL stores), I don't see 'showing flavors'. Store indicator shows 'Albertville, AL, Albertville, AL change' which looks like legacy format, not the new SharedNav blue bar. Flavor data error visible."
severity: major

### 2. Confirm/Select Store
expected: From the first-visit prompt, tap confirm (if store shown) or "Find your store" then select one. Store indicator in the header shows store name and city compactly with a "change" link.
result: pass

### 3. Change Store via Picker
expected: Tap "change" on the store indicator. A store picker opens with a search input. Type a store name (e.g., "Mt. Horeb"). Matching stores filter in real-time. Select one. Picker closes, indicator updates to show the new store.
result: pass
note: "Core behavior works but store list shows only 'Madison, WI' for all Madison stores -- no street address to differentiate them (e.g., 'Mineral Point', 'Todd Dr'). Tracked as separate gap."

### 4. Forecast Loads After Store Change
expected: On index.html, after changing store via the picker, flavor data loads for the new store. No "Something went wrong loading the flavor data" error.
result: issue
reported: "fail, there's a red error and it says 'Something went wrong loading the flavor data'"
severity: blocker

### 5. Cross-Page Store Persistence
expected: With a store selected on index.html, navigate to calendar.html (or any other page). The same store name appears in the header store indicator.
result: pass

### 6. Nav Bar on All Pages
expected: Visit at least 3 different pages (index, calendar, map). Each page shows the same 11 nav links. The current page's link is highlighted/bold.
result: pass

### 7. Mobile Layout (375px)
expected: In DevTools, switch to 375px viewport width (e.g., iPhone SE). Store indicator text does not overflow or break layout. Nav links are usable (wrap or scroll).
result: issue
reported: "nav links function, but the overflow is weird and makes the page wider at 375px"
severity: minor

## Summary

total: 7
passed: 4
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "First-time visitor is geolocated and sees nearest store name in header without manual selection, with 'Showing flavors for [Store] -- change?' prompt"
  status: failed
  reason: "User reported: I see a non geoip result (AL stores instead of WI), no 'showing flavors' prompt, legacy store indicator format, and flavor data error"
  severity: major
  test: 1
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Store picker list items distinguish stores in same city by street address"
  status: failed
  reason: "User reported: All Madison WI stores show identically as 'Madison, WI' with no street address (Mineral Point, Todd Dr, etc.) to tell them apart"
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Flavor data loads for the selected store after changing store via SharedNav picker"
  status: failed
  reason: "User reported: fail, there's a red error and it says 'Something went wrong loading the flavor data'"
  severity: blocker
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Nav links are usable at 375px mobile viewport width"
  status: failed
  reason: "User reported: nav links function, but the overflow is weird and makes the page wider at 375px"
  severity: minor
  test: 7
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
