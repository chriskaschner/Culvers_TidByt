import { expect, test } from "@playwright/test";

/**
 * Map page exclusion persistence tests (MAP-02).
 *
 * Covers: exclusion state persists across page reload via localStorage,
 * localStorage key is 'custard:map:exclusions' (separate from Compare).
 */

// Mock store manifest
var MOCK_STORES = [
  { slug: "kopps-glendale", name: "Kopp's Glendale", city: "Glendale", state: "WI", address: "7631 N Port Washington Rd", lat: 43.13, lng: -87.91, brand: "kopps" },
];

// Mock nearby-flavors API response
var MOCK_NEARBY = {
  query: { flavor: "", location: "Madison, WI" },
  matches: [],
  nearby: [
    { slug: "mt-horeb", name: "Mt. Horeb", address: "100 Main St, Mt. Horeb WI", lat: 43.0045, lon: -89.7387, flavor: "Mint Explosion", description: "Cool mint with fudge" },
    { slug: "verona", name: "Verona", address: "200 Elm St, Verona WI", lat: 42.9919, lon: -89.5332, flavor: "Chocolate Volcano", description: "Rich chocolate" },
    { slug: "madison-east", name: "Madison East", address: "300 Oak Ave, Madison WI", lat: 43.0731, lon: -89.3012, flavor: "Caramel Cashew", description: "Caramel with cashews" },
  ],
  suggestions: [],
};

var MOCK_GEO = { lat: 43.0, lon: -89.4, city: "Madison", state: "Wisconsin", regionName: "Wisconsin" };

var MOCK_FLAVOR_CONFIG = {
  flavor_families: {
    mint: { color: "#2ECC71", members: ["andes mint avalanche", "mint cookie", "mint explosion", "mint chip"] },
    chocolate: { color: "#6F4E37", members: ["chocolate caramel twist", "chocolate heath crunch", "chocolate volcano", "dark chocolate decadence"] },
    caramel: { color: "#D4A056", members: ["caramel cashew", "caramel fudge cookie dough", "caramel pecan", "caramel turtle"] },
    cheesecake: { color: "#FFD700", members: ["oreo cheesecake", "raspberry cheesecake", "strawberry cheesecake"] },
    peanutButter: { color: "#C4852F", members: ["peanut butter cup", "peanut butter cookie dough"] },
    pecan: { color: "#8B6914", members: ["butter pecan", "caramel pecan", "georgia peach pecan"] },
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
  await page.waitForSelector(".flavor-map-marker-wrap", { timeout: 15000 });
}

// ---------------------------------------------------------------------------
// MAP-02 Test 1: Exclusion state persists across page reload
// ---------------------------------------------------------------------------
test("MAP-02: exclusion state persists across page reload", async ({ page }) => {
  await setupMapPage(page);

  // Tap "No Mint" to exclude mint family
  var mintChip = page.locator('#map-exclusion-chips .compare-filter-chip:has-text("No Mint")');
  await mintChip.click();
  await expect(mintChip).toHaveClass(/selected/);

  // Reload the page
  await page.reload();
  await page.waitForSelector(".flavor-map-marker-wrap", { timeout: 15000 });

  // After reload, "No Mint" chip should still have .selected class
  var mintChipAfter = page.locator('#map-exclusion-chips .compare-filter-chip:has-text("No Mint")');
  await expect(mintChipAfter).toHaveClass(/selected/);

  // Mint marker should still be dimmed after reload
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
});

// ---------------------------------------------------------------------------
// MAP-02 Test 2: localStorage key is 'custard:map:exclusions'
// ---------------------------------------------------------------------------
test("MAP-02: localStorage key is custard:map:exclusions", async ({ page }) => {
  await setupMapPage(page);

  // Tap "No Mint" to set an exclusion
  var mintChip = page.locator('#map-exclusion-chips .compare-filter-chip:has-text("No Mint")');
  await mintChip.click();

  // Verify the correct localStorage key was set
  var storedValue = await page.evaluate(function () {
    return localStorage.getItem("custard:map:exclusions");
  });
  expect(storedValue).toBeTruthy();
  var parsed = JSON.parse(storedValue);
  expect(parsed).toContain("mint");

  // Verify the compare page key was NOT touched
  var compareValue = await page.evaluate(function () {
    return localStorage.getItem("custard-exclusions");
  });
  expect(compareValue).toBeNull();
});
