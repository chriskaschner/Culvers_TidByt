---
status: diagnosed
trigger: "Store picker list items distinguish stores in same city by street address"
created: 2026-03-07T18:00:00Z
updated: 2026-03-07T18:00:00Z
---

## Current Focus

hypothesis: buildStorePickerHTML() never reads the address field from store objects
test: Read buildStorePickerHTML source and stores.json schema
expecting: address field exists in data but is omitted from rendering
next_action: confirmed -- return diagnosis

## Symptoms

expected: Store picker shows unique identifiers for each store -- e.g., "Madison, WI - Mineral Point Rd" and "Madison, WI - Todd Dr" instead of identical "Madison, WI" entries
actual: All Madison WI stores show identically as "Madison, WI" with no street address to tell them apart
errors: None
reproduction: Open store picker, type "madison", see identical entries
started: Discovered during UAT (test 3)

## Eliminated

(none -- root cause found on first hypothesis)

## Evidence

- timestamp: 2026-03-07T18:00:00Z
  checked: stores.json schema (first 50 lines, Madison entries)
  found: Every store object has an "address" field (e.g., "7206 Mineral Point Road", "2102 West Beltline Hwy.", "1325 Northport Drive", "4301 East Towne Blvd.", "4401 Cottage Grove Road")
  implication: The data source has street addresses available

- timestamp: 2026-03-07T18:00:00Z
  checked: buildStorePickerHTML() in shared-nav.js lines 355-383
  found: |
    The label construction only uses s.name, s.city, and s.state:
      var label = escapeHtml(s.name);
      if (s.city && s.state) {
        label += ' <span class="store-picker-meta">' + escapeHtml(s.city) + ', ' + escapeHtml(s.state) + '</span>';
      }
    The s.address field is never referenced anywhere in buildStorePickerHTML.
    The data-* attributes on the <li> also omit address (only data-slug, data-name, data-city, data-state).
  implication: Street addresses are available in the data but the picker rendering code never uses them

- timestamp: 2026-03-07T18:00:00Z
  checked: filterStoreList() in shared-nav.js lines 386-403
  found: Search filtering checks data-name, data-city, data-state but NOT address. Even if address were displayed, it would not be searchable.
  implication: Fix must also add data-address attribute and include it in filter matching

- timestamp: 2026-03-07T18:00:00Z
  checked: store name field pattern across stores.json
  found: The "name" field is formatted as "City, ST" (e.g., "Madison, WI") which is identical to the city+state meta span, making the label redundant -- "Madison, WI Madison, WI"
  implication: The label shows the same city/state info twice with no distinguishing detail

## Resolution

root_cause: |
  buildStorePickerHTML() in shared-nav.js (line 368-378) constructs each store
  list item label using only s.name (which is "City, ST") and a meta span of
  s.city + s.state. It never reads the s.address field. Since multiple Madison
  stores all have name="Madison, WI", city="Madison", state="WI", the picker
  renders identical labels for all of them. The address field (e.g., "7206
  Mineral Point Road") exists on every store object in stores.json but is
  simply never used in the picker.

fix: ""
verification: ""
files_changed: []
