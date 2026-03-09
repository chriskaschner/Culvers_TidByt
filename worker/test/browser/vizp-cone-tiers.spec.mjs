import { expect, test } from "@playwright/test";

/**
 * VIZP-01 and VIZP-04: Cone tier rendering tests.
 *
 * Verifies:
 * - Today hero card renders PNG <img> for known flavors (VIZP-01)
 * - Today hero card falls back to SVG when PNG missing (VIZP-04)
 * - Compare page cells still use inline SVG, not PNG (VIZP-01)
 * - Multi-store row cells still use inline SVG, not PNG (VIZP-01)
 * - heroConeSrc() returns correct path format (VIZP-04)
 */

// Compute date strings matching page logic
var _today = new Date();
_today.setHours(12, 0, 0, 0);
var TODAY_STR = _today.toISOString().slice(0, 10);
var _tomorrow = new Date(_today);
_tomorrow.setDate(_tomorrow.getDate() + 1);
var TOMORROW_STR = _tomorrow.toISOString().slice(0, 10);
var _day2 = new Date(_today);
_day2.setDate(_day2.getDate() + 2);
var DAY2_STR = _day2.toISOString().slice(0, 10);

// Mock store manifest
var MOCK_STORES = [
  { slug: "mt-horeb", name: "Mt. Horeb", city: "Mt. Horeb", state: "WI", lat: 43.0045, lng: -89.7387, brand: "culvers" },
  { slug: "verona", name: "Verona", city: "Verona", state: "WI", lat: 42.9919, lng: -89.5332, brand: "culvers" },
  { slug: "madison-east", name: "Madison East", city: "Madison", state: "WI", lat: 43.0731, lng: -89.3012, brand: "culvers" },
];

// Minimal 1x1 transparent PNG as base64 (valid PNG file)
var TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
var TINY_PNG_BUFFER = Buffer.from(TINY_PNG_B64, "base64");

// Mock today response for known flavor (Chocolate Eclair)
var MOCK_TODAY_KNOWN = {
  slug: "mt-horeb",
  flavor: "Chocolate Eclair",
  description: "Rich chocolate custard with eclair pieces",
  date: TODAY_STR,
  rarity: { appearances: 3, avg_gap_days: 120, label: "Rare" },
};

// Mock today response for unknown flavor (no PNG exists)
var MOCK_TODAY_UNKNOWN = {
  slug: "mt-horeb",
  flavor: "Unknown Test Flavor",
  description: "A flavor that has no pre-rendered PNG",
  date: TODAY_STR,
  rarity: null,
};

// Mock flavors response (known flavor)
var MOCK_FLAVORS_KNOWN = {
  slug: "mt-horeb",
  name: "Mt. Horeb",
  flavors: [
    { date: TODAY_STR, title: "Chocolate Eclair", description: "Rich chocolate custard with eclair pieces" },
    { date: TOMORROW_STR, title: "Butter Pecan", description: "Buttery pecan custard" },
    { date: DAY2_STR, title: "Vanilla", description: "Classic vanilla" },
  ],
  fetched_at: new Date().toISOString(),
};

// Mock flavors response (unknown flavor)
var MOCK_FLAVORS_UNKNOWN = {
  slug: "mt-horeb",
  name: "Mt. Horeb",
  flavors: [
    { date: TODAY_STR, title: "Unknown Test Flavor", description: "A flavor that has no pre-rendered PNG" },
    { date: TOMORROW_STR, title: "Butter Pecan", description: "Buttery pecan custard" },
  ],
  fetched_at: new Date().toISOString(),
};

// Mock forecast (known flavor)
var MOCK_FORECAST_KNOWN = {
  slug: "mt-horeb",
  forecast: [
    { date: TODAY_STR, flavor: "Chocolate Eclair", description: "Rich chocolate custard", type: "confirmed" },
    { date: TOMORROW_STR, flavor: "Butter Pecan", description: "Buttery pecan", type: "confirmed" },
    { date: DAY2_STR, flavor: "Vanilla", description: "Classic vanilla", type: "confirmed" },
  ],
  fetchedAt: new Date().toISOString(),
};

// Mock forecast (unknown flavor)
var MOCK_FORECAST_UNKNOWN = {
  slug: "mt-horeb",
  forecast: [
    { date: TODAY_STR, flavor: "Unknown Test Flavor", description: "No PNG", type: "confirmed" },
    { date: TOMORROW_STR, flavor: "Butter Pecan", description: "Buttery pecan", type: "confirmed" },
  ],
  fetchedAt: new Date().toISOString(),
};

var MOCK_SIGNALS = { signals: [] };
var MOCK_GEO = { lat: 43.0, lon: -89.4, city: "Madison", regionName: "Wisconsin" };

/**
 * Set up common API mocks (stores, geo, flavor-colors, signals, reliability).
 */
async function setupCommonMocks(context) {
  await context.route("**/stores.json*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ stores: MOCK_STORES }),
    });
  });

  await context.route("**/api/v1/geolocate", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_GEO),
    });
  });

  await context.route("**/api/v1/flavor-colors*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  await context.route("**/api/v1/signals/*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_SIGNALS),
    });
  });

  await context.route("**/api/v1/reliability/*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ reliability: null }),
    });
  });
}

// ---------------------------------------------------------------------------
// Test 1 (VIZP-01): Today hero card renders PNG <img> for known flavor
// ---------------------------------------------------------------------------
test("VIZP-01: Today hero card renders PNG img for known flavor", async ({ page }) => {
  var context = page.context();
  await setupCommonMocks(context);

  // Serve tiny PNG for chocolate-eclair.png
  await context.route("**/assets/cones/chocolate-eclair.png", function (route) {
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: TINY_PNG_BUFFER,
    });
  });

  await context.route("**/api/v1/today*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_TODAY_KNOWN),
    });
  });

  await context.route("**/api/v1/forecast/*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_FORECAST_KNOWN),
    });
  });

  await context.route("**/api/v1/flavors*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_FLAVORS_KNOWN),
    });
  });

  await page.goto("/index.html");
  await page.evaluate(function () {
    localStorage.setItem("custard-primary", "mt-horeb");
  });
  await page.reload();
  await page.waitForSelector("#today-section:not([hidden])", { timeout: 10000 });

  // Hero cone should contain an <img> element with src matching assets/cones/chocolate-eclair.png
  var heroImg = page.locator("#today-cone img");
  await expect(heroImg).toBeVisible({ timeout: 5000 });
  var src = await heroImg.getAttribute("src");
  expect(src).toContain("assets/cones/chocolate-eclair.png");
});

// ---------------------------------------------------------------------------
// Test 2 (VIZP-04): Today hero card falls back to SVG when PNG missing
// ---------------------------------------------------------------------------
test("VIZP-04: Today hero card falls back to SVG when PNG missing", async ({ page }) => {
  var context = page.context();
  await setupCommonMocks(context);

  // Do NOT serve any PNG for "unknown-test-flavor" -- let it 404
  await context.route("**/assets/cones/unknown-test-flavor.png", function (route) {
    route.fulfill({ status: 404, body: "Not Found" });
  });

  await context.route("**/api/v1/today*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_TODAY_UNKNOWN),
    });
  });

  await context.route("**/api/v1/forecast/*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_FORECAST_UNKNOWN),
    });
  });

  await context.route("**/api/v1/flavors*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_FLAVORS_UNKNOWN),
    });
  });

  await page.goto("/index.html");
  await page.evaluate(function () {
    localStorage.setItem("custard-primary", "mt-horeb");
  });
  await page.reload();
  await page.waitForSelector("#today-section:not([hidden])", { timeout: 10000 });

  // Wait for fallback to trigger
  await page.waitForTimeout(2000);

  // Should have SVG fallback (no visible <img>)
  var todayCone = page.locator("#today-cone");
  var svgCount = await todayCone.locator("svg").count();
  expect(svgCount).toBeGreaterThan(0);

  // Should NOT have a visible <img>
  var imgCount = await todayCone.locator("img").count();
  expect(imgCount).toBe(0);
});

// ---------------------------------------------------------------------------
// Test 3 (VIZP-01): Compare page cells still use inline SVG, not PNG
// ---------------------------------------------------------------------------
test("VIZP-01: Compare page cells use inline SVG not PNG", async ({ page }) => {
  var context = page.context();
  await setupCommonMocks(context);

  // Mock compare-relevant API calls
  await context.route("**/api/v1/today*", function (route) {
    var url = new URL(route.request().url());
    var slug = url.searchParams.get("slug") || "mt-horeb";
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        slug: slug,
        flavor: "Chocolate Eclair",
        description: "Rich chocolate custard",
        date: TODAY_STR,
        rarity: null,
      }),
    });
  });

  await context.route("**/api/v1/flavors*", function (route) {
    var url = new URL(route.request().url());
    var slug = url.searchParams.get("slug") || "mt-horeb";
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        slug: slug,
        name: slug,
        flavors: [
          { date: TODAY_STR, title: "Chocolate Eclair", description: "Rich chocolate custard" },
          { date: TOMORROW_STR, title: "Butter Pecan", description: "Buttery pecan" },
          { date: DAY2_STR, title: "Vanilla", description: "Classic vanilla" },
        ],
        fetched_at: new Date().toISOString(),
      }),
    });
  });

  await context.route("**/api/v1/forecast/*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        slug: "mt-horeb",
        forecast: [
          { date: TODAY_STR, flavor: "Chocolate Eclair", type: "confirmed" },
          { date: TOMORROW_STR, flavor: "Butter Pecan", type: "confirmed" },
          { date: DAY2_STR, flavor: "Vanilla", type: "confirmed" },
        ],
      }),
    });
  });

  // Set up multi-store preferences so Compare has stores to show
  await page.goto("/compare.html");
  await page.evaluate(function () {
    localStorage.setItem("custard:compare:stores", JSON.stringify(["mt-horeb", "verona"]));
  });
  await page.reload();

  // Wait for compare grid to render
  await page.waitForTimeout(3000);

  // Find cells with cones -- they should contain SVG, not <img>
  var coneCells = page.locator(".compare-cone svg, .day-cone svg, .mini-cone");
  var coneCount = await coneCells.count();

  // At least some SVG cones should exist in the compare grid
  if (coneCount > 0) {
    // Verify no <img> tags with assets/cones in the compare grid
    var pngImgs = page.locator(".compare-grid img[src*='assets/cones'], .compare-row img[src*='assets/cones']");
    var pngCount = await pngImgs.count();
    expect(pngCount).toBe(0);
  }

  // Also verify the grid area has SVG elements
  var gridSvgs = page.locator("#compare-grid svg");
  var gridSvgCount = await gridSvgs.count();
  expect(gridSvgCount).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Test 4 (VIZP-01): Multi-store row cells use inline SVG, not PNG
// ---------------------------------------------------------------------------
test("VIZP-01: Multi-store row cells use inline SVG not PNG", async ({ page }) => {
  var context = page.context();
  await setupCommonMocks(context);

  await context.route("**/api/v1/today*", function (route) {
    var url = new URL(route.request().url());
    var slug = url.searchParams.get("slug") || "mt-horeb";
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        slug: slug,
        flavor: "Chocolate Eclair",
        description: "Rich chocolate custard",
        date: TODAY_STR,
        rarity: null,
      }),
    });
  });

  await context.route("**/api/v1/forecast/*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_FORECAST_KNOWN),
    });
  });

  await context.route("**/api/v1/flavors*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_FLAVORS_KNOWN),
    });
  });

  await page.goto("/index.html");
  await page.evaluate(function () {
    localStorage.setItem("custard-primary", "mt-horeb");
    localStorage.setItem(
      "custard:v1:preferences",
      JSON.stringify({
        activeRoute: { stores: ["mt-horeb", "verona"] },
      })
    );
  });
  await page.reload();
  await page.waitForSelector("#today-section:not([hidden])", { timeout: 10000 });

  // Wait for multi-store row to render
  await page.waitForTimeout(3000);

  var multiStoreSection = page.locator("#multi-store-section");
  var isVisible = await multiStoreSection.isVisible();

  if (isVisible) {
    // Multi-store cells should have SVG, not PNG <img>
    var multiSvgs = page.locator("#multi-store-row svg");
    var svgCount = await multiSvgs.count();
    expect(svgCount).toBeGreaterThan(0);

    var multiPngs = page.locator("#multi-store-row img[src*='assets/cones']");
    var pngCount = await multiPngs.count();
    expect(pngCount).toBe(0);
  }
});

// ---------------------------------------------------------------------------
// Test 5 (VIZP-04): heroConeSrc() returns correct path format
// ---------------------------------------------------------------------------
test("VIZP-04: heroConeSrc returns correct path format", async ({ page }) => {
  var context = page.context();
  await setupCommonMocks(context);

  await context.route("**/api/v1/today*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_TODAY_KNOWN),
    });
  });

  await context.route("**/api/v1/forecast/*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_FORECAST_KNOWN),
    });
  });

  await context.route("**/api/v1/flavors*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_FLAVORS_KNOWN),
    });
  });

  await page.goto("/index.html");

  // Test heroConeSrc function
  var result = await page.evaluate(function () {
    if (typeof heroConeSrc !== "function") return { error: "heroConeSrc not defined" };
    return {
      chocolateEclair: heroConeSrc("Chocolate Eclair"),
      butterPecan: heroConeSrc("Butter Pecan"),
      reallyReeses: heroConeSrc("Really Reese's"),
      empty: heroConeSrc(""),
      nullVal: heroConeSrc(null),
    };
  });

  expect(result.error).toBeUndefined();
  expect(result.chocolateEclair).toBe("assets/cones/chocolate-eclair.png");
  expect(result.butterPecan).toBe("assets/cones/butter-pecan.png");
  expect(result.reallyReeses).toBe("assets/cones/really-reese-s.png");
  expect(result.empty).toBeNull();
  expect(result.nullVal).toBeNull();
});
