/**
 * Flavor signal detection for the custard intelligence platform.
 *
 * Signals are statistically gated insights about flavor patterns at a store.
 * Each signal has a plain-language explanation with evidence, a type, and a
 * recommended action (alert, calendar, directions).
 *
 * Signal types:
 *   overdue       -- Flavor hasn't appeared in > 1.5x its average interval
 *   dow_pattern   -- Flavor shows significant day-of-week scheduling bias
 *   seasonal      -- Flavor concentrated in a 3-month window (>=50%)
 *   active_streak -- Flavor on a multi-day consecutive streak right now
 *   rare_find     -- Flavor available today at very few stores (<= 3)
 *
 * Gating: each signal type has minimum evidence thresholds to prevent noise.
 */

// --- Signal type constants ---

export const SIGNAL_TYPES = {
  OVERDUE: 'overdue',
  DOW_PATTERN: 'dow_pattern',
  SEASONAL: 'seasonal',
  ACTIVE_STREAK: 'active_streak',
  RARE_FIND: 'rare_find',
};

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// --- Threshold constants ---

/** Minimum appearances for a flavor to qualify for any signal. */
export const MIN_APPEARANCES = 3;

/** Overdue ratio threshold (days_since / avg_gap). */
export const OVERDUE_RATIO = 1.5;

/** Minimum appearances for DOW chi-squared to be meaningful. */
export const MIN_DOW_APPEARANCES = 7;

/** Chi-squared critical value for DOW bias (df=6, p<0.05). */
export const CHI_SQUARED_CRITICAL = 12.592;

/** Minimum concentration for seasonal detection. */
export const SEASONAL_CONCENTRATION = 0.5;

/** Minimum consecutive days for active streak signal. */
export const MIN_STREAK_DAYS = 2;

/** Maximum stores serving a flavor for it to count as "rare." */
export const MAX_RARE_STORES = 3;

// --- Signal computation ---

/**
 * Detect overdue flavors at a store.
 *
 * @param {Array} flavorHistory - [{flavor, dates: [string]}]
 * @param {string} today - YYYY-MM-DD
 * @returns {Array} Overdue signals
 */
export function detectOverdue(flavorHistory, today) {
  const todayMs = new Date(today).getTime();
  const signals = [];

  for (const { flavor, dates } of flavorHistory) {
    if (dates.length < MIN_APPEARANCES) continue;

    const sorted = dates.map((d) => new Date(d).getTime()).sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24));
    }
    if (gaps.length === 0) continue;

    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const daysSince = (todayMs - sorted[sorted.length - 1]) / (1000 * 60 * 60 * 24);
    const ratio = daysSince / avgGap;

    if (ratio >= OVERDUE_RATIO && avgGap >= 2) {
      signals.push({
        type: SIGNAL_TYPES.OVERDUE,
        flavor,
        headline: `${flavor} is overdue`,
        explanation: `${flavor} usually appears every ${Math.round(avgGap)} days but hasn't been seen in ${Math.round(daysSince)} days.`,
        action: 'alert',
        evidence: { avg_gap_days: Math.round(avgGap), days_since: Math.round(daysSince), ratio: Math.round(ratio * 10) / 10, appearances: dates.length },
        score: ratio, // higher = more overdue = more newsworthy
      });
    }
  }

  return signals.sort((a, b) => b.score - a.score);
}

/**
 * Detect day-of-week scheduling bias via chi-squared test.
 *
 * @param {Array} flavorHistory - [{flavor, dates: [string]}]
 * @returns {Array} DOW pattern signals
 */
export function detectDowPatterns(flavorHistory) {
  const signals = [];

  for (const { flavor, dates } of flavorHistory) {
    if (dates.length < MIN_DOW_APPEARANCES) continue;

    // Count appearances per DOW
    const dowCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const d of dates) {
      const dow = new Date(d).getUTCDay();
      dowCounts[dow]++;
    }

    // Chi-squared test
    const expected = dates.length / 7;
    let chiSquared = 0;
    for (const count of dowCounts) {
      chiSquared += ((count - expected) ** 2) / expected;
    }

    if (chiSquared >= CHI_SQUARED_CRITICAL) {
      const peakDow = dowCounts.indexOf(Math.max(...dowCounts));
      const peakPct = Math.round((dowCounts[peakDow] / dates.length) * 100);
      signals.push({
        type: SIGNAL_TYPES.DOW_PATTERN,
        flavor,
        headline: `${flavor} peaks on ${DOW_NAMES[peakDow]}s`,
        explanation: `${flavor} appears ${peakPct}% of the time on ${DOW_NAMES[peakDow]}s (${dowCounts[peakDow]} of ${dates.length} appearances).`,
        action: 'calendar',
        evidence: { peak_dow: peakDow, peak_name: DOW_NAMES[peakDow], peak_pct: peakPct, chi_squared: Math.round(chiSquared * 10) / 10, total: dates.length },
        score: chiSquared,
      });
    }
  }

  return signals.sort((a, b) => b.score - a.score);
}

/**
 * Detect seasonal concentration (>=50% of appearances in a 3-month window).
 *
 * @param {Array} flavorHistory - [{flavor, dates: [string]}]
 * @returns {Array} Seasonal signals
 */
export function detectSeasonal(flavorHistory) {
  const signals = [];

  for (const { flavor, dates } of flavorHistory) {
    if (dates.length < MIN_APPEARANCES) continue;

    // Count by month
    const monthCounts = new Array(12).fill(0);
    for (const d of dates) {
      const month = new Date(d).getUTCMonth();
      monthCounts[month]++;
    }

    // Sliding 3-month window to find peak concentration
    let bestStart = 0;
    let bestSum = 0;
    for (let start = 0; start < 12; start++) {
      const sum = monthCounts[start] + monthCounts[(start + 1) % 12] + monthCounts[(start + 2) % 12];
      if (sum > bestSum) {
        bestSum = sum;
        bestStart = start;
      }
    }

    const concentration = bestSum / dates.length;
    if (concentration >= SEASONAL_CONCENTRATION && dates.length >= 6) {
      const peakMonths = [
        MONTH_NAMES[bestStart],
        MONTH_NAMES[(bestStart + 1) % 12],
        MONTH_NAMES[(bestStart + 2) % 12],
      ];
      signals.push({
        type: SIGNAL_TYPES.SEASONAL,
        flavor,
        headline: `${flavor} peaks ${peakMonths[0]}-${peakMonths[2]}`,
        explanation: `${Math.round(concentration * 100)}% of ${flavor} appearances fall in ${peakMonths.join('-')} (${bestSum} of ${dates.length}).`,
        action: 'alert',
        evidence: { peak_months: peakMonths, concentration: Math.round(concentration * 100) / 100, peak_count: bestSum, total: dates.length },
        score: concentration,
      });
    }
  }

  return signals.sort((a, b) => b.score - a.score);
}

/**
 * Detect active consecutive-day streaks.
 *
 * @param {Array} flavorHistory - [{flavor, dates: [string]}]
 * @param {string} today - YYYY-MM-DD
 * @returns {Array} Active streak signals
 */
export function detectStreaks(flavorHistory, today) {
  const todayMs = new Date(today).getTime();
  const oneDayMs = 1000 * 60 * 60 * 24;
  const signals = [];

  for (const { flavor, dates } of flavorHistory) {
    if (dates.length < MIN_STREAK_DAYS) continue;

    const sorted = dates.map((d) => new Date(d).getTime()).sort((a, b) => b - a); // most recent first
    // Check if the most recent date is today or yesterday
    const daysDiff = (todayMs - sorted[0]) / oneDayMs;
    if (daysDiff > 1.5) continue; // streak not active

    // Count consecutive days backwards from most recent
    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const gap = (sorted[i - 1] - sorted[i]) / oneDayMs;
      if (gap > 1.5) break;
      streak++;
    }

    if (streak >= MIN_STREAK_DAYS) {
      signals.push({
        type: SIGNAL_TYPES.ACTIVE_STREAK,
        flavor,
        headline: `${flavor}: ${streak}-day streak`,
        explanation: `${flavor} has been the flavor of the day for ${streak} consecutive days.`,
        action: 'directions',
        evidence: { streak_days: streak },
        score: streak,
      });
    }
  }

  return signals.sort((a, b) => b.score - a.score);
}

/**
 * Detect rare finds -- flavors available today at very few stores.
 *
 * @param {string} todayFlavor - The confirmed flavor at this store today
 * @param {number} storeCount - Number of stores serving this flavor today
 * @returns {Object|null} Rare find signal or null
 */
export function detectRareFind(todayFlavor, storeCount) {
  if (!todayFlavor || typeof storeCount !== 'number') return null;
  if (storeCount > MAX_RARE_STORES || storeCount < 1) return null;

  return {
    type: SIGNAL_TYPES.RARE_FIND,
    flavor: todayFlavor,
    headline: `Rare: ${todayFlavor}`,
    explanation: storeCount === 1
      ? `${todayFlavor} is only available at 1 store today.`
      : `${todayFlavor} is only available at ${storeCount} stores today.`,
    action: 'directions',
    evidence: { store_count: storeCount },
    score: 1 / storeCount, // rarer = higher score
  };
}

// --- Aggregation ---

/**
 * Build flavor history from D1 snapshot rows.
 * Groups dates by normalized flavor name.
 *
 * @param {Array} rows - [{flavor, date}]
 * @returns {Array} [{flavor, dates: [string]}]
 */
export function buildFlavorHistory(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!row.flavor || !row.date) continue;
    if (!map.has(row.flavor)) {
      map.set(row.flavor, { flavor: row.flavor, dates: [] });
    }
    map.get(row.flavor).dates.push(row.date);
  }
  return Array.from(map.values());
}

/**
 * Compute all signals for a store.
 *
 * @param {Object} opts
 * @param {Array} opts.snapshotRows - [{flavor, date}] from D1
 * @param {string} opts.today - YYYY-MM-DD
 * @param {string} [opts.todayFlavor] - Confirmed flavor today
 * @param {number} [opts.todayFlavorStoreCount] - How many stores serve today's flavor
 * @param {number} [opts.limit=5] - Max signals to return
 * @returns {Array} Top signals sorted by score
 */
export function computeSignals(opts = {}) {
  const {
    snapshotRows = [],
    today,
    todayFlavor,
    todayFlavorStoreCount,
    limit = 5,
  } = opts;

  const history = buildFlavorHistory(snapshotRows);
  const signals = [
    ...detectOverdue(history, today),
    ...detectDowPatterns(history),
    ...detectSeasonal(history),
    ...detectStreaks(history, today),
  ];

  const rare = detectRareFind(todayFlavor, todayFlavorStoreCount);
  if (rare) signals.push(rare);

  // Deduplicate: keep highest-scoring signal per flavor
  const best = new Map();
  for (const signal of signals) {
    const key = `${signal.flavor}:${signal.type}`;
    if (!best.has(key) || signal.score > best.get(key).score) {
      best.set(key, signal);
    }
  }

  return Array.from(best.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// --- API handler ---

/**
 * Handle GET /api/v1/signals/{slug}
 *
 * @param {URL} url
 * @param {Object} env
 * @param {Object} corsHeaders
 * @returns {Promise<Response>}
 */
export async function handleSignals(url, env, corsHeaders) {
  const parts = url.pathname.replace(/^\/api\/v1\//, '').split('/');
  const slug = parts[1] || '';

  if (!slug) {
    return Response.json(
      { error: 'Missing store slug. Usage: /api/v1/signals/{slug}' },
      { status: 400, headers: corsHeaders }
    );
  }

  const db = env.DB;
  if (!db) {
    return Response.json(
      { error: 'Database unavailable' },
      { status: 503, headers: corsHeaders }
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  // Fetch snapshot history for this store (last 365 days for pattern detection)
  let rows;
  try {
    const result = await db.prepare(
      `SELECT flavor, date FROM snapshots WHERE slug = ? AND date >= date('now', '-365 days') ORDER BY date`
    ).bind(slug).all();
    rows = result.results || [];
  } catch {
    return Response.json(
      { error: 'Failed to query snapshot history' },
      { status: 500, headers: corsHeaders }
    );
  }

  if (rows.length === 0) {
    return Response.json(
      { slug, signals: [], message: 'No history for this store' },
      { headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' } }
    );
  }

  // Get today's flavor and cross-store count
  let todayFlavor = null;
  let todayFlavorStoreCount = null;
  const todayRow = rows.find((r) => r.date === today);
  if (todayRow) {
    todayFlavor = todayRow.flavor;
    try {
      const countResult = await db.prepare(
        `SELECT COUNT(DISTINCT slug) as cnt FROM snapshots WHERE normalized_flavor = ? AND date = ?`
      ).bind(todayRow.flavor.toLowerCase().replace(/[^\w\s]/g, '').trim(), today).first();
      todayFlavorStoreCount = countResult?.cnt || null;
    } catch {
      // best-effort
    }
  }

  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit')) || 5, 1), 20);

  const signals = computeSignals({
    snapshotRows: rows,
    today,
    todayFlavor,
    todayFlavorStoreCount,
    limit,
  });

  return Response.json(
    { slug, today, signals },
    {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=1800',
      },
    }
  );
}
