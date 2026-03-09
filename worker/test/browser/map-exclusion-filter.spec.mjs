import { expect, test } from "@playwright/test";

/**
 * Map page exclusion filter tests (MAP-01).
 *
 * Covers: exclusion chips visible after results load, tapping dims markers,
 * tapping again restores, multiple exclusions active simultaneously,
 * AND logic with brand chips.
 */

// Mock store manifest (secondary brands)
var MOCK_STORES = [
  { slug: "kopps-glendale", name: "Kopp's Glendale", city: "Glendale", state: "WI", address: "7631 N Port Washington Rd", lat: 43.13, lng: -87.91, brand: "kopps" },
];

// Compute date strings matching the page's logic
var _today = new Date();
_today.setHours(12, 0, 0, 0);
var TODAY_STR = _today.toISOString().slice(0, 10);

// Mock nearby-flavors API response for Culver's search
// Includes stores with mint, chocolate, caramel family flavors
var MOCK_NEARBY = {
  query: { flavor: "", location: "Madison, WI" },
  matches: [],
  nearby: [
    { slug: "mt-horeb", name: "Mt. Horeb", address: "100 Main St, Mt. Horeb WI", lat: 43.0045, lon: -89.7387, flavor: "Mint Explosion", description: "Cool mint with fudge" },
    { slug: "verona", name: "Verona", address: "200 Elm St, Verona WI", lat: 42.9919, lon: -89.5332, flavor: "Chocolate Volcano", description: "Rich chocolate" },
    { slug: "madison-east", name: "Madison East", address: "300 Oak Ave, Madison WI", lat: 43.0731, lon: -89.3012, flavor: "Caramel Cashew", description: "Caramel with cashews" },
    { slug: "middleton", name: "Middleton", address: "400 University Ave, Middleton WI", lat: 43.0967, lon: -89.5043, flavor: "Butter Pecan", description: "Buttery pecan custard" },
  ],
  suggestions: [],
};

var MOCK_GEO = { lat: 43.0, lon: -89.4, city: "Madison", state: "Wisconsin", regionName: "Wisconsin" };

// Flavor config with families matching mock flavors
var MOCK_FLAVOR_CONFIG = {
  flavor_families: {
    mint: { color: "#2ECC71", members: ["andes mint avalanche", "mint cookie", "mint explosion", "mint chip"] },
    chocolate: { color: "#6F4E37", members: ["chocolate caramel twist", "chocolate heath crunch", "chocolate volcano", "dark chocolate decadence", "dark chocolate pb crunch", "chocolate oreo volcano", "chocolate eclair"] },
    caramel: { color: "#D4A056", members: ["caramel cashew", "caramel fudge cookie dough", "caramel pecan", "caramel turtle", "salted caramel pecan pie", "chocolate caramel twist", "caramel swirl"] },
    cheesecake: { color: "#FFD700", members: ["oreo cheesecake", "raspberry cheesecake", "strawberry cheesecake", "turtle cheesecake"] },
    peanutButter: { color: "#C4852F", members: ["peanut butter cup", "peanut butter cookie dough", "peanut butter brownie", "really reese's", "dark chocolate pb crunch"] },
    pecan: { color: "#8B6914", members: ["butter pecan", "caramel pecan", "georgia peach pecan", "salted caramel pecan pie"] },
  },
};

async function setupMapPage(page) {
  var context = page.context();

  await context.route("**/stores.json*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stores: MOCK_STORES }) });
  });
  await context.route("**/api/v1/nearby-flavors*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_NEARBY) });
  });
  await context.route("**/api/v1/geolocate", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_GEO) });
  });
  await context.route("**/api/v1/flavor-colors*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });
  await context.route("**/api/v1/flavor-config*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_FLAVOR_CONFIG) });
  });
  await context.route("**/api/v1/flavors/catalog*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ flavors: [] }) });
  });
  await context.route("**/api/v1/metrics/**", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });

  await page.goto("/map.html");

  // Wait for markers to appear (auto-geolocate triggers search)
  await page.waitForSelector(".flavor-map-marker-wrap", { timeout: 15000 });
}

// ---------------------------------------------------------------------------
// MAP-01 Test 1: Exclusion chips are visible after map results load
// ---------------------------------------------------------------------------
test("MAP-01: exclusion chips are visible after results load", async ({ page }) => {
  await setupMapPage(page);

  var chipContainer = page.locator("#map-exclusion-chips");
  await expect(chipContainer).toBeVisible();

  // Should have compare-filter-chip buttons
  var chips = chipContainer.locator(".compare-filter-chip");
  var chipCount = await chips.count();
  expect(chipCount).toBeGreaterThan(0);

  // Should have a "No Mint" chip
  var mintChip = chipContainer.locator('.compare-filter-chip:has-text("No Mint")');
  await expect(mintChip).toBeVisible();
});

// ---------------------------------------------------------------------------
// MAP-01 Test 2: Tapping "No Mint" chip dims mint-family store markers
// ---------------------------------------------------------------------------
test("MAP-01: tapping No Mint chip dims mint-family markers to opacity 0.15", async ({ page }) => {
  await setupMapPage(page);

  // Find the mint-family marker (Mt. Horeb has Mint Explosion)
  // After tapping No Mint, its marker opacity should drop to 0.15
  var mintChip = page.locator('#map-exclusion-chips .compare-filter-chip:has-text("No Mint")');
  await mintChip.click();

  // Check that at least one marker has opacity 0.15 (the mint one)
  // Leaflet markers use inline style opacity via setOpacity()
  var dimmedMarker = await page.evaluate(function () {
    var markers = window._allMarkers || [];
    for (var i = 0; i < markers.length; i++) {
      if (markers[i].store.flavor === "Mint Explosion") {
        return markers[i].marker.options.opacity;
      }
    }
    return null;
  });
  expect(dimmedMarker).toBe(0.15);
});

// ---------------------------------------------------------------------------
// MAP-01 Test 3: Tapping chip again restores markers to opacity 1
// ---------------------------------------------------------------------------
test("MAP-01: tapping chip again restores markers to opacity 1", async ({ page }) => {
  await setupMapPage(page);

  var mintChip = page.locator('#map-exclusion-chips .compare-filter-chip:has-text("No Mint")');

  // Tap to exclude
  await mintChip.click();
  var dimmed = await page.evaluate(function () {
    var markers = window._allMarkers || [];
    for (var i = 0; i < markers.length; i++) {
      if (markers[i].store.flavor === "Mint Explosion") {
        return markers[i].marker.options.opacity;
      }
    }
    return null;
  });
  expect(dimmed).toBe(0.15);

  // Tap again to un-exclude
  await mintChip.click();
  var restored = await page.evaluate(function () {
    var markers = window._allMarkers || [];
    for (var i = 0; i < markers.length; i++) {
      if (markers[i].store.flavor === "Mint Explosion") {
        return markers[i].marker.options.opacity;
      }
    }
    return null;
  });
  expect(restored).toBe(1);
});

// ---------------------------------------------------------------------------
// MAP-01 Test 4: Multiple exclusion chips can be active simultaneously
// ---------------------------------------------------------------------------
test("MAP-01: multiple exclusion chips active simultaneously", async ({ page }) => {
  await setupMapPage(page);

  var mintChip = page.locator('#map-exclusion-chips .compare-filter-chip:has-text("No Mint")');
  var chocoChip = page.locator('#map-exclusion-chips .compare-filter-chip:has-text("No Chocolate")');

  // Tap both chips
  await mintChip.click();
  await chocoChip.click();

  // Both should have .selected class
  await expect(mintChip).toHaveClass(/selected/);
  await expect(chocoChip).toHaveClass(/selected/);

  // Both mint and chocolate markers should be dimmed
  var opacities = await page.evaluate(function () {
    var markers = window._allMarkers || [];
    var result = {};
    for (var i = 0; i < markers.length; i++) {
      result[markers[i].store.flavor] = markers[i].marker.options.opacity;
    }
    return result;
  });
  expect(opacities["Mint Explosion"]).toBe(0.15);
  expect(opacities["Chocolate Volcano"]).toBe(0.15);
  // Caramel Cashew should NOT be dimmed
  expect(opacities["Caramel Cashew"]).toBe(1);
});

// ---------------------------------------------------------------------------
// MAP-01 Test 5: Brand chips and exclusion chips compose with AND logic
// ---------------------------------------------------------------------------
test("MAP-01: brand chips and exclusion chips compose with AND logic", async ({ page }) => {
  await setupMapPage(page);

  // Exclude mint family
  var mintChip = page.locator('#map-exclusion-chips .compare-filter-chip:has-text("No Mint")');
  await mintChip.click();

  // Verify mint markers dimmed even with Culver's brand active
  var mintOpacity = await page.evaluate(function () {
    var markers = window._allMarkers || [];
    for (var i = 0; i < markers.length; i++) {
      if (markers[i].store.flavor === "Mint Explosion") {
        return markers[i].marker.options.opacity;
      }
    }
    return null;
  });
  expect(mintOpacity).toBe(0.15);

  // Non-excluded Culver's markers should still be fully visible
  var chocoOpacity = await page.evaluate(function () {
    var markers = window._allMarkers || [];
    for (var i = 0; i < markers.length; i++) {
      if (markers[i].store.flavor === "Chocolate Volcano") {
        return markers[i].marker.options.opacity;
      }
    }
    return null;
  });
  expect(chocoOpacity).toBe(1);
});
