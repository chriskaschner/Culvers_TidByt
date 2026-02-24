/**
 * flavor-stats.js -- flavor intelligence metrics from D1 snapshot history.
 *
 * GET /api/v1/flavor-stats/{slug}           -- store overview (personality, overdue)
 * GET /api/v1/flavor-stats/{slug}?flavor=X  -- single-flavor deep dive
 *
 * All metrics are derived from the snapshots table; no prediction models required.
 */

/**
 * Similarity groups for flavor family classification.
 * Used in store-overview mode to build "personality" profiles.
 */
const SIMILARITY_GROUPS = {
  mint: ['andes mint avalanche', 'mint cookie', 'mint explosion'],
  chocolate: ['chocolate caramel twist', 'chocolate heath crunch', 'dark chocolate decadence', 'dark chocolate pb crunch', 'brownie thunder', 'chocolate volcano', 'chocolate oreo volcano'],
  caramel: ['caramel cashew', 'caramel fudge cookie dough', 'caramel pecan', 'caramel turtle', 'salted caramel pecan pie', 'salted double caramel pecan', 'caramel peanut buttercup', 'caramel chocolate pecan'],
  cheesecake: ['oreo cheesecake', 'oreo cookie cheesecake', 'raspberry cheesecake', 'strawberry cheesecake', 'turtle cheesecake'],
  turtle: ['turtle', 'turtle dove', 'turtle cheesecake', 'caramel turtle'],
  cookie: ['crazy for cookie dough', 'caramel fudge cookie dough', 'oreo cookies and cream'],
  peanutButter: ['dark chocolate pb crunch', 'peanut butter cup', 'really reeses', 'caramel peanut buttercup'],
  berry: ['blackberry cobbler', 'raspberry cheesecake', 'double strawberry', 'chocolate covered strawberry', 'strawberry cheesecake', 'georgia peach', 'lemon berry layer cake'],
  pecan: ['butter pecan', 'caramel pecan', 'salted caramel pecan pie', 'georgia peach pecan', 'caramel chocolate pecan'],
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Handle GET /api/flavor-stats/{slug}[?flavor=X]
 *
 * @param {Request} request
 * @param {Object} env - Worker env bindings
 * @param {string} slug - Store slug from URL path
 * @returns {Promise<Response>}
 */
export async function handleFlavorStats(request, env, slug) {
  const url = new URL(request.url);
  const flavorQuery = url.searchParams.get('flavor');
  const db = env.DB;

  if (!db) {
    return new Response(
      JSON.stringify({ error: 'No database configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const result = flavorQuery
    ? await buildSingleFlavorStats(db, slug, flavorQuery)
    : await buildStoreOverview(db, slug);

  return new Response(JSON.stringify(result), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

// ---------------------------------------------------------------------------
// Single-flavor mode
// ---------------------------------------------------------------------------

async function buildSingleFlavorStats(db, slug, flavorQuery) {
  const normalized = flavorQuery.toLowerCase().replace(/[\u00ae\u2122\u00a9]/g, '').replace(/\s+/g, ' ').trim();

  // 1. All appearance dates for this flavor at this store (sorted ASC)
  const dates = await db.prepare(
    'SELECT date FROM snapshots WHERE slug = ? AND normalized_flavor = ? ORDER BY date ASC',
  ).bind(slug, normalized).all();

  const appearances = dates.results.length;
  let avgGapDays = null;
  let daysSinceLast = null;
  let lastSeen = null;

  if (appearances > 1) {
    let totalGap = 0;
    for (let i = 1; i < dates.results.length; i++) {
      const d1 = new Date(dates.results[i - 1].date);
      const d2 = new Date(dates.results[i].date);
      totalGap += (d2 - d1) / 86400000;
    }
    avgGapDays = Math.round(totalGap / (appearances - 1));
    lastSeen = dates.results[dates.results.length - 1].date;
    daysSinceLast = Math.round((Date.now() - new Date(lastSeen).getTime()) / 86400000);
  } else if (appearances === 1) {
    lastSeen = dates.results[0].date;
    daysSinceLast = Math.round((Date.now() - new Date(lastSeen).getTime()) / 86400000);
  }

  const overdueDays = (avgGapDays && daysSinceLast > avgGapDays) ? daysSinceLast - avgGapDays : 0;

  // 2. Annual frequency
  let annualFrequency = null;
  if (appearances > 0 && dates.results.length >= 2) {
    const firstDate = new Date(dates.results[0].date);
    const lastDate = new Date(dates.results[dates.results.length - 1].date);
    const spanYears = Math.max((lastDate - firstDate) / (365.25 * 86400000), 1);
    annualFrequency = Math.round(appearances / spanYears);
  }

  // 3. Seasonality (month distribution)
  const monthDist = await db.prepare(
    "SELECT CAST(strftime('%m', date) AS INTEGER) as month, COUNT(*) as count FROM snapshots WHERE slug = ? AND normalized_flavor = ? GROUP BY month",
  ).bind(slug, normalized).all();

  let seasonality = null;
  if (monthDist.results.length > 0) {
    const months = new Array(12).fill(0);
    let total = 0;
    for (const row of monthDist.results) {
      months[row.month - 1] = row.count;
      total += row.count;
    }
    // Find best 3-month window (wrapping around Dec->Jan)
    let bestSum = 0;
    let bestStart = 0;
    for (let i = 0; i < 12; i++) {
      const sum3 = months[i] + months[(i + 1) % 12] + months[(i + 2) % 12];
      if (sum3 > bestSum) { bestSum = sum3; bestStart = i; }
    }
    const concentration = total > 0 ? bestSum / total : 0;
    seasonality = {
      seasonal: concentration >= 0.5,
      peak_months: [MONTH_NAMES[bestStart], MONTH_NAMES[(bestStart + 1) % 12], MONTH_NAMES[(bestStart + 2) % 12]],
      concentration: Math.round(concentration * 100) / 100,
      distribution: months,
    };
  }

  // 4. Day-of-week bias
  const dowDist = await db.prepare(
    "SELECT CAST(strftime('%w', date) AS INTEGER) as dow, COUNT(*) as count FROM snapshots WHERE slug = ? AND normalized_flavor = ? GROUP BY dow",
  ).bind(slug, normalized).all();

  let dowBias = null;
  if (dowDist.results.length > 0) {
    const dows = new Array(7).fill(0);
    let total = 0;
    for (const row of dowDist.results) {
      dows[row.dow] = row.count;
      total += row.count;
    }
    const expected = total / 7;
    let chiSquared = 0;
    for (let i = 0; i < 7; i++) {
      chiSquared += Math.pow(dows[i] - expected, 2) / Math.max(expected, 0.001);
    }
    // df=6, p<0.05 threshold is ~12.59
    const hasBias = chiSquared > 12.59 && total >= 14;
    let peakDow = 0;
    for (let i = 1; i < 7; i++) { if (dows[i] > dows[peakDow]) peakDow = i; }
    dowBias = {
      has_bias: hasBias,
      peak_dow: peakDow,
      peak_name: DAY_NAMES[peakDow],
      peak_percentage: total > 0 ? Math.round((dows[peakDow] / total) * 100) / 100 : 0,
      chi_squared: Math.round(chiSquared * 10) / 10,
      distribution: dows,
    };
  }

  // 5. Streaks at this store
  let streaks = { current: 0, longest: 0 };
  if (dates.results.length >= 2) {
    let currentStreak = 1;
    let longestStreak = 1;
    for (let i = 1; i < dates.results.length; i++) {
      const d1 = new Date(dates.results[i - 1].date);
      const d2 = new Date(dates.results[i].date);
      const gap = (d2 - d1) / 86400000;
      if (gap === 1) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }
    // Check if the last date is today or yesterday (active streak)
    const lastDate = new Date(dates.results[dates.results.length - 1].date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysSinceLastDate = Math.round((today - lastDate) / 86400000);
    streaks = {
      current: daysSinceLastDate <= 1 ? currentStreak : 0,
      longest: longestStreak,
    };
  }

  // 6. Cross-store rarity (last 30 days)
  const crossStore = await db.prepare(
    "SELECT COUNT(DISTINCT slug) as store_count FROM snapshots WHERE normalized_flavor = ? AND date >= date('now', '-30 days')",
  ).bind(normalized).first();

  return {
    flavor: flavorQuery,
    appearances,
    avg_gap_days: avgGapDays,
    last_seen: lastSeen,
    days_since_last: daysSinceLast,
    overdue_days: overdueDays,
    annual_frequency: annualFrequency,
    seasonality,
    dow_bias: dowBias,
    streaks,
    stores_last_30d: crossStore ? crossStore.store_count : null,
  };
}

// ---------------------------------------------------------------------------
// Store overview mode
// ---------------------------------------------------------------------------

async function buildStoreOverview(db, slug) {
  // Top flavor families (personality)
  const flavorCounts = await db.prepare(
    'SELECT normalized_flavor, flavor, COUNT(*) as count FROM snapshots WHERE slug = ? GROUP BY normalized_flavor ORDER BY count DESC LIMIT 30',
  ).bind(slug).all();

  const familyCounts = {};
  let totalCounted = 0;
  for (const row of (flavorCounts.results || [])) {
    const nf = row.normalized_flavor;
    for (const [family, members] of Object.entries(SIMILARITY_GROUPS)) {
      if (members.includes(nf)) {
        familyCounts[family] = (familyCounts[family] || 0) + row.count;
      }
    }
    totalCounted += row.count;
  }

  const families = Object.entries(familyCounts)
    .map(([family, count]) => ({
      family,
      count,
      percentage: Math.round((count / Math.max(totalCounted, 1)) * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Overdue flavors: appeared >= 3 times, sorted by oldest last_seen first
  const overdue = await db.prepare(
    'SELECT normalized_flavor, flavor, MAX(date) as last_seen, COUNT(*) as appearances FROM snapshots WHERE slug = ? GROUP BY normalized_flavor HAVING appearances >= 3 ORDER BY last_seen ASC LIMIT 10',
  ).bind(slug).all();

  const overdueList = [];
  for (const row of (overdue.results || [])) {
    const daysSince = Math.round((Date.now() - new Date(row.last_seen).getTime()) / 86400000);
    overdueList.push({
      flavor: row.flavor,
      last_seen: row.last_seen,
      days_since: daysSince,
      appearances: row.appearances,
    });
  }

  return {
    slug,
    personality: { top_families: families, total_observations: totalCounted },
    overdue: overdueList.slice(0, 5),
    unique_flavors: (flavorCounts.results || []).length,
  };
}
