import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleFlavorStats } from '../src/flavor-stats.js';

// ---------------------------------------------------------------------------
// Mock D1 database
// ---------------------------------------------------------------------------
// Stores an in-memory array of snapshot rows and routes SQL queries to
// client-side filters.  This keeps tests deterministic without needing a
// real D1 binding.

function createMockD1(rows = []) {
  function makeResultMethods(sql, args) {
    return {
      first: vi.fn(async () => {
        // Cross-store rarity: COUNT(DISTINCT slug) ... WHERE normalized_flavor = ? AND date >= ...
        if (sql.includes('COUNT(DISTINCT slug)') && sql.includes('store_count')) {
          const normalized = args[0];
          // We ignore the date filter in tests for simplicity — all rows count
          const slugs = new Set(rows.filter(r => r.normalized_flavor === normalized).map(r => r.slug));
          return { store_count: slugs.size };
        }
        return null;
      }),
      all: vi.fn(async () => {
        // Single-flavor dates: SELECT date FROM snapshots WHERE slug = ? AND normalized_flavor = ? ORDER BY date ASC
        if (sql.includes('SELECT date FROM snapshots') && sql.includes('ORDER BY date ASC')) {
          const slug = args[0];
          const normalized = args[1];
          const filtered = rows
            .filter(r => r.slug === slug && r.normalized_flavor === normalized)
            .sort((a, b) => a.date.localeCompare(b.date));
          return { results: filtered.map(r => ({ date: r.date })) };
        }

        // Month distribution: strftime('%m', date)
        if (sql.includes("strftime('%m'")) {
          const slug = args[0];
          const normalized = args[1];
          const filtered = rows.filter(r => r.slug === slug && r.normalized_flavor === normalized);
          const buckets = {};
          for (const r of filtered) {
            const m = parseInt(r.date.slice(5, 7), 10);
            buckets[m] = (buckets[m] || 0) + 1;
          }
          return { results: Object.entries(buckets).map(([month, count]) => ({ month: Number(month), count })) };
        }

        // DOW distribution: strftime('%w', date)
        if (sql.includes("strftime('%w'")) {
          const slug = args[0];
          const normalized = args[1];
          const filtered = rows.filter(r => r.slug === slug && r.normalized_flavor === normalized);
          const buckets = {};
          for (const r of filtered) {
            const dow = new Date(r.date + 'T12:00:00Z').getUTCDay();
            buckets[dow] = (buckets[dow] || 0) + 1;
          }
          return { results: Object.entries(buckets).map(([dow, count]) => ({ dow: Number(dow), count })) };
        }

        // Store overview: flavor counts grouped by normalized_flavor
        if (sql.includes('SELECT normalized_flavor, flavor, COUNT(*)') && sql.includes('GROUP BY normalized_flavor') && sql.includes('ORDER BY count DESC LIMIT 30')) {
          const slug = args[0];
          const filtered = rows.filter(r => r.slug === slug);
          const groups = {};
          for (const r of filtered) {
            if (!groups[r.normalized_flavor]) groups[r.normalized_flavor] = { normalized_flavor: r.normalized_flavor, flavor: r.flavor, count: 0 };
            groups[r.normalized_flavor].count++;
          }
          return { results: Object.values(groups).sort((a, b) => b.count - a.count).slice(0, 30) };
        }

        // Overdue flavors: MAX(date) ... HAVING appearances >= 3
        if (sql.includes('MAX(date)') && sql.includes('HAVING appearances >= 3')) {
          const slug = args[0];
          const filtered = rows.filter(r => r.slug === slug);
          const groups = {};
          for (const r of filtered) {
            if (!groups[r.normalized_flavor]) groups[r.normalized_flavor] = { normalized_flavor: r.normalized_flavor, flavor: r.flavor, last_seen: r.date, appearances: 0 };
            const g = groups[r.normalized_flavor];
            g.appearances++;
            if (r.date > g.last_seen) g.last_seen = r.date;
          }
          return {
            results: Object.values(groups)
              .filter(g => g.appearances >= 3)
              .sort((a, b) => a.last_seen.localeCompare(b.last_seen))
              .slice(0, 10),
          };
        }

        return { results: [] };
      }),
    };
  }

  return {
    prepare: vi.fn((sql) => {
      const unboundMethods = makeResultMethods(sql, []);
      return {
        ...unboundMethods,
        bind: vi.fn((...args) => makeResultMethods(sql, args)),
      };
    }),
  };
}

/**
 * Build a mock Request with optional query params.
 */
function makeRequest(slug, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const urlStr = `https://example.com/api/v1/flavor-stats/${slug}${qs ? '?' + qs : ''}`;
  return new Request(urlStr);
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

// Consecutive dates for streak testing, with varied flavors for personality
function buildTestRows() {
  return [
    // Turtle: 5 appearances at mt-horeb, including a 3-day streak
    { slug: 'mt-horeb', date: '2026-01-10', flavor: 'Turtle', normalized_flavor: 'turtle' },
    { slug: 'mt-horeb', date: '2026-01-11', flavor: 'Turtle', normalized_flavor: 'turtle' },
    { slug: 'mt-horeb', date: '2026-01-12', flavor: 'Turtle', normalized_flavor: 'turtle' },
    { slug: 'mt-horeb', date: '2026-01-20', flavor: 'Turtle', normalized_flavor: 'turtle' },
    { slug: 'mt-horeb', date: '2026-02-05', flavor: 'Turtle', normalized_flavor: 'turtle' },

    // Caramel Pecan: 3 appearances
    { slug: 'mt-horeb', date: '2026-01-15', flavor: 'Caramel Pecan', normalized_flavor: 'caramel pecan' },
    { slug: 'mt-horeb', date: '2026-01-25', flavor: 'Caramel Pecan', normalized_flavor: 'caramel pecan' },
    { slug: 'mt-horeb', date: '2026-02-10', flavor: 'Caramel Pecan', normalized_flavor: 'caramel pecan' },

    // Mint Explosion: 2 appearances (not enough for overdue list)
    { slug: 'mt-horeb', date: '2026-01-18', flavor: 'Mint Explosion', normalized_flavor: 'mint explosion' },
    { slug: 'mt-horeb', date: '2026-02-08', flavor: 'Mint Explosion', normalized_flavor: 'mint explosion' },

    // Butter Pecan: 4 appearances for overdue + pecan family
    { slug: 'mt-horeb', date: '2025-11-01', flavor: 'Butter Pecan', normalized_flavor: 'butter pecan' },
    { slug: 'mt-horeb', date: '2025-11-15', flavor: 'Butter Pecan', normalized_flavor: 'butter pecan' },
    { slug: 'mt-horeb', date: '2025-12-01', flavor: 'Butter Pecan', normalized_flavor: 'butter pecan' },
    { slug: 'mt-horeb', date: '2025-12-20', flavor: 'Butter Pecan', normalized_flavor: 'butter pecan' },

    // Cross-store: turtle at another store
    { slug: 'madison-todd-drive', date: '2026-02-01', flavor: 'Turtle', normalized_flavor: 'turtle' },
    { slug: 'madison-todd-drive', date: '2026-02-02', flavor: 'Turtle', normalized_flavor: 'turtle' },
  ];
}

// ---------------------------------------------------------------------------
// Tests: single-flavor mode (?flavor=...)
// ---------------------------------------------------------------------------

describe('flavor-stats: single-flavor mode', () => {
  it('returns overdue, seasonality, dow, streaks for a flavor', async () => {
    const db = createMockD1(buildTestRows());
    const req = makeRequest('mt-horeb', { flavor: 'Turtle' });
    const res = await handleFlavorStats(req, { DB: db }, 'mt-horeb');

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.flavor).toBe('Turtle');
    expect(body.appearances).toBe(5);
    expect(body.last_seen).toBe('2026-02-05');
    expect(body.avg_gap_days).toBeGreaterThan(0);
    expect(typeof body.days_since_last).toBe('number');
    expect(typeof body.overdue_days).toBe('number');
    expect(body.annual_frequency).toBeGreaterThan(0);

    // Seasonality
    expect(body.seasonality).not.toBeNull();
    expect(body.seasonality.peak_months).toHaveLength(3);
    expect(typeof body.seasonality.concentration).toBe('number');
    expect(body.seasonality.distribution).toHaveLength(12);

    // DOW bias
    expect(body.dowBias || body.dow_bias).toBeDefined();
    const dow = body.dow_bias;
    expect(dow.distribution).toHaveLength(7);
    expect(typeof dow.chi_squared).toBe('number');
    expect(typeof dow.has_bias).toBe('boolean');
    expect(DAY_NAMES).toContain(dow.peak_name);

    // Streaks: 3-day streak (Jan 10-12)
    expect(body.streaks.longest).toBe(3);

    // Cross-store rarity
    expect(body.stores_last_30d).toBeGreaterThanOrEqual(1);
  });

  it('handles flavor with no appearances', async () => {
    const db = createMockD1(buildTestRows());
    const req = makeRequest('mt-horeb', { flavor: 'Nonexistent Flavor' });
    const res = await handleFlavorStats(req, { DB: db }, 'mt-horeb');

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.flavor).toBe('Nonexistent Flavor');
    expect(body.appearances).toBe(0);
    expect(body.avg_gap_days).toBeNull();
    expect(body.last_seen).toBeNull();
    expect(body.days_since_last).toBeNull();
    expect(body.overdue_days).toBe(0);
    expect(body.annual_frequency).toBeNull();
    expect(body.seasonality).toBeNull();
    expect(body.dow_bias).toBeNull();
    expect(body.streaks).toEqual({ current: 0, longest: 0 });
  });

  it('handles flavor with exactly one appearance', async () => {
    const rows = [
      { slug: 'mt-horeb', date: '2026-02-01', flavor: 'Unique Special', normalized_flavor: 'unique special' },
    ];
    const db = createMockD1(rows);
    const req = makeRequest('mt-horeb', { flavor: 'Unique Special' });
    const res = await handleFlavorStats(req, { DB: db }, 'mt-horeb');

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.appearances).toBe(1);
    expect(body.avg_gap_days).toBeNull();
    expect(body.last_seen).toBe('2026-02-01');
    expect(typeof body.days_since_last).toBe('number');
    expect(body.annual_frequency).toBeNull();
    // Seasonality still computes from 1 appearance
    expect(body.seasonality).not.toBeNull();
    expect(body.seasonality.distribution[1]).toBe(1); // February index
  });

  it('returns cross-store rarity count', async () => {
    const db = createMockD1(buildTestRows());
    const req = makeRequest('mt-horeb', { flavor: 'Turtle' });
    const res = await handleFlavorStats(req, { DB: db }, 'mt-horeb');

    const body = await res.json();
    // Turtle appears at mt-horeb and madison-todd-drive
    expect(body.stores_last_30d).toBe(2);
  });

  it('normalizes flavor query (trademarks, whitespace)', async () => {
    const rows = [
      { slug: 'mt-horeb', date: '2026-02-01', flavor: 'Really Reeses', normalized_flavor: 'really reeses' },
    ];
    const db = createMockD1(rows);
    // Simulate a query with trademark symbol and extra spaces
    const req = makeRequest('mt-horeb', { flavor: '  Really  Reeses\u00ae ' });
    const res = await handleFlavorStats(req, { DB: db }, 'mt-horeb');

    const body = await res.json();
    expect(body.appearances).toBe(1);
  });

  it('detects longest streak correctly across non-consecutive gaps', async () => {
    const rows = [
      // 2-day streak
      { slug: 'test-store', date: '2026-01-01', flavor: 'Turtle', normalized_flavor: 'turtle' },
      { slug: 'test-store', date: '2026-01-02', flavor: 'Turtle', normalized_flavor: 'turtle' },
      // gap
      { slug: 'test-store', date: '2026-01-10', flavor: 'Turtle', normalized_flavor: 'turtle' },
      // 4-day streak
      { slug: 'test-store', date: '2026-01-20', flavor: 'Turtle', normalized_flavor: 'turtle' },
      { slug: 'test-store', date: '2026-01-21', flavor: 'Turtle', normalized_flavor: 'turtle' },
      { slug: 'test-store', date: '2026-01-22', flavor: 'Turtle', normalized_flavor: 'turtle' },
      { slug: 'test-store', date: '2026-01-23', flavor: 'Turtle', normalized_flavor: 'turtle' },
    ];
    const db = createMockD1(rows);
    const req = makeRequest('test-store', { flavor: 'Turtle' });
    const res = await handleFlavorStats(req, { DB: db }, 'test-store');

    const body = await res.json();
    expect(body.streaks.longest).toBe(4);
  });
});

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---------------------------------------------------------------------------
// Tests: store overview mode (no ?flavor param)
// ---------------------------------------------------------------------------

describe('flavor-stats: store overview mode', () => {
  it('returns store personality with top families', async () => {
    const db = createMockD1(buildTestRows());
    const req = makeRequest('mt-horeb');
    const res = await handleFlavorStats(req, { DB: db }, 'mt-horeb');

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.slug).toBe('mt-horeb');
    expect(body.personality).toBeDefined();
    expect(body.personality.top_families).toBeDefined();
    expect(Array.isArray(body.personality.top_families)).toBe(true);
    expect(body.personality.total_observations).toBeGreaterThan(0);

    // Turtle is in the turtle family, caramel pecan is in caramel + pecan families,
    // butter pecan is in pecan family, mint explosion is in mint family
    const familyNames = body.personality.top_families.map(f => f.family);
    // At minimum we expect turtle and pecan families
    expect(familyNames).toContain('turtle');
    expect(familyNames).toContain('pecan');

    // Each family entry has the right shape
    for (const fam of body.personality.top_families) {
      expect(fam).toHaveProperty('family');
      expect(fam).toHaveProperty('count');
      expect(fam).toHaveProperty('percentage');
      expect(fam.count).toBeGreaterThan(0);
    }
  });

  it('returns overdue flavor list', async () => {
    const db = createMockD1(buildTestRows());
    const req = makeRequest('mt-horeb');
    const res = await handleFlavorStats(req, { DB: db }, 'mt-horeb');

    const body = await res.json();
    expect(Array.isArray(body.overdue)).toBe(true);
    // Only flavors with >= 3 appearances qualify: turtle (5), caramel pecan (3), butter pecan (4)
    expect(body.overdue.length).toBeGreaterThanOrEqual(1);
    expect(body.overdue.length).toBeLessThanOrEqual(5);

    for (const item of body.overdue) {
      expect(item).toHaveProperty('flavor');
      expect(item).toHaveProperty('last_seen');
      expect(item).toHaveProperty('days_since');
      expect(item).toHaveProperty('appearances');
      expect(item.appearances).toBeGreaterThanOrEqual(3);
    }

    // Overdue list is sorted by last_seen ASC (oldest first)
    for (let i = 1; i < body.overdue.length; i++) {
      expect(body.overdue[i].last_seen >= body.overdue[i - 1].last_seen).toBe(true);
    }
  });

  it('returns unique_flavors count', async () => {
    const db = createMockD1(buildTestRows());
    const req = makeRequest('mt-horeb');
    const res = await handleFlavorStats(req, { DB: db }, 'mt-horeb');

    const body = await res.json();
    // mt-horeb has turtle, caramel pecan, mint explosion, butter pecan = 4
    expect(body.unique_flavors).toBe(4);
  });

  it('returns empty overview for unknown store', async () => {
    const db = createMockD1(buildTestRows());
    const req = makeRequest('nonexistent-store');
    const res = await handleFlavorStats(req, { DB: db }, 'nonexistent-store');

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.slug).toBe('nonexistent-store');
    expect(body.personality.top_families).toEqual([]);
    expect(body.personality.total_observations).toBe(0);
    expect(body.overdue).toEqual([]);
    expect(body.unique_flavors).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: error handling
// ---------------------------------------------------------------------------

describe('flavor-stats: error handling', () => {
  it('returns 503 when no DB configured', async () => {
    const req = makeRequest('mt-horeb');
    const res = await handleFlavorStats(req, {}, 'mt-horeb');

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/no database/i);
  });

  it('returns 503 when DB is null', async () => {
    const req = makeRequest('mt-horeb', { flavor: 'Turtle' });
    const res = await handleFlavorStats(req, { DB: null }, 'mt-horeb');

    expect(res.status).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// Tests: route integration (via index.js handleRequest)
// ---------------------------------------------------------------------------

describe('flavor-stats: route integration', () => {
  it('is accessible at /api/v1/flavor-stats/{slug}', async () => {
    // Import handleRequest to verify routing
    const { handleRequest } = await import('../src/index.js');
    const db = createMockD1(buildTestRows());
    const env = {
      DB: db,
      FLAVOR_CACHE: null,
      _validSlugsOverride: new Set(['mt-horeb']),
    };

    const req = new Request('https://example.com/api/v1/flavor-stats/mt-horeb');
    const res = await handleRequest(req, env, () => {});

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe('mt-horeb');
    // Should have API-Version header since using /api/v1/
    expect(res.headers.get('API-Version')).toBe('1');
  });

  it('decodes URL-encoded slugs in path', async () => {
    const { handleRequest } = await import('../src/index.js');
    const db = createMockD1(buildTestRows());
    const env = {
      DB: db,
      FLAVOR_CACHE: null,
      _validSlugsOverride: new Set(['mt-horeb']),
    };

    const req = new Request('https://example.com/api/v1/flavor-stats/mt-horeb?flavor=Caramel%20Pecan');
    const res = await handleRequest(req, env, () => {});

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flavor).toBe('Caramel Pecan');
    expect(body.appearances).toBe(3);
  });
});
