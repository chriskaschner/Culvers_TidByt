import { expect, test } from "@playwright/test";

/**
 * Compare page multi-store picker tests.
 *
 * Covers: the compare-specific store picker that allows users to select
 * multiple stores (2-4) for side-by-side comparison, the store management
 * bar showing selected stores with remove buttons, and integration with
 * SharedNav store changes.
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
 * Set up compare page with API mocks. Does NOT set localStorage preferences
 * unless storeSlugs is provided.
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
// Empty state shows "Add stores" button that opens compare picker
// ---------------------------------------------------------------------------
test("empty state Add stores button opens multi-store picker", async ({ page }) => {
  await setupComparePage(page);

  // Should show empty state
  await page.waitForSelector("#compare-empty", { timeout: 10000 });
  var emptyState = page.locator("#compare-empty");
  await expect(emptyState).toBeVisible();

  // Click "Add stores"
  await page.click("#compare-add-stores");

  // Compare-specific picker should appear (not SharedNav picker)
  var picker = page.locator(".compare-picker");
  await expect(picker).toBeVisible({ timeout: 5000 });

  // Should have store list items with checkboxes
  var items = picker.locator(".compare-picker-item");
  var count = await items.count();
  expect(count).toBeGreaterThanOrEqual(5); // all MOCK_STORES

  // Should have a "Compare stores" done button
  var doneBtn = picker.locator(".compare-picker-done");
  await expect(doneBtn).toBeVisible();

  // Done button should be disabled (0 stores selected < min 2)
  await expect(doneBtn).toBeDisabled();
});

// ---------------------------------------------------------------------------
// Selecting 2 stores in picker and clicking done shows comparison grid
// ---------------------------------------------------------------------------
test("selecting 2 stores in picker shows comparison grid", async ({ page }) => {
  await setupComparePage(page);
  await page.waitForSelector("#compare-empty", { timeout: 10000 });

  // Open picker
  await page.click("#compare-add-stores");
  await page.waitForSelector(".compare-picker", { timeout: 5000 });

  // Check two stores
  var mtHorebItem = page.locator('.compare-picker-item[data-slug="mt-horeb"]');
  await mtHorebItem.click();

  var veronaItem = page.locator('.compare-picker-item[data-slug="verona"]');
  await veronaItem.click();

  // Done button should now be enabled
  var doneBtn = page.locator(".compare-picker-done");
  await expect(doneBtn).toBeEnabled();

  // Click done
  await doneBtn.click();

  // Picker should close
  await expect(page.locator(".compare-picker")).toHaveCount(0);

  // Grid should appear with day cards
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });
  var dayCards = page.locator(".compare-day-card");
  await expect(dayCards).toHaveCount(3);

  // Each day card should have 2 store rows
  for (var i = 0; i < 3; i++) {
    var rows = dayCards.nth(i).locator(".compare-store-row");
    await expect(rows).toHaveCount(2);
  }
});

// ---------------------------------------------------------------------------
// Store management bar shows selected stores with remove buttons
// ---------------------------------------------------------------------------
test("store bar shows selected stores with remove and add buttons", async ({ page }) => {
  await setupComparePage(page, { storeSlugs: ["mt-horeb", "verona", "madison-east"] });

  // Store bar should be visible
  var storeBar = page.locator("#compare-store-bar");
  await expect(storeBar).toBeVisible();

  // Should show 3 store chips
  var chips = storeBar.locator(".compare-store-chip");
  await expect(chips).toHaveCount(3);

  // Each chip should have a remove button
  var removeBtns = storeBar.locator(".compare-store-chip-remove");
  await expect(removeBtns).toHaveCount(3);

  // Should have an "Add store" button (3 < max 4)
  var addBtn = storeBar.locator(".compare-store-add-btn");
  await expect(addBtn).toBeVisible();
});

// ---------------------------------------------------------------------------
// Removing a store from the bar updates the grid
// ---------------------------------------------------------------------------
test("removing a store from bar updates grid to show fewer stores", async ({ page }) => {
  await setupComparePage(page, { storeSlugs: ["mt-horeb", "verona", "madison-east"] });

  // Start with 3 stores per day card
  var todayCard = page.locator(".compare-day-card").first();
  await expect(todayCard.locator(".compare-store-row")).toHaveCount(3);

  // Remove the last store (madison-east) by clicking its remove button
  var chips = page.locator(".compare-store-chip");
  var lastRemoveBtn = chips.nth(2).locator(".compare-store-chip-remove");
  await lastRemoveBtn.click();

  // Wait for grid to re-render with 2 stores
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });
  todayCard = page.locator(".compare-day-card").first();
  await expect(todayCard.locator(".compare-store-row")).toHaveCount(2);

  // Store bar should now show 2 chips
  var updatedChips = page.locator(".compare-store-chip");
  await expect(updatedChips).toHaveCount(2);
});

// ---------------------------------------------------------------------------
// Removing stores down to 1 shows grid with add-more hint (not empty state)
// ---------------------------------------------------------------------------
test("removing stores down to 1 shows grid with add-more hint", async ({ page }) => {
  await setupComparePage(page, { storeSlugs: ["mt-horeb", "verona"] });

  // Remove one store
  var firstRemoveBtn = page.locator(".compare-store-chip-remove").first();
  await firstRemoveBtn.click();

  // Should show the grid with 1 store and add-more hint
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });
  var dayCards = page.locator(".compare-day-card");
  await expect(dayCards).toHaveCount(3);

  // Each day card should have 1 store row
  for (var i = 0; i < 3; i++) {
    var rows = dayCards.nth(i).locator(".compare-store-row");
    await expect(rows).toHaveCount(1);
  }

  // Add-more hint should be present
  var hints = page.locator(".compare-add-hint");
  await expect(hints).toHaveCount(3);
});

// ---------------------------------------------------------------------------
// Add store button on bar opens the multi-store picker
// ---------------------------------------------------------------------------
test("add store button on bar opens multi-store picker with pre-checked stores", async ({ page }) => {
  await setupComparePage(page, { storeSlugs: ["mt-horeb", "verona"] });

  // Click add store button on the bar
  var addBtn = page.locator(".compare-store-add-btn");
  await addBtn.click();

  // Picker should appear
  var picker = page.locator(".compare-picker");
  await expect(picker).toBeVisible({ timeout: 5000 });

  // Mt. Horeb and Verona checkboxes should be pre-checked
  var mtHorebCb = picker.locator('.compare-picker-checkbox[data-slug="mt-horeb"]');
  await expect(mtHorebCb).toBeChecked();

  var veronaCb = picker.locator('.compare-picker-checkbox[data-slug="verona"]');
  await expect(veronaCb).toBeChecked();

  // Other stores should be unchecked
  var madisonCb = picker.locator('.compare-picker-checkbox[data-slug="madison-east"]');
  await expect(madisonCb).not.toBeChecked();
});

// ---------------------------------------------------------------------------
// Picker enforces max 4 stores
// ---------------------------------------------------------------------------
test("picker disables unchecked checkboxes when 4 stores selected", async ({ page }) => {
  await setupComparePage(page, { storeSlugs: ["mt-horeb", "verona"] });

  var addBtn = page.locator(".compare-store-add-btn");
  await addBtn.click();
  await page.waitForSelector(".compare-picker", { timeout: 5000 });

  // Select 2 more stores to reach max 4
  await page.locator('.compare-picker-item[data-slug="madison-east"]').click();
  await page.locator('.compare-picker-item[data-slug="fitchburg"]').click();

  // 5th store checkbox should be disabled
  var sunPrairieCb = page.locator('.compare-picker-checkbox[data-slug="sun-prairie"]');
  await expect(sunPrairieCb).toBeDisabled();
});

// ---------------------------------------------------------------------------
// Picker search filters store list
// ---------------------------------------------------------------------------
test("picker search filters store list", async ({ page }) => {
  await setupComparePage(page);
  await page.waitForSelector("#compare-empty", { timeout: 10000 });

  await page.click("#compare-add-stores");
  await page.waitForSelector(".compare-picker", { timeout: 5000 });

  // Type "Verona" in search
  var search = page.locator(".compare-picker-search");
  await search.fill("Verona");

  // Only Verona item should be visible
  var visibleItems = page.locator(".compare-picker-item:visible");
  await expect(visibleItems).toHaveCount(1);
  await expect(visibleItems.first()).toHaveAttribute("data-slug", "verona");
});

// ---------------------------------------------------------------------------
// Picker close button closes without saving
// ---------------------------------------------------------------------------
test("picker close button closes without saving changes", async ({ page }) => {
  await setupComparePage(page, { storeSlugs: ["mt-horeb", "verona"] });

  var addBtn = page.locator(".compare-store-add-btn");
  await addBtn.click();
  await page.waitForSelector(".compare-picker", { timeout: 5000 });

  // Check a new store
  await page.locator('.compare-picker-item[data-slug="madison-east"]').click();

  // Close without clicking Done
  await page.locator(".compare-picker-close").click();

  // Picker should be gone
  await expect(page.locator(".compare-picker")).toHaveCount(0);

  // Grid should still show 2 stores (not 3)
  var todayCard = page.locator(".compare-day-card").first();
  await expect(todayCard.locator(".compare-store-row")).toHaveCount(2);
});

// ---------------------------------------------------------------------------
// Preferences are persisted to localStorage
// ---------------------------------------------------------------------------
test("selected stores are saved to custard:compare:stores", async ({ page }) => {
  await setupComparePage(page);
  await page.waitForSelector("#compare-empty", { timeout: 10000 });

  // Open picker, select 2 stores, confirm
  await page.click("#compare-add-stores");
  await page.waitForSelector(".compare-picker", { timeout: 5000 });
  await page.locator('.compare-picker-item[data-slug="mt-horeb"]').click();
  await page.locator('.compare-picker-item[data-slug="verona"]').click();
  await page.locator(".compare-picker-done").click();

  // Wait for grid
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });

  // Read localStorage -- now a plain array under the new key
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
