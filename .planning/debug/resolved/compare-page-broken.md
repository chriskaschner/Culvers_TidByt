---
status: resolved
trigger: "Compare page broken -- cannot select or compare multiple stores"
created: 2026-03-09T06:00:00-05:00
updated: 2026-03-09T07:30:00-05:00
---

## Current Focus

hypothesis: confirmed -- SharedNav single-store picker was incompatible with compare page
test: n/a (resolved)
expecting: n/a
next_action: archived

## Symptoms

expected: Compare page allows selecting 2-4 stores and shows side-by-side comparison
actual: Compare page used SharedNav's single-store picker which wrote to the wrong storage key and had no multi-select capability
errors: No runtime errors; functional mismatch -- single picker cannot drive multi-store comparison
reproduction: Open compare page, attempt to select multiple stores
started: Compare page never had proper multi-store selection

## Eliminated

- hypothesis: Bug in SharedNav picker component itself
  evidence: SharedNav picker works correctly on other pages for single-store selection; the issue is that compare needs multi-select, not single-select
  timestamp: 2026-03-09T06:15:00-05:00

## Evidence

- timestamp: 2026-03-09T06:10:00-05:00
  checked: compare-page.js store selection logic
  found: Compare page was reusing SharedNav's single-store picker which writes to a different storage key and only supports one store
  implication: Compare page needs its own multi-store picker component

- timestamp: 2026-03-09T06:20:00-05:00
  checked: SharedNav picker API surface
  found: SharedNav picker has no multi-select mode; it is designed for single-store context switching
  implication: Cannot extend SharedNav picker; need compare-specific implementation

## Resolution

root_cause: Compare page reused SharedNav's single-store picker, which wrote to the wrong localStorage key and had no multi-select capability. The compare page requires selecting 2-4 stores simultaneously for side-by-side comparison, which the single-store picker fundamentally cannot support.

fix: Added a compare-specific multi-store picker with checkboxes (2-4 stores), a store management bar with remove/add controls, and proper persistence to the correct storage key.

verification: User confirmed fix is working -- multi-store picker allows selecting stores and comparing side-by-side. Fix verified live on production. Polish issue (two store pickers on first load) logged to deferred-items.md.

files_changed:
  - docs/compare-page.js (339 lines added -- multi-store picker logic)
  - docs/compare.html (3 lines -- picker markup)
  - docs/style.css (216 lines -- picker and management bar styles)
  - worker/test/browser/compare-picker.spec.mjs (374 lines -- test coverage)
