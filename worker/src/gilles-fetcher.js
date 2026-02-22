/**
 * Fetches and parses Gille's Frozen Custard flavor data.
 *
 * Gille's publishes a full month calendar at gillesfrozencustard.com/flavor-of-the-day.
 * Drupal 7 Calendar module renders an HTML table with td[data-date] attributes.
 *
 * HTML structure: tr.single-day > td.single-day[data-date] > .views-field-title .field-content a
 */

/**
 * Parse Gille's flavor calendar HTML.
 * @param {string} html - Raw HTML from gillesfrozencustard.com/flavor-of-the-day
 * @returns {{ name: string, address: string, flavors: Array<{date: string, title: string, description: string}> }}
 */
export function parseGillesHtml(html) {
  const flavors = [];

  // Find td.single-day elements with data-date attributes
  const cellPattern = /<td[^>]*class="[^"]*single-day[^"]*"[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*>([\s\S]*?)<\/td>/gi;
  let cellMatch;

  while ((cellMatch = cellPattern.exec(html)) !== null) {
    const date = cellMatch[1];
    const cellContent = cellMatch[2];

    // Look for "Flavor of the day:" label to distinguish from "Flavor of the month:"
    // Find item blocks within the cell
    const itemPattern = /<div class="item">([\s\S]*?)<\/div>\s*(?=<div class="item">|$)/gi;
    let itemMatch;
    let fotdFound = false;

    // Simpler approach: find all .views-field-title links and check if preceded by "Flavor of the day"
    // We'll parse the cell content for flavor-of-the-day entries
    const flavorLabelPattern = /Flavor of the day[\s\S]*?<div class="views-field views-field-title">\s*<span class="field-content">\s*<a[^>]*>([\s\S]*?)<\/a>/gi;
    let flavorMatch = flavorLabelPattern.exec(cellContent);

    if (flavorMatch) {
      const name = flavorMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();

      if (name && name.toLowerCase() !== 'closed') {
        flavors.push({
          date,
          title: name,
          description: '',
        });
      }
    }
  }

  return {
    name: "Gille's Frozen Custard",
    address: '7515 W Bluemound Rd, Milwaukee, WI',
    flavors,
  };
}

/**
 * Fetch flavor data for Gille's.
 * @param {string} slug - "gilles"
 * @param {Function} [fetchFn] - Injectable fetch function for testing
 * @returns {Promise<{name: string, address: string, flavors: Array}>}
 */
export async function fetchGillesFlavors(slug, fetchFn = globalThis.fetch) {
  const url = 'https://gillesfrozencustard.com/flavor-of-the-day';
  const response = await fetchFn(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch Gille's flavor page: ${response.status}`);
  }

  const html = await response.text();
  return parseGillesHtml(html);
}
