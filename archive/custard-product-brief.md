# Custard Calendar — Product Brief & Restructuring Plan

## Document Purpose

This is a handoff document for restructuring [custard.chriskaschner.com](https://custard.chriskaschner.com/). It captures the output of a detailed product discovery conversation between the site's creator and a collaborator. The goal is to move from 11 loosely connected feature pages to a focused product organized around real use cases.

The GitHub repo is at [github.com/chriskaschner/custard-calendar](https://github.com/chriskaschner/custard-calendar).

---

## What Custard Calendar Is

Custard Calendar tracks daily "Flavor of the Day" schedules across 1,000+ frozen custard stores — primarily Culver's locations nationwide, plus Milwaukee-area independents (Kopp's, Gille's, Hefner's, Kraverz, Oscar's). It uses a weather forecast metaphor ("Custard Forecast") as its design concept.

The site has confirmed flavor data typically 30 days out, sourced directly from store schedules. It also has a deep historical dataset (observations dating back to 2015-08-02 across 971+ stores with 176+ distinct flavors) that powers rarity scores, day-of-week patterns, and other analytics.

**Key data point:** Forecasting/prediction is unnecessary. The confirmed data from stores is reliable and available ~30 days out. Any "estimated" vs "confirmed" distinction, accuracy dashboards, or prediction confidence scores are solving a problem that doesn't exist. The historical data is valuable for enrichment (rarity, patterns, seasonality) but not for prediction.

---

## The Four Use Cases

These were described by the creator based on how he and his family/friends actually use (or want to use) the site.

### UC1: "Where should we go?" — Store Comparison for a Decision

**The moment:** It's Friday midday. The family might go out today, tomorrow, or Sunday. There are 3-4 stores within driving range. The question is: is there a flavor we love at a particular store on a particular day that justifies going there?

**Also this moment:** We're in the car right now, passing 3 stores on the way home. Which one should we hit?

**What's needed:**
- Side-by-side comparison of 2-4 stores across 1-3 days
- Flavor names and descriptions
- Rarity data as a nudge ("this one only comes around every 400 days — don't miss it")
- Must work well on mobile (the "in the car" scenario)
- The family's flavor preferences matter but are situational and sometimes a negotiation, not a static profile

**Current state:** This use case is partially served by Forecast (which shows nearby stores ranked), Map (geographic view), Scoop (card-based), and Radar (which suggests "next best store"). But none of them present a clean store × day comparison grid. The creator currently eyeballs it by looking at multiple stores' week-ahead views.

### UC2: "What's the flavor right now?" — Glanceable Info

**The moment:** Quick check — what's today's flavor at my store? What about the next few days?

**What's needed:**
- Single store, single day: a picture of the cone, the flavor name, a short description
- Single store, 3 days ahead
- 3-4 stores, today only (multi-store glance)
- This information should be available across multiple surfaces/channels — not just the website

**Delivery channels (all serving the same atomic data unit):**
- Calendar subscription (.ics feed) — the original and most accessible
- iOS home screen widget (via Scriptable) — already working in 3 sizes (small: 1 store/1 day, medium: 1 store/3 days, medium: 3 stores/1 day)
- Siri Shortcut — experimental but functional ("Hey Siri, flavor of the day")
- Potentially: Alexa skill, Home Assistant integration
- The website homepage itself

**Key insight:** These are delivery channels, not features. They all carry the same payload. On the website, they should be one-time setup flows, not top-level nav destinations.

### UC3: "What can I eat nearby?" — Filtered Discovery

**The moment:** Friends are flexible on which store to visit but have hard constraints — no nuts, no mint, no cheesecake base, etc. They're willing to drive a bit further but want to eliminate options they'd reject.

**What's needed:**
- Set a distance radius (e.g., within 10 minutes)
- Exclude flavor families or specific ingredients
- See what remains — today's options that pass the filter
- Reduce decision fatigue through elimination

**Current state:** Partially served by Map (has brand and flavor family filters) and Radar (was intended for "find closest place serving a flavor family I like"). Neither presents this as a clean filter-and-decide flow.

**Relationship to UC1:** UC1 is "I know my stores, show me the flavors." UC3 is "I know my constraints, show me the stores." They're inverses. A well-designed core experience might serve both.

### UC4: "Make it fun" — Quizzes, Mad Libs, Games

**The moment:** The kids want to play. They've burned through the Culver's website quizzes and want more. Or the family can't decide and wants a fun tiebreaker.

**What's needed:**
- Multiple quiz modes (personality, Mad Libs, trivia, date night, compatibility)
- Image-based answers on mobile, not just text grids
- Mad Libs should offer 3 pre-populated word choices + 1 write-in option
- Results map to flavor archetypes, then match to actually available flavors nearby (this is the key differentiator vs Culver's own quizzes, which might recommend a flavor not within 100 miles)
- The quiz/vote can feed back into the UC1 decision — it's not just entertainment

**Current state:** Quiz page exists with multiple modes in a dropdown, but it's text-heavy, the modes aren't clearly differentiated, the Mad Libs mode is buried, and one quiz is a direct copy of Culver's. The underlying idea is sound (personality → archetype → available flavor) but the UX hides it.

---

## Current Site Inventory — Page-by-Page Assessment

### Pages with clear value (keep/refine):

| Page | What it does | Maps to UC | Status |
|------|-------------|-----------|--------|
| **Forecast (index.html)** | Today's flavor + week ahead for one store, nearby store ranking, calendar preview, flavor signals | UC1, UC2 | Overgrown. Started as the ideal landing page, became a junk drawer. Every feature got bolted on. Too much information, impossible to scan. Needs radical simplification. |
| **Calendar (calendar.html)** | Subscribe to .ics feed, setup instructions for Apple/Google/Outlook | UC2 | Solid concept, works. Pain points are polish-level: calendar color can't be forced automatically, store picker feels complex. Should be a setup flow, not a top-level destination. |
| **Map (map.html)** | Geographic map of nearby stores with brand/flavor family filters | UC1, UC3 | Good idea, keeper. Pixel art cone icons are charming (need refinement). Ranking by distance works. Brand filter useful (Culver's vs Milwaukee independents). Flavor family filter questionable (nobody drives an hour based on it). Has fun personality — Easter eggs about Milwaukee stores. |
| **Alerts (alerts.html)** | Email notifications when favorite flavors are scheduled. Pick store, pick up to 10 flavors, daily or weekly digest. | UC2, UC3 | Works end-to-end. Only current mechanism for capturing user identity (email). Should expand conceptually — email is a channel that can carry different payloads (favorite flavor alert, weekly digest, multi-store comparison). |
| **Widget (widget.html)** | iOS Scriptable widget setup in 3 sizes | UC2 | Works and is personally valuable. The three widget sizes (1 store/1 day, 1 store/3 days, 3 stores/1 day) effectively ARE the core information architecture of the product. Should be a setup flow, not a top-level page. |
| **Quiz (quiz.html)** | Personality quizzes, Mad Libs, trivia with 6 modes. Maps results to available flavors nearby. | UC4 | Good underlying utility hidden by bad UX. Should be image-based on mobile, modes shouldn't be in a dropdown, Mad Libs needs word selection UI. Key differentiator: results map to actually available flavors, unlike Culver's quizzes. |

### Pages that are experimental/secondary (defer or fold in):

| Page | What it does | Maps to UC | Status |
|------|-------------|-----------|--------|
| **Radar (radar.html)** | Dense power-user page: store picker, favorite flavor highlighting, 7-day forecast with rarity, next-best-store, accuracy dashboard, flavor signals, historical context | UC1, UC3 | A mess by the creator's admission. Core job was "find closest place serving a flavor family I like" — that's useful. Flavor signals (day-of-week patterns) are cool but need to be contextual enrichment on cards, not a standalone section. Forecasting/accuracy infrastructure is unnecessary (data is confirmed). Should be decomposed: the useful parts folded into Compare and Map, the rest cut. |
| **Siri (siri.html)** | Setup guide for Siri Shortcut | UC2 | Experimental but functional. Store picker dominates the page unnecessarily. The decorative device icons (iPhone, HomePod, etc.) don't do anything. Should be a setup flow alongside Calendar and Widget, not its own page. |
| **Fronts (forecast-map.html)** | Weather-map visualization of flavor "fronts" across stores. Color-coded intensity, 7-day animation. | Fun/delight | Purely whimsical — "a storm of mint blowing in from the west." Takes advantage of unique national-scale data. Fun, shareable, memorable, but zero utility. Phase 2 delight feature. |
| **Group (group.html)** | QR-based group voting on stores. Everyone votes yes/meh/no. | UC1, UC4 | Most experimental feature. Ties to the family decision moment but very niche. Lowest priority. |

### Pages to remove:

| Page | Reason |
|------|--------|
| **Scoop (scoop.html)** | Vestigial. Was the original homepage concept, functionality absorbed into Forecast. Page itself says "primary home has moved to forecast." The name "Scoop" might survive as branding. |

---

## Cross-Cutting Problems to Solve

### 1. The Store Picker is Everywhere and Too Heavy

The store picker (a massive dropdown of 1,000+ stores with state filtering) appears on almost every page. It renders poorly on mobile. It dominates pages where it shouldn't (e.g., Siri setup). If the site has already geolocated you or you've previously selected a store, you shouldn't face it again.

**Recommendation:** Implement a persistent "your stores" concept. Set once (via geolocation on first visit or manual selection), carried across the site via localStorage or URL params. Show as a small indicator with a "change" link, not a full picker. The picker only appears in full when someone actively wants to change stores.

The site already does some of this — the Forecast page URL includes `?stores=mt-horeb,verona,madison-todd-drive&sort=match&radius=25` — but the UX doesn't reflect it consistently.

### 2. No Progressive Disclosure

Every page shows everything at once. The Forecast page is the worst offender — today's flavor, week ahead, near-you ranking, calendar preview, flavor signals, subscribe CTAs, and setup instructions all compete for attention.

**Recommendation:** Start with the answer, then offer the next question, then offer to keep answering automatically. The flow should be:

1. **Here's today's flavor at your store** (immediate, glanceable)
2. **Here's this week** (one tap/scroll to expand)
3. **Compare with nearby stores** (deliberate action)
4. **Want this every day? Set up calendar/widget/alerts** (contextual CTA, not a separate page)

### 3. Delivery Channels Treated as Features

Calendar, Widget, Siri, and Alerts are all ways to get the same information. They don't need to be top-level nav items. They're one-time setup flows.

**Recommendation:** Group these under a single "Get Updates" or "Stay In The Loop" concept. Surface them contextually — after someone sees today's flavor and the week ahead, offer: "Want this automatically? Here's how." The setup instructions for each channel live behind that prompt.

### 4. Whimsical Naming vs Clarity

Names like "Forecast," "Radar," "Fronts," and "Scoop" are fun and fit the weather metaphor. But users can't tell what "Radar" does differently from "Forecast." Cleverness shouldn't come at the cost of wayfinding.

**Recommendation:** Use clear, functional names for the primary navigation. The weather metaphor can live in the branding, headers, and personality of the site without dictating the nav structure. "Today" is clearer than "Forecast." "Compare" is clearer than "Radar." "Map" is already clear. The fun names can appear as headings within pages.

### 5. Asset Design (Pixel Art / Cone Images)

The pixel art cone icons are charming and distinctive but need refinement. They're currently tied to a "tidbit" design system. There's a spectrum between the tiny pixel art tidbits and full hero-size lifelike images — the right answer is probably somewhere in between, with enough pixel density to look good on widget and card contexts.

This is a design task, not a structural one, but it affects how the Compare view and widgets feel.

---

## Proposed Site Structure

### Primary Navigation (3-4 items):

#### 1. Today (Home)
**Job:** "What's the flavor right now?"
**Default view:** Your primary store, today's flavor, cone image, flavor name, short description. Rarity tag if it's rare.
**Progressive disclosure:**
- Scroll/tap to see the week ahead at this store
- If user has multiple stores saved, show a compact multi-store view for today
- Contextual CTA: "Want this every day?" → leads to setup flows for Calendar, Widget, Siri, Alerts
- Flavor signals shown contextually on relevant cards (e.g., "Devil's Food Cake peaks on Sundays" shown when Devil's Food Cake appears)

**First visit experience:** Geolocate to nearest store automatically. No blank page. Show today's flavor immediately with a subtle prompt to confirm or change the store. Keep the store picker *out of the way* unless the user asks for it.

**Critical:** This page must not become a junk drawer again. Resist the urge to add things here. If it doesn't directly answer "what's today's flavor?" or naturally follow from that answer, it belongs elsewhere.

#### 2. Compare
**Job:** "Where should we go?"
**Default view:** A grid/table of the user's saved stores (2-4) × the next 2-3 days. Each cell shows: flavor name, cone image, rarity tag if rare.
**Key features:**
- Side-by-side comparison is the whole point — this view should feel like a decision matrix
- Rarity as a nudge: highlight cells where a rare flavor appears ("only every 400 days!")
- Tap any cell to expand: full description, directions link, historical pattern
- Must be mobile-optimized — this is the "in the car" view
- Could incorporate flavor family filtering (from UC3) as an optional layer — "hide flavors with nuts"

**Relationship to Today:** If Today shows one store, Compare shows multiple stores. They share the same data, different views.

#### 3. Map
**Job:** "What can I eat nearby?" / Geographic discovery
**Default view:** Map centered on user location, stores as markers with cone icons, today's flavor shown on hover/tap.
**Key features:**
- Distance radius control
- Brand filter (Culver's / Kopp's / Gille's / Hefner's / Kraverz / Oscar's)
- Flavor family exclusion filter (no nuts, no mint, etc.) — this serves UC3
- Store results ranked by distance below the map
- Tap a store to see today's flavor + next few days
- Keep the personality — Easter eggs, Milwaukee shade, pixel art cones

#### 4. Fun
**Job:** Entertainment, delight, family engagement
**Content:**
- Quiz modes (personality, Mad Libs, trivia, date night, build-your-scoop, compatibility)
- Each quiz maps results to an archetype, then matches to actually available flavors nearby
- Mad Libs: offer 3 pre-populated word options + 1 write-in per blank
- Image-based answer selection on mobile (not text grids)
- Eventually: Fronts (weather map visualization), Group Vote

**Design notes:** This section can be more playful and experimental. It's where the weather metaphor gets to be its most whimsical. But the underlying utility (results → available flavors) should be the consistent throughline.

### Secondary/Contextual (not in main nav):

#### Get Updates (setup flows)
Accessible from contextual CTAs within Today, Compare, and Map. Contains setup instructions for:
- **Calendar subscription** (.ics feed for Apple Calendar, Google Calendar, Outlook)
- **iOS Widget** (Scriptable setup, 3 sizes)
- **Siri Shortcut** (setup guide)
- **Email Alerts** (favorite flavor notifications, weekly digest)

These are one-time configuration flows. After setup, the user never needs to visit these pages again — the value is delivered in their calendar, home screen, or inbox.

The flow to get here should feel natural: see today's flavor → "want this every day?" → choose your channel → follow setup steps.

#### About / Privacy
Standard footer content. Not affiliated with any restaurant. Data sourced from restaurant websites. GitHub link. Privacy policy.

---

## Flavor Enrichment Data (Available for Use Across Views)

The historical dataset enables several types of enrichment that should be used contextually throughout the site, not siloed into dedicated pages:

- **Rarity tags:** "Rare" / "Ultra Rare" based on frequency at a specific store. E.g., "appears roughly every 118 days at your store"
- **Flavor signals / Day-of-week patterns:** "Devil's Food Cake peaks on Sundays" — 6 of 38 observed Sundays (16%), 50% of this flavor's appearances land on Sunday
- **Seasonality:** "Peaks in March. In-season now."
- **Frequency rank:** "#8 of 176 flavors (5,119 appearances across 971 stores)"
- **Store specialty:** "Turtle leads this store's history (111 of 1,475 observations)"
- **Historical window:** Observations dating back to 2015-08-02

**How to use this:** Show rarity tags on Compare grid cells and Today cards. Show day-of-week patterns when relevant (e.g., if today is Sunday and Devil's Food Cake is showing, note the pattern). Show seasonality on expanded flavor detail. Don't create a dedicated analytics page — weave this into the existing views as contextual enrichment.

---

## Design Principles (Derived from This Conversation)

1. **Start with the answer.** No blank pages. Geolocate and show today's flavor immediately.

2. **Progressive disclosure.** Slowly unravel complexity. Don't give everybody all the levers up front. Answer the question, then offer the next question.

3. **Delivery channels are not features.** Calendar, Widget, Siri, Alerts are setup flows surfaced contextually, not top-level pages.

4. **Clarity over cleverness.** The weather metaphor is fun and should live in the branding and personality. But nav labels should be functional ("Today" not "Forecast," "Compare" not "Radar").

5. **Mobile-first for decisions.** UC1 ("where should we go?") often happens on a phone, in a car. Compare view must be fast and scannable on small screens.

6. **Enrichment, not dashboards.** Rarity, patterns, and historical data are powerful — use them as contextual nudges on cards and cells, not as standalone analytics sections.

7. **The store picker must get out of the way.** Set once, persist everywhere, show as a small indicator with a change option.

8. **Keep the personality.** Pixel art cones, weather metaphor in branding, Milwaukee Easter eggs, whimsical quiz modes. This is a passion project and the fun is part of what makes people want to use it.

---

## What to Build First (Suggested Priority)

### Phase 1: Core restructure
1. **Today (Home)** — Simplified landing page. Geolocate → show flavor → week ahead → contextual "get updates" CTA. Radically cut what's on the current Forecast page.
2. **Compare** — New page. Store × day grid for 2-4 stores × 2-3 days. This is the highest-value new feature — it's the use case that doesn't exist cleanly anywhere on the current site.
3. **Persistent store selection** — Set once, carry everywhere. Kill the repeated full store picker on every page.
4. **Nav consolidation** — Go from 11 items to 4 (Today, Compare, Map, Fun).

### Phase 2: Polish and channels
5. **Map refinements** — Flavor family exclusion filter (UC3), improved cone assets
6. **Get Updates consolidation** — Merge Calendar, Widget, Siri, Alerts setup flows into one contextual section
7. **Quiz UX overhaul** — Image-based answers, Mad Libs word selection UI, clear mode separation, remove Culver's quiz copy

### Phase 3: Delight
8. **Fronts** — Weather map visualization with national flavor "storms"
9. **Group Vote** — QR-based family voting
10. **Asset refinement** — Cone images between pixel-art tidbits and full hero

---

## Current Technical Details (Observed)

- Static site (HTML/CSS/JS pages: index.html, calendar.html, map.html, radar.html, alerts.html, siri.html, forecast-map.html, quiz.html, widget.html, scoop.html, group.html)
- API backend serving flavor data (e.g., `/v1/calendar.ics?primary=mt-horeb`)
- Store data includes slug identifiers (e.g., `mt-horeb`, `verona`, `madison-todd-drive`)
- URL params used for state: `?stores=mt-horeb,verona,madison-todd-drive&sort=match&radius=25`
- Geolocation used for initial store selection (IP-based)
- Leaflet.js for maps (OpenStreetMap tiles)
- Scriptable (iOS) for widget implementation
- Historical data: 450+ observations per store, data from 2015-08-02 to 2026-03-31
- Covers 1,000+ stores across all 50 US states with Culver's locations
- Milwaukee independents: Kopp's (Brookfield, Glendale, Greenfield), Gille's (Milwaukee), Hefner's (West Allis), Kraverz (Fond du Lac), Oscar's (Muskego, New Berlin)

---

## Pages to Remove or Redirect

| Current page | Action |
|-------------|--------|
| scoop.html | Remove. Vestigial — functionality absorbed into Forecast/Today. |
| radar.html | Remove as standalone page. Decompose useful parts: "find flavor family nearby" → Map filters. "Next best store" → Compare. Flavor signals → contextual enrichment on cards. |
| forecast-map.html (Fronts) | Defer to Phase 3. Hide from nav. |
| group.html | Defer to Phase 3. Hide from nav. |
| siri.html | Fold into "Get Updates" section. Remove from nav. |
| widget.html | Fold into "Get Updates" section. Remove from nav. |
| calendar.html | Fold into "Get Updates" section. Remove from nav (but keep the .ics endpoint obviously). |
| alerts.html | Fold into "Get Updates" section. Remove from nav. |

---

## Open Questions for Implementation

1. **Store persistence mechanism:** localStorage? URL params? Account/email-based? The site currently uses URL params (`?stores=...`) which is shareable but not persistent across visits without localStorage.

2. **"Get Updates" as a page vs modal/drawer:** Should the setup flows for Calendar/Widget/Siri/Alerts be a dedicated page (just not in main nav) or a slide-out drawer / modal accessible from CTAs?

3. **Compare view layout on mobile:** A grid of 4 stores × 3 days is 12 cells. How does this work on a phone screen? Cards that scroll horizontally? A swipe-between-days pattern? This needs design exploration.

4. **Flavor family taxonomy:** What are the actual flavor families/categories used for filtering? (mint, chocolate, caramel, nut, fruit, cheesecake, cookie, etc.) How well-defined is this in the current data?

5. **Quiz asset creation:** Image-based quiz answers need imagery for each option. Is this generated, illustrated, or sourced from somewhere?

6. **Cone asset pipeline:** The pixel art cones need refinement. What's the design direction — more detailed pixel art, or a different illustration style?
