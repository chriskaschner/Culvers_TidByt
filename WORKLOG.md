# Worklog

## Analytics Pipeline (2026-02-22)

### What Was Built

Full Python analytics layer on the 38,842-row backfill dataset (`data/backfill/flavors.sqlite`): 154 WI stores, 42 unique flavors, Jan 2024 – Mar 2026.

**Files created** (all in `analytics/`, branch `analytics-pipeline`):

| File | Purpose |
|------|---------|
| `__init__.py` | Package init |
| `data_loader.py` | SQLite → DataFrame, filters 2 closed-day sentinels, adds dow/month/year |
| `basic_metrics.py` | Frequency, recency, Shannon entropy, Pielou's evenness, surprise scoring, store summary |
| `patterns.py` | Day-of-week chi-squared, recurrence intervals, seasonal heatmap, seasonal flavor detection |
| `markov.py` | Transition matrices P(tomorrow \| today), top transitions, self-transition rates |
| `collaborative.py` | Store×flavor matrix, NMF decomposition (6 factors), K-Means clustering, geographic mapping |
| `predict.py` | FrequencyRecencyModel, MarkovRecencyModel, XGBoostFlavorModel |
| `evaluate.py` | Time-based train/test split (pre-2026/2026+), top-k accuracy, log loss, NDCG |
| `embeddings.py` | SEED_CATALOG (32 flavors), SIMILARITY_GROUPS, TF-IDF/sentence-transformer embeddings |
| `forecast_writer.py` | Weather-style prose generation, batch JSON export, Claude API integration (optional) |
| `batch_forecast.py` | CLI: `uv run python -m analytics.batch_forecast --store mt-horeb` |
| `review.ipynb` | Jupyter notebook covering all phases with charts |
| `tests/test_basic_metrics.py` | 24 tests |
| `tests/test_patterns.py` | 21 tests |
| `tests/test_collaborative.py` | 13 tests |
| `tests/test_predict.py` | 12 tests |
| `tests/test_embeddings.py` | 9 tests |

**79 tests total**, all passing.

### Key Data Findings

- **42 unique flavors** across 154 WI stores (after filtering 2 closed-day sentinels)
- **~43-day recurrence cycle** for popular flavors at a given store
- **Day-of-week bias** is real for some flavors (chi-squared p < 0.05)
- **Seasonal patterns**: How Now Brown Cow = May only (103 appearances, all in May 2024 + May 2025), berry/fruit flavors skew summer, Pumpkin Pecan skews fall
- **Store clusters** (NMF + K-Means) correlate with geography — regional scheduling calendars likely exist
- **Diversity varies dramatically**: Pielou's evenness ranges from ~0.6 (favorites-heavy) to ~0.95 (even rotation)
- **Markov insight**: Self-transition rate is very low (~2-5%) — stores almost never serve the same flavor two days in a row

### Prediction Model Performance

| Model | Top-1 Accuracy | Top-5 Recall | Notes |
|-------|---------------|-------------|-------|
| Random baseline | 2.4% | 12% | 1/42 flavors |
| FrequencyRecencyModel | ~5-8% | ~20-25% | Best simple model. freq=0.7, recency=0.3 |
| MarkovRecencyModel | ~4-6% | ~15-20% | Transition matrix + recency |

**Key design decision**: Recency uses "overdue ratio" (days_since / expected_interval, clipped to 3.0) not raw days-since. Raw days amplified rare flavors. Fill value = 0.0 for never-served flavors.

**Framing**: Top-5 recall is the useful metric. The actual flavor lands in the top 5 predictions ~20-25% of the time (2x random). Probability calibration matters more than exact prediction.

### Bugs Fixed Along the Way

1. **`cluster_geo_summary` KeyError**: Merge column name mismatch (`store_slug` vs `index` vs `slug`). Fixed with dynamic detection.
2. **Prediction worse than random**: `fill_value=1.0` gave never-served flavors maximum score. Changed to 0.0.
3. **Recency degrading accuracy**: Raw days-since amplified rare flavors. Switched to overdue ratio.
4. **`overdue_flavors` empty DataFrame KeyError**: `pd.DataFrame([])` has no columns. Added explicit column guard.
5. **Files lost after squash merge**: Analytics files were never committed on `flavor-backfill`. Recreated from context.

---

## Strategic Product Analysis (2026-02-22)

### The Core Insight

The shift from **reactive** ("what's today's flavor?") to **predictive** ("what's coming this week?") is the product unlock. Nobody else has this data or these predictions. The weather-forecast framing makes it fun and shareable.

### Priority Stack Rank

| Priority | Feature | Impact | Effort | Status |
|----------|---------|--------|--------|--------|
| **P0** | Forecast-powered weekly email | High | Low | TODO — half-built. `sendWeeklyDigestEmail()` exists, needs forecast data merged in. Weather-style prose from `forecast_writer.py`. |
| **P1** | Per-flavor pages (`/flavor/{name}`) | High | Medium | TODO — SEO play. Each flavor = landing page. Shows: where served today, frequency, seasonal pattern, overdue stores, similar flavors. |
| **P1** | Forecast card on map | High | Low | TODO — one `fetch('/api/v1/forecast/{slug}')` + UI panel when store clicked. Top 3 predictions + overdue list. |
| **P2** | "What's Scooping" daily homepage | High | Medium | TODO — replace static index.html with dynamic daily view. Today's flavors, surprise scores ("most unexpected today"), overdue watch. Daily pull reason. |
| **P2** | Flavor rarity scores in alerts | Medium | Low | TODO — add surprise score (`-log2(P)`) as "Common / Uncommon / Rare!" badge in daily alert emails. Collection/discovery mechanic. |
| **P3** | Shareable forecast OG cards | Medium | Medium | TODO — `/v1/og/forecast/{slug}.svg` showing top 3 predictions. Social sharing for "what's coming to my store." |
| **P3** | Public analytics dashboard | Medium | Medium | TODO — portfolio piece. Seasonal heatmaps, store diversity leaderboard, flavor recurrence clocks, cluster map. |
| **P4** | Flavor Spotter (crowdsourced confirmation) | Very High | High | TODO — users confirm predictions ("I'm here, it's Turtle"). Closes feedback loop, creates network effect. Needs auth/moderation. |
| **P5** | Pairwise flavor voting | Low | High | TODO — multiplayer coordination problem, no clear MVP. Deprioritized. |

### Key Product Decisions

1. **Don't ship XGBoost to production.** FrequencyRecency is simpler, nearly as accurate, runs in ms. Keep XGBoost in the notebook for portfolio.
2. **Forecast email is P0** because it goes to existing subscribers. Zero acquisition cost, highest signal of product value.
3. **Per-flavor pages are the SEO engine.** "Culver's Turtle flavor of the day" is a real search query. Nobody else has historical frequency, seasonal patterns, or overdue detection for individual flavors.
4. **Surprise scores are the engagement hook.** "Rare flavor spotted!" is inherently shareable. Pokémon Go energy for custard.
5. **Don't build analytics dashboard before core forecast features ship.** Dashboard is a vanity metric — impressive but doesn't solve user problems.

### Feature Detail: Forecast-Powered Weekly Email (P0)

Current weekly digest shows a 7-day table of scheduled flavors. Enhance with:
- Prediction probabilities for unscheduled days ("Strong chance of Turtle, 12%")
- Overdue flavor alerts ("Chocolate Covered Strawberry: 45 days since last serving, avg gap is 30")
- Weather-style prose from `format_forecast_template()`
- "Prediction accuracy this week: 3/5 correct" (retroactive scoring)

### Feature Detail: Per-Flavor Pages (P1)

Route: `/flavor/{normalized-name}` (e.g., `/flavor/turtle`)

Content:
- **Hero**: Flavor name, description, seasonal badge ("Peak: May-June")
- **Where today**: Stores serving it today (from existing nearby-flavors data)
- **Stats**: Total appearances, number of stores, avg recurrence interval
- **Seasonal chart**: Month-by-month frequency sparkline
- **Overdue at**: Stores where it's overdue vs historical avg gap
- **Similar flavors**: From embedding similarity (Turtle → Caramel Turtle, Turtle Dove, Turtle Cheesecake)
- **Subscribe**: "Get alerted when this flavor appears near you"

### Feature Detail: Flavor Rarity Score (P2)

Every flavor serving gets a score: `-log2(P(flavor|store))` bits.

| Score | Label | Frequency |
|-------|-------|-----------|
| < 2.0 | Common | Top ~25% of servings |
| 2.0–3.5 | Uncommon | Middle ~50% |
| 3.5–5.0 | Rare | Bottom ~20% |
| > 5.0 | Ultra Rare | Bottom ~5% |

Display as badges in emails, map popups, and flavor pages. Creates collection/discovery mechanic.

---

## Completed Items (Historical)

### Infrastructure
- [x] Daily snapshot persistence — append-only triple-write in KV
- [x] D1 snapshots + metrics — dual-write KV+D1, metrics endpoints
- [x] API v1 versioning + Bearer auth
- [x] Per-slug fetch budget (3/day) + global circuit breaker (200/day)
- [x] DTSTAMP determinism in ICS
- [x] Kill dual scrapers — Python calls Worker API
- [x] Multi-brand config in config.yaml
- [x] Geocode all 1,012 stores with lat/lng

### Product
- [x] Flavor alert email subscriptions — double opt-in, Resend, cron, security
- [x] Weekly digest emails with star badges and frequency toggle
- [x] Fun rotating quips in alert emails
- [x] Voice assistant integration (Siri) — `/api/v1/today` with `spoken` field
- [x] Social OG cards — dynamic SVG at `/v1/og/{slug}/{date}.svg`
- [x] OG meta tags on all 3 HTML pages
- [x] README with SaaS positioning
- [x] Flavor intelligence analytics pipeline (79 Python tests)

### Map & UI
- [x] Unified distance-sorted store results
- [x] Brand flavor matching on map
- [x] Brand chip filter UI
- [x] Custom flavor autocomplete dropdown
- [x] Map pan/zoom dynamic search with reverse geocoding
- [x] MKE custard hipster easter egg quips
- [x] Strip "culvers" from non-brand-specific code
- [x] custard.chriskaschner.com subdomain + HTTPS

### Tidbyt
- [x] Brand-agnostic theming
- [x] Community app submission
