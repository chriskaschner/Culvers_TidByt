/**
 * Snapshot targets -- resolve which slugs need D1 snapshots.
 *
 * Union of forecast slugs (from D1 forecasts table) and subscription
 * slugs (from KV alert subscriptions), deduplicated and sorted for
 * deterministic cursor-based iteration.
 */

/**
 * Get all slugs that have forecasts stored in D1.
 * @param {Object} db - D1 database binding
 * @returns {Promise<string[]>}
 */
export async function getForecastSlugs(db) {
  if (!db) return [];
  try {
    const result = await db.prepare('SELECT DISTINCT slug FROM forecasts').all();
    return (result?.results || []).map(r => r.slug);
  } catch {
    return [];
  }
}

/**
 * Get all unique slugs from KV alert subscriptions.
 * Reads directly from KV (does NOT go through checkAlerts, which
 * early-returns when RESEND_API_KEY is missing).
 * @param {Object} kv - KV namespace binding
 * @returns {Promise<string[]>}
 */
export async function getSubscriptionSlugs(kv) {
  if (!kv) return [];
  const slugs = new Set();
  let cursor;

  try {
    do {
      const opts = { prefix: 'alert:sub:', limit: 1000 };
      if (cursor) opts.cursor = cursor;

      const list = await kv.list(opts);
      for (const key of list.keys) {
        const raw = await kv.get(key.name);
        if (raw) {
          try {
            const sub = JSON.parse(raw);
            if (sub.slug) slugs.add(sub.slug);
          } catch {
            // Skip corrupted entries
          }
        }
      }
      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);
  } catch {
    // KV failures are non-fatal
  }

  return [...slugs];
}

/**
 * Union forecast + subscription slugs, deduplicated and sorted alphabetically.
 * @param {Object} db - D1 database binding
 * @param {Object} kv - KV namespace binding
 * @returns {Promise<string[]>}
 */
export async function resolveSnapshotTargets(db, kv) {
  const [forecastSlugs, subSlugs] = await Promise.all([
    getForecastSlugs(db),
    getSubscriptionSlugs(kv),
  ]);
  const union = new Set([...forecastSlugs, ...subSlugs]);
  return [...union].sort();
}

/**
 * Read a cursor value from D1 cron_state table.
 * @param {Object} db - D1 database binding
 * @param {string} key - Cursor key name
 * @returns {Promise<number>}
 */
export async function getCronCursor(db, key) {
  if (!db) return 0;
  try {
    const row = await db.prepare(
      'SELECT value FROM cron_state WHERE key = ?'
    ).bind(key).first();
    return row ? parseInt(row.value, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Write a cursor value to D1 cron_state table.
 * @param {Object} db - D1 database binding
 * @param {string} key - Cursor key name
 * @param {number} value - Cursor position
 */
export async function setCronCursor(db, key, value) {
  if (!db) return;
  try {
    await db.prepare(
      `INSERT INTO cron_state (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).bind(key, String(value), new Date().toISOString()).run();
  } catch (err) {
    console.error(`Failed to write cron cursor ${key}: ${err.message}`);
  }
}
