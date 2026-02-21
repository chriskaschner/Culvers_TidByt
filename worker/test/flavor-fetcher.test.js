import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseNextData, fetchFlavors, cleanText } from '../src/flavor-fetcher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');

// Load fixture data
const mtHorebNextData = JSON.parse(readFileSync(join(FIXTURES, 'mt-horeb-nextdata.json'), 'utf-8'));
const mtHorebExpected = JSON.parse(readFileSync(join(FIXTURES, 'mt-horeb-expected.json'), 'utf-8'));

// Wrap __NEXT_DATA__ in minimal HTML like Culver's pages serve it
function wrapInHtml(nextDataProps) {
  const fullData = JSON.stringify({ props: nextDataProps });
  return `<!DOCTYPE html><html><head><script id="__NEXT_DATA__" type="application/json">${fullData}</script></head><body></body></html>`;
}

describe('parseNextData', () => {
  it('1: parses fixture HTML and returns flavors with correct dates and titles', () => {
    const html = wrapInHtml(mtHorebNextData);
    const result = parseNextData(html);

    expect(result.flavors).toBeDefined();
    expect(result.flavors.length).toBeGreaterThan(0);

    const firstFlavor = result.flavors[0];
    expect(firstFlavor).toHaveProperty('date');
    expect(firstFlavor).toHaveProperty('title');
    expect(firstFlavor).toHaveProperty('description');
    expect(firstFlavor.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('2: extracts restaurant name', () => {
    const html = wrapInHtml(mtHorebNextData);
    const result = parseNextData(html);

    expect(result.name).toBeDefined();
    expect(typeof result.name).toBe('string');
    expect(result.name.length).toBeGreaterThan(0);
  });

  it('3: cleans trademark symbols from titles', () => {
    expect(cleanText('Flavor Name®')).toBe('Flavor Name');
    expect(cleanText('Flavor™ Name')).toBe('Flavor Name');
    expect(cleanText('©2024 Flavor')).toBe('2024 Flavor');
    expect(cleanText('Double®™ Clean©')).toBe('Double Clean');
  });

  it('4: outputs dates in YYYY-MM-DD format without time', () => {
    const html = wrapInHtml(mtHorebNextData);
    const result = parseNextData(html);

    for (const flavor of result.flavors) {
      expect(flavor.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(flavor.date).not.toContain('T');
    }
  });

  it('5: returns empty array when flavors are missing', () => {
    const emptyData = {
      pageProps: {
        page: {
          customData: {
            restaurantCalendar: { flavors: [] },
            restaurantDetails: { name: 'Test Store' },
          },
        },
      },
    };
    const html = wrapInHtml(emptyData);
    const result = parseNextData(html);

    expect(result.flavors).toEqual([]);
  });

  it('6: throws descriptive error when __NEXT_DATA__ is missing', () => {
    const html = '<!DOCTYPE html><html><head></head><body>No data</body></html>';

    expect(() => parseNextData(html)).toThrow(/NEXT_DATA/i);
  });
});

describe('fetchFlavors', () => {
  it('7: calls fetch with correct URL for slug', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(wrapInHtml(mtHorebNextData)),
    });

    await fetchFlavors('mt-horeb', mockFetch);

    expect(mockFetch).toHaveBeenCalledWith('https://www.culvers.com/restaurants/mt-horeb');
  });

  it('8: golden test - JS output matches Python expected output', () => {
    const html = wrapInHtml(mtHorebNextData);
    const result = parseNextData(html);

    // JS returns all flavors (no date filtering), Python expected may be a subset.
    // Verify every expected flavor appears in JS output with matching date and name.
    expect(result.flavors.length).toBeGreaterThanOrEqual(mtHorebExpected.flavors.length);

    const jsByDate = Object.fromEntries(result.flavors.map(f => [f.date, f]));
    for (const expected of mtHorebExpected.flavors) {
      const jsFlavor = jsByDate[expected.date];
      expect(jsFlavor).toBeDefined();
      expect(jsFlavor.title).toBe(expected.name);
    }
  });
});
