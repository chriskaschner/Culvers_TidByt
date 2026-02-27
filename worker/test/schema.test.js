import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRequest } from '../src/index.js';

function makeRequest(path) {
  return new Request(`https://example.com${path}`);
}

describe('GET /api/v1/schema', () => {
  let env;

  beforeEach(() => {
    env = { FLAVOR_CACHE: { get: vi.fn(async () => null), put: vi.fn(async () => {}) } };
  });

  it('returns 200 with valid JSON', async () => {
    const req = makeRequest('/api/v1/schema');
    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  it('response includes schema_version and required endpoint keys', async () => {
    const req = makeRequest('/api/v1/schema');
    const res = await handleRequest(req, env);
    const body = await res.json();
    expect(typeof body.schema_version).toBe('number');
    expect(body.schema_version).toBeGreaterThanOrEqual(1);
    expect(body.endpoints).toBeDefined();
    expect(body.endpoints['/api/v1/flavors']).toBeDefined();
    expect(body.endpoints['/api/v1/today']).toBeDefined();
    expect(body.endpoints['/api/v1/stores']).toBeDefined();
  });
});
