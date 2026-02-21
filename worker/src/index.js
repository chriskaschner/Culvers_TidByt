/**
 * Cloudflare Worker entry point for Culver's FOTD calendar service.
 *
 * Serves subscribable .ics calendar files based on URL query parameters:
 *   GET /calendar.ics?primary=mt-horeb&secondary=madison-todd-drive,middleton
 *
 * Flavor data is cached in KV with 24h TTL. The .ics response includes
 * cache headers so Cloudflare's edge cache absorbs repeated requests.
 */

import { generateIcs } from './ics-generator.js';
import { fetchFlavors as defaultFetchFlavors } from './flavor-fetcher.js';
import { VALID_SLUGS as DEFAULT_VALID_SLUGS } from './valid-slugs.js';

const KV_TTL_SECONDS = 86400; // 24 hours
const CACHE_MAX_AGE = 43200;  // 12 hours
const MAX_SECONDARY = 3;
const MAX_DAILY_FETCHES = 50;

// Reject slugs with invalid characters before checking allowlist (defense-in-depth)
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{1,59}$/;

/**
 * Check access token if one is configured.
 * Set ACCESS_TOKEN in wrangler.toml [vars] or as a secret to enable.
 * When not set, all requests are allowed (open access).
 */
function checkAccess(url, env) {
  const requiredToken = env.ACCESS_TOKEN;
  if (!requiredToken) return true; // no token configured = open access
  return url.searchParams.get('token') === requiredToken;
}

/**
 * Validate a slug against the regex pattern and the allowlist.
 * @param {string} slug
 * @param {Set<string>} validSlugs
 * @returns {{ valid: boolean, reason?: string }}
 */
export function isValidSlug(slug, validSlugs) {
  if (!slug) {
    return { valid: false, reason: 'Slug is empty' };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return { valid: false, reason: 'Slug contains invalid characters' };
  }
  if (!validSlugs.has(slug)) {
    return { valid: false, reason: 'Unknown store slug' };
  }
  return { valid: true };
}

/**
 * Increment and check the daily upstream fetch counter.
 * Uses KV key `meta:fetch-count` with 24h TTL.
 * @returns {Promise<boolean>} true if under budget, false if exhausted
 */
async function checkFetchBudget(kv) {
  const raw = await kv.get('meta:fetch-count');
  const count = raw ? parseInt(raw, 10) : 0;
  return count < MAX_DAILY_FETCHES;
}

async function incrementFetchCount(kv) {
  const raw = await kv.get('meta:fetch-count');
  const count = raw ? parseInt(raw, 10) : 0;
  await kv.put('meta:fetch-count', String(count + 1), {
    expirationTtl: KV_TTL_SECONDS,
  });
}

/**
 * Get flavor data for a store, checking KV cache first.
 * @param {string} slug
 * @param {Object} kv - KV namespace binding
 * @param {Function} fetchFlavorsFn - flavor fetcher function
 * @returns {Promise<{name: string, flavors: Array}>}
 */
async function getFlavorsCached(slug, kv, fetchFlavorsFn) {
  // Check KV cache
  const cached = await kv.get(`flavors:${slug}`);
  if (cached) {
    return JSON.parse(cached);
  }

  // Check daily fetch budget before making upstream request
  const withinBudget = await checkFetchBudget(kv);
  if (!withinBudget) {
    throw new Error('Daily upstream fetch limit reached. Try again later.');
  }

  // Cache miss: fetch from Culver's
  const data = await fetchFlavorsFn(slug);

  // Store in KV with TTL
  await kv.put(`flavors:${slug}`, JSON.stringify(data), {
    expirationTtl: KV_TTL_SECONDS,
  });

  // Increment fetch counter after successful fetch
  await incrementFetchCount(kv);

  return data;
}

/**
 * Handle an incoming request.
 * Exported for testing — Cloudflare Worker default export calls this.
 *
 * @param {Request} request
 * @param {Object} env - Cloudflare Worker env bindings (FLAVOR_CACHE KV)
 * @param {Function} [fetchFlavorsFn] - injectable for testing
 * @returns {Promise<Response>}
 */
export async function handleRequest(request, env, fetchFlavorsFn = defaultFetchFlavors) {
  const url = new URL(request.url);
  const allowedOrigin = env.ALLOWED_ORIGIN || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Access control
  if (!checkAccess(url, env)) {
    return Response.json(
      { error: 'Invalid or missing access token' },
      { status: 403, headers: corsHeaders }
    );
  }

  // Health check
  if (url.pathname === '/health') {
    return Response.json(
      { status: 'ok', timestamp: new Date().toISOString() },
      { headers: corsHeaders }
    );
  }

  // Calendar endpoint
  if (url.pathname === '/calendar.ics') {
    return handleCalendar(url, env, corsHeaders, fetchFlavorsFn);
  }

  return Response.json(
    { error: 'Not found. Use /calendar.ics?primary=<slug> or /health' },
    { status: 404, headers: corsHeaders }
  );
}

/**
 * Handle /calendar.ics requests.
 */
async function handleCalendar(url, env, corsHeaders, fetchFlavorsFn) {
  // Resolve the valid slugs set (allow test override)
  const validSlugs = env._validSlugsOverride || DEFAULT_VALID_SLUGS;

  // Parse and validate query params
  const primarySlug = url.searchParams.get('primary');
  if (!primarySlug) {
    return Response.json(
      { error: 'Missing required "primary" parameter. Usage: /calendar.ics?primary=<store-slug>' },
      { status: 400, headers: corsHeaders }
    );
  }

  // Validate primary slug
  const primaryCheck = isValidSlug(primarySlug, validSlugs);
  if (!primaryCheck.valid) {
    return Response.json(
      { error: `Invalid primary store: ${primaryCheck.reason}` },
      { status: 400, headers: corsHeaders }
    );
  }

  const secondarySlugs = url.searchParams.get('secondary')
    ? url.searchParams.get('secondary').split(',').filter(Boolean)
    : [];

  if (secondarySlugs.length > MAX_SECONDARY) {
    return Response.json(
      { error: `Too many secondary stores. Maximum ${MAX_SECONDARY} allowed.` },
      { status: 400, headers: corsHeaders }
    );
  }

  // Validate all secondary slugs
  for (const slug of secondarySlugs) {
    const check = isValidSlug(slug, validSlugs);
    if (!check.valid) {
      return Response.json(
        { error: `Invalid secondary store "${slug}": ${check.reason}` },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  // Fetch flavor data for all stores
  const stores = [];
  const flavorsBySlug = {};

  try {
    // Fetch primary
    const primaryData = await getFlavorsCached(primarySlug, env.FLAVOR_CACHE, fetchFlavorsFn);
    stores.push({ slug: primarySlug, name: primaryData.name, address: primaryData.address || '', role: 'primary' });
    flavorsBySlug[primarySlug] = primaryData.flavors;

    // Fetch secondaries
    for (const slug of secondarySlugs) {
      const data = await getFlavorsCached(slug, env.FLAVOR_CACHE, fetchFlavorsFn);
      stores.push({ slug, name: data.name, address: data.address || '', role: 'secondary' });
      flavorsBySlug[slug] = data.flavors;
    }
  } catch (err) {
    return Response.json(
      { error: `Failed to fetch flavor data: ${err.message}` },
      { status: 400, headers: corsHeaders }
    );
  }

  // Generate .ics
  const calendarName = `Culver's FOTD - ${stores[0].name}`;
  const ics = generateIcs({ calendarName, stores, flavorsBySlug });

  return new Response(ics, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
      'Content-Disposition': 'inline; filename="culvers-fotd.ics"',
    },
  });
}

// Cloudflare Worker default export
export default {
  async fetch(request, env, ctx) {
    // Only cache GET requests to /calendar.ics
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/calendar.ics') {
      const cache = caches.default;
      const cacheKey = request;

      // Check edge cache first
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }

      // Cache miss — handle request normally
      const response = await handleRequest(request, env);

      // Only cache successful responses
      if (response.status === 200) {
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }

      return response;
    }

    return handleRequest(request, env);
  },
};
