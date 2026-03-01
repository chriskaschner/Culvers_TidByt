import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleGroupRoute, computeWinner } from '../src/group-routes.js';

function createMockKV() {
  const store = new Map();
  return {
    get: vi.fn(async (key) => store.get(key) ?? null),
    put: vi.fn(async (key, value) => { store.set(key, value); }),
    _store: store,
  };
}

function makeEnv(validSlugsArray = ['mt-horeb', 'verona', 'madison-todd-drive']) {
  return {
    FLAVOR_CACHE: createMockKV(),
    _validSlugsOverride: new Set(validSlugsArray),
  };
}

const CORS = { 'Access-Control-Allow-Origin': '*' };

function makeRequest(method, url, body) {
  const opts = { method };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
    opts.headers = { 'Content-Type': 'application/json' };
  }
  return new Request(url, opts);
}

describe('computeWinner', () => {
  it('picks fewest hard-nos', () => {
    const tally = {
      'mt-horeb': { yes: 1, meh: 0, no: 2 },
      verona: { yes: 0, meh: 1, no: 0 },
    };
    expect(computeWinner(tally, ['mt-horeb', 'verona'])).toBe('verona');
  });

  it('uses most yes to break ties on no count', () => {
    const tally = {
      'mt-horeb': { yes: 3, meh: 0, no: 1 },
      verona: { yes: 1, meh: 2, no: 1 },
    };
    expect(computeWinner(tally, ['mt-horeb', 'verona'])).toBe('mt-horeb');
  });

  it('falls back to alpha when no and yes are tied', () => {
    const tally = {
      bravo: { yes: 1, meh: 0, no: 1 },
      alpha: { yes: 1, meh: 0, no: 1 },
    };
    expect(computeWinner(tally, ['bravo', 'alpha'])).toBe('alpha');
  });

  it('returns null for empty slugs', () => {
    expect(computeWinner({}, [])).toBeNull();
  });
});

describe('POST /api/group/create', () => {
  it('creates a session with valid 2-slug payload', async () => {
    const env = makeEnv();
    const req = makeRequest('POST', 'https://w.example.com/api/v1/group/create', {
      slugs: ['mt-horeb', 'verona'],
    });
    const res = await handleGroupRoute('/api/group/create', new URL(req.url), req, env, CORS);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.join_code).toMatch(/^[A-Z0-9]{6}$/);
    expect(json.slugs).toEqual(['mt-horeb', 'verona']);
    expect(json.expires_at).toBeTruthy();
    // KV should have both session and votes keys
    expect(env.FLAVOR_CACHE.put).toHaveBeenCalledTimes(2);
  });

  it('returns 400 when fewer than 2 slugs provided', async () => {
    const env = makeEnv();
    const req = makeRequest('POST', 'https://w.example.com/api/v1/group/create', {
      slugs: ['mt-horeb'],
    });
    const res = await handleGroupRoute('/api/group/create', new URL(req.url), req, env, CORS);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/at least 2/i);
  });

  it('returns 400 when more than 5 slugs provided', async () => {
    const env = makeEnv([
      'mt-horeb', 'verona', 'madison-todd-drive', 'middleton', 'fitchburg', 'sun-prairie',
    ]);
    const req = makeRequest('POST', 'https://w.example.com/api/v1/group/create', {
      slugs: ['mt-horeb', 'verona', 'madison-todd-drive', 'middleton', 'fitchburg', 'sun-prairie'],
    });
    const res = await handleGroupRoute('/api/group/create', new URL(req.url), req, env, CORS);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/at most 5/i);
  });

  it('returns 400 for invalid/unknown slug', async () => {
    const env = makeEnv();
    const req = makeRequest('POST', 'https://w.example.com/api/v1/group/create', {
      slugs: ['mt-horeb', 'not-a-real-store'],
    });
    const res = await handleGroupRoute('/api/group/create', new URL(req.url), req, env, CORS);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid/i);
  });
});

describe('GET /api/group/:joinCode', () => {
  it('returns session state and empty tally for a valid code', async () => {
    const env = makeEnv();
    // Pre-seed the session
    const code = 'ABC123';
    env.FLAVOR_CACHE._store.set(
      `group:session:${code}`,
      JSON.stringify({ joinCode: code, slugs: ['mt-horeb', 'verona'], created_at: new Date().toISOString() }),
    );
    env.FLAVOR_CACHE._store.set(`group:votes:${code}`, JSON.stringify({}));

    const req = makeRequest('GET', `https://w.example.com/api/v1/group/${code}`);
    const res = await handleGroupRoute(`/api/group/${code}`, new URL(req.url), req, env, CORS);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.join_code).toBe(code);
    expect(json.slugs).toEqual(['mt-horeb', 'verona']);
    expect(json.total_voters).toBe(0);
    expect(json.tally).toEqual({
      'mt-horeb': { yes: 0, meh: 0, no: 0 },
      verona: { yes: 0, meh: 0, no: 0 },
    });
  });

  it('returns 404 for unknown/expired code', async () => {
    const env = makeEnv();
    const req = makeRequest('GET', 'https://w.example.com/api/v1/group/XXXXXX');
    const res = await handleGroupRoute('/api/group/XXXXXX', new URL(req.url), req, env, CORS);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/group/vote', () => {
  function seedSession(env, code, slugs = ['mt-horeb', 'verona']) {
    env.FLAVOR_CACHE._store.set(
      `group:session:${code}`,
      JSON.stringify({ joinCode: code, slugs, created_at: new Date().toISOString() }),
    );
    env.FLAVOR_CACHE._store.set(`group:votes:${code}`, JSON.stringify({}));
  }

  it('records a valid vote and returns updated tally and winner', async () => {
    const env = makeEnv();
    const code = 'VOTE01';
    seedSession(env, code);

    const req = makeRequest('POST', 'https://w.example.com/api/v1/group/vote', {
      join_code: code,
      voter_id: 'voter-a',
      votes: { 'mt-horeb': 'yes', verona: 'no' },
    });
    const res = await handleGroupRoute('/api/group/vote', new URL(req.url), req, env, CORS);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.tally['mt-horeb'].yes).toBe(1);
    expect(json.tally.verona.no).toBe(1);
    expect(json.winner).toBe('mt-horeb');
  });

  it('re-voting same voter overwrites previous votes', async () => {
    const env = makeEnv();
    const code = 'VOTE02';
    seedSession(env, code);

    // First vote
    const req1 = makeRequest('POST', 'https://w.example.com/api/v1/group/vote', {
      join_code: code,
      voter_id: 'voter-a',
      votes: { 'mt-horeb': 'no', verona: 'yes' },
    });
    await handleGroupRoute('/api/group/vote', new URL(req1.url), req1, env, CORS);

    // Second vote (change of heart)
    const req2 = makeRequest('POST', 'https://w.example.com/api/v1/group/vote', {
      join_code: code,
      voter_id: 'voter-a',
      votes: { 'mt-horeb': 'yes', verona: 'no' },
    });
    const res = await handleGroupRoute('/api/group/vote', new URL(req2.url), req2, env, CORS);
    const json = await res.json();
    // After overwrite, mt-horeb has 1 yes (not 1 no), verona has 1 no
    expect(json.tally['mt-horeb'].yes).toBe(1);
    expect(json.tally['mt-horeb'].no).toBe(0);
    expect(json.winner).toBe('mt-horeb');
  });

  it('returns 400 when votes contain slugs not in the session', async () => {
    const env = makeEnv();
    const code = 'VOTE03';
    seedSession(env, code);

    const req = makeRequest('POST', 'https://w.example.com/api/v1/group/vote', {
      join_code: code,
      voter_id: 'voter-b',
      votes: { 'mt-horeb': 'yes', 'unknown-store': 'meh' },
    });
    const res = await handleGroupRoute('/api/group/vote', new URL(req.url), req, env, CORS);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/unknown-store/);
  });

  it('returns 400 when vote value is invalid', async () => {
    const env = makeEnv();
    const code = 'VOTE04';
    seedSession(env, code);

    const req = makeRequest('POST', 'https://w.example.com/api/v1/group/vote', {
      join_code: code,
      voter_id: 'voter-c',
      votes: { 'mt-horeb': 'maybe', verona: 'yes' },
    });
    const res = await handleGroupRoute('/api/group/vote', new URL(req.url), req, env, CORS);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/yes.*meh.*no/i);
  });

  it('returns 404 for expired/missing session', async () => {
    const env = makeEnv();
    const req = makeRequest('POST', 'https://w.example.com/api/v1/group/vote', {
      join_code: 'NOPE99',
      voter_id: 'voter-d',
      votes: { 'mt-horeb': 'yes', verona: 'meh' },
    });
    const res = await handleGroupRoute('/api/group/vote', new URL(req.url), req, env, CORS);
    expect(res.status).toBe(404);
  });
});
