/**
 * Subscription index helpers.
 *
 * Maintains a materialized subscription index in KV so cron jobs can avoid
 * KV prefix list + per-key lookups on every run.
 */

export const SUBSCRIPTION_INDEX_KEY = 'alert:index:subscriptions:v1';

function sanitizeSubscription(sub, id) {
  if (!sub || typeof sub !== 'object') return null;
  if (!id || typeof id !== 'string') return null;
  if (!sub.email || !sub.slug || !Array.isArray(sub.favorites) || !sub.unsubToken) {
    return null;
  }
  return {
    id,
    email: sub.email,
    slug: sub.slug,
    favorites: sub.favorites,
    frequency: sub.frequency || 'daily',
    unsubToken: sub.unsubToken,
    createdAt: sub.createdAt || new Date().toISOString(),
  };
}

/**
 * Read the materialized subscription index from KV.
 * @param {Object} kv
 * @returns {Promise<Array|null>} null when missing/invalid
 */
export async function readSubscriptionIndex(kv) {
  if (!kv) return null;
  const raw = await kv.get(SUBSCRIPTION_INDEX_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeSubscriptionIndex(kv, subscriptions) {
  if (!kv) return false;
  try {
    await kv.put(SUBSCRIPTION_INDEX_KEY, JSON.stringify(subscriptions));
    return true;
  } catch (err) {
    console.error(`Subscription index write failed: ${err.message}`);
    return false;
  }
}

/**
 * Build subscriptions by scanning legacy alert:sub:* keys.
 * This is fallback-only and intentionally isolated.
 * @param {Object} kv
 * @returns {Promise<Array>}
 */
export async function listSubscriptionsFromKvScan(kv) {
  if (!kv) return [];
  const subs = [];
  let cursor = undefined;

  do {
    const opts = { prefix: 'alert:sub:', limit: 1000 };
    if (cursor) opts.cursor = cursor;

    const list = await kv.list(opts);
    for (const key of list.keys) {
      const raw = await kv.get(key.name);
      if (!raw) continue;
      try {
        const sub = JSON.parse(raw);
        const id = key.name.replace('alert:sub:', '');
        const normalized = sanitizeSubscription(sub, id);
        if (normalized) subs.push(normalized);
      } catch {
        // Skip corrupted entries
      }
    }

    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  // Deterministic order keeps snapshots/cursor progression stable.
  subs.sort((a, b) => a.id.localeCompare(b.id));
  return subs;
}

/**
 * Read subscriptions using index first, then legacy fallback scan.
 * Self-heals by writing the index after fallback success.
 * @param {Object} kv
 * @returns {Promise<Array>}
 */
export async function listSubscriptions(kv) {
  const indexed = await readSubscriptionIndex(kv);
  if (indexed) return indexed;

  const scanned = await listSubscriptionsFromKvScan(kv);
  if (scanned.length > 0) {
    await writeSubscriptionIndex(kv, scanned);
  }
  return scanned;
}

/**
 * Upsert one subscription record in the materialized index.
 * Best-effort only; canonical per-sub keys remain the source of truth.
 * @param {Object} kv
 * @param {string} subId
 * @param {Object} subscription
 */
export async function upsertSubscriptionIndex(kv, subId, subscription) {
  const normalized = sanitizeSubscription(subscription, subId);
  if (!normalized) return false;
  const current = (await readSubscriptionIndex(kv)) || [];
  const byId = new Map(current.map(s => [s.id, s]));
  byId.set(subId, normalized);
  const next = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  return writeSubscriptionIndex(kv, next);
}

/**
 * Remove one subscription record from the materialized index.
 * Best-effort only.
 * @param {Object} kv
 * @param {string} subId
 */
export async function removeSubscriptionIndex(kv, subId) {
  if (!subId) return false;
  const current = await readSubscriptionIndex(kv);
  if (!current) return false;
  const next = current.filter(s => s.id !== subId);
  return writeSubscriptionIndex(kv, next);
}
