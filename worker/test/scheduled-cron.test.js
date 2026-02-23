import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkAlerts: vi.fn(async (env, fetchFn) => {
    await fetchFn('mt-horeb', env.FLAVOR_CACHE);
    return { checked: 1, sent: 0, errors: [] };
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

function createMockDb() {
  const writes = [];
  return {
    writes,
    prepare: vi.fn((sql) => ({
      bind: vi.fn((...params) => ({
        run: vi.fn(async () => {
          writes.push({ sql, params });
          return {};
        }),
        first: vi.fn(async () => null),
        all: vi.fn(async () => ({ results: [] })),
      })),
    })),
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
});
