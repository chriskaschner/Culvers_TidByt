# Roadmap

## Phase 12: Feature Development

**Status:** PLANNED
**Goal:** Three independent frontend features: map exclusion chips, quiz image grid, compare localStorage isolation
**Plans:** 3 plans
**Requirements:** [MAP-01, MAP-02, QUIZ-01, CMPR-01]

Plans:
- [ ] 12-01-PLAN.md -- Map exclusion chips with localStorage persistence
- [ ] 12-02-PLAN.md -- Quiz image-based answer grid on mobile
- [ ] 12-03-PLAN.md -- Compare page localStorage isolation

---

## Phase 5: Visual Polish

**Status:** COMPLETE
**Plans:** 3/3 done

| Plan | Name | Status | Summary |
| ---- | ---- | ------ | ------- |
| 01 | Card system + seasonal rarity | Done | Unified .card class system, design tokens at :root, seasonal rarity badge suppression |
| 02 | Hero cone asset pipeline | Done | Generated 40 hero cone PNGs from FLAVOR_PROFILES, SVG fallback for remaining flavors |
| 03 | Design token adoption | Done | Adopted design tokens across 37 CSS rules in Today, Map, Compare, SharedNav, Navigation sections |

### Key Deliverables
- Design tokens defined and consumed across all 4 nav page CSS sections
- 40 hero cone PNGs for profiled flavors with SVG fallback
- Unified .card class system with 12px border-radius
- Seasonal rarity badge suppression (no cadence text for seasonal flavors)
- 37 hardcoded CSS values replaced with var() token references

---

## Phase 4: Supporting Pages + Nav Activation

**Status:** COMPLETE
**Plans:** 4/4 done

| Plan | Name | Status | Summary |
| ---- | ---- | ------ | ------- |
| 01 | Nav consolidation + shared footer | Done | Consolidated nav from 8+ to 4 items, added shared footer with Get Updates / GitHub / Privacy links |
| 02 | Fun.html hub page + quiz mode param | Done | Created fun.html hub routing to quiz modes via ?mode query param, fun-page.js IIFE module |
| 03 | Get Updates page + CTA updates | Done | Created updates.html with inline alert signup, updated Today/Compare CTAs to reference new pages |
| 04 | Service worker + visual verification | Done | Bumped CACHE_VERSION to v14, consolidated footer into shared-nav.js, visual verification approved |

### Key Deliverables
- 4-item nav bar (Today, Compare, Fun, Updates) across all pages
- Shared footer with Get Updates / GitHub / Privacy links via shared-nav.js
- fun.html hub page with quiz mode routing
- updates.html with inline email alert signup
- Service worker v14 caching all new assets
- 16 files modified, 837 insertions across the phase

### Test Coverage Added
- nav-clickthrough.spec.mjs (updated for 4-item nav)
- nav-375px.spec.mjs (mobile nav width tests)
- nav-footer.spec.mjs (footer link verification)
- fun-page.spec.mjs (fun page rendering and navigation)
- updates-page.spec.mjs (updates page rendering and signup form)
- today-hero.spec.mjs (updated CTA references)
