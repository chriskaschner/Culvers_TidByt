/**
 * Per-store Calendar Reliability Index.
 *
 * Computes a 0-1 reliability score from D1 snapshot history.
 * Three metrics (v1):
 *   - freshness_lag: avg hours between fetched_at and date midnight
 *   - missing_window_rate: fraction of last N days with no snapshot
 *   - recovery_time: avg gap length in consecutive missing dates
 *
 * Tier thresholds:
 *   confirmed  >= 0.7
 *   watch      >= 0.4
 *   unreliable <  0.4
 */

const WINDOW_DAYS = 30;
const TIER_CONFIRMED = 0.7;
const TIER_WATCH = 0.4;

/**
 * Compute reliability metrics for a single store.
 * @param {Object} db - D1 database binding
 * @param {string} slug - Store slug
 * @returns {Promise<Object|null>} Reliability record or null if insufficient data
 */
export async function computeReliability(db, slug) {
  if (!db || !slug) return null;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Fetch snapshots within the window
  const result = await db.prepare(
    `SELECT date, fetched_at, brand FROM snapshots
     WHERE slug = ? AND date >= ?
     ORDER BY date ASC`
  ).bind(slug, cutoffStr).all();

  const rows = result?.results || [];
  if (rows.length === 0) return null;

  const brand = rows[0].brand;

  // Build the set of dates that have snapshots
  const presentDates = new Set(rows.map(r => r.date));

  // Generate all dates in the window
  const allDates = [];
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - (WINDOW_DAYS - 1 - i));
    allDates.push(d.toISOString().slice(0, 10));
  }

  // --- Metric 1: Missing window rate ---
  let missingCount = 0;
  for (let i = 0; i < allDates.length; i++) {
    if (!presentDates.has(allDates[i])) missingCount++;
  }
  const missingRate = missingCount / allDates.length;

  // --- Metric 2: Freshness lag (avg hours between fetched_at and date midnight) ---
  let totalLagHours = 0;
  let lagCount = 0;
  for (const row of rows) {
    if (!row.fetched_at || !row.date) continue;
    const dateMidnight = new Date(row.date + 'T00:00:00Z').getTime();
    const fetchedAt = new Date(row.fetched_at).getTime();
    if (!Number.isFinite(dateMidnight) || !Number.isFinite(fetchedAt)) continue;
    const lagMs = Math.abs(fetchedAt - dateMidnight);
    totalLagHours += lagMs / (1000 * 60 * 60);
    lagCount++;
  }
  const avgLagHours = lagCount > 0 ? totalLagHours / lagCount : 24;

  // Normalize lag: 0h = perfect (0.0), 24h+ = worst (1.0)
  const lagNorm = Math.min(avgLagHours / 24, 1.0);

  // --- Metric 3: Recovery time (avg gap length in consecutive missing dates) ---
  let gapLengths = [];
  let currentGap = 0;
  for (let i = 0; i < allDates.length; i++) {
    if (!presentDates.has(allDates[i])) {
      currentGap++;
    } else {
      if (currentGap > 0) {
        gapLengths.push(currentGap);
        currentGap = 0;
      }
    }
  }
  if (currentGap > 0) gapLengths.push(currentGap);

  const avgRecoveryDays = gapLengths.length > 0
    ? gapLengths.reduce((a, b) => a + b, 0) / gapLengths.length
    : 0;
  const avgRecoveryHours = avgRecoveryDays * 24;

  // Normalize recovery: 0 days = perfect (0.0), 7+ days = worst (1.0)
  const recoveryNorm = Math.min(avgRecoveryDays / 7, 1.0);

  // --- Composite score ---
  const score = Math.max(0, Math.min(1,
    1.0 - (0.4 * missingRate + 0.3 * lagNorm + 0.3 * recoveryNorm)
  ));

  // Round to 4 decimal places
  const roundedScore = Math.round(score * 10000) / 10000;

  // --- Tier ---
  let tier;
  if (roundedScore >= TIER_CONFIRMED) {
    tier = 'confirmed';
  } else if (roundedScore >= TIER_WATCH) {
    tier = 'watch';
  } else {
    tier = 'unreliable';
  }

  // --- Reason text ---
  const reasons = [];
  if (missingRate > 0.3) reasons.push(`${Math.round(missingRate * 100)}% of days missing data`);
  if (avgLagHours > 12) reasons.push(`avg ${avgLagHours.toFixed(0)}h freshness lag`);
  if (avgRecoveryDays > 3) reasons.push(`avg ${avgRecoveryDays.toFixed(1)}d recovery time`);
  const reason = reasons.length > 0 ? reasons.join('; ') : null;

  return {
    slug,
    brand,
    freshness_lag_avg_hours: Math.round(avgLagHours * 100) / 100,
    missing_window_rate: Math.round(missingRate * 10000) / 10000,
    forward_change_rate: null,
    late_change_rate: null,
    recovery_time_avg_hours: Math.round(avgRecoveryHours * 100) / 100,
    reliability_score: roundedScore,
    reliability_tier: tier,
    reason,
    computed_at: new Date().toISOString(),
    window_days: WINDOW_DAYS,
  };
}

/**
 * Persist a reliability record to D1.
 * @param {Object} db - D1 database binding
 * @param {Object} record - Reliability record from computeReliability
 */
export async function saveReliability(db, record) {
  if (!db || !record) return;
  await db.prepare(
    `INSERT INTO store_reliability
       (slug, brand, freshness_lag_avg_hours, missing_window_rate,
        forward_change_rate, late_change_rate, recovery_time_avg_hours,
        reliability_score, reliability_tier, reason, computed_at, window_days)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       brand = excluded.brand,
       freshness_lag_avg_hours = excluded.freshness_lag_avg_hours,
       missing_window_rate = excluded.missing_window_rate,
       forward_change_rate = excluded.forward_change_rate,
       late_change_rate = excluded.late_change_rate,
       recovery_time_avg_hours = excluded.recovery_time_avg_hours,
       reliability_score = excluded.reliability_score,
       reliability_tier = excluded.reliability_tier,
       reason = excluded.reason,
       computed_at = excluded.computed_at,
       window_days = excluded.window_days`
  ).bind(
    record.slug,
    record.brand,
    record.freshness_lag_avg_hours,
    record.missing_window_rate,
    record.forward_change_rate,
    record.late_change_rate,
    record.recovery_time_avg_hours,
    record.reliability_score,
    record.reliability_tier,
    record.reason,
    record.computed_at,
    record.window_days,
  ).run();
}

/**
 * Get reliability data for a single store.
 * @param {Object} db - D1 database binding
 * @param {string} slug - Store slug
 * @returns {Promise<Object|null>}
 */
export async function getReliability(db, slug) {
  if (!db || !slug) return null;
  try {
    return await db.prepare(
      'SELECT * FROM store_reliability WHERE slug = ?'
    ).bind(slug).first();
  } catch {
    return null;
  }
}

/**
 * Get all stores' reliability tiers (bulk endpoint).
 * @param {Object} db - D1 database binding
 * @returns {Promise<Array>}
 */
export async function getAllReliability(db) {
  if (!db) return [];
  try {
    const result = await db.prepare(
      `SELECT slug, brand, reliability_score, reliability_tier, reason, computed_at
       FROM store_reliability
       ORDER BY reliability_score ASC`
    ).all();
    return result?.results || [];
  } catch {
    return [];
  }
}

/**
 * Get slugs that need reliability refresh.
 * Uses cursor-based batching from cron_state.
 * @param {Object} db - D1 database binding
 * @param {number} batchSize - Number of slugs per batch
 * @param {number} cursor - Current cursor position
 * @returns {Promise<{slugs: string[], nextCursor: number}>}
 */
export async function getReliabilityBatch(db, batchSize, cursor) {
  if (!db) return { slugs: [], nextCursor: 0 };

  // Get all unique slugs from snapshots
  const result = await db.prepare(
    'SELECT DISTINCT slug FROM snapshots ORDER BY slug ASC'
  ).all();
  const allSlugs = (result?.results || []).map(r => r.slug);

  if (allSlugs.length === 0) return { slugs: [], nextCursor: 0 };

  const batch = allSlugs.slice(cursor, cursor + batchSize);
  const nextCursor = cursor + batch.length >= allSlugs.length
    ? 0
    : cursor + batch.length;

  return { slugs: batch, nextCursor };
}

/**
 * Run a batch reliability refresh: compute + persist for a batch of stores.
 * @param {Object} db - D1 database binding
 * @param {string[]} slugs - Slugs to process
 * @returns {Promise<{processed: number, errors: number}>}
 */
export async function refreshReliabilityBatch(db, slugs) {
  let processed = 0;
  let errors = 0;

  for (const slug of slugs) {
    try {
      const record = await computeReliability(db, slug);
      if (record) {
        await saveReliability(db, record);
        processed++;
      }
    } catch (err) {
      console.error(`Reliability computation failed for ${slug}: ${err.message}`);
      errors++;
    }
  }

  return { processed, errors };
}

/**
 * API handler for GET /api/reliability/{slug}
 */
export async function handleReliabilityRoute(canonical, env, corsHeaders) {
  // Single store: /api/reliability/{slug}
  const singleMatch = canonical.match(/^\/api\/reliability\/([a-z0-9][a-z0-9_-]+)$/);
  if (singleMatch) {
    const slug = decodeURIComponent(singleMatch[1]);
    const data = await getReliability(env.DB, slug);
    if (!data) {
      return Response.json(
        { error: 'No reliability data for this store' },
        { status: 404, headers: corsHeaders }
      );
    }
    return Response.json(data, { headers: corsHeaders });
  }

  // Bulk: /api/reliability
  if (canonical === '/api/reliability') {
    const data = await getAllReliability(env.DB);
    return Response.json({ stores: data }, { headers: corsHeaders });
  }

  return null;
}
