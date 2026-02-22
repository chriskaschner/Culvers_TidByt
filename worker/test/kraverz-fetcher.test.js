import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseKraverzHtml } from '../src/kraverz-fetcher.js';

const fixture = readFileSync(join(__dirname, 'fixtures/kraverz.html'), 'utf-8');

describe('Kraverz fetcher', () => {
  it('parses multiple days from fixture HTML', () => {
    const result = parseKraverzHtml(fixture);
    // 6 entries minus 1 CLOSED = 5
    expect(result.flavors.length).toBe(5);
  });

  it('extracts correct dates', () => {
    const result = parseKraverzHtml(fixture);
    const dates = result.flavors.map(f => f.date);
    expect(dates).toContain('2026-02-19');
    expect(dates).toContain('2026-02-21');
    expect(dates).toContain('2026-02-23');
  });

  it('title-cases ALL CAPS flavor names', () => {
    const result = parseKraverzHtml(fixture);
    const feb19 = result.flavors.find(f => f.date === '2026-02-19');
    expect(feb19.title).toBe('Caramel Fudge Brownie');
  });

  it('handles ampersand entities', () => {
    const result = parseKraverzHtml(fixture);
    const feb21 = result.flavors.find(f => f.date === '2026-02-21');
    expect(feb21.title).toContain('M&M');
  });

  it('excludes CLOSED days', () => {
    const result = parseKraverzHtml(fixture);
    const feb22 = result.flavors.find(f => f.date === '2026-02-22');
    expect(feb22).toBeUndefined();
  });

  it('returns brand name and address', () => {
    const result = parseKraverzHtml(fixture);
    expect(result.name).toBe('Kraverz Frozen Custard');
    expect(result.address).toContain('Fond du Lac');
  });

  it('returns empty flavors for empty HTML', () => {
    const result = parseKraverzHtml('<html><body></body></html>');
    expect(result.flavors).toEqual([]);
  });
});
