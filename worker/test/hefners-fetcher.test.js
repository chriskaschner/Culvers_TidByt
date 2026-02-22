import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseHefnersHtml } from '../src/hefners-fetcher.js';

const fixture = readFileSync(join(__dirname, 'fixtures/hefners.html'), 'utf-8');

describe('Hefner\'s fetcher', () => {
  it('extracts today\'s flavor name', () => {
    const result = parseHefnersHtml(fixture);
    expect(result.flavors).toHaveLength(1);
    expect(result.flavors[0].title).toBe('Tiramisu');
  });

  it('extracts flavor description', () => {
    const result = parseHefnersHtml(fixture);
    expect(result.flavors[0].description).toContain('tiramisu');
  });

  it('sets date to today', () => {
    const result = parseHefnersHtml(fixture);
    const today = new Date().toISOString().slice(0, 10);
    expect(result.flavors[0].date).toBe(today);
  });

  it('returns brand name and address', () => {
    const result = parseHefnersHtml(fixture);
    expect(result.name).toBe("Hefner's Frozen Custard");
    expect(result.address).toContain('West Allis');
  });

  it('returns empty flavors when no flavor-content section', () => {
    const result = parseHefnersHtml('<html><body><div>No flavors here</div></body></html>');
    expect(result.flavors).toEqual([]);
  });

  it('does not extract sundae-of-month as FOTD', () => {
    const result = parseHefnersHtml(fixture);
    const titles = result.flavors.map(f => f.title);
    expect(titles).not.toContain('Puppy Love');
  });
});
