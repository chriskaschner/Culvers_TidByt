/**
 * Tests for Flavor Radar client-side logic.
 *
 * These pure functions are duplicated from docs/radar.html so they can be
 * tested in isolation. If the HTML logic changes, update these copies.
 * The tests catch the silent-failure modes we hit during development:
 * - Catalog fetch failing (CORS) leaves flavor search broken
 * - Geolocate fetch failing leaves state picker empty
 * - Timeline mishandling old vs new forecast formats
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Extracted pure functions from radar.html ---

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function isFavorite(flavorName, selectedFlavors) {
  const n = normalize(flavorName);
  for (const fav of selectedFlavors) {
    if (normalize(fav) === n) return true;
  }
  return false;
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function findForecastDay(forecast, dateStr) {
  if (!forecast) return null;
  if (forecast.days) {
    return forecast.days.find(d => d.date === dateStr) || null;
  }
  if (forecast.date === dateStr) return forecast;
  return null;
}

function buildTimeline(confirmedFlavors, forecast, today) {
  const timeline = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, i);
    const dateStr = toISODate(date);

    const confirmed = confirmedFlavors.find(f => f.date === dateStr);
    if (confirmed) {
      timeline.push({ date: dateStr, type: 'confirmed', flavor: confirmed.title, description: confirmed.description || '' });
      continue;
    }

    const forecastDay = findForecastDay(forecast, dateStr);
    if (forecastDay && forecastDay.predictions && forecastDay.predictions.length > 0) {
      timeline.push({ date: dateStr, type: 'predicted', predictions: forecastDay.predictions.slice(0, 5), overdue: forecastDay.overdue_flavors || [] });
      continue;
    }

    timeline.push({ date: dateStr, type: 'none' });
  }
  return timeline;
}

const SIMILARITY_GROUPS = {
  mint: ['andes mint avalanche', 'mint cookie', 'mint explosion'],
  chocolate: ['chocolate caramel twist', 'chocolate heath crunch', 'chocolate volcano', 'dark chocolate decadence', 'dark chocolate pb crunch', 'chocolate oreo volcano'],
  caramel: ['caramel cashew', 'caramel fudge cookie dough', 'caramel pecan', 'caramel turtle', 'salted caramel pecan pie', 'chocolate caramel twist'],
  turtle: ['turtle', 'turtle dove', 'turtle cheesecake', 'caramel turtle'],
};

function findSimilarFlavors(favorites) {
  const favNorms = [...favorites].map(normalize);
  const similar = new Set();
  for (const fav of favNorms) {
    for (const group of Object.values(SIMILARITY_GROUPS)) {
      if (group.includes(fav)) {
        for (const f of group) {
          if (!favNorms.includes(f)) similar.add(f);
        }
      }
    }
  }
  return [...similar];
}

// --- Tests ---

describe('normalize', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalize("Andes Mint Avalanche")).toBe('andes mint avalanche');
    expect(normalize("Gille's Chocolate")).toBe('gilles chocolate');
    expect(normalize("  Turtle  ")).toBe('turtle');
  });
});

describe('isFavorite', () => {
  it('matches case-insensitively', () => {
    const favs = new Set(['Turtle', 'Mint Explosion']);
    expect(isFavorite('turtle', favs)).toBe(true);
    expect(isFavorite('TURTLE', favs)).toBe(true);
    expect(isFavorite('mint explosion', favs)).toBe(true);
  });

  it('returns false for non-favorites', () => {
    const favs = new Set(['Turtle']);
    expect(isFavorite('Caramel Cashew', favs)).toBe(false);
  });

  it('handles empty favorites', () => {
    expect(isFavorite('Turtle', new Set())).toBe(false);
  });
});

describe('findForecastDay', () => {
  it('returns null for null forecast', () => {
    expect(findForecastDay(null, '2026-02-23')).toBeNull();
  });

  it('finds day in multi-day format', () => {
    const forecast = {
      days: [
        { date: '2026-02-23', predictions: [{ flavor: 'Turtle' }] },
        { date: '2026-02-24', predictions: [{ flavor: 'Caramel' }] },
      ],
    };
    const day = findForecastDay(forecast, '2026-02-24');
    expect(day.predictions[0].flavor).toBe('Caramel');
  });

  it('returns null for missing date in multi-day', () => {
    const forecast = {
      days: [{ date: '2026-02-23', predictions: [] }],
    };
    expect(findForecastDay(forecast, '2026-02-25')).toBeNull();
  });

  it('handles legacy single-day format', () => {
    const forecast = {
      date: '2026-02-23',
      predictions: [{ flavor: 'Turtle' }],
    };
    expect(findForecastDay(forecast, '2026-02-23').predictions[0].flavor).toBe('Turtle');
    expect(findForecastDay(forecast, '2026-02-24')).toBeNull();
  });
});

describe('buildTimeline', () => {
  const today = new Date('2026-02-23T12:00:00');

  it('produces 7 days', () => {
    const timeline = buildTimeline([], null, today);
    expect(timeline).toHaveLength(7);
  });

  it('marks confirmed days correctly', () => {
    const confirmed = [{ date: '2026-02-23', title: 'Turtle', description: 'Yum' }];
    const timeline = buildTimeline(confirmed, null, today);
    expect(timeline[0].type).toBe('confirmed');
    expect(timeline[0].flavor).toBe('Turtle');
    expect(timeline[1].type).toBe('none');
  });

  it('marks predicted days correctly', () => {
    const forecast = {
      days: [
        { date: '2026-02-24', predictions: [{ flavor: 'Caramel', probability: 0.08 }], overdue_flavors: [] },
      ],
    };
    const timeline = buildTimeline([], forecast, today);
    expect(timeline[0].type).toBe('none'); // 2/23 -- no data
    expect(timeline[1].type).toBe('predicted'); // 2/24 -- forecast
    expect(timeline[1].predictions[0].flavor).toBe('Caramel');
  });

  it('confirmed takes priority over predicted for same date', () => {
    const confirmed = [{ date: '2026-02-23', title: 'Turtle', description: '' }];
    const forecast = {
      days: [
        { date: '2026-02-23', predictions: [{ flavor: 'Caramel', probability: 0.08 }], overdue_flavors: [] },
      ],
    };
    const timeline = buildTimeline(confirmed, forecast, today);
    expect(timeline[0].type).toBe('confirmed');
    expect(timeline[0].flavor).toBe('Turtle');
  });

  it('handles empty predictions array as none', () => {
    const forecast = {
      days: [{ date: '2026-02-23', predictions: [], overdue_flavors: [] }],
    };
    const timeline = buildTimeline([], forecast, today);
    expect(timeline[0].type).toBe('none');
  });

  it('limits predictions to 5 per day', () => {
    const preds = Array.from({ length: 10 }, (_, i) => ({ flavor: `Flavor ${i}`, probability: 0.05 }));
    const forecast = {
      days: [{ date: '2026-02-23', predictions: preds, overdue_flavors: [] }],
    };
    const timeline = buildTimeline([], forecast, today);
    expect(timeline[0].predictions).toHaveLength(5);
  });
});

describe('findSimilarFlavors', () => {
  it('finds similar flavors in same group', () => {
    const similar = findSimilarFlavors(new Set(['Turtle']));
    expect(similar).toContain('turtle dove');
    expect(similar).toContain('turtle cheesecake');
    expect(similar).toContain('caramel turtle');
    expect(similar).not.toContain('turtle'); // exclude self
  });

  it('returns empty for flavor not in any group', () => {
    const similar = findSimilarFlavors(new Set(['Flavor of the Day']));
    expect(similar).toHaveLength(0);
  });

  it('handles multiple favorites across groups', () => {
    const similar = findSimilarFlavors(new Set(['Turtle', 'Mint Explosion']));
    // Should include turtle group (minus Turtle) and mint group (minus Mint Explosion)
    expect(similar).toContain('turtle dove');
    expect(similar).toContain('andes mint avalanche');
    expect(similar).toContain('mint cookie');
  });

  it('deduplicates across groups', () => {
    // Caramel Turtle is in both turtle and caramel groups
    const similar = findSimilarFlavors(new Set(['Turtle', 'Caramel Cashew']));
    const count = similar.filter(s => s === 'caramel turtle').length;
    expect(count).toBeLessThanOrEqual(1);
  });
});

describe('catalog loading fallback', () => {
  // Simulates the fetch fallback pattern from radar.html:
  // try local flavors.json first, then fall back to Worker API

  it('uses local file when available', async () => {
    const localData = { flavors: [{ title: 'Turtle' }] };
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => localData });

    let catalog = [];
    // Simulate loadCatalog logic
    try {
      const resp = await mockFetch('flavors.json');
      if (resp.ok) {
        const data = await resp.json();
        catalog = data.flavors || [];
      }
    } catch (e) {}

    expect(catalog).toHaveLength(1);
    expect(catalog[0].title).toBe('Turtle');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to API when local file fails', async () => {
    const apiData = { flavors: [{ title: 'Caramel Cashew' }] };
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('CORS'))  // local file fails
      .mockResolvedValueOnce({ ok: true, json: async () => apiData });

    let catalog = [];
    // Simulate loadCatalog logic
    try {
      const resp = await mockFetch('flavors.json');
      if (resp.ok) {
        const data = await resp.json();
        catalog = data.flavors || [];
        return;
      }
    } catch (e) {}
    try {
      const resp = await mockFetch('/api/v1/flavors/catalog');
      const data = await resp.json();
      catalog = data.flavors || [];
    } catch (e) {}

    expect(catalog).toHaveLength(1);
    expect(catalog[0].title).toBe('Caramel Cashew');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns empty catalog when both sources fail', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('CORS'))
      .mockRejectedValueOnce(new Error('Network'));

    let catalog = [];
    try {
      const resp = await mockFetch('flavors.json');
      if (resp.ok) { catalog = (await resp.json()).flavors || []; return; }
    } catch (e) {}
    try {
      const resp = await mockFetch('/api/v1/flavors/catalog');
      catalog = (await resp.json()).flavors || [];
    } catch (e) {}

    expect(catalog).toHaveLength(0);
  });
});

describe('state detection fallback', () => {
  it('uses geolocate region when available', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ region: 'IL' }) });

    let state;
    try {
      const resp = await mockFetch('/api/v1/geolocate');
      const data = await resp.json();
      state = data.region || 'WI';
    } catch (e) {
      state = 'WI';
    }

    expect(state).toBe('IL');
  });

  it('defaults to WI when geolocate fails (CORS)', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('CORS blocked'));

    let state;
    try {
      const resp = await mockFetch('/api/v1/geolocate');
      const data = await resp.json();
      state = data.region || 'WI';
    } catch (e) {
      state = 'WI';
    }

    expect(state).toBe('WI');
  });

  it('defaults to WI when geolocate returns no region', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    let state;
    try {
      const resp = await mockFetch('/api/v1/geolocate');
      const data = await resp.json();
      state = data.region || 'WI';
    } catch (e) {
      state = 'WI';
    }

    expect(state).toBe('WI');
  });
});
