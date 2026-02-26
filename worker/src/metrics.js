/**
 * Metrics endpoints — queryable flavor intelligence from D1 snapshots.
 *
 * Three views:
 *   GET /api/v1/metrics/intelligence      — historical metrics seed summary
 *   GET /api/v1/metrics/flavor/{normalized}  — frequency, recency, store count
 *   GET /api/v1/metrics/store/{slug}         — diversity, flavor history, streaks
 *   GET /api/v1/metrics/trending             — most/least common this week vs historical
 */

import { TRIVIA_METRICS_SEED } from './trivia-metrics-seed.js';
import { STORE_INDEX } from './store-index.js';
import { WI_METRO_MAP } from './leaderboard.js';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
let cachedFlavorRank = null;

function normalizeFlavorKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u00ae\u2122\u00a9]/g, '')
    .replace(/[\u2018\u2019']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getSourceWindow(seed) {
  return {
    start: seed?.dataset_summary?.min_date || null,
    end: seed?.dataset_summary?.max_date || null,
  };
}

function getFlavorRank(seed) {
  const cacheKey = `${seed?.generated_at || 'na'}:${seed?.as_of || 'na'}`;
  if (cachedFlavorRank && cachedFlavorRank.key === cacheKey) return cachedFlavorRank.value;

  const flavorLookup = seed?.planner_features?.flavor_lookup && typeof seed.planner_features.flavor_lookup === 'object'
    ? seed.planner_features.flavor_lookup
    : {};
  const rows = Object.entries(flavorLookup)
    .map(([normalized, row]) => ({ normalized, appearances: Number(row?.appearances || 0) }))
    .filter((row) => row.normalized && row.appearances > 0)
    .sort((a, b) => b.appearances - a.appearances);

  const byNormalized = {};
  for (let i = 0; i < rows.length; i++) {
    byNormalized[rows[i].normalized] = i + 1;
  }

  const value = { byNormalized, total: rows.length };
  cachedFlavorRank = { key: cacheKey, value };
  return value;
}

// ---------------------------------------------------------------------------
// Flavor hierarchy helpers
// ---------------------------------------------------------------------------

/**
 * Compute appearances + avg_gap_days from a sorted array of date strings.
 * Dates must be sorted ASC; duplicates are allowed (collapsed to same-day).
 */
function computeGapStats(dates) {
  const deduped = [...new Set(dates)].sort();
  const appearances = deduped.length;
  if (appearances < 2) return { appearances, avg_gap_days: null };
  let totalGap = 0;
  for (let i = 1; i < deduped.length; i++) {
    totalGap += (new Date(deduped[i]) - new Date(deduped[i - 1])) / 86400000;
  }
  return { appearances, avg_gap_days: Math.round(totalGap / (deduped.length - 1)) };
}

/**
 * Query all appearance dates for a flavor across a set of slugs.
 * Batches into groups of 98 slugs to stay under D1's 100-bind limit.
 */
async function queryDatesForSlugs(db, slugs, normalizedFlavor) {
  if (!db || !slugs.length) return [];
  const SLUG_BATCH = 98; // leave 2 slots: 1 for flavor, 1 safety margin
  const allDates = [];
  for (let i = 0; i < slugs.length; i += SLUG_BATCH) {
    const batch = slugs.slice(i, i + SLUG_BATCH);
    const placeholders = batch.map(() => '?').join(',');
    try {
      const result = await db.prepare(
        `SELECT date FROM snapshots WHERE slug IN (${placeholders}) AND normalized_flavor = ? ORDER BY date ASC`,
      ).bind(...batch, normalizedFlavor).all();
      for (const row of (result?.results || [])) {
        allDates.push(row.date);
      }
    } catch {
      // Partial failure: continue with what we have
    }
  }
  return allDates;
}

/**
 * GET /api/v1/metrics/flavor-hierarchy?flavor=X&slug=Y
 *
 * Returns avg_gap_days + appearances at 4 scopes (store, metro, state, national)
 * for a flavor+store pair. effective_scope = first scope with >= 30 appearances.
 *
 * Scopes:
 *   store    — appearances at this specific store (D1)
 *   metro    — appearances across WI metro area (D1; WI stores only)
 *   state    — appearances across all stores in the same state (D1)
 *   national — from TRIVIA_METRICS_SEED planner_features.flavor_lookup
 */
async function handleFlavorHierarchyMetrics(rawFlavor, rawSlug, env, corsHeaders) {
  const flavor = String(rawFlavor || '').trim();
  const slug = String(rawSlug || '').trim().toLowerCase();
  const normalizedFlavor = normalizeFlavorKey(flavor);

  if (!flavor || !slug || !normalizedFlavor) {
    return Response.json(
      { error: 'flavor and slug query params are required' },
      { status: 400, headers: corsHeaders },
    );
  }

  // --- Store entry lookup ---
  const storeEntry = STORE_INDEX.find((s) => s.slug === slug);
  const storeCity = (storeEntry?.city || '').toLowerCase().trim();
  const storeState = storeEntry?.state || null;

  const db = env.DB || null;
  const scopes = {};

  // --- Store scope ---
  {
    const dates = db ? await queryDatesForSlugs(db, [slug], normalizedFlavor) : [];
    const stats = computeGapStats(dates);
    scopes.store = { appearances: stats.appearances, avg_gap_days: stats.avg_gap_days };
  }

  // --- Metro scope (WI only) ---
  const metro = storeCity ? (WI_METRO_MAP[storeCity] || null) : null;
  if (metro && metro !== 'other') {
    const metroSlugs = STORE_INDEX
      .filter((s) => WI_METRO_MAP[(s.city || '').toLowerCase().trim()] === metro)
      .map((s) => s.slug);
    const dates = db ? await queryDatesForSlugs(db, metroSlugs, normalizedFlavor) : [];
    const stats = computeGapStats(dates);
    scopes.metro = { appearances: stats.appearances, avg_gap_days: stats.avg_gap_days, metro };
  } else {
    scopes.metro = null;
  }

  // --- State scope ---
  if (storeState) {
    const stateSlugs = STORE_INDEX
      .filter((s) => s.state === storeState)
      .map((s) => s.slug);
    const dates = db ? await queryDatesForSlugs(db, stateSlugs, normalizedFlavor) : [];
    const stats = computeGapStats(dates);
    scopes.state = { appearances: stats.appearances, avg_gap_days: stats.avg_gap_days, state: storeState };
  } else {
    scopes.state = null;
  }

  // --- National scope (from seed; no D1 query) ---
  {
    const seed = TRIVIA_METRICS_SEED || {};
    const lookup = seed?.planner_features?.flavor_lookup || {};
    const seedRow = lookup[normalizedFlavor] || null;
    if (seedRow) {
      const appearances = Number(seedRow.appearances || 0);
      const storeCount = Number(seedRow.store_count || 1);
      const summary = seed.dataset_summary || {};
      let avg_gap_days = null;
      if (appearances > 0 && storeCount > 0 && summary.min_date && summary.max_date) {
        const spanDays = (new Date(summary.max_date) - new Date(summary.min_date)) / 86400000;
        // Avg appearances per store = appearances / store_count
        // Avg gap at a typical store = span_days / (appearances / store_count)
        const appsPerStore = appearances / storeCount;
        if (appsPerStore > 0) {
          avg_gap_days = Math.round(spanDays / appsPerStore);
        }
      }
      scopes.national = { appearances, avg_gap_days };
    } else {
      scopes.national = null;
    }
  }

  // --- effective_scope: first scope with >= 30 appearances ---
  const SCOPE_ORDER = ['store', 'metro', 'state', 'national'];
  const MIN_APPEARANCES = 30;
  let effectiveScope = 'national';
  for (const scope of SCOPE_ORDER) {
    const s = scopes[scope];
    if (s && Number(s.appearances || 0) >= MIN_APPEARANCES) {
      effectiveScope = scope;
      break;
    }
  }

  return Response.json(
    { flavor, slug, scopes, effective_scope: effectiveScope },
    { headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' } },
  );
}

/**
 * Route a metrics request to the appropriate handler.
 * @param {string} path - Canonical path (already normalized)
 * @param {Object} env - Worker env bindings
 * @param {Object} corsHeaders
 * @param {URL|null} url - Full request URL (for query param access)
 * @returns {Promise<Response|null>}
 */
export async function handleMetricsRoute(path, env, corsHeaders, url = null) {
  // /api/metrics/intelligence
  // Served from generated metrics seed; does not require D1.
  if (path === '/api/metrics/intelligence') {
    return handleIntelligenceMetrics(corsHeaders);
  }

  // /api/metrics/flavor-hierarchy?flavor=X&slug=Y
  if (path === '/api/metrics/flavor-hierarchy') {
    return handleFlavorHierarchyMetrics(
      url?.searchParams?.get('flavor') || '',
      url?.searchParams?.get('slug') || '',
      env,
      corsHeaders,
    );
  }

  const contextFlavorMatch = path.match(/^\/api\/metrics\/context\/flavor\/(.+)$/);
  if (contextFlavorMatch) {
    return handleFlavorContextMetrics(decodeURIComponent(contextFlavorMatch[1]), corsHeaders);
  }

  const contextStoreMatch = path.match(/^\/api\/metrics\/context\/store\/(.+)$/);
  if (contextStoreMatch) {
    return handleStoreContextMetrics(decodeURIComponent(contextStoreMatch[1]), corsHeaders, env.DB);
  }

  const db = env.DB;
  if (!db) {
    return Response.json(
      { error: 'Metrics not available — D1 database not configured' },
      { status: 503, headers: corsHeaders },
    );
  }

  // /api/metrics/flavor/{normalized}
  const flavorMatch = path.match(/^\/api\/metrics\/flavor\/(.+)$/);
  if (flavorMatch) {
    return handleFlavorMetrics(db, decodeURIComponent(flavorMatch[1]), corsHeaders);
  }

  // /api/metrics/store/{slug}
  const storeMatch = path.match(/^\/api\/metrics\/store\/(.+)$/);
  if (storeMatch) {
    return handleStoreMetrics(db, decodeURIComponent(storeMatch[1]), corsHeaders);
  }

  // /api/metrics/trending
  if (path === '/api/metrics/trending') {
    return handleTrending(db, corsHeaders);
  }

  // /api/metrics/accuracy/{slug}
  const accuracyStoreMatch = path.match(/^\/api\/metrics\/accuracy\/(.+)$/);
  if (accuracyStoreMatch) {
    return handleAccuracyByStore(db, decodeURIComponent(accuracyStoreMatch[1]), corsHeaders);
  }

  // /api/metrics/accuracy
  if (path === '/api/metrics/accuracy') {
    return handleAccuracy(db, corsHeaders);
  }

  // /api/metrics/coverage
  if (path === '/api/metrics/coverage') {
    return handleCoverage(db, corsHeaders);
  }

  return null;
}

function trimList(list, limit) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, limit);
}

function handleIntelligenceMetrics(corsHeaders) {
  const seed = TRIVIA_METRICS_SEED || {};
  const topFlavors = trimList(seed.top_flavors, 10);
  const topStores = trimList(seed.top_stores, 10);
  const seasonalSpotlights = trimList(seed.seasonal_spotlights, 10);
  const topStates = trimList(seed?.coverage?.top_state_coverage, 12);
  const hnbc = seed?.hnbc || {};
  const hnbcByMonth = hnbc.by_month && typeof hnbc.by_month === 'object' ? hnbc.by_month : {};
  const hnbcPeakMonth = Object.entries(hnbcByMonth)
    .map(([month, count]) => ({ month: Number(month), count: Number(count) }))
    .filter((row) => Number.isFinite(row.month) && row.month >= 1 && row.month <= 12 && Number.isFinite(row.count))
    .sort((a, b) => b.count - a.count)[0] || null;

  return Response.json({
    contract_version: Number(seed.version || 1),
    source: 'trivia_metrics_seed',
    generated_at: seed.generated_at || null,
    as_of: seed.as_of || null,
    dataset_summary: seed.dataset_summary || null,
    coverage: {
      manifest_total: Number(seed?.coverage?.manifest_total || 0),
      current_covered: Number(seed?.coverage?.current_covered || 0),
      wayback_covered: Number(seed?.coverage?.wayback_covered || 0),
      overall_covered: Number(seed?.coverage?.overall_covered || 0),
      missing_overall_count: Number(seed?.coverage?.missing_overall_count || 0),
      pending_non_wi_count: Number(seed?.coverage?.pending_non_wi_count || 0),
      top_state_coverage: topStates,
    },
    highlights: {
      top_flavors: topFlavors,
      top_stores: topStores,
      seasonal_spotlights: seasonalSpotlights,
      how_now_brown_cow: {
        count: Number(hnbc.count || 0),
        peak_month: hnbcPeakMonth ? hnbcPeakMonth.month : null,
        peak_month_count: hnbcPeakMonth ? hnbcPeakMonth.count : null,
        by_month: hnbcByMonth,
        by_year: hnbc.by_year && typeof hnbc.by_year === 'object' ? hnbc.by_year : {},
      },
    },
  }, {
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
  });
}

function handleFlavorContextMetrics(inputFlavor, corsHeaders) {
  const seed = TRIVIA_METRICS_SEED || {};
  const normalized = normalizeFlavorKey(inputFlavor);
  const lookup = seed?.planner_features?.flavor_lookup && typeof seed.planner_features.flavor_lookup === 'object'
    ? seed.planner_features.flavor_lookup
    : {};
  const rank = getFlavorRank(seed);
  const row = normalized ? lookup[normalized] : null;
  const peakMonth = Number(row?.peak_month || 0);
  const defaultMonthName = peakMonth >= 1 && peakMonth <= 12 ? MONTH_NAMES[peakMonth - 1] : null;

  return Response.json({
    source: 'trivia_metrics_seed',
    as_of: seed?.as_of || null,
    source_window: getSourceWindow(seed),
    normalized_flavor: normalized || null,
    found: !!row,
    rank: row ? (rank.byNormalized[normalized] || null) : null,
    total_ranked_flavors: rank.total,
    flavor: row ? {
      title: row.title || inputFlavor,
      appearances: Number(row.appearances || 0),
      store_count: Number(row.store_count || 0),
      peak_month: peakMonth || null,
      peak_month_name: row.peak_month_name || defaultMonthName,
      seasonal_concentration: Number(row.seasonal_concentration || 0),
    } : null,
  }, {
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * Compute which flavor a store serves disproportionately vs. the national average.
 * Returns the top row if specialty_ratio >= 1.2, else null.
 */
async function computeStoreSpecialtyFromD1(slug, db) {
  if (!db || !slug) return null;
  try {
    const result = await db.prepare(
      `WITH store_counts AS (
        SELECT normalized_flavor, MAX(flavor) AS display_flavor, COUNT(*) AS cnt
        FROM snapshots
        WHERE slug = ? AND date >= date('now', '-365 days')
        GROUP BY normalized_flavor
        HAVING cnt >= 3
      ),
      national_counts AS (
        SELECT normalized_flavor, COUNT(*) AS cnt
        FROM snapshots
        WHERE date >= date('now', '-365 days')
        GROUP BY normalized_flavor
      ),
      store_total AS (SELECT COUNT(*) AS n FROM snapshots WHERE slug = ? AND date >= date('now', '-365 days')),
      national_total AS (SELECT COUNT(*) AS n FROM snapshots WHERE date >= date('now', '-365 days'))
      SELECT
        s.normalized_flavor, s.display_flavor, s.cnt AS store_count,
        n.cnt AS national_count, st.n AS store_total, nt.n AS national_total,
        ROUND(CAST(s.cnt AS REAL) / st.n / (CAST(n.cnt AS REAL) / nt.n), 2) AS specialty_ratio
      FROM store_counts s
      JOIN national_counts n ON s.normalized_flavor = n.normalized_flavor
      CROSS JOIN store_total st
      CROSS JOIN national_total nt
      WHERE st.n > 0 AND nt.n > 0
      ORDER BY specialty_ratio DESC
      LIMIT 3`
    ).bind(slug, slug).all();
    const rows = result?.results || [];
    const top = rows[0];
    if (!top || Number(top.specialty_ratio) < 1.2) return null;
    return {
      title: top.display_flavor,
      ratio: Number(top.specialty_ratio),
      store_count: Number(top.store_count),
    };
  } catch {
    return null;
  }
}

async function handleStoreContextMetrics(inputSlug, corsHeaders, db) {
  const seed = TRIVIA_METRICS_SEED || {};
  const slug = String(inputSlug || '').trim().toLowerCase();
  const lookup = seed?.planner_features?.store_lookup && typeof seed.planner_features.store_lookup === 'object'
    ? seed.planner_features.store_lookup
    : {};
  const row = slug ? lookup[slug] : null;
  const rank = getFlavorRank(seed);
  const topFlavorKey = row?.top_flavor ? normalizeFlavorKey(row.top_flavor) : '';

  const specialty_flavor = db ? await computeStoreSpecialtyFromD1(slug, db) : null;

  return Response.json({
    source: 'trivia_metrics_seed',
    as_of: seed?.as_of || null,
    source_window: getSourceWindow(seed),
    slug: slug || null,
    found: !!row,
    store: row ? {
      city: row.city || null,
      state: row.state || null,
      observations: Number(row.observations || 0),
      distinct_flavors: Number(row.distinct_flavors || 0),
      top_flavor: row.top_flavor || null,
      top_flavor_count: Number(row.top_flavor_count || 0),
      top_flavor_rank: topFlavorKey ? (rank.byNormalized[topFlavorKey] || null) : null,
    } : null,
    specialty_flavor,
  }, {
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * Flavor metrics: how often does this flavor appear, at how many stores, when was it last seen?
 */
async function handleFlavorMetrics(db, normalized, corsHeaders) {
  const normalizedFlavor = normalizeFlavorKey(normalized);
  const rank = getFlavorRank(TRIVIA_METRICS_SEED || {});
  const globalRank = rank.byNormalized[normalizedFlavor] || null;
  const globalPercentile = (globalRank && rank.total > 1)
    ? Math.round((((globalRank - 1) / (rank.total - 1)) * 100) * 10) / 10
    : null;

  const [frequencyResult, recentResult, storeCountResult] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) as total_appearances FROM snapshots WHERE normalized_flavor = ?`
    ).bind(normalizedFlavor).first(),
    db.prepare(
      `SELECT date, slug, flavor FROM snapshots WHERE normalized_flavor = ? ORDER BY date DESC LIMIT 10`
    ).bind(normalizedFlavor).all(),
    db.prepare(
      `SELECT COUNT(DISTINCT slug) as store_count FROM snapshots WHERE normalized_flavor = ?`
    ).bind(normalizedFlavor).first(),
  ]);

  return Response.json({
    normalized_flavor: normalizedFlavor,
    global_rank: globalRank,
    total_ranked_flavors: rank.total,
    global_percentile: globalPercentile,
    total_appearances: frequencyResult?.total_appearances || 0,
    store_count: storeCountResult?.store_count || 0,
    recent: (recentResult?.results || []).map(r => ({
      date: r.date,
      slug: r.slug,
      flavor: r.flavor,
    })),
  }, {
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * Store metrics: how many unique flavors has this store had, recent history, streaks.
 */
async function handleStoreMetrics(db, slug, corsHeaders) {
  const [diversityResult, historyResult, totalResult] = await Promise.all([
    db.prepare(
      `SELECT COUNT(DISTINCT normalized_flavor) as unique_flavors FROM snapshots WHERE slug = ?`
    ).bind(slug).first(),
    db.prepare(
      `SELECT date, flavor, normalized_flavor FROM snapshots WHERE slug = ? ORDER BY date DESC LIMIT 30`
    ).bind(slug).all(),
    db.prepare(
      `SELECT COUNT(*) as total_days FROM snapshots WHERE slug = ?`
    ).bind(slug).first(),
  ]);

  // Detect streaks (consecutive days with same flavor)
  const history = historyResult?.results || [];
  const streaks = detectStreaks(history);

  return Response.json({
    slug,
    unique_flavors: diversityResult?.unique_flavors || 0,
    total_days: totalResult?.total_days || 0,
    recent_history: history.map(r => ({
      date: r.date,
      flavor: r.flavor,
    })),
    active_streaks: streaks,
  }, {
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * Trending: most and least common flavors this week vs overall.
 */
async function handleTrending(db, corsHeaders) {
  // This week = last 7 days, capped at today
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);

  const [thisWeekResult, allTimeResult] = await Promise.all([
    db.prepare(
      `SELECT normalized_flavor, flavor, COUNT(*) as count
       FROM snapshots WHERE date >= ? AND date <= ?
       GROUP BY normalized_flavor
       ORDER BY count DESC
       LIMIT 10`
    ).bind(weekAgoStr, todayStr).all(),
    db.prepare(
      `SELECT normalized_flavor, flavor, COUNT(*) as count
       FROM snapshots
       GROUP BY normalized_flavor
       ORDER BY count DESC
       LIMIT 10`
    ).all(),
  ]);

  return Response.json({
    this_week: (thisWeekResult?.results || []).map(r => ({
      flavor: r.flavor,
      normalized: r.normalized_flavor,
      count: r.count,
    })),
    all_time: (allTimeResult?.results || []).map(r => ({
      flavor: r.flavor,
      normalized: r.normalized_flavor,
      count: r.count,
    })),
  }, {
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * Accuracy metrics: all stores or grouped overview.
 */
async function handleAccuracy(db, corsHeaders) {
  const result = await db.prepare(
    `SELECT slug, window, top_1_hit_rate, top_5_hit_rate, avg_log_loss, n_samples, computed_at
     FROM accuracy_metrics ORDER BY slug, window`
  ).all();

  const rows = result?.results || [];
  // Group by slug
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.slug]) grouped[row.slug] = {};
    grouped[row.slug][row.window] = {
      top_1_hit_rate: row.top_1_hit_rate,
      top_5_hit_rate: row.top_5_hit_rate,
      avg_log_loss: row.avg_log_loss,
      n_samples: row.n_samples,
      computed_at: row.computed_at,
    };
  }

  return Response.json(grouped, {
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * Accuracy metrics for a single store.
 */
async function handleAccuracyByStore(db, slug, corsHeaders) {
  const result = await db.prepare(
    `SELECT window, top_1_hit_rate, top_5_hit_rate, avg_log_loss, n_samples, computed_at
     FROM accuracy_metrics WHERE slug = ? ORDER BY window`
  ).bind(slug).all();

  const rows = result?.results || [];
  const metrics = {};
  for (const row of rows) {
    metrics[row.window] = {
      top_1_hit_rate: row.top_1_hit_rate,
      top_5_hit_rate: row.top_5_hit_rate,
      avg_log_loss: row.avg_log_loss,
      n_samples: row.n_samples,
      computed_at: row.computed_at,
    };
  }

  return Response.json({ slug, metrics }, {
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * Coverage: how many forecast slugs exist and which have recent snapshot backing.
 */
async function handleCoverage(db, corsHeaders) {
  const [forecastResult, snapshotResult] = await Promise.all([
    db.prepare(
      `SELECT slug, generated_at FROM forecasts ORDER BY slug`
    ).all(),
    db.prepare(
      `SELECT DISTINCT slug FROM snapshots
       WHERE date >= date('now', '-2 days')
       AND fetched_at >= datetime('now', '-48 hours')`
    ).all(),
  ]);

  const forecastRows = forecastResult?.results || [];
  const snapshotSlugs = new Set((snapshotResult?.results || []).map(r => r.slug));

  const forecastSlugs = forecastRows.map(r => r.slug);
  const lastGenerated = forecastRows.length > 0
    ? forecastRows.reduce((latest, r) => (r.generated_at > latest ? r.generated_at : latest), forecastRows[0].generated_at)
    : null;

  const withSnapshot = forecastSlugs.filter(s => snapshotSlugs.has(s));
  const missingSlugs = forecastSlugs.filter(s => !snapshotSlugs.has(s));

  return Response.json({
    forecast_slugs: forecastSlugs,
    total_forecasts: forecastSlugs.length,
    snapshot_coverage: {
      stores_with_recent_snapshots: snapshotSlugs.size,
      stores_with_forecast_and_snapshot: withSnapshot.length,
    },
    last_generated: lastGenerated,
    missing_slugs: missingSlugs,
  }, {
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * Detect streaks of consecutive appearances of the same flavor.
 * @param {Array<{date: string, normalized_flavor: string}>} history - Sorted desc by date
 * @returns {Array<{flavor: string, length: number, start: string, end: string}>}
 */
function detectStreaks(history) {
  if (history.length === 0) return [];

  const streaks = [];
  let currentFlavor = history[0].normalized_flavor;
  let currentName = history[0].flavor;
  let streakLen = 1;
  let streakEnd = history[0].date;
  let streakStart = history[0].date;

  for (let i = 1; i < history.length; i++) {
    if (history[i].normalized_flavor === currentFlavor) {
      streakLen++;
      streakStart = history[i].date;
    } else {
      if (streakLen >= 2) {
        streaks.push({ flavor: currentName, length: streakLen, start: streakStart, end: streakEnd });
      }
      currentFlavor = history[i].normalized_flavor;
      currentName = history[i].flavor;
      streakLen = 1;
      streakEnd = history[i].date;
      streakStart = history[i].date;
    }
  }
  if (streakLen >= 2) {
    streaks.push({ flavor: currentName, length: streakLen, start: streakStart, end: streakEnd });
  }

  return streaks;
}

export { detectStreaks };
