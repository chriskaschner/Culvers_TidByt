import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDrive } from '../src/drive.js';
import { makeFlavorCacheRecord } from '../src/kv-cache.js';
import { buildDealbreakers, buildVibeTags, extractFlavorTags } from '../src/flavor-tags.js';

function createMockKV() {
  const store = new Map();
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value) => store.set(key, value)),
    _store: store,
  };
}

function setFlavorCache(kv, slug, payload) {
  kv._store.set(`flavors:${slug}`, makeFlavorCacheRecord(payload, slug, false));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowIso() {
  return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
}

describe('flavor-tags helpers', () => {
  it('extracts nuts + caramel tags from name and description', () => {
    const tags = extractFlavorTags('Caramel Cashew', 'Vanilla custard with caramel and cashew pieces');
    expect(tags).toContain('nuts');
    expect(tags).toContain('caramel');
  });

  it('builds top-3 vibe labels in deterministic priority order', () => {
    const vibes = buildVibeTags(['mint', 'bright', 'chocolate', 'rich', 'cookie']);
    expect(vibes).toEqual(['Bright', 'Chocolatey', 'Rich']);
  });

  it('maps excluded tags to user-facing dealbreakers', () => {
    expect(buildDealbreakers(['nuts', 'cheesecake'])).toEqual(['Contains nuts', 'Contains cheesecake']);
  });
});

describe('handleDrive', () => {
  let env;
  let corsHeaders;
  let mockKv;
  const validSlugs = new Set(['mt-horeb', 'madison-todd-drive', 'middleton']);

  beforeEach(() => {
    mockKv = createMockKV();
    env = {
      FLAVOR_CACHE: mockKv,
      _validSlugsOverride: validSlugs,
      _storeIndexOverride: [
        { slug: 'mt-horeb', name: "Culver's of Mt. Horeb", address: '1 Main', lat: 43.01, lng: -89.72, city: 'Mt. Horeb', state: 'WI', brand: 'culvers' },
        { slug: 'madison-todd-drive', name: "Culver's of Madison", address: '2 Main', lat: 43.07, lng: -89.39, city: 'Madison', state: 'WI', brand: 'culvers' },
        { slug: 'middleton', name: "Culver's of Middleton", address: '3 Main', lat: 43.1, lng: -89.5, city: 'Middleton', state: 'WI', brand: 'culvers' },
      ],
    };
    corsHeaders = { 'Access-Control-Allow-Origin': '*' };
  });

  it('returns 400 for invalid slugs payload', async () => {
    const url = new URL('https://example.com/api/v1/drive?slugs=mt-horeb');
    const res = await handleDrive(url, env, corsHeaders);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/slugs/i);
  });

  it('returns 400 when more than 5 slugs are provided', async () => {
    env._validSlugsOverride = new Set([
      'mt-horeb',
      'madison-todd-drive',
      'middleton',
      'verona',
      'fitchburg',
      'sun-prairie',
    ]);
    const url = new URL(
      'https://example.com/api/v1/drive?slugs=mt-horeb,madison-todd-drive,middleton,verona,fitchburg,sun-prairie'
    );
    const res = await handleDrive(url, env, corsHeaders);
    expect(res.status).toBe(400);
  });

  it('excludes hard-pass cards when No Nuts is active', async () => {
    const today = todayIso();
    setFlavorCache(mockKv, 'mt-horeb', {
      name: "Culver's of Mt. Horeb",
      flavors: [{ date: today, title: 'Caramel Cashew', description: 'Vanilla with caramel and cashew pieces' }],
    });
    setFlavorCache(mockKv, 'madison-todd-drive', {
      name: "Culver's of Madison",
      flavors: [{ date: today, title: 'Lemon Ice', description: 'Lemon bright flavor' }],
    });

    const url = new URL('https://example.com/api/v1/drive?slugs=mt-horeb,madison-todd-drive&exclude=nuts');
    const res = await handleDrive(url, env, corsHeaders);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.cards).toHaveLength(1);
    expect(json.cards[0].slug).toBe('madison-todd-drive');
    expect(json.excluded).toHaveLength(1);
    expect(json.excluded[0].slug).toBe('mt-horeb');
    expect(json.excluded[0].reason_codes).toContain('nuts');
  });

  it('sorts cards by detour distance when sort=detour', async () => {
    const today = todayIso();
    setFlavorCache(mockKv, 'mt-horeb', {
      name: "Culver's of Mt. Horeb",
      flavors: [{ date: today, title: 'Turtle', description: 'Vanilla with pecan and caramel' }],
    });
    setFlavorCache(mockKv, 'madison-todd-drive', {
      name: "Culver's of Madison",
      flavors: [{ date: today, title: 'Mint Explosion', description: 'Mint and oreo' }],
    });

    const url = new URL(
      'https://example.com/api/v1/drive?slugs=mt-horeb,madison-todd-drive&location=43.0700,-89.3900&sort=detour&radius=25'
    );
    const res = await handleDrive(url, env, corsHeaders);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cards.length).toBeGreaterThanOrEqual(2);
    expect(json.cards[0].distance_miles).toBeLessThanOrEqual(json.cards[1].distance_miles);
  });

  it('applies boost + avoid scoring and map buckets deterministically', async () => {
    const today = todayIso();
    setFlavorCache(mockKv, 'mt-horeb', {
      name: "Culver's of Mt. Horeb",
      flavors: [{ date: today, title: 'Lemon Berry Crisp', description: 'Bright lemon berry flavor' }],
    });
    setFlavorCache(mockKv, 'madison-todd-drive', {
      name: "Culver's of Madison",
      flavors: [{ date: today, title: 'Mint Oreo', description: 'Mint cookies and cream' }],
    });

    env.DB = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({
            results: [{ date: '2026-01-01' }, { date: '2025-10-01' }],
          })),
        })),
      })),
    };

    const url = new URL(
      'https://example.com/api/v1/drive?slugs=mt-horeb,madison-todd-drive&boost=fruit&avoid=mint&sort=match'
    );
    const res = await handleDrive(url, env, corsHeaders);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.cards).toHaveLength(2);
    const top = json.cards[0];
    const bottom = json.cards[1];
    expect(top.slug).toBe('mt-horeb');
    expect(top.score).toBeGreaterThan(bottom.score);
    expect(top.map_bucket).toBe('great');
  });

  it('uses estimated fallback when no confirmed flavors exist for the route', async () => {
    const today = todayIso();
    // No today's flavor for either store.
    setFlavorCache(mockKv, 'mt-horeb', {
      name: "Culver's of Mt. Horeb",
      flavors: [{ date: '2025-01-01', title: 'Old Flavor', description: '' }],
    });
    setFlavorCache(mockKv, 'madison-todd-drive', {
      name: "Culver's of Madison",
      flavors: [{ date: '2025-01-01', title: 'Old Flavor', description: '' }],
    });
    mockKv._store.set(`forecast:mt-horeb`, JSON.stringify({
      store_slug: 'mt-horeb',
      date: today,
      predictions: [{ flavor: 'Mint Explosion', probability: 0.45 }],
    }));

    const url = new URL('https://example.com/api/v1/drive?slugs=mt-horeb,madison-todd-drive');
    const res = await handleDrive(url, env, corsHeaders);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cards.length).toBeGreaterThanOrEqual(1);
    expect(json.cards.some((card) => card.source === 'estimated')).toBe(true);
  });

  it('returns confirmed tomorrow payload when include_tomorrow=1 and tomorrow is posted', async () => {
    const today = todayIso();
    const tomorrow = tomorrowIso();
    setFlavorCache(mockKv, 'mt-horeb', {
      name: "Culver's of Mt. Horeb",
      flavors: [
        { date: today, title: 'Mint Explosion', description: 'Mint with oreo' },
        { date: tomorrow, title: 'Caramel Cashew', description: 'Vanilla with caramel and cashew pieces' },
      ],
    });
    setFlavorCache(mockKv, 'madison-todd-drive', {
      name: "Culver's of Madison",
      flavors: [{ date: today, title: 'Lemon Ice', description: 'Lemon bright flavor' }],
    });

    const url = new URL(
      'https://example.com/api/v1/drive?slugs=mt-horeb,madison-todd-drive&include_tomorrow=1'
    );
    const res = await handleDrive(url, env, corsHeaders);
    expect(res.status).toBe(200);
    const json = await res.json();

    const mtHoreb = json.cards.find((card) => card.slug === 'mt-horeb');
    const madison = json.cards.find((card) => card.slug === 'madison-todd-drive');
    expect(mtHoreb.tomorrow).toEqual({
      date: tomorrow,
      flavor: 'Caramel Cashew',
      description: 'Vanilla with caramel and cashew pieces',
      certainty_tier: 'confirmed',
    });
    expect(madison.tomorrow).toBeNull();
    expect(json.query.include_tomorrow).toBe(1);
  });

  it('omits tomorrow field when include_tomorrow is not enabled', async () => {
    const today = todayIso();
    setFlavorCache(mockKv, 'mt-horeb', {
      name: "Culver's of Mt. Horeb",
      flavors: [{ date: today, title: 'Mint Explosion', description: 'Mint with oreo' }],
    });
    setFlavorCache(mockKv, 'madison-todd-drive', {
      name: "Culver's of Madison",
      flavors: [{ date: today, title: 'Lemon Ice', description: 'Lemon bright flavor' }],
    });

    const url = new URL('https://example.com/api/v1/drive?slugs=mt-horeb,madison-todd-drive');
    const res = await handleDrive(url, env, corsHeaders);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.query.include_tomorrow).toBe(0);
    for (const card of json.cards) {
      expect(Object.prototype.hasOwnProperty.call(card, 'tomorrow')).toBe(false);
    }
  });
});
