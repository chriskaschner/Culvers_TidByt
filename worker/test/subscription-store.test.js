import { describe, it, expect, vi } from 'vitest';
import {
  SUBSCRIPTION_INDEX_KEY,
  listSubscriptions,
  readSubscriptionIndex,
  upsertSubscriptionIndex,
  removeSubscriptionIndex,
} from '../src/subscription-store.js';

function createMockKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value) => store.set(key, value)),
    list: vi.fn(async (opts) => {
      const prefix = opts?.prefix || '';
      const keys = [];
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) keys.push({ name: key });
      }
      return { keys, list_complete: true };
    }),
    _store: store,
  };
}

describe('subscription-store', () => {
  it('prefers materialized index over KV list scan', async () => {
    const kv = createMockKV({
      [SUBSCRIPTION_INDEX_KEY]: JSON.stringify([
        {
          id: 'abc',
          email: 'a@test.com',
          slug: 'mt-horeb',
          favorites: ['Turtle'],
          frequency: 'daily',
          unsubToken: 'tok-1',
          createdAt: '2026-02-23T00:00:00.000Z',
        },
      ]),
    });

    const subs = await listSubscriptions(kv);
    expect(subs).toHaveLength(1);
    expect(subs[0].id).toBe('abc');
    expect(kv.list).not.toHaveBeenCalled();
  });

  it('builds index from legacy scan when index is absent', async () => {
    const kv = createMockKV({
      'alert:sub:abc': JSON.stringify({
        email: 'a@test.com',
        slug: 'mt-horeb',
        favorites: ['Turtle'],
        frequency: 'daily',
        unsubToken: 'tok-1',
        createdAt: '2026-02-23T00:00:00.000Z',
      }),
    });

    const subs = await listSubscriptions(kv);
    expect(subs).toHaveLength(1);
    const indexed = await readSubscriptionIndex(kv);
    expect(indexed).toHaveLength(1);
    expect(indexed[0].id).toBe('abc');
  });

  it('supports upsert + remove in materialized index', async () => {
    const kv = createMockKV();
    await upsertSubscriptionIndex(kv, 'abc', {
      email: 'a@test.com',
      slug: 'mt-horeb',
      favorites: ['Turtle'],
      frequency: 'daily',
      unsubToken: 'tok-1',
      createdAt: '2026-02-23T00:00:00.000Z',
    });

    let indexed = await readSubscriptionIndex(kv);
    expect(indexed).toHaveLength(1);
    expect(indexed[0].id).toBe('abc');

    await removeSubscriptionIndex(kv, 'abc');
    indexed = await readSubscriptionIndex(kv);
    expect(indexed).toEqual([]);
  });
});
