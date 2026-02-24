import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeReliability,
  saveReliability,
  getReliability,
  getAllReliability,
  getReliabilityBatch,
  refreshReliabilityBatch,
  handleReliabilityRoute,
} from '../src/reliability.js';

// --- D1 mock helpers ---

function isoDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function createSnapshotRows(opts = {}) {
  const { daysPresent = 30, lagHours = 6, brand = 'culvers', slug = 'mt-horeb' } = opts;
  const rows = [];
  for (let i = 0; i < daysPresent; i++) {
    const date = isoDate(i);
    const dateMidnight = new Date(date + 'T00:00:00Z');
    const fetchedAt = new Date(dateMidnight.getTime() + lagHours * 3600000);
    rows.push({
      date,
      fetched_at: fetchedAt.toISOString(),
      brand,
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

function mockDb(queryResults = {}) {
  const run = vi.fn(async () => ({}));
  const first = vi.fn(async () => null);
  const all = vi.fn(async () => ({ results: [] }));

  const bind = vi.fn(function () {
    return { run, first, all };
  });

  const prepare = vi.fn(function (sql) {
    // Match query to results
    for (const [pattern, result] of Object.entries(queryResults)) {
      if (sql.includes(pattern)) {
        const boundAll = vi.fn(async () => ({ results: typeof result === 'function' ? result(sql) : result }));
        const boundFirst = vi.fn(async () => {
          const results = typeof result === 'function' ? result(sql) : result;
          return Array.isArray(results) ? results[0] || null : results;
        });
        return {
          bind: vi.fn(function () { return { run, first: boundFirst, all: boundAll }; }),
          all: boundAll,
          first: boundFirst,
          run,
        };
      }
    }
    return { bind, all, first, run };
  });

  return { prepare, _run: run, _bind: bind, _first: first, _all: all };
}

// --- Tests ---

describe('computeReliability', () => {
  it('returns null for null db', async () => {
    expect(await computeReliability(null, 'mt-horeb')).toBeNull();
  });

  it('returns null for null slug', async () => {
    const db = mockDb();
    expect(await computeReliability(db, null)).toBeNull();
  });

  it('returns null when no snapshots exist', async () => {
    const db = mockDb({ 'FROM snapshots': [] });
    expect(await computeReliability(db, 'mt-horeb')).toBeNull();
  });

  it('computes high reliability for store with all 30 days present', async () => {
    const rows = createSnapshotRows({ daysPresent: 30, lagHours: 4 });
    const db = mockDb({ 'FROM snapshots': rows });

    const result = await computeReliability(db, 'mt-horeb');

    expect(result).not.toBeNull();
    expect(result.slug).toBe('mt-horeb');
    expect(result.brand).toBe('culvers');
    expect(result.reliability_tier).toBe('confirmed');
    expect(result.reliability_score).toBeGreaterThanOrEqual(0.7);
    expect(result.missing_window_rate).toBe(0);
    expect(result.window_days).toBe(30);
    expect(result.computed_at).toBeTruthy();
  });

  it('computes low reliability for store with many missing days', async () => {
    // Only 5 days present out of 30
    const rows = createSnapshotRows({ daysPresent: 5, lagHours: 18 });
    const db = mockDb({ 'FROM snapshots': rows });

    const result = await computeReliability(db, 'sparse-store');

    expect(result).not.toBeNull();
    expect(result.reliability_score).toBeLessThan(0.7);
    expect(result.missing_window_rate).toBeGreaterThan(0);
    expect(result.reason).toBeTruthy();
  });

  it('computes watch tier for borderline store', async () => {
    // 18 days present, moderate lag
    const rows = createSnapshotRows({ daysPresent: 18, lagHours: 10 });
    const db = mockDb({ 'FROM snapshots': rows });

    const result = await computeReliability(db, 'borderline');

    expect(result).not.toBeNull();
    expect(result.reliability_score).toBeGreaterThanOrEqual(0.4);
    expect(result.reliability_score).toBeLessThan(0.7);
    expect(result.reliability_tier).toBe('watch');
  });

  it('correctly classifies unreliable store', async () => {
    // Only 3 days present out of 30 with high lag
    const rows = createSnapshotRows({ daysPresent: 3, lagHours: 20 });
    const db = mockDb({ 'FROM snapshots': rows });

    const result = await computeReliability(db, 'unreliable-store');

    expect(result).not.toBeNull();
    expect(result.reliability_tier).toBe('unreliable');
    expect(result.reliability_score).toBeLessThan(0.4);
  });

  it('includes freshness lag in computation', async () => {
    // Perfect coverage but high lag
    const rows = createSnapshotRows({ daysPresent: 30, lagHours: 22 });
    const db = mockDb({ 'FROM snapshots': rows });

    const result = await computeReliability(db, 'laggy-store');

    expect(result).not.toBeNull();
    expect(result.freshness_lag_avg_hours).toBeGreaterThan(20);
    // High lag should reduce score even with perfect coverage
    expect(result.reliability_score).toBeLessThan(1.0);
  });

  it('score is bounded between 0 and 1', async () => {
    const rows = createSnapshotRows({ daysPresent: 1, lagHours: 48 });
    const db = mockDb({ 'FROM snapshots': rows });

    const result = await computeReliability(db, 'worst-store');

    expect(result).not.toBeNull();
    expect(result.reliability_score).toBeGreaterThanOrEqual(0);
    expect(result.reliability_score).toBeLessThanOrEqual(1);
  });

  it('recovery_time_avg_hours increases with longer gaps', async () => {
    // Gaps in the middle: days 0-9 present, 10-19 missing, 20-29 present
    const rows = [];
    for (let i = 0; i < 10; i++) {
      rows.push({
        date: isoDate(i),
        fetched_at: new Date(isoDate(i) + 'T06:00:00Z').toISOString(),
        brand: 'culvers',
      });
    }
    for (let i = 20; i < 30; i++) {
      rows.push({
        date: isoDate(i),
        fetched_at: new Date(isoDate(i) + 'T06:00:00Z').toISOString(),
        brand: 'culvers',
      });
    }
    const db = mockDb({ 'FROM snapshots': rows.sort((a, b) => a.date.localeCompare(b.date)) });

    const result = await computeReliability(db, 'gappy-store');

    expect(result).not.toBeNull();
    expect(result.recovery_time_avg_hours).toBeGreaterThan(0);
    expect(result.missing_window_rate).toBeCloseTo(10 / 30, 1);
  });
});

describe('saveReliability', () => {
  it('no-ops when db is null', async () => {
    await saveReliability(null, { slug: 'test' });
    // No error thrown
  });

  it('no-ops when record is null', async () => {
    const db = mockDb();
    await saveReliability(db, null);
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it('calls D1 with upsert SQL', async () => {
    const run = vi.fn(async () => ({}));
    const bind = vi.fn(() => ({ run }));
    const prepare = vi.fn(() => ({ bind }));
    const db = { prepare };

    const record = {
      slug: 'mt-horeb',
      brand: 'culvers',
      freshness_lag_avg_hours: 5.5,
      missing_window_rate: 0.1,
      forward_change_rate: null,
      late_change_rate: null,
      recovery_time_avg_hours: 12,
      reliability_score: 0.82,
      reliability_tier: 'confirmed',
      reason: null,
      computed_at: '2026-02-24T12:00:00Z',
      window_days: 30,
    };

    await saveReliability(db, record);

    expect(prepare).toHaveBeenCalledOnce();
    expect(prepare.mock.calls[0][0]).toContain('ON CONFLICT(slug)');
    expect(bind).toHaveBeenCalledWith(
      'mt-horeb', 'culvers', 5.5, 0.1, null, null, 12,
      0.82, 'confirmed', null, '2026-02-24T12:00:00Z', 30
    );
    expect(run).toHaveBeenCalledOnce();
  });
});

describe('getReliability', () => {
  it('returns null for null db', async () => {
    expect(await getReliability(null, 'mt-horeb')).toBeNull();
  });

  it('returns null for null slug', async () => {
    const db = mockDb();
    expect(await getReliability(db, null)).toBeNull();
  });

  it('returns store data when present', async () => {
    const record = { slug: 'mt-horeb', reliability_tier: 'confirmed', reliability_score: 0.85 };
    const db = mockDb({ 'FROM store_reliability': record });

    const result = await getReliability(db, 'mt-horeb');
    expect(result).not.toBeNull();
    expect(result.slug).toBe('mt-horeb');
  });
});

describe('getAllReliability', () => {
  it('returns empty array for null db', async () => {
    expect(await getAllReliability(null)).toEqual([]);
  });

  it('returns all stores', async () => {
    const stores = [
      { slug: 'a', reliability_tier: 'confirmed', reliability_score: 0.9 },
      { slug: 'b', reliability_tier: 'watch', reliability_score: 0.5 },
    ];
    const db = mockDb({ 'FROM store_reliability': stores });

    const result = await getAllReliability(db);
    expect(result).toHaveLength(2);
  });
});

describe('getReliabilityBatch', () => {
  it('returns empty for null db', async () => {
    const result = await getReliabilityBatch(null, 25, 0);
    expect(result.slugs).toEqual([]);
    expect(result.nextCursor).toBe(0);
  });

  it('returns batch of slugs with cursor advancement', async () => {
    const allSlugs = Array.from({ length: 60 }, (_, i) => ({ slug: `store-${String(i).padStart(3, '0')}` }));
    const db = mockDb({ 'DISTINCT slug FROM snapshots': allSlugs });

    const { slugs, nextCursor } = await getReliabilityBatch(db, 25, 0);
    expect(slugs).toHaveLength(25);
    expect(nextCursor).toBe(25);
  });

  it('wraps cursor to 0 at end of list', async () => {
    const allSlugs = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }];
    const db = mockDb({ 'DISTINCT slug FROM snapshots': allSlugs });

    const { slugs, nextCursor } = await getReliabilityBatch(db, 25, 0);
    expect(slugs).toHaveLength(3);
    expect(nextCursor).toBe(0);
  });
});

describe('refreshReliabilityBatch', () => {
  it('processes stores and returns counts', async () => {
    const rows = createSnapshotRows({ daysPresent: 30, lagHours: 4 });
    const run = vi.fn(async () => ({}));
    const bind = vi.fn(() => ({ run }));

    const db = {
      prepare: vi.fn((sql) => {
        if (sql.includes('FROM snapshots')) {
          return {
            bind: vi.fn(() => ({
              all: vi.fn(async () => ({ results: rows })),
              run,
            })),
          };
        }
        return { bind };
      }),
    };

    const result = await refreshReliabilityBatch(db, ['mt-horeb', 'madison']);
    expect(result.processed).toBe(2);
    expect(result.errors).toBe(0);
  });
});

describe('handleReliabilityRoute', () => {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

  it('returns null for unmatched path', async () => {
    const env = { DB: mockDb() };
    const result = await handleReliabilityRoute('/api/other', env, corsHeaders);
    expect(result).toBeNull();
  });

  it('returns 404 for unknown slug', async () => {
    const db = mockDb({ 'FROM store_reliability': [] });
    const env = { DB: db };

    const result = await handleReliabilityRoute('/api/reliability/unknown-store', env, corsHeaders);
    expect(result.status).toBe(404);
  });

  it('returns store data for known slug', async () => {
    const record = { slug: 'mt-horeb', reliability_tier: 'confirmed', reliability_score: 0.85 };
    const db = mockDb({ 'FROM store_reliability': record });
    const env = { DB: db };

    const result = await handleReliabilityRoute('/api/reliability/mt-horeb', env, corsHeaders);
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.slug).toBe('mt-horeb');
  });

  it('returns bulk data for /api/reliability', async () => {
    const stores = [
      { slug: 'a', reliability_tier: 'confirmed', reliability_score: 0.9 },
      { slug: 'b', reliability_tier: 'watch', reliability_score: 0.5 },
    ];
    const db = mockDb({ 'FROM store_reliability': stores });
    const env = { DB: db };

    const result = await handleReliabilityRoute('/api/reliability', env, corsHeaders);
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.stores).toHaveLength(2);
  });
});
