/**
 * Fetches and parses Culver's Flavor of the Day data from restaurant pages.
 *
 * This is a JavaScript port of the parsing logic in flavor_service.py:
 * - extract_json_data() (lines 35-59)
 * - get_flavor_calendar() (lines 243-328)
 * - clean_text() (lines 26-32)
 */

/**
 * Remove trademark symbols and clean up text.
 * Mirrors Python's clean_text() at flavor_service.py:26-32.
 * @param {string} text
 * @returns {string}
 */
export function cleanText(text) {
  return text
    .replace(/\u00ae/g, '')  // ®
    .replace(/\u2122/g, '')  // ™
    .replace(/\u00a9/g, '')  // ©
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse __NEXT_DATA__ from Culver's restaurant page HTML.
 *
 * Extracts the JSON blob from <script id="__NEXT_DATA__"> and navigates
 * to the flavor calendar at:
 *   props.pageProps.page.customData.restaurantCalendar.flavors
 *
 * @param {string} html - Raw HTML from a Culver's restaurant page
 * @returns {{ name: string, flavors: Array<{date: string, title: string, description: string}> }}
 */
export function parseNextData(html) {
  // Extract JSON from <script id="__NEXT_DATA__"> using regex
  const match = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error('No __NEXT_DATA__ script tag found in HTML');
  }

  const data = JSON.parse(match[1]);
  const props = data.props || data;

  // Navigate to flavor data
  const customData = props?.pageProps?.page?.customData;
  if (!customData) {
    throw new Error('No customData found in __NEXT_DATA__');
  }

  const rawFlavors = customData?.restaurantCalendar?.flavors || [];
  const restaurantDetails = customData?.restaurantDetails || {};

  // Extract restaurant name and address
  const name = cleanText(restaurantDetails.name || '');
  const address = [
    restaurantDetails.streetAddress || '',
    restaurantDetails.city || '',
    restaurantDetails.state || '',
  ].filter(Boolean).join(', ');

  // Parse each flavor entry — include all dates Culver's provides
  // Validate upstream data before persisting (X1: data poisoning defense)
  const TITLE_MAX = 100;
  const DESC_MAX = 500;
  const SAFE_TEXT = /^[\w\s\-'.,!&()\/\u2019\u2014]+$/;

  const flavors = rawFlavors
    .map(f => {
      // onDate format: "2026-02-20T00:00:00" or "2026-02-20T00:00:00Z"
      const date = (f.onDate || '').split('T')[0];
      let title = cleanText(f.title || '');
      let description = cleanText(f.description || '');

      // Length limits
      title = title.slice(0, TITLE_MAX);
      description = description.slice(0, DESC_MAX);

      return { date, title, description };
    })
    .filter(f => f.date && f.title && SAFE_TEXT.test(f.title));

  return { name, address, flavors };
}

/**
 * Fetch flavor calendar data for a Culver's restaurant.
 *
 * @param {string} slug - Restaurant URL slug (e.g., "mt-horeb")
 * @param {Function} [fetchFn] - Injectable fetch function for testing
 * @returns {Promise<{name: string, flavors: Array<{date: string, title: string, description: string}>}>}
 */
export async function fetchFlavors(slug, fetchFn = globalThis.fetch) {
  const url = `https://www.culvers.com/restaurants/${slug}`;
  const response = await fetchFn(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch restaurant page for "${slug}": ${response.status}`);
  }

  const html = await response.text();
  return parseNextData(html);
}
