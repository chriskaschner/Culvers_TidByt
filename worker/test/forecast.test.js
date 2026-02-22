import { describe, it, expect, vi } from 'vitest';
import { handleForecast } from '../src/forecast.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
};

function createMockKV(data = {}) {
  return {
    get: vi.fn(async (key) => data[key] || null),
    put: vi.fn(async () => {}),
  };
}

describe('handleForecast', () => {
  it('returns 503 when KV not configured', async () => {
    const resp = await handleForecast('mt-horeb', {}, corsHeaders);
    expect(resp.status).toBe(503);
    const body = await resp.json();
    expect(body.error).toContain('KV not configured');
  });

  it('returns 404 when no forecast exists for slug', async () => {
    const kv = createMockKV();
    const resp = await handleForecast('mt-horeb', { FLAVOR_CACHE: kv }, corsHeaders);
    expect(resp.status).toBe(404);
    const body = await resp.json();
    expect(body.error).toContain('No forecast available');
  });

  it('returns forecast JSON when available', async () => {
    const forecast = {
      store_slug: 'mt-horeb',
      date: '2026-02-23',
      predictions: [
        { flavor: 'Turtle', probability: 0.08 },
        { flavor: 'Caramel Cashew', probability: 0.07 },
      ],
      total_probability: 1.0,
      prose: "Sunday's Flavor Forecast for Mt Horeb...",
    };
    const kv = createMockKV({ 'forecast:mt-horeb': JSON.stringify(forecast) });
    const resp = await handleForecast('mt-horeb', { FLAVOR_CACHE: kv }, corsHeaders);
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.store_slug).toBe('mt-horeb');
    expect(body.predictions).toHaveLength(2);
    expect(body.predictions[0].flavor).toBe('Turtle');
    expect(body.prose).toContain('Mt Horeb');
  });

  it('returns 500 on corrupted JSON', async () => {
    const kv = createMockKV({ 'forecast:mt-horeb': '{invalid json' });
    const resp = await handleForecast('mt-horeb', { FLAVOR_CACHE: kv }, corsHeaders);
    expect(resp.status).toBe(500);
  });

  it('sets cache headers on success', async () => {
    const forecast = { store_slug: 'mt-horeb', predictions: [] };
    const kv = createMockKV({ 'forecast:mt-horeb': JSON.stringify(forecast) });
    const resp = await handleForecast('mt-horeb', { FLAVOR_CACHE: kv }, corsHeaders);
    expect(resp.headers.get('Cache-Control')).toBe('public, max-age=3600');
  });
});
