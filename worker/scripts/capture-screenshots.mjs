import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const BASE = 'https://custard.chriskaschner.com';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../docs/screenshots');

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

// --- Forecast: select Mt. Horeb store to show flavor data ---
{
  const page = await context.newPage();
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle', timeout: 30000 });
  // Type into store search to trigger dropdown, then select Mt. Horeb
  await page.waitForTimeout(1500);
  await page.fill('#store-search', 'Mt. Horeb');
  await page.waitForTimeout(1000);
  // Click first dropdown item
  try {
    await page.click('.store-dropdown-item', { timeout: 3000 });
  } catch {}
  // Wait for flavor data to load
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(OUT, 'forecast.png'), fullPage: false });
  console.log('captured forecast.png');
  await page.close();
}

// --- Radar: select Mt. Horeb store to show timeline ---
{
  const page = await context.newPage();
  await page.goto(`${BASE}/radar.html`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  // Filter to WI and select Mt. Horeb
  const storeSelect = page.locator('#store-select');
  try {
    // Type in search to narrow results
    await page.fill('#city-search', 'Mt. Horeb');
    await page.waitForTimeout(500);
    // Select first matching option
    const firstOption = storeSelect.locator('option:not([disabled])').first();
    const val = await firstOption.getAttribute('value');
    if (val) await storeSelect.selectOption(val);
  } catch {}
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(OUT, 'radar.png'), fullPage: false });
  console.log('captured radar.png');
  await page.close();
}

// --- Map: search for Sun Prairie, WI ---
{
  const page = await context.newPage();
  await page.goto(`${BASE}/map.html`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, 'map.png'), fullPage: false });
  console.log('captured map.png');
  await page.close();
}

// --- Alerts: select a store to show the setup flow ---
{
  const page = await context.newPage();
  await page.goto(`${BASE}/alerts.html`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  // Filter to WI and select Mt. Horeb
  try {
    await page.fill('#city-search', 'Mt. Horeb');
    await page.waitForTimeout(500);
    const storeSelect = page.locator('#store-select');
    const firstOption = storeSelect.locator('option:not([disabled])').first();
    const val = await firstOption.getAttribute('value');
    if (val) await storeSelect.selectOption(val);
  } catch {}
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, 'alerts.png'), fullPage: false });
  console.log('captured alerts.png');
  await page.close();
}

await browser.close();
