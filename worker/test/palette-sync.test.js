/**
 * Palette sync CI gate (VALD-01).
 *
 * Verifies that all downstream color files stay in sync with the canonical
 * flavor-colors.js source of truth. Catches hex drift before it reaches
 * production.
 *
 * Sync targets:
 *   1. docs/cone-renderer.js (FALLBACK_* dicts)
 *   2. tidbyt/culvers_fotd.star (Starlark dicts)
 *   3. custard-tidbyt/apps/culversfotd/culvers_fotd.star (if available)
 *   4. docs/flavor-audit.html (SEED_* dicts)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BASE_COLORS,
  RIBBON_COLORS,
  TOPPING_COLORS,
  CONE_COLORS,
} from '../src/flavor-colors.js';

// Resolve file paths relative to this test file
const testDir = import.meta.dirname;
const CONE_RENDERER_PATH = resolve(testDir, '../../docs/cone-renderer.js');
const TIDBYT_STAR_PATH = resolve(testDir, '../../tidbyt/culvers_fotd.star');
const CUSTARD_TIDBYT_STAR_PATH = resolve(testDir, '../../../custard-tidbyt/apps/culversfotd/culvers_fotd.star');
const FLAVOR_AUDIT_PATH = resolve(testDir, '../../docs/flavor-audit.html');

/**
 * Parse a JavaScript var declaration of the form:
 *   var NAME = { key: '#HEXVAL', key2: '#HEXVAL', ... };
 * Returns a Map<string, string> of key -> uppercase hex.
 */
function parseJSVarDict(content, varName) {
  // Match: var VARNAME = { ... };
  const re = new RegExp(`var\\s+${varName}\\s*=\\s*\\{([^}]+)\\}`, 's');
  const m = content.match(re);
  if (!m) return new Map();
  const body = m[1];
  const result = new Map();
  // Match: key: '#HEXVAL' or key: "#HEXVAL"
  const entryRe = /(\w+)\s*:\s*['"]([^'"]+)['"]/g;
  let em;
  while ((em = entryRe.exec(body)) !== null) {
    result.set(em[1], em[2].toUpperCase());
  }
  return result;
}

/**
 * Parse a Starlark dict literal of the form:
 *   DICT_NAME = {
 *     "key": "#HEXVAL",
 *     ...
 *   }
 * Returns a Map<string, string> of key -> uppercase hex.
 */
function parseStarlarkDict(content, dictName) {
  // Match: DICTNAME = {\n ... \n}
  const re = new RegExp(`${dictName}\\s*=\\s*\\{([^}]+)\\}`, 's');
  const m = content.match(re);
  if (!m) return new Map();
  const body = m[1];
  const result = new Map();
  // Match: "key": "#HEXVAL"
  const entryRe = /"(\w+)"\s*:\s*"([^"]+)"/g;
  let em;
  while ((em = entryRe.exec(body)) !== null) {
    result.set(em[1], em[2].toUpperCase());
  }
  return result;
}

/**
 * Assert that every key/value in canonical matches the parsed downstream dict.
 */
function assertDictSync(canonical, downstream, dictLabel) {
  for (const [key, value] of Object.entries(canonical)) {
    const normalizedCanonical = value.toUpperCase();
    const downstreamValue = downstream.get(key);
    expect(
      downstreamValue,
      `${dictLabel}: key "${key}" missing or wrong. Expected ${normalizedCanonical}, got ${downstreamValue || 'MISSING'}`
    ).toBe(normalizedCanonical);
  }
}

// ===================================================================
// cone-renderer.js sync
// ===================================================================

describe('palette sync: cone-renderer.js', () => {
  const content = readFileSync(CONE_RENDERER_PATH, 'utf-8');

  it('FALLBACK_BASE_COLORS matches canonical BASE_COLORS', () => {
    const parsed = parseJSVarDict(content, 'FALLBACK_BASE_COLORS');
    assertDictSync(BASE_COLORS, parsed, 'cone-renderer FALLBACK_BASE_COLORS');
  });

  it('FALLBACK_RIBBON_COLORS matches canonical RIBBON_COLORS', () => {
    const parsed = parseJSVarDict(content, 'FALLBACK_RIBBON_COLORS');
    assertDictSync(RIBBON_COLORS, parsed, 'cone-renderer FALLBACK_RIBBON_COLORS');
  });

  it('FALLBACK_TOPPING_COLORS matches canonical TOPPING_COLORS', () => {
    const parsed = parseJSVarDict(content, 'FALLBACK_TOPPING_COLORS');
    assertDictSync(TOPPING_COLORS, parsed, 'cone-renderer FALLBACK_TOPPING_COLORS');
  });

  it('FALLBACK_CONE_COLORS matches canonical CONE_COLORS', () => {
    const parsed = parseJSVarDict(content, 'FALLBACK_CONE_COLORS');
    assertDictSync(CONE_COLORS, parsed, 'cone-renderer FALLBACK_CONE_COLORS');
  });
});

// ===================================================================
// tidbyt/culvers_fotd.star sync
// ===================================================================

describe('palette sync: tidbyt/culvers_fotd.star', () => {
  const content = readFileSync(TIDBYT_STAR_PATH, 'utf-8');

  it('BASE_COLORS matches canonical', () => {
    const parsed = parseStarlarkDict(content, 'BASE_COLORS');
    assertDictSync(BASE_COLORS, parsed, 'tidbyt BASE_COLORS');
  });

  it('RIBBON_COLORS matches canonical', () => {
    const parsed = parseStarlarkDict(content, 'RIBBON_COLORS');
    assertDictSync(RIBBON_COLORS, parsed, 'tidbyt RIBBON_COLORS');
  });

  it('TOPPING_COLORS matches canonical', () => {
    const parsed = parseStarlarkDict(content, 'TOPPING_COLORS');
    assertDictSync(TOPPING_COLORS, parsed, 'tidbyt TOPPING_COLORS');
  });

  it('cone color hex values present in file', () => {
    // Starlark files use cone colors as inline hex literals, not a named dict
    for (const [key, value] of Object.entries(CONE_COLORS)) {
      expect(
        content.toUpperCase().includes(value.toUpperCase()),
        `tidbyt: cone color ${key} (${value}) not found in file`
      ).toBe(true);
    }
  });
});

// ===================================================================
// custard-tidbyt/apps/culversfotd/culvers_fotd.star sync (optional)
// ===================================================================

const hasCustardTidbyt = existsSync(CUSTARD_TIDBYT_STAR_PATH);

const custardTidbytDescribe = hasCustardTidbyt ? describe : describe.skip;

custardTidbytDescribe('palette sync: custard-tidbyt/culvers_fotd.star', () => {
  // Only read file if it exists to avoid test crash
  const content = hasCustardTidbyt
    ? readFileSync(CUSTARD_TIDBYT_STAR_PATH, 'utf-8')
    : '';

  if (!hasCustardTidbyt) {
    console.warn('custard-tidbyt not available in this checkout -- skipping sync checks');
  }

  it('BASE_COLORS matches canonical', () => {
    const parsed = parseStarlarkDict(content, 'BASE_COLORS');
    assertDictSync(BASE_COLORS, parsed, 'custard-tidbyt BASE_COLORS');
  });

  it('RIBBON_COLORS matches canonical', () => {
    const parsed = parseStarlarkDict(content, 'RIBBON_COLORS');
    assertDictSync(RIBBON_COLORS, parsed, 'custard-tidbyt RIBBON_COLORS');
  });

  it('TOPPING_COLORS matches canonical', () => {
    const parsed = parseStarlarkDict(content, 'TOPPING_COLORS');
    assertDictSync(TOPPING_COLORS, parsed, 'custard-tidbyt TOPPING_COLORS');
  });

  it('cone color hex values present in file', () => {
    for (const [key, value] of Object.entries(CONE_COLORS)) {
      expect(
        content.toUpperCase().includes(value.toUpperCase()),
        `custard-tidbyt: cone color ${key} (${value}) not found in file`
      ).toBe(true);
    }
  });
});

// ===================================================================
// docs/flavor-audit.html sync
// ===================================================================

describe('palette sync: flavor-audit.html', () => {
  const content = readFileSync(FLAVOR_AUDIT_PATH, 'utf-8');

  it('SEED_BASE matches canonical BASE_COLORS', () => {
    const parsed = parseJSVarDict(content, 'SEED_BASE');
    assertDictSync(BASE_COLORS, parsed, 'flavor-audit SEED_BASE');
  });

  it('SEED_RIBBON matches canonical RIBBON_COLORS', () => {
    const parsed = parseJSVarDict(content, 'SEED_RIBBON');
    assertDictSync(RIBBON_COLORS, parsed, 'flavor-audit SEED_RIBBON');
  });

  it('SEED_TOPPING matches canonical TOPPING_COLORS', () => {
    const parsed = parseJSVarDict(content, 'SEED_TOPPING');
    assertDictSync(TOPPING_COLORS, parsed, 'flavor-audit SEED_TOPPING');
  });

  it('SEED_CONE matches canonical CONE_COLORS', () => {
    const parsed = parseJSVarDict(content, 'SEED_CONE');
    assertDictSync(CONE_COLORS, parsed, 'flavor-audit SEED_CONE');
  });
});
