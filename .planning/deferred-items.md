
## Asset quality inconsistency across stores
- Gilles vs Culver's stores show different asset quality
- Butterscotch Oreo: simple asset, looks fine
- Caramel Pecan: weird/bad "higher" resolution asset
- Likely different source image sizes or processing per brand

## "Know before you go" banner covers forecast after store selection
- After selecting a store on the Today page, the "Know today's flavor before you go" / "NEW HERE?" section still displays
- This banner should be hidden once a store is selected since the user already committed
- Covers up the actual forecast content

## map-pan-stability.spec.mjs pre-existing test failure
- `map-pan-stability.spec.mjs` fails with 5-second poll timeout waiting for markers
- Failure exists on main branch before any Phase 19 changes
- Test expects markers to appear within 5 seconds of page load, but the `expect.poll` default timeout is too short
- Discovered during Phase 19 plan 01 execution

## Compare page: two store pickers create confusing first-load flow
- SharedNav store picker and Compare multi-store picker both present on first load
- User has to select a store in one picker, then immediately use the other to add comparison stores
- Polish: consolidate or sequence the pickers so first-load flow is intuitive
