/**
 * Group Vote routes — "Where Are We Going?"
 *
 * Lets a driver pick 2-5 candidate stores, share a join code, and collect
 * yes/meh/no votes. Winner is chosen by minimize-misery: fewest hard-nos,
 * most yeses breaks ties, alpha for the rare coin-flip.
 *
 * KV layout (4h TTL on both keys):
 *   group:session:{code}  →  { joinCode, slugs, created_at }
 *   group:votes:{code}    →  { [voterId]: { [slug]: 'yes'|'meh'|'no' } }
 */

import { VALID_SLUGS as DEFAULT_VALID_SLUGS } from './valid-slugs.js';

const VOTE_VALUES = new Set(['yes', 'meh', 'no']);
const SESSION_TTL = 14400; // 4 hours

/**
 * Generate a 6-char uppercase alphanumeric join code.
 */
function generateJoinCode() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
}

/**
 * Compute per-store vote tally from the votes map.
 * @param {{ [voterId]: { [slug]: string } }} votes
 * @param {string[]} slugs
 * @returns {{ [slug]: { yes: number, meh: number, no: number } }}
 */
function computeTally(votes, slugs) {
  const tally = {};
  for (const slug of slugs) {
    tally[slug] = { yes: 0, meh: 0, no: 0 };
  }
  for (const voterVotes of Object.values(votes)) {
    for (const [slug, value] of Object.entries(voterVotes)) {
      if (tally[slug] && VOTE_VALUES.has(value)) {
        tally[slug][value]++;
      }
    }
  }
  return tally;
}

/**
 * Pick the winning store: fewest hard-nos wins; most yes breaks tie; alpha fallback.
 * Returns null if slugs array is empty.
 * @param {{ [slug]: { yes: number, meh: number, no: number } }} tally
 * @param {string[]} slugs
 * @returns {string|null}
 */
export function computeWinner(tally, slugs) {
  if (!slugs || slugs.length === 0) return null;
  return [...slugs].sort((a, b) => {
    const noA = tally[a]?.no || 0;
    const noB = tally[b]?.no || 0;
    if (noA !== noB) return noA - noB;
    const yesA = tally[a]?.yes || 0;
    const yesB = tally[b]?.yes || 0;
    if (yesA !== yesB) return yesB - yesA;
    return a.localeCompare(b);
  })[0] || null;
}

/**
 * POST /api/v1/group/create
 * Body: { slugs: ['mt-horeb', 'verona'] }  — 2 to 5 valid store slugs
 */
async function handleCreate(request, env, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400, headers: corsHeaders },
    );
  }

  const slugs = body?.slugs;
  if (!Array.isArray(slugs)) {
    return Response.json(
      { error: 'Missing required field "slugs" (array of store slugs).' },
      { status: 400, headers: corsHeaders },
    );
  }
  if (slugs.length < 2) {
    return Response.json(
      { error: 'Provide at least 2 store slugs.' },
      { status: 400, headers: corsHeaders },
    );
  }
  if (slugs.length > 5) {
    return Response.json(
      { error: 'Provide at most 5 store slugs.' },
      { status: 400, headers: corsHeaders },
    );
  }

  const validSlugs = env._validSlugsOverride || DEFAULT_VALID_SLUGS;
  const invalid = slugs.filter((s) => typeof s !== 'string' || !validSlugs.has(s));
  if (invalid.length > 0) {
    return Response.json(
      { error: `Unknown or invalid store slug(s): ${invalid.join(', ')}` },
      { status: 400, headers: corsHeaders },
    );
  }

  const joinCode = generateJoinCode();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL * 1000).toISOString();

  await env.FLAVOR_CACHE.put(
    `group:session:${joinCode}`,
    JSON.stringify({ joinCode, slugs, created_at: createdAt }),
    { expirationTtl: SESSION_TTL },
  );
  await env.FLAVOR_CACHE.put(
    `group:votes:${joinCode}`,
    JSON.stringify({}),
    { expirationTtl: SESSION_TTL },
  );

  return Response.json(
    { ok: true, join_code: joinCode, expires_at: expiresAt, slugs },
    { status: 200, headers: corsHeaders },
  );
}

/**
 * GET /api/v1/group/:joinCode
 * Returns session state + running tally + computed winner.
 */
async function handleGet(joinCode, env, corsHeaders) {
  const [sessionRaw, votesRaw] = await Promise.all([
    env.FLAVOR_CACHE.get(`group:session:${joinCode}`),
    env.FLAVOR_CACHE.get(`group:votes:${joinCode}`),
  ]);

  if (!sessionRaw) {
    return Response.json(
      { error: 'Session not found or expired.' },
      { status: 404, headers: corsHeaders },
    );
  }

  const session = JSON.parse(sessionRaw);
  const votes = votesRaw ? JSON.parse(votesRaw) : {};
  const tally = computeTally(votes, session.slugs);
  const winner = computeWinner(tally, session.slugs);
  const totalVoters = Object.keys(votes).length;

  return Response.json(
    {
      join_code: session.joinCode,
      slugs: session.slugs,
      total_voters: totalVoters,
      votes,
      tally,
      winner,
    },
    { headers: corsHeaders },
  );
}

/**
 * POST /api/v1/group/vote
 * Body: { join_code, voter_id, votes: { slug: 'yes'|'meh'|'no' } }
 */
async function handleVote(request, env, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400, headers: corsHeaders },
    );
  }

  const { join_code, voter_id, votes } = body || {};
  if (!join_code || typeof join_code !== 'string') {
    return Response.json(
      { error: 'Missing required field "join_code".' },
      { status: 400, headers: corsHeaders },
    );
  }
  if (!voter_id || typeof voter_id !== 'string') {
    return Response.json(
      { error: 'Missing required field "voter_id".' },
      { status: 400, headers: corsHeaders },
    );
  }
  if (!votes || typeof votes !== 'object' || Array.isArray(votes)) {
    return Response.json(
      { error: 'Missing required field "votes" (object mapping slug to yes/meh/no).' },
      { status: 400, headers: corsHeaders },
    );
  }

  const sessionRaw = await env.FLAVOR_CACHE.get(`group:session:${join_code}`);
  if (!sessionRaw) {
    return Response.json(
      { error: 'Session not found or expired.' },
      { status: 404, headers: corsHeaders },
    );
  }

  const session = JSON.parse(sessionRaw);
  const sessionSlugSet = new Set(session.slugs);

  // Validate all slugs in votes belong to this session
  const unknownSlugs = Object.keys(votes).filter((s) => !sessionSlugSet.has(s));
  if (unknownSlugs.length > 0) {
    return Response.json(
      { error: `Vote contains slugs not in this session: ${unknownSlugs.join(', ')}` },
      { status: 400, headers: corsHeaders },
    );
  }

  // Validate all vote values
  const invalidValues = Object.entries(votes).filter(([, v]) => !VOTE_VALUES.has(v));
  if (invalidValues.length > 0) {
    return Response.json(
      { error: 'Vote values must be "yes", "meh", or "no".' },
      { status: 400, headers: corsHeaders },
    );
  }

  const votesRaw = await env.FLAVOR_CACHE.get(`group:votes:${join_code}`);
  const currentVotes = votesRaw ? JSON.parse(votesRaw) : {};

  // Merge (voter re-voting overwrites previous votes)
  currentVotes[voter_id] = votes;

  await env.FLAVOR_CACHE.put(
    `group:votes:${join_code}`,
    JSON.stringify(currentVotes),
    { expirationTtl: SESSION_TTL },
  );

  const tally = computeTally(currentVotes, session.slugs);
  const winner = computeWinner(tally, session.slugs);

  return Response.json(
    { ok: true, tally, winner },
    { headers: corsHeaders },
  );
}

/**
 * Route dispatcher for /api/group/* (called from index.js with canonical path).
 * Canonical paths arrive as /api/group/* (v1 prefix already stripped).
 */
export async function handleGroupRoute(canonical, url, request, env, corsHeaders) {
  if (canonical === '/api/group/create' && request.method === 'POST') {
    return handleCreate(request, env, corsHeaders);
  }

  if (canonical === '/api/group/vote' && request.method === 'POST') {
    return handleVote(request, env, corsHeaders);
  }

  // GET /api/group/:joinCode
  const getMatch = canonical.match(/^\/api\/group\/([A-Z0-9]{6})$/);
  if (getMatch && request.method === 'GET') {
    return handleGet(getMatch[1], env, corsHeaders);
  }

  return Response.json(
    { error: 'Not found.' },
    { status: 404, headers: corsHeaders },
  );
}
