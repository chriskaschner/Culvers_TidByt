# Custard Calendar -- Restructuring Implementation Plan

## Document Purpose

Bridge document between the product brief (`custard-product-brief.md`) and the current codebase state. Maps each brief requirement to what exists, identifies gaps, and defines sequenced implementation tickets to get from here to there.

Last reviewed: 2026-03-07

---

## Current State Summary

The codebase has evolved significantly since the product brief was written -- but in a different direction than the brief prescribed. The team built deep backend infrastructure (planner engine, certainty model, signals system, enrichment layer, 810+ worker tests, 45 API modules) while the presentation layer remained largely unchanged.

**Result:** The APIs and data layer are ready to support all four use cases. The work is almost entirely presentation-layer restructuring.

### Already Built (aligns with brief intent, different packaging)

| Brief Requirement | What Exists | Where |
|---|---|---|
| Store comparison / "where should we go?" | Today's Drive -- ranks 2-5 stores by weighted score (certainty, distance, rarity, preference) | `/api/v1/drive`, `docs/todays-drive.js` |
| Persistent store selection | `custard:v1:preferences` in localStorage with URL param override, legacy migration | `docs/planner-shared.js` |
| No prediction needed / confirmed data | Certainty tiers (Confirmed/Watch/Estimated/None) replace prediction confidence | `worker/src/certainty.js` |
| Flavor enrichment as contextual nudges | Rarity tags, day-of-week patterns, seasonality, streaks, rare finds via signals system | `worker/src/signals.js`, `worker/src/flavor-stats.js` |
| Quiz maps to available nearby flavors | 6 quiz modes, archetype-to-flavor mapping, CTAs for matched stores | `docs/quiz.html`, `worker/src/quiz-routes.js` |
| Calendar .ics feed | Working, multi-store, RFC 5545 compliant | `worker/src/ics-generator.js` |
| iOS widgets | 3 sizes (1 store/1 day, 1 store/3 days, 3 stores/1 day) via Scriptable | `docs/assets/custard-today.js` |
| Siri shortcut | Working, `/api/v1/today` with spoken text | `worker/src/route-today.js` |
| Email alerts | Daily + weekly digest, double opt-in, signal cards, rarity spotlight | `worker/src/alert-checker.js`, `worker/src/email-sender.js` |
| Map with brand filters | Leaflet, cone markers, brand filter, flavor family filter, store specialty, rarity chips | `docs/map.html` |
| Group vote | KV-backed sessions, QR join, minimize-misery winner algorithm | `docs/group.html`, `worker/src/group-routes.js` |
| Tidbyt display | Separate repo, production, 29 flavor profiles, 3-day view | `custard-tidbyt/` |

### Not Built (gaps vs. brief)

| Brief Requirement | Gap |
|---|---|
| Nav consolidation (11 -> 4) | Still 11+ nav items across all pages |
| "Today" page radical simplification | `index.html` is a junk drawer: Drive cards + hero card + signals + calendar CTA + week-ahead all compete (flagged in TODO.md) |
| "Compare" as a clean store x day grid | Today's Drive is a ranked card list, not a side-by-side comparison matrix |
| "Get Updates" consolidation | Calendar, Widget, Siri, Alerts are 4 separate top-level nav pages |
| Progressive disclosure on home | Everything shows at once |
| Clear nav labels (Today/Compare/Map/Fun) | Still using weather metaphor names (Forecast, Radar, Fronts) in nav |
| Homepage visual coherence | Explicitly broken per TODO.md: cone sizing, card inconsistency, minimap, score badges, rarity copy |
| Scoop removal | Still exists as compatibility alias |
| Radar decomposition | Still a standalone page |
| Fronts/Group deferred from nav | Both in nav |

---

## Implementation Tickets

### Phase 1: Core Restructure

#### T1.1: Persistent Store Indicator (UX Polish)

**User story:** As a returning visitor, I should see my saved stores as a compact indicator in the header, not face the full picker on every page. (UC1, UC2)

**Acceptance criteria:**
- Header shows compact store indicator (store name + city) when stores are saved
- "Change" link opens the store picker only on demand
- First-visit geolocation auto-selects nearest store and shows a confirmation prompt ("Showing flavors for Mt. Horeb -- change?")
- Full store picker is hidden by default on all pages
- Works at 375px width without overflow

**Dependencies:** None (unblocks everything else)

**Files likely affected:**
- All `docs/*.html` files (header markup)
- `docs/planner-shared.js` (store indicator component, geolocation prompt)
- `docs/style.css` (indicator styling)

**What NOT to do:** Don't change the store persistence mechanism itself (localStorage + URL override). Don't change the store picker search/filter logic. Don't touch the Worker.

**Design constraints:** Store picker must get out of the way (principle 7). Start with the answer (principle 1).

---

#### T1.2: Today Page -- Radical Simplification

**User story:** As someone checking their phone, I want to see today's flavor at my store instantly, with the option to see more if I want. (UC2)

**Acceptance criteria:**
- Above the fold at 375px: cone image, flavor name, short description, rarity tag (if rare)
- Week-ahead is a collapsed `<details>` section, not visible by default
- If user has multiple stores saved, show a compact multi-store row for today only (flavor name + cone + store name per store, no full card)
- Single contextual CTA below the fold: "Want this every day?" linking to Get Updates
- One flavor signal shown if relevant (e.g., "peaks on Sundays") -- inline on the card, not a separate section
- No score badges, no Drive ranking cards, no hero card duplication, no calendar preview, no mini-map on this page
- Page title/nav label is "Today" (not "Forecast")

**Dependencies:** T1.1 (store indicator in header)

**Files likely affected:**
- `docs/index.html` (major rewrite of page body)
- `docs/style.css` (today page styles)
- `docs/todays-drive.js` (remove from index.html; will be used on Compare page instead)

**What NOT to do:** Don't delete `todays-drive.js` -- it moves to the Compare page. Don't remove any API calls from `planner-shared.js`. Don't change the Worker. Don't add features to this page.

**Design constraints:** Start with the answer (principle 1). Progressive disclosure (principle 2). Must not become a junk drawer again (principle from brief). Mobile-first (principle 5).

---

#### T1.3: Compare Page -- New Build

**User story:** As a family deciding where to go, I want to see my 2-4 saved stores side by side across the next 2-3 days so I can pick the best flavor/store/day combination. (UC1)

**Acceptance criteria:**
- New `docs/compare.html` page
- Grid/table layout: rows = stores (2-4), columns = days (today + next 2 days)
- Each cell: cone image (mini tier), flavor name, rarity tag if rare
- Tap/click any cell to expand: full description, directions link, historical pattern note
- Rarity highlights: cells with rare flavors get a visual call-out ("only every 400 days!")
- Flavor family exclusion filter: toggle chips to hide flavors with nuts, mint, etc. (serves UC3)
- Data comes from `/api/v1/drive` (already supports multi-store + multi-day)
- At 375px width: horizontal scroll for day columns, or swipe-between-days pattern
- Nav label is "Compare"

**Dependencies:** T1.1 (store indicator), `/api/v1/drive` endpoint (already exists)

**Files likely affected:**
- `docs/compare.html` (new file)
- `docs/style.css` (compare grid styles)
- `docs/planner-shared.js` (may need a grid data formatter utility)

**What NOT to do:** Don't rebuild the Drive API. Don't duplicate scoring logic client-side. Don't add the full Drive ranked-card UI here -- this page is a grid, not a ranking. Don't add the mini-map.

**Design constraints:** Mobile-first for decisions (principle 5). Enrichment not dashboards (principle 6). The comparison grid IS the feature.

---

#### T1.4: Nav Consolidation

**User story:** As a visitor, I should see 4 clear navigation options and understand what each does without guessing. (All UCs)

**Acceptance criteria:**
- Primary nav: **Today** (home), **Compare**, **Map**, **Fun**
- Secondary link (footer or subtle header link): **Get Updates**
- "Today" links to `index.html`
- "Compare" links to `compare.html`
- "Map" links to `map.html`
- "Fun" links to `quiz.html` (will later include Group Vote)
- "Get Updates" links to `updates.html`
- All 12+ existing HTML files updated with new nav
- Old nav items (Forecast, Radar, Calendar, Widget, Siri, Alerts, Scoop, Fronts, Group) removed from primary nav
- Pages that still exist (for redirects/compatibility) get a banner: "This page has moved" with link to new location

**Dependencies:** T1.2 (Today page exists), T1.3 (Compare page exists)

**Files likely affected:**
- All `docs/*.html` files (nav block replacement)
- `docs/style.css` (nav styling for 4 items)

**What NOT to do:** Don't delete old HTML files yet (Phase 3). Don't change page content -- just the nav. Don't add a hamburger menu unless the 4 items genuinely don't fit at 375px.

**Design constraints:** Clarity over cleverness (principle 4). Weather metaphor lives in branding and headers, not nav labels.

---

### Phase 2: Channel Consolidation + Polish

#### T2.1: Get Updates Page

**User story:** As someone who just saw today's flavor and wants it automatically, I want one place to set up my preferred notification channel. (UC2)

**Acceptance criteria:**
- New `docs/updates.html` page
- Four cards or tabs: Calendar, Widget, Siri, Alerts
- Each card: brief description ("Get flavors in your calendar"), setup button/link
- Setup instructions for each channel pulled from existing pages (calendar.html, widget.html, siri.html, alerts.html content)
- Alert signup form works inline (not a redirect)
- Store context carried from referring page (if user came from Today page showing Mt. Horeb, pre-fill Mt. Horeb)
- Contextual entry: "Want this every day?" CTAs on Today and Compare link here

**Dependencies:** T1.4 (nav points here)

**Files likely affected:**
- `docs/updates.html` (new file)
- `docs/style.css` (updates page styles)
- Content migrated from: `docs/calendar.html`, `docs/widget.html`, `docs/siri.html`, `docs/alerts.html`

**What NOT to do:** Don't break the .ics endpoint URL. Don't break the Scriptable widget install flow. Don't change the alert subscription API. Don't delete the old pages yet.

**Design constraints:** Delivery channels are not features (principle 3). These are one-time setup flows, not destinations.

---

#### T2.2: Map -- Flavor Family Exclusion Filter

**User story:** As someone with dietary constraints (no nuts, no mint), I want to filter out stores serving flavors I can't eat and see what's left nearby. (UC3)

**Acceptance criteria:**
- Exclusion toggle chips above the map: "No Nuts," "No Mint," "No Cheesecake," etc.
- Toggling a chip hides map markers for stores whose today's flavor matches that family
- Result list below map also filters
- Chips are clearly "exclude" semantics (not "show only")
- Works with existing brand filter (additive filtering)

**Dependencies:** None (map.html exists, flavor families defined in `planner-shared.js`)

**Files likely affected:**
- `docs/map.html` (exclusion chip UI + filter logic)
- `docs/style.css` (chip styling)

**What NOT to do:** Don't rebuild the map. Don't change existing brand filter behavior. Don't add the exclusion filter to Compare (that's already in T1.3).

---

#### T2.3: Fun Page -- Quiz UX Consolidation

**User story:** As a family looking for entertainment, I want to easily find and start a quiz mode, with image-based answers on my phone. (UC4)

**Acceptance criteria:**
- `quiz.html` page title/heading becomes "Fun" (or similar)
- Quiz mode selection: visual cards (not a dropdown), each showing mode name + one-line description
- On mobile (< 768px), answer options render as image cards (cone images or weather sprites), not text grids
- Mad Libs mode: word selection UI with 3 pre-populated choices + 1 write-in per blank (already partially built)
- Group Vote accessible from this page as a section or card ("Decide together")
- Results always show actually-available nearby flavors with Directions/Alert CTAs

**Dependencies:** T1.4 (nav labels this "Fun")

**Files likely affected:**
- `docs/quiz.html` (mode selector redesign, image-based answers)
- `docs/style.css` (quiz card styles)
- Quiz JSON configs (may need image references)

**What NOT to do:** Don't change the quiz engine logic. Don't change the archetype-to-flavor matching. Don't remove any quiz modes. Don't rebuild Group Vote -- just link to it or embed entry point.

---

### Phase 3: Cleanup + Delight

#### T3.1: Old Page Redirects

**User story:** As someone with a bookmarked old URL, I should land on the right new page. (All UCs)

**Acceptance criteria:**
- `scoop.html` -> redirect to `index.html` (Today) preserving `?stores=` params
- `radar.html` -> redirect to `compare.html` preserving `?store=` param
- `calendar.html` -> redirect to `updates.html#calendar`
- `widget.html` -> redirect to `updates.html#widget`
- `siri.html` -> redirect to `updates.html#siri`
- `alerts.html` -> redirect to `updates.html#alerts`
- `forecast-map.html` -> keep accessible via direct URL, no nav link
- `group.html` -> keep accessible via direct URL, linked from Fun page
- Redirects use `<meta http-equiv="refresh">` or JS redirect (GitHub Pages constraint)
- Old URLs with query params pass through to new destinations

**Dependencies:** T2.1 (Get Updates page exists)

**Files likely affected:**
- `docs/scoop.html`, `docs/radar.html`, `docs/calendar.html`, `docs/widget.html`, `docs/siri.html`, `docs/alerts.html` (replace content with redirects)

**What NOT to do:** Don't delete files (breaks GitHub Pages URLs). Don't redirect `forecast-map.html` or `group.html` -- they stay as hidden-but-accessible pages.

---

#### T3.2: Homepage Visual Coherence

**User story:** As a visitor, the homepage should look like one product, not six widgets duct-taped together.

**Acceptance criteria:**
- Consistent cone rendering tier across all homepage elements
- Unified card system (shared border, background, spacing, typography)
- Rarity/overdue copy accounts for seasonality (suppress misleading cadence claims for seasonal flavors)
- No floating score badges without explanation
- Consistent spacing and section hierarchy

**Dependencies:** T1.2 (simplified Today page means fewer elements to harmonize)

**Files likely affected:**
- `docs/index.html` (card markup)
- `docs/style.css` (unified card system)
- `docs/cone-renderer.js` (ensure consistent tier usage)

**What NOT to do:** Don't redesign the cone renderer. Don't add new sections. Focus on visual consistency of what remains after T1.2 simplification.

**Note:** Many items from the TODO.md "Homepage visual coherence audit" will be resolved by T1.2's simplification (removing the conflicting elements entirely). This ticket catches whatever remains.

---

#### T3.3: Fronts as Delight Feature

**User story:** As a curious visitor, I want to see the whimsical weather-map visualization of flavor "fronts" across the country. (Delight)

**Acceptance criteria:**
- `forecast-map.html` remains functional at its URL
- Accessible from the Fun page as a "Flavor Fronts" card/link
- No primary nav link
- Existing functionality preserved (color-coded intensity, day animation)

**Dependencies:** T2.3 (Fun page has a place for it)

**Files likely affected:**
- `docs/quiz.html` (add Fronts link/card)
- `docs/forecast-map.html` (minor: remove old nav, add back-link to Fun)

---

## Ticket Dependency Graph

```
T1.1 (Store Indicator)
  |
  +---> T1.2 (Today Page Simplification)
  |       |
  |       +---> T1.4 (Nav Consolidation) ---> T2.1 (Get Updates) ---> T3.1 (Redirects)
  |       |
  |       +---> T3.2 (Visual Coherence)
  |
  +---> T1.3 (Compare Page)
          |
          +---> T1.4

T2.2 (Map Exclusion Filter) -- independent
T2.3 (Fun Page) -- depends on T1.4
T3.3 (Fronts as Delight) -- depends on T2.3
```

## What Does NOT Need to Change

Explicitly scoping these out to prevent scope creep:

- **Worker/API layer** -- feature-complete for all four use cases. No new endpoints needed.
- **Store persistence mechanism** -- localStorage + URL override is correct. Just needs UX polish (T1.1).
- **Enrichment data pipeline** -- rarity, signals, patterns all have endpoints and are working.
- **Quiz engine logic** -- archetype matching, trivia API, Mad Libs engine all work. Just needs UX reskin.
- **.ics feed** -- working, don't touch the endpoint.
- **Widget/Siri/Alert integrations** -- all functional. Consolidating setup pages doesn't change the integrations.
- **Tidbyt app** -- separate repo, production, complete.
- **Analytics pipeline** -- ML models, batch forecasts, backfill scripts all stable.
- **Test infrastructure** -- 810+ Worker tests, 32 Playwright tests, 179 Python tests. Add tests for new pages, don't restructure existing tests.

## Risk Register

| Risk | Mitigation |
|---|---|
| Today page becomes a junk drawer again | T1.2 acceptance criteria explicitly cap what's on the page. Reviewer agent runs "junk drawer test" per agent config. |
| Compare grid doesn't work on mobile | T1.3 requires 375px testing. Design exploration needed before building (horizontal scroll vs. swipe pattern). |
| Old URL bookmarks break | T3.1 redirects preserve query params. No files deleted. |
| Removing nav items confuses existing users | Redirect banners on old pages explain where content moved. |
| Scope creep into Worker changes | Explicitly scoped out above. All tickets are presentation-layer only. |

## Open Questions (from brief, still open)

1. **"Get Updates" as page vs. modal/drawer?** -- This plan assumes a page (`updates.html`). A drawer might be better UX but is more complex. Decide before T2.1.
2. **Compare grid mobile layout?** -- Horizontal scroll, swipe-between-days, or something else? Needs design exploration as part of T1.3.
3. **Quiz image assets?** -- Image-based answer cards need imagery. Source TBD. Could use cone renderer output or weather sprites (already exist for weather quiz).
4. **Cone asset direction?** -- Multiple rendering tiers exist (mini, HD, hero, premium). Which tier for which context needs a decision before T3.2.
