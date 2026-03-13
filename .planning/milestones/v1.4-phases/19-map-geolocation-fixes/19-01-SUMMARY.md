---
phase: 19-map-geolocation-fixes
plan: 01
subsystem: ui
tags: [leaflet, geolocation, gps, watchPosition, css-animation, playwright]

requires:
  - phase: none
    provides: n/a
provides:
  - GPS auto-centering on page load with Permissions API fast-path
  - Pulsing blue "you are here" position dot via Leaflet divIcon
  - watchPosition live tracking (dot moves, map stays)
  - Geolocate button re-centers on live GPS position
  - Graceful fallback chain (GPS -> IP -> Sauk City)
  - Reverse geocode populates location input from GPS coords
affects: [19-02-nearest-store-highlight]

tech-stack:
  added: [navigator.permissions, navigator.geolocation.watchPosition]
  patterns: [permissions-api-gating, position-dot-leaflet-divicon, fallback-chain]

key-files:
  created:
    - custard-calendar/worker/test/browser/map-gps-centering.spec.mjs
  modified:
    - custard-calendar/docs/map.html
    - custard-calendar/docs/style.css

key-decisions:
  - "Use Permissions API to skip GPS entirely when denied (fast fallback path for tests and denied users)"
  - "Position dot uses interactive:false and zIndexOffset:1000 to stay above store markers without intercepting clicks"
  - "watchPosition does NOT re-center map -- only dot moves (per user decision in CONTEXT.md)"
  - "Sauk City (43.2697, -89.7218) as last-resort fallback when both GPS and IP geolocation fail"
  - "Renamed autoGeolocate to ipGeolocateFallback for clarity"

patterns-established:
  - "Permissions API gating: check navigator.permissions.query before GPS to avoid blocking on 'prompt' state"
  - "Position dot pattern: Leaflet divIcon with user-position-dot-wrap/user-position-dot CSS classes"

requirements-completed: [MAP-01, MAP-03]

duration: 7min
completed: 2026-03-13
---

# Phase 19 Plan 01: GPS Map Centering Summary

**GPS auto-centering with live position dot, Permissions API fast-path, and three-tier fallback (GPS -> IP -> Sauk City)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-13T02:32:05Z
- **Completed:** 2026-03-13T02:39:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Map auto-requests GPS on page load, centers on user's actual coordinates instead of default Wisconsin view
- Pulsing blue "you are here" dot appears at GPS position, visually distinct from cone store markers
- Live tracking via watchPosition updates dot position without re-centering map
- Graceful three-tier fallback: GPS denied -> IP geolocation -> Sauk City (first Culver's)
- Geolocate button re-centers on live GPS position when available, falls back to IP if not
- Location text input populated via reverse geocode from GPS coordinates

## Task Commits

Each task was committed atomically:

1. **Task 1: Write browser tests for GPS centering and position dot** - `9d3ded2` (test) -- TDD RED phase, 4 Playwright tests
2. **Task 2: Implement GPS auto-request, position dot, and fallback** - `a179e1c` (feat) -- TDD GREEN phase, all tests pass

**Submodule update:** `cc01695` (chore: update custard-calendar submodule)

## Files Created/Modified
- `custard-calendar/worker/test/browser/map-gps-centering.spec.mjs` - 4 Playwright browser tests for GPS centering, position dot, IP fallback, graceful degradation
- `custard-calendar/docs/map.html` - GPS auto-request in initLocation, position dot via updatePositionDot, watchPosition tracking, geolocate button re-center, ipGeolocateFallback with Sauk City last-resort
- `custard-calendar/docs/style.css` - Pulsing blue position dot CSS (user-position-dot, user-position-dot-wrap, position-pulse keyframes)

## Decisions Made
- Used Permissions API to check geolocation state before attempting GPS -- skips the 8-second timeout entirely when permission is 'denied', providing instant fallback
- Position dot marker uses `interactive: false` so it never intercepts map clicks, and `zIndexOffset: 1000` to render above all store cone markers
- Renamed `autoGeolocate` to `ipGeolocateFallback` for clarity in the new three-tier hierarchy
- Sauk City coordinates (43.2697, -89.7218) used as last-resort map center when both GPS and IP fail

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed window.map reference in test**
- **Found during:** Task 2 (running tests)
- **Issue:** Test used `window.map.getCenter()` but Leaflet map is declared as `const map` in a script tag, not explicitly on window
- **Fix:** Changed to `map.getCenter()` which accesses the global correctly
- **Files modified:** custard-calendar/worker/test/browser/map-gps-centering.spec.mjs
- **Verification:** All 4 GPS centering tests pass
- **Committed in:** a179e1c (Task 2 commit)

**2. [Rule 1 - Bug] Added Permissions API gating to prevent GPS timeout blocking**
- **Found during:** Task 2 (running existing tests)
- **Issue:** Without permission check, GPS getCurrentPosition would hang for 8 seconds in headless browsers where permission is denied, blocking IP fallback
- **Fix:** Added `navigator.permissions.query({name: 'geolocation'})` check -- when state is 'denied', skip GPS entirely
- **Files modified:** custard-calendar/docs/map.html
- **Verification:** All 4 new tests pass, GPS denied tests complete in ~2 seconds
- **Committed in:** a179e1c (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correct test execution and fast fallback. No scope creep.

## Issues Encountered
- `map-pan-stability.spec.mjs` pre-existing test failure discovered -- fails on main branch before any Phase 19 changes. Logged to deferred-items.md. Not caused by this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- GPS centering and position dot complete, ready for Phase 19 Plan 02 (nearest store highlight)
- `window._allMarkers` array and `userLat`/`userLon` state available for nearest-store distance calculation

---
*Phase: 19-map-geolocation-fixes*
*Completed: 2026-03-13*
