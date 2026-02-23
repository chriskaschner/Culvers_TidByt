import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkAlerts: vi.fn(async (env, fetchFn) => {
    await fetchFn('mt-horeb', env.FLAVOR_CACHE);
    return { checked: 1, sent: 0, errors: [], fetchedSlugs: new Set(['mt-horeb']) };
  }),
  checkWeeklyDigests: vi.fn(async () => ({ checked: 0, sent: 0, errors: [] })),
  fetchFlavors: vi.fn(async (slug) => ({
    name: `Store ${slug}`,
    address: '123 Main St',
    flavors: [
      { date: '2026-02-23', title: 'Turtle', description: 'Pecan, caramel, fudge.' },
    ],
  })),
}));

vi.mock('../src/alert-checker.js', () => ({
  checkAlerts: mocks.checkAlerts,
  checkWeeklyDigests: mocks.checkWeeklyDigests,
}));

vi.mock('../src/flavor-fetcher.js', () => ({
  fetchFlavors: mocks.fetchFlavors,
}));

import worker from '../src/index.js';

function createMockKV() {
  const store = new Map();
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value) => store.set(key, value)),
    list: vi.fn(async () => ({ keys: [], list_complete: true })),
    _store: store,
  };
}

function createMockDb({ forecastSlugs = [] } = {}) {
  const writes = [];
  const cronState = new Map();
  return {
    writes,
    prepare: vi.fn((sql) => {
      // Handle queries that call .all() directly (no bind)
      const unboundAll = vi.fn(async () => {
        if (sql.includes('FROM forecasts')) {
          return { results: forecastSlugs.map(s => ({ slug: s })) };
        }
        return { results: [] };
      });
      return {
        all: unboundAll,
        bind: vi.fn((...params) => ({
          run: vi.fn(async () => {
            writes.push({ sql, params });
            if (sql.includes('INTO cron_state')) {
              cronState.set(params[0], params[1]);
            }
            return {};
          }),
          first: vi.fn(async () => {
            if (sql.includes('FROM cron_state')) {
              const val = cronState.get(params[0]);
              return val !== undefined ? { value: val } : null;
            }
            return null;
          }),
          all: vi.fn(async () => {
            if (sql.includes('FROM forecasts')) {
              return { results: forecastSlugs.map(s => ({ slug: s })) };
            }
            return { results: [] };
          }),
        })),
      };
    }),
  };
}

describe('scheduled cron integration', () => {
  beforeEach(() => {
    mocks.checkAlerts.mockClear();
    mocks.checkWeeklyDigests.mockClear();
    mocks.fetchFlavors.mockClear();
  });

  it('passes env through cron fetchFn so cache misses write snapshots to D1', async () => {
    const kv = createMockKV();
    const db = createMockDb();
    const env = {
      FLAVOR_CACHE: kv,
      DB: db,
    };

    let scheduledPromise = null;
    const ctx = {
      waitUntil: (p) => {
        scheduledPromise = p;
      },
    };

    await worker.scheduled({ cron: '0 12 * * *' }, env, ctx);
    expect(scheduledPromise).toBeTruthy();
    await scheduledPromise;

    expect(mocks.checkAlerts).toHaveBeenCalledTimes(1);
    expect(mocks.fetchFlavors).toHaveBeenCalledTimes(1);

    const wroteSnapshot = db.writes.some(entry => entry.sql.includes('INTO snapshots') && entry.sql.includes('ON CONFLICT'));
    expect(wroteSnapshot).toBe(true);

    const wroteCronRun = db.writes.some(entry => entry.sql.includes('INSERT INTO cron_runs'));
    expect(wroteCronRun).toBe(true);
  });

  it('forecast slug with no subscribers: cron harvest writes snapshot to D1', async () => {
    // checkAlerts returns fetchedSlugs=Set(['mt-horeb']), so middleton needs harvesting
    mocks.checkAlerts.mockImplementationOnce(async (env, fetchFn) => {
      await fetchFn('mt-horeb', env.FLAVOR_CACHE);
      return { checked: 1, sent: 0, errors: [], fetchedSlugs: new Set(['mt-horeb']) };
    });

    const kv = createMockKV();
    const db = createMockDb({ forecastSlugs: ['middleton', 'mt-horeb'] });
    const env = { FLAVOR_CACHE: kv, DB: db };

    let scheduledPromise = null;
    const ctx = { waitUntil: (p) => { scheduledPromise = p; } };

    await worker.scheduled({ cron: '0 12 * * *' }, env, ctx);
    await scheduledPromise;

    // middleton should be fetched by the harvest phase (mt-horeb already fetched by alerts)
    expect(mocks.fetchFlavors).toHaveBeenCalledWith('middleton');

    // Verify snapshot was written for middleton
    const middletonSnapshot = db.writes.some(
      entry => entry.sql.includes('INTO snapshots') && entry.params.some(p => p === 'middleton')
    );
    expect(middletonSnapshot).toBe(true);
  });

  it('harvest phase runs even without RESEND_API_KEY', async () => {
    // No API key: checkAlerts returns immediately with empty result
    mocks.checkAlerts.mockImplementationOnce(async () => {
      return { checked: 0, sent: 0, errors: [] };
    });

    const kv = createMockKV();
    const db = createMockDb({ forecastSlugs: ['madison-todd-drive'] });
    const env = { FLAVOR_CACHE: kv, DB: db };

    let scheduledPromise = null;
    const ctx = { waitUntil: (p) => { scheduledPromise = p; } };

    await worker.scheduled({ cron: '0 12 * * *' }, env, ctx);
    await scheduledPromise;

    // madison-todd-drive should be fetched by harvest (not skipped due to missing RESEND_API_KEY)
    expect(mocks.fetchFlavors).toHaveBeenCalledWith('madison-todd-drive');
  });
});
