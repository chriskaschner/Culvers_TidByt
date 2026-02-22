/**
 * Fetches and parses Kraverz Frozen Custard flavor data.
 *
 * Kraverz publishes a full month schedule at kraverzcustard.com/FlavorSchedule (ASP.NET MVC).
 * Each entry has a date (MM/DD) and flavor name in div.Flavor containers.
 *
 * HTML structure: div.flavorList > div.Flavor > div.flavorDate + div.flavorName
 * Also: div.CurrentFlavor for today's featured flavor
 */

/**
 * Parse Kraverz flavor schedule HTML.
 * @param {string} html - Raw HTML from kraverzcustard.com/FlavorSchedule
 * @returns {{ name: string, address: string, flavors: Array<{date: string, title: string, description: string}> }}
 */
export function parseKraverzHtml(html) {
  const flavors = [];

  // Find all div.Flavor entries in the schedule
  const entryPattern = /<div class="Flavor">\s*<div class="flavorDate">([\s\S]*?)<\/div>\s*<div class="flavorName">([\s\S]*?)<\/div>/gi;
  let match;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-based

  while ((match = entryPattern.exec(html)) !== null) {
    const rawDate = match[1].trim();
    const rawName = match[2]
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    // Skip closed days
    if (!rawName || rawName.toUpperCase() === 'CLOSED') continue;

    // Parse MM/DD date
    const dateMatch = rawDate.match(/^(\d{2})\/(\d{2})$/);
    if (!dateMatch) continue;

    const month = parseInt(dateMatch[1], 10);
    const day = parseInt(dateMatch[2], 10);

    // Infer year — if month < current month and difference > 6, it's next year
    let year = currentYear;
    if (month < currentMonth && (currentMonth - month) > 6) {
      year += 1;
    }

    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Title case the all-caps name
    const title = rawName.replace(/\b\w+/g, w =>
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).replace(/\bM & M\b/gi, 'M&M')
     .replace(/\bPb\b/g, 'PB');

    flavors.push({ date, title, description: '' });
  }

  return {
    name: 'Kraverz Frozen Custard',
    address: '233 S Main St, Fond du Lac, WI',
    flavors,
  };
}

/**
 * Fetch flavor data for Kraverz.
 * @param {string} slug - "kraverz"
 * @param {Function} [fetchFn] - Injectable fetch function for testing
 * @returns {Promise<{name: string, address: string, flavors: Array}>}
 */
export async function fetchKraverzFlavors(slug, fetchFn = globalThis.fetch) {
  const url = 'https://kraverzcustard.com/FlavorSchedule';
  const response = await fetchFn(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch Kraverz flavor page: ${response.status}`);
  }

  const html = await response.text();
  return parseKraverzHtml(html);
}
