import { expect, test } from "@playwright/test";

/**
 * Compare page localStorage isolation tests (CMPR-01).
 *
 * Covers: compare page reads/writes store selections from its own
 * localStorage key ('custard:compare:stores') and never touches
 * 'custard:v1:preferences'. Primary store fallback still works.
 * Multi-store side-by-side grid works with the new key.
 */

// Mock store manifest
var MOCK_STORES = [
  { slug: "mt-horeb", name: "Mt. Horeb", city: "Mt. Horeb", state: "WI", address: "100 Main St", lat: 43.0045, lng: -89.7387, brand: "culvers" },
  { slug: "verona", name: "Verona", city: "Verona", state: "WI", address: "200 Elm St", lat: 42.9919, lng: -89.5332, brand: "culvers" },
  { slug: "madison-east", name: "Madison East", city: "Madison", state: "WI", address: "300 Oak Ave", lat: 43.0731, lng: -89.3012, brand: "culvers" },
  { slug: "fitchburg", name: "Fitchburg", city: "Fitchburg", state: "WI", address: "400 Fish Hatchery Rd", lat: 42.9609, lng: -89.4267, brand: "culvers" },
  { slug: "sun-prairie", name: "Sun Prairie", city: "Sun Prairie", state: "WI", address: "500 Main St", lat: 43.1836, lng: -89.2137, brand: "culvers" },
];

// Compute date strings
var _today = new Date();
_today.setHours(12, 0, 0, 0);
var TODAY_STR = _today.toISOString().slice(0, 10);
var _tomorrow = new Date(_today);
_tomorrow.setDate(_tomorrow.getDate() + 1);
var TOMORROW_STR = _tomorrow.toISOString().slice(0, 10);
var _day2 = new Date(_today);
_day2.setDate(_day2.getDate() + 2);
var DAY2_STR = _day2.toISOString().slice(0, 10);

function makeMockFlavors(slug, flavors) {
  return {
    slug: slug,
    flavors: [
      { date: TODAY_STR, title: flavors[0], description: "Desc " + flavors[0] },
      { date: TOMORROW_STR, title: flavors[1], description: "Desc " + flavors[1] },
      { date: DAY2_STR, title: flavors[2], description: "Desc " + flavors[2] },
    ],
  };
}

function makeMockToday(slug, flavor) {
  return { slug: slug, flavor: flavor, description: "Desc " + flavor, date: TODAY_STR, rarity: null };
}

var FLAVOR_MAP = {
  "mt-horeb": makeMockFlavors("mt-horeb", ["Chocolate Eclair", "Butter Pecan", "Vanilla"]),
  "verona": makeMockFlavors("verona", ["Mint Chip", "Caramel Swirl", "Strawberry"]),
  "madison-east": makeMockFlavors("madison-east", ["Turtle Sundae", "Cookie Dough", "Peanut Butter Cup"]),
  "fitchburg": makeMockFlavors("fitchburg", ["Raspberry Cheesecake", "Vanilla", "Mint Chip"]),
  "sun-prairie": makeMockFlavors("sun-prairie", ["Butter Pecan", "Turtle Sundae", "Cookie Dough"]),
};

var TODAY_MAP = {
  "mt-horeb": makeMockToday("mt-horeb", "Chocolate Eclair"),
  "verona": makeMockToday("verona", "Mint Chip"),
  "madison-east": makeMockToday("madison-east", "Turtle Sundae"),
  "fitchburg": makeMockToday("fitchburg", "Raspberry Cheesecake"),
  "sun-prairie": makeMockToday("sun-prairie", "Butter Pecan"),
};

var MOCK_GEO = { lat: 43.0, lon: -89.4, city: "Madison", regionName: "Wisconsin" };

/**
 * Set up compare page with API mocks. Uses the NEW localStorage key
 * 'custard:compare:stores' for store slugs (a plain JSON array).
 */
async function setupComparePage(page, opts) {
  opts = opts || {};
  var context = page.context();

  await context.route("**/stores.json*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stores: MOCK_STORES }) });
  });
  await context.route("**/api/v1/flavors*", function (route) {
    var url = route.request().url();
    for (var slug in FLAVOR_MAP) {
      if (url.indexOf("slug=" + slug) !== -1) {
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FLAVOR_MAP[slug]) });
        return;
      }
    }
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ flavors: [] }) });
  });
  await context.route("**/api/v1/today*", function (route) {
    var url = route.request().url();
    for (var slug in TODAY_MAP) {
      if (url.indexOf("slug=" + slug) !== -1) {
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(TODAY_MAP[slug]) });
        return;
      }
    }
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });
  await context.route("**/api/v1/geolocate", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_GEO) });
  });
  await context.route("**/api/v1/flavor-colors*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });
  await context.route("**/api/v1/flavor-config*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });

  await page.goto("/compare.html");

  if (opts.storeSlugs) {
    await page.evaluate(function (slugs) {
      localStorage.setItem("custard:compare:stores", JSON.stringify(slugs));
    }, opts.storeSlugs);
    await page.reload();
    if (opts.storeSlugs.length >= 2) {
      await page.waitForSelector(".compare-day-card", { timeout: 10000 });
    }
  }
}

// ---------------------------------------------------------------------------
// CMPR-01 Test 1: Reads store slugs from new key
// ---------------------------------------------------------------------------
test("CMPR-01: compare page reads store slugs from custard:compare:stores", async ({ page }) => {
  await setupComparePage(page);

  // Set the new key with 2 store slugs
  await page.evaluate(function () {
    localStorage.setItem("custard:compare:stores", JSON.stringify(["mt-horeb", "verona"]));
  });
  await page.reload();

  // Wait for the grid to render
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });

  // Verify grid renders with 2 store rows per day card
  var dayCards = page.locator(".compare-day-card");
  await expect(dayCards).toHaveCount(3);

  var todayCard = dayCards.first();
  var rows = todayCard.locator(".compare-store-row");
  await expect(rows).toHaveCount(2);
});

// ---------------------------------------------------------------------------
// CMPR-01 Test 2: Writes store selections to new key
// ---------------------------------------------------------------------------
test("CMPR-01: compare page writes store selections to custard:compare:stores", async ({ page }) => {
  await setupComparePage(page);

  // Start from empty state
  await page.waitForSelector("#compare-empty", { timeout: 10000 });

  // Open picker, select 2 stores, click done
  await page.click("#compare-add-stores");
  await page.waitForSelector(".compare-picker", { timeout: 5000 });
  await page.locator('.compare-picker-item[data-slug="mt-horeb"]').click();
  await page.locator('.compare-picker-item[data-slug="verona"]').click();
  await page.locator(".compare-picker-done").click();

  // Wait for grid
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });

  // Read the new key from localStorage
  var stores = await page.evaluate(function () {
    var raw = localStorage.getItem("custard:compare:stores");
    return raw ? JSON.parse(raw) : null;
  });

  expect(stores).not.toBeNull();
  expect(Array.isArray(stores)).toBe(true);
  expect(stores.length).toBeGreaterThanOrEqual(2);
  expect(stores).toContain("mt-horeb");
  expect(stores).toContain("verona");
});

// ---------------------------------------------------------------------------
// CMPR-01 Test 3: Does NOT read from old key
// ---------------------------------------------------------------------------
test("CMPR-01: compare page does NOT read from custard:v1:preferences for store slugs", async ({ page }) => {
  await setupComparePage(page);

  // Set the OLD key with store slugs (legacy format)
  await page.evaluate(function () {
    localStorage.setItem("custard:v1:preferences", JSON.stringify({
      activeRoute: { stores: ["mt-horeb", "verona"] },
    }));
    // Ensure the new key is NOT set
    localStorage.removeItem("custard:compare:stores");
  });
  await page.reload();

  // Should show empty state (not the grid) because compare page
  // should NOT read from the old key anymore
  await page.waitForSelector("#compare-empty", { timeout: 10000 });
  var emptyState = page.locator("#compare-empty");
  await expect(emptyState).toBeVisible();
});

// ---------------------------------------------------------------------------
// CMPR-01 Test 4: Does NOT write to old key
// ---------------------------------------------------------------------------
test("CMPR-01: compare page does NOT write to custard:v1:preferences", async ({ page }) => {
  await setupComparePage(page);

  // Start from empty state
  await page.waitForSelector("#compare-empty", { timeout: 10000 });

  // Capture the old key's value before interaction
  var prefsBefore = await page.evaluate(function () {
    return localStorage.getItem("custard:v1:preferences");
  });

  // Open picker, select 2 stores, click done
  await page.click("#compare-add-stores");
  await page.waitForSelector(".compare-picker", { timeout: 5000 });
  await page.locator('.compare-picker-item[data-slug="mt-horeb"]').click();
  await page.locator('.compare-picker-item[data-slug="verona"]').click();
  await page.locator(".compare-picker-done").click();

  // Wait for grid
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });

  // Read the old key -- should be null or unchanged
  var prefsAfter = await page.evaluate(function () {
    return localStorage.getItem("custard:v1:preferences");
  });

  expect(prefsAfter).toBe(prefsBefore);
});

// ---------------------------------------------------------------------------
// CMPR-01 Test 5: Primary store fallback works for first-time visitors
// ---------------------------------------------------------------------------
test("CMPR-01: primary store fallback seeds first-time compare visitors", async ({ page }) => {
  await setupComparePage(page);

  // Set the primary store key (existing mechanism)
  await page.evaluate(function () {
    localStorage.setItem("custard-primary", "mt-horeb");
    // Ensure neither compare key nor old preferences key is set
    localStorage.removeItem("custard:compare:stores");
    localStorage.removeItem("custard:v1:preferences");
  });
  await page.reload();

  // The compare page should show the grid with 1 store (inherited from primary).
  // MIN_COMPARE_STORES is 1, so the grid renders with the primary store's data
  // and an add-more hint encouraging comparison.
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });
  var dayCards = page.locator(".compare-day-card");
  await expect(dayCards).toHaveCount(3);
  var emptyState = page.locator("#compare-empty");
  await expect(emptyState).toBeHidden();
});

// ---------------------------------------------------------------------------
// CMPR-01 Test 6: Multi-store side-by-side grid works with new key
// ---------------------------------------------------------------------------
test("CMPR-01: multi-store grid works with 3 stores from new key", async ({ page }) => {
  await setupComparePage(page, { storeSlugs: ["mt-horeb", "verona", "madison-east"] });

  // Verify 3 day cards appear
  var dayCards = page.locator(".compare-day-card");
  await expect(dayCards).toHaveCount(3);

  // Each day card should have 3 store rows
  for (var i = 0; i < 3; i++) {
    var rows = dayCards.nth(i).locator(".compare-store-row");
    await expect(rows).toHaveCount(3);
  }
});
