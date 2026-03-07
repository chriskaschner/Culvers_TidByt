# Feature Landscape

**Domain:** Food discovery / daily flavor tracking / store comparison
**Researched:** 2026-03-07

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Instant answer on load | Every food app geolocates and shows results immediately. A blank page or "pick your store first" flow kills bounce rate. DoorDash, Yelp, and Untappd all start with location-aware results. | Med | Geolocation + IP fallback + confirmation prompt. Already partially built (IP-based). Browser Geolocation API with permission prompt is the missing piece. |
| Single-store today view above fold | UC2 core. Culver's own site does this. Any food app shows "what's here now" without scrolling. Must include: flavor name, visual (cone), short description. | Low | Radical simplification of existing index.html. Cut, don't add. The hard part is restraint. |
| Multi-store comparison grid | UC1 core. The "in the car" decision. Hotels.com, Google Flights, and grocery comparison apps all use store-x-attribute grids. Users comparing 2-4 options across a few dimensions is a solved interaction pattern. | High | New page. The grid layout on mobile is the main design challenge -- see Architecture notes on responsive patterns. |
| Rarity/scarcity indicators | Scarcity drives action in food apps. DoorDash "Most Liked," Untappd badge rarity, and limited-edition food marketing all prove that "this is rare, don't miss it" is the #1 nudge that converts browsing into driving. The existing rarity dataset is a genuine differentiator. | Low | Data already exists in the API. Implementation is a visual tag/badge on cards and grid cells. Keep it contextual -- a tag, not a dashboard. |
| Flavor family exclusion filters | Dietary/allergy filtering is a safety feature, not a nice-to-have. Fig, Picknic, and every food delivery app treat allergen filters as top-tier UX. "No nuts" must be prominent and reliable. | Med | Toggle chips with exclude semantics. Needs clear visual state (active = excluded). Must work on both Map and Compare views. Chip row should be horizontally scrollable on mobile. |
| Mobile-optimized decision flow | 52%+ of web traffic is mobile. The "in the car" scenario (UC1) is the primary use case. NNGroup research confirms: if comparison tables don't work at 375px, users leave. | Med | Pervasive constraint, not a discrete feature. Every view needs 375px testing. Compare grid is the hardest -- sticky left column + horizontal scroll for days is the proven pattern. |
| Clear, functional navigation | Users can't navigate "Forecast" vs "Radar" vs "Scoop." Every food app uses literal labels. NNGroup and Baymard research consistently shows functional nav labels outperform clever/branded ones. | Low | 4 items: Today, Compare, Map, Fun. Weather metaphor stays in branding, not wayfinding. |
| Persistent store selection | "Set it and forget it" store preference. Every store locator (Starbucks, Target, Walmart) implements "My Store" that persists. Having to re-select stores on every page is a dealbreaker. | Low | Already built (localStorage + URL params). Gap is UX: needs compact header indicator with "change" link instead of full picker on every page. |
| Week-ahead view | Culver's own site shows the monthly calendar. Users planning weekend trips need 2-3 days ahead. This is expected for any "what's coming" food tool. | Low | Already built. The change is making it a collapsed `<details>` section, not the default view. Progressive disclosure -- answer today first, then reveal the week. |
| Directions/navigation link | Every restaurant/food discovery app links to maps for directions. "I've decided, now take me there." Must be one tap from any store mention. | Low | Simple link to Google Maps or Apple Maps with store coordinates. Must work from Compare cells, Map markers, and Today page. |

## Differentiators

Features that set the product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Rarity scoring with historical depth | No competitor has 10+ years of flavor observation data across 971+ stores. "Appears every 118 days at your store" is genuinely unique intelligence. Untappd has beer ratings; this has flavor rarity. The scarcity principle (FOMO, urgency) is proven to drive engagement in food contexts. | Low | Data exists. Feature is about surfacing it contextually -- rarity tags on grid cells, "don't miss it" nudges, seasonal callouts. Not a separate page. |
| Quiz-to-available-flavor pipeline | Culver's own quizzes recommend flavors that may not be within 100 miles. This site maps personality archetype to actually-available-nearby flavors. That's the differentiator: entertainment that ends with an actionable result. | Low | Engine exists with 6 modes. UX overhaul needed: visual mode cards instead of dropdown, image-based answers on mobile. Logic stays the same. |
| Contextual flavor signals | "Devil's Food Cake peaks on Sundays" shown when that flavor appears on a Sunday. Day-of-week patterns, seasonality, streaks -- woven into cards as enrichment, not siloed into an analytics page. Transforms raw data into "oh, interesting" moments that build trust and engagement. | Low | Data and API exist. Implementation is conditional rendering of signal text on flavor cards. One signal per card maximum to avoid clutter. |
| Cross-brand coverage | 1,000+ stores across Culver's + 5 Milwaukee independents. No other tool aggregates across brands. For Milwaukee-area users comparing Kopp's vs Culver's, this is the only option. | N/A | Already built. Worth emphasizing in branding. Milwaukee Easter eggs reinforce the local personality. |
| Exclusion-based filtering (not inclusion) | Most food apps filter by "show me X." This product filters by "hide what I can't eat" -- a psychologically different frame. Research from Fig app shows "show what you CAN eat" framing is more empowering. Exclusion chips that remove bad options and show what remains reduce decision fatigue. | Med | Deliberate UX choice. Chips should read "No Nuts," "No Mint" etc. When active, stores with matching flavors disappear. What remains is the answer. |
| Multi-channel delivery of same atomic data | Calendar (.ics), widget (Scriptable), Siri, email alerts, Tidbyt display, web -- all carrying the same payload. Users pick their channel and the data meets them where they are. No competitor offers this breadth of delivery surfaces for daily food specials. | Low | All channels exist. The feature is consolidating their setup into one "Get Updates" flow instead of 4 separate nav pages. Contextual CTA: "Want this every day?" |
| Group vote with minimize-misery algorithm | Family can't decide? QR-based group voting where everyone votes yes/meh/no and the algorithm minimizes dissatisfaction rather than maximizing agreement. Unique in the food discovery space. | N/A | Already built. Low priority for restructure but should be accessible from Fun page. |
| Flavor Fronts visualization | National weather-map of flavor "fronts" is pure delight. "A storm of mint blowing in from the west." Shareable, memorable, and leverages the unique national-scale dataset. No utility, all personality. | N/A | Already built. Phase 3 delight feature. Accessible from Fun page, no nav link. |
| Mad Libs flavor discovery | Interactive word-fill game that generates a flavor story. 3 pre-populated choices + 1 write-in per blank. Fun for kids, results map to real flavors. Not just a quiz -- it's generative entertainment. | Med | Engine exists. UX gap: needs word selection UI (tap-to-choose cards, not free-text for pre-populated options). |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Prediction/accuracy dashboard | Data is confirmed ~30 days out. Prediction solves a non-problem. Accuracy dashboards add complexity and undermine trust (implying the data might be wrong). | Use certainty tiers (Confirmed/Watch/Estimated/None) as quiet metadata. Never show "85% confidence" -- show "Confirmed" or don't show anything. |
| User accounts / authentication | localStorage is sufficient for store preferences. Accounts add friction, require password management, and demand GDPR compliance infrastructure. The only identity capture is email for alerts (already working). | Keep localStorage for preferences, email for alerts. No login wall. |
| Full analytics/stats page | Rarity scores, day-of-week patterns, and seasonality are powerful -- but only as contextual enrichment on cards. A dedicated analytics dashboard turns a "where should we go?" product into a "look at this data" product. The creator explicitly wants enrichment, not dashboards. | Weave signals into existing views: rarity tag on grid cells, pattern note in expanded cards, seasonal callout when relevant. One signal per card. |
| AI-powered personalized recommendations | Training data shows food apps trending toward ML-driven suggestions. But this product has 176 flavors, not 10,000 restaurants. The dataset is small enough that rarity scores and manual preference (email alerts for favorites) are more trustworthy than a recommendation engine. | Rarity scoring IS the recommendation: "this is rare at your store, don't miss it." Flavor alerts let users define their own preferences explicitly. |
| Social features / sharing / reviews | Untappd's social check-in model works for beer (thousands of unique products, exploration-driven). Frozen custard has ~176 flavors rotating on a schedule -- there's nothing to "discover" socially. User reviews of well-known flavors add noise, not signal. | The data IS the social proof. "Turtle leads this store's history (111 of 1,475 observations)" is more useful than "4.2 stars from 23 reviews." |
| Push notifications | Require a service worker registration flow, browser permission prompt (users increasingly decline), and ongoing engagement management. Email alerts already serve this need. Push adds complexity for marginal gain on a static site. | Email alerts (daily/weekly digest) and calendar subscriptions. Both are user-initiated, no permission fatigue. |
| Loyalty/points/rewards gamification | DoorDash and Starbucks use points because they control the transaction. This site has no transaction -- it's an information tool. Points without purchases are meaningless tokens. | The gamification is quizzes, Mad Libs, and the inherent "collector" psychology of tracking rare flavors. Badges/streaks are a Phase 4+ consideration if usage data justifies it. |
| Distance radius slider on map | Sounds useful, breaks in practice. Users don't think in miles -- they think in "stores I'd actually drive to." A slider adds a control that most users never touch and creates empty-state problems when set too tight. | Default to showing stores within a reasonable radius based on density. Let the map's natural zoom-and-pan be the distance control. |
| Hamburger/overflow menu | 4 nav items fit comfortably at 375px. A hamburger menu hides navigation behind a tap, reducing discoverability. NNGroup research consistently shows visible navigation outperforms hidden navigation. | 4 visible tab-style nav items: Today, Compare, Map, Fun. "Get Updates" in footer or contextual CTA. |
| Dark mode (as a launch feature) | Adds CSS complexity, requires testing every view in both modes, and delays launch. | Ship light mode. Add dark mode post-launch if user feedback warrants it. Respect `prefers-color-scheme` for basic comfort but don't build a toggle. |

## Feature Dependencies

```
Persistent Store Selection (T1.1)
  |
  +---> Today Page Simplification (T1.2)
  |       |
  |       +---> Nav Consolidation (T1.4)
  |       |       |
  |       |       +---> Get Updates Page (T2.1)
  |       |       |       |
  |       |       |       +---> Old Page Redirects (T3.1)
  |       |       |
  |       |       +---> Fun Page UX (T2.3)
  |       |               |
  |       |               +---> Fronts as Delight (T3.3)
  |       |
  |       +---> Visual Coherence (T3.2)
  |
  +---> Compare Page (T1.3)
          |
          +---> Nav Consolidation (T1.4)

Map Exclusion Filter (T2.2) -- independent, no blockers

Rarity Tags -- no dependency, can be added to any view at any time
Flavor Signals -- no dependency, conditional rendering on any card
Directions Links -- no dependency, simple href on any store reference
```

**Key insight:** Store persistence (T1.1) unblocks everything. It must ship first because every other view assumes "we know which stores you care about."

## MVP Recommendation

### Must ship (Phase 1 -- the product doesn't work without these):

1. **Persistent store indicator** -- Compact header display, geolocation on first visit, "change" link. Unblocks everything.
2. **Today page radical simplification** -- Cone + flavor + description above fold. Week-ahead collapsed. One signal if relevant. No junk drawer.
3. **Compare page (store x day grid)** -- The highest-value new feature. 2-4 stores x 2-3 days. Rarity highlights. Cell expansion for details. Mobile-first.
4. **Nav consolidation (4 items)** -- Today, Compare, Map, Fun. Clear labels. Weather metaphor in branding only.
5. **Rarity tags on grid cells and cards** -- Data exists. Visual implementation only. The #1 nudge that converts browsing to driving.
6. **Flavor family exclusion filter on Compare** -- Toggle chips. "No Nuts" / "No Mint." Serves UC3 from within UC1's view.

### Should ship (Phase 2 -- polish and channels):

7. **Get Updates consolidation** -- One page for Calendar/Widget/Siri/Alerts setup. Contextual CTAs from Today and Compare.
8. **Map exclusion filter** -- Same chip pattern as Compare, applied to map markers. Independent work stream.
9. **Fun page quiz UX** -- Visual mode cards, image-based answers on mobile, Mad Libs word selection UI. Engine unchanged.
10. **Contextual flavor signals** -- "Peaks on Sundays" / "In-season now" shown inline on cards when relevant.

### Defer (Phase 3 -- delight and cleanup):

11. **Old page redirects** -- meta refresh redirects preserving query params. Requires all new pages to exist first.
12. **Visual coherence audit** -- Consistent cone rendering, unified card system. Simplified Today page reduces scope.
13. **Fronts as delight feature** -- Accessible from Fun page, no nav link. Already built.
14. **Group Vote accessibility** -- Link from Fun page. Already built.

### Explicitly not building:

- Prediction/accuracy UI
- User accounts
- Analytics dashboard
- AI recommendations
- Social features
- Push notifications
- Loyalty program
- Dark mode toggle

## Comparison Grid UX: Research-Backed Patterns

The Compare page is the highest-complexity new build. Research findings specific to this feature:

**Mobile layout (375px):** NNGroup recommends locking the leftmost column (store names) and allowing horizontal scroll for additional columns (days). Only 2 columns of complex content fit legibly on narrow mobile screens, but date headers with flavor names beneath can be more compact. The "lead with 1-2 fields that drive action, hide low-value fields until a tap reveals them" principle applies directly.

**Cell expansion:** Samsung's accordion pattern for comparison table categories is the closest analog. Tap a cell to expand inline: full flavor description, directions link, historical pattern note. This avoids navigating away from the grid.

**Scroll indicators:** Arrows or gradient fade at the edge of the scrollable area signal that more content exists. NNGroup found indicators within the data table itself (not at page top) are most effective.

**Filter chips placement:** Horizontally scrollable chip row above the grid. Chips stay in original position after selection (don't reorder). Active state should be visually distinct (filled vs outlined). 32px minimum height, 12px horizontal padding.

**Card alternative for smallest screens:** If the grid feels too cramped at 375px, the fallback is swipeable day-cards where each card shows all stores for one day. The user swipes between Today / Tomorrow / Day After. This is less scannable than a grid but avoids the "tiny cells" problem.

## Progressive Disclosure Patterns

Research confirms the product brief's instinct. The recommended layering for this product:

**Level 1 (visible on load):** The answer. Today's flavor, cone image, flavor name, rarity tag if rare. Zero interaction required.

**Level 2 (one tap/scroll):** The context. Week-ahead (collapsed `<details>`), multi-store glance row, one flavor signal if relevant.

**Level 3 (deliberate navigation):** The comparison. Compare page grid, map discovery, exclusion filters.

**Level 4 (contextual prompt):** The automation. "Want this every day?" CTA leading to Get Updates setup flows.

**Level 5 (entertainment):** The fun. Quizzes, Mad Libs, Fronts, Group Vote.

This matches the NNGroup principle: "disclose everything users frequently need up front, so they only progress to secondary display on rare occasions."

## Gamification in Context

Research shows food app gamification works when tied to actual behavior (Untappd badges for trying new beers, DoorDash missions for ordering). For this product:

**What works:** Quizzes with real outcomes (personality -> available flavor), rarity as implicit gamification (collecting/tracking rare flavors), Mad Libs as family entertainment.

**What doesn't fit:** Points, streaks, leaderboards, badges. Without a transaction or daily active behavior to reward, these are empty mechanics. The product is consulted when the family wants custard, not daily.

**The rarity dataset IS the gamification.** "Only appears every 400 days" triggers the same psychology as rare collectibles -- FOMO, urgency, status ("I had Turtle on the one day it showed up"). Surfacing this data contextually is more powerful than bolted-on game mechanics.

## Sources

- [NNGroup - Mobile Tables: Comparisons and Other Data Tables](https://www.nngroup.com/articles/mobile-tables/) -- HIGH confidence, authoritative UX research
- [NNGroup - Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) -- HIGH confidence
- [LogRocket - How to design feature comparison tables](https://blog.logrocket.com/ux-design/ui-design-comparison-features/) -- MEDIUM confidence
- [BricxLabs - 15 Filter UI Patterns 2025](https://bricxlabs.com/blogs/universal-search-and-filters-ui) -- MEDIUM confidence, chip design specs
- [Baymard - 3 High-Level UX Takeaways from Food Delivery/Takeout Sites](https://baymard.com/blog/food-delivery-takeout-launch) -- HIGH confidence
- [Untappd - Beer Discovery Features](https://untappd.com) -- MEDIUM confidence, closest analog product (daily rotating taps, location-based discovery, rarity/badges)
- [Storemapper - 10 Store Locator Best Practices](https://www.storemapper.com/blog/10-store-locator-best-practices-to-help-people-find-your-business) -- MEDIUM confidence
- [Map UI Patterns - Store Locator](https://mapuipatterns.com/store-locator/) -- MEDIUM confidence
- [Goama - Using Gamification in Food Apps](https://goama.com/using-gamificaiton-in-food-apps/) -- LOW confidence, marketing-heavy source
- [Uncommon Food - The Allure of Limited-Edition Food Releases](https://www.uncommonfood.com/the-allure-of-limited-edition-food-releases/) -- MEDIUM confidence, scarcity psychology in food
- [Pencil & Paper - Mobile Filter UX Design Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-mobile-filters) -- MEDIUM confidence
- [UX Matters - Designing Mobile Tables](https://www.uxmatters.com/mt/archives/2020/07/designing-mobile-tables.php) -- HIGH confidence
