import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseGillesHtml } from '../src/gilles-fetcher.js';

const fixture = readFileSync(join(__dirname, 'fixtures/gilles-fotd.html'), 'utf-8');

describe('Gille\'s fetcher', () => {
  it('parses multiple days from fixture HTML', () => {
    const result = parseGillesHtml(fixture);
    expect(result.flavors.length).toBeGreaterThanOrEqual(3);
  });

  it('extracts correct dates from data-date attributes', () => {
    const result = parseGillesHtml(fixture);
    const dates = result.flavors.map(f => f.date);
    expect(dates).toContain('2026-02-19');
    expect(dates).toContain('2026-02-20');
    expect(dates).toContain('2026-02-21');
  });

  it('extracts flavor names from links', () => {
    const result = parseGillesHtml(fixture);
    const feb19 = result.flavors.find(f => f.date === '2026-02-19');
    expect(feb19).toBeDefined();
    expect(feb19.title).toBe('Grasshopper');
  });

  it('excludes closed days', () => {
    const result = parseGillesHtml(fixture);
    const feb15 = result.flavors.find(f => f.date === '2026-02-15');
    expect(feb15).toBeUndefined();
  });

  it('returns brand name and address', () => {
    const result = parseGillesHtml(fixture);
    expect(result.name).toBe("Gille's Frozen Custard");
    expect(result.address).toContain('Milwaukee');
  });

  it('returns empty flavors for empty HTML', () => {
    const result = parseGillesHtml('<html><body></body></html>');
    expect(result.flavors).toEqual([]);
  });
});
