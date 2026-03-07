import { expect, test } from "@playwright/test";

/**
 * Shared-nav store indicator tests (STOR-01 through STOR-05).
 *
 * These tests cover store geolocation, first-visit prompts, store indicator
 * display, store picker interaction, and cross-page persistence.
 *
 * Since shared-nav.js is not yet wired into the HTML pages (Plan 02),
 * each test injects the #shared-nav container and loads the script manually.
 */

// Mock store manifest returned by the Worker API
const MOCK_STORES = [
  { slug: "mt-horeb", name: "Mt. Horeb", city: "Mt. Horeb", state: "WI", lat: 43.0045, lng: -89.7387, brand: "culvers" },
  { slug: "verona", name: "Verona", city: "Verona", state: "WI", lat: 42.9919, lng: -89.5332, brand: "culvers" },
  { slug: "madison-east", name: "Madison East", city: "Madison", state: "WI", lat: 43.0731, lng: -89.3012, brand: "culvers" },
];

// Mock IP geolocation response (near Madison, WI)
const MOCK_GEO = { lat: 43.0, lon: -89.4, city: "Madison", regionName: "Wisconsin" };

/**
 * Set up a page with shared-nav.js injected. Intercepts API calls for
 * the store manifest and IP geolocation to keep tests deterministic.
 */
async function setupSharedNav(page, { clearStorage = false, setStore = null } = {}) {
  // Intercept store manifest API
  await page.route("**/api/v1/stores", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_STORES),
    });
  });

  // Intercept IP geolocation API
  await page.route("**/ip-api.com/**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_GEO),
    });
  });

  // Handle localStorage before navigation
  if (clearStorage) {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  if (setStore) {
    await page.addInitScript((slug) => {
      localStorage.setItem("custard-primary", slug);
    }, setStore);
  }

  // Navigate to the page
  await page.goto("/index.html");

  // Inject #shared-nav container if it doesn't exist
  await page.evaluate(() => {
    if (!document.getElementById("shared-nav")) {
      var container = document.createElement("div");
      container.id = "shared-nav";
      var header = document.querySelector("header");
      if (header) {
        header.appendChild(container);
      } else {
        document.body.insertBefore(container, document.body.firstChild);
      }
    }
  });

  // Load shared-nav.js (fires DOMContentLoaded again won't work, so call init manually)
  await page.addScriptTag({ url: "/shared-nav.js" });

  // Trigger rendering since DOMContentLoaded already fired
  await page.evaluate(() => {
    if (typeof SharedNav !== "undefined" && SharedNav.renderNav) {
      var el = document.getElementById("shared-nav");
      if (el) SharedNav.renderNav(el);
    }
  });

  // Allow async operations (manifest fetch, geolocation) to complete
  await page.waitForTimeout(1500);
}

// ---------------------------------------------------------------------------
// STOR-03: Store indicator visible when store is saved
// ---------------------------------------------------------------------------
test("STOR-03: store indicator visible when a store is saved in localStorage", async ({ page }) => {
  await setupSharedNav(page, { setStore: "mt-horeb" });

  const sharedNav = page.locator("#shared-nav");
  await expect(sharedNav).toBeVisible();

  // Store indicator should be present with store name text
  const indicator = sharedNav.locator(".store-indicator");
  await expect(indicator).toBeVisible();

  // Should contain non-empty store name text
  const text = await indicator.textContent();
  expect(text.trim().length).toBeGreaterThan(0);

  // Should include a "change" button
  const changeBtn = indicator.locator(".store-change-btn");
  await expect(changeBtn).toBeVisible();
});

// ---------------------------------------------------------------------------
// STOR-05: Store persists across pages
// ---------------------------------------------------------------------------
test("STOR-05: store selection persists across page navigation", async ({ page }) => {
  // Set up routes and store before navigating
  await page.route("**/api/v1/stores", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_STORES),
    });
  });

  await page.route("**/ip-api.com/**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_GEO),
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem("custard-primary", "mt-horeb");
  });

  // Visit index.html with shared-nav
  await page.goto("/index.html");
  await page.evaluate(() => {
    if (!document.getElementById("shared-nav")) {
      var c = document.createElement("div");
      c.id = "shared-nav";
      var h = document.querySelector("header");
      if (h) h.appendChild(c); else document.body.insertBefore(c, document.body.firstChild);
    }
  });
  await page.addScriptTag({ url: "/shared-nav.js" });
  await page.evaluate(() => {
    if (typeof SharedNav !== "undefined" && SharedNav.renderNav) {
      var el = document.getElementById("shared-nav");
      if (el) SharedNav.renderNav(el);
    }
  });
  await page.waitForTimeout(1500);

  // Verify store shows on index.html
  const indexIndicator = page.locator("#shared-nav .store-indicator");
  await expect(indexIndicator).toBeVisible();
  const indexText = await indexIndicator.textContent();

  // Navigate to calendar.html
  await page.goto("/calendar.html");
  await page.evaluate(() => {
    if (!document.getElementById("shared-nav")) {
      var c = document.createElement("div");
      c.id = "shared-nav";
      var h = document.querySelector("header");
      if (h) h.appendChild(c); else document.body.insertBefore(c, document.body.firstChild);
    }
  });
  await page.addScriptTag({ url: "/shared-nav.js" });
  await page.evaluate(() => {
    if (typeof SharedNav !== "undefined" && SharedNav.renderNav) {
      var el = document.getElementById("shared-nav");
      if (el) SharedNav.renderNav(el);
    }
  });
  await page.waitForTimeout(1500);

  // Verify same store shows on calendar.html
  const calIndicator = page.locator("#shared-nav .store-indicator");
  await expect(calIndicator).toBeVisible();
  const calText = await calIndicator.textContent();

  // Both pages should show the same store name content
  expect(calText.trim().length).toBeGreaterThan(0);
  expect(calText).toContain(indexText.replace(/change/i, "").trim().split(" ")[0]);
});

// ---------------------------------------------------------------------------
// STOR-04: Tap "change" opens store picker
// ---------------------------------------------------------------------------
test("STOR-04: tapping change button opens the store picker", async ({ page }) => {
  await setupSharedNav(page, { setStore: "mt-horeb" });

  // Click the change button
  const changeBtn = page.locator("#shared-nav .store-change-btn");
  await expect(changeBtn).toBeVisible();
  await changeBtn.click();

  // Store picker should become visible
  const picker = page.locator(".store-picker");
  await expect(picker).toBeVisible();

  // Picker should contain a search input
  const searchInput = picker.locator("input[type='text'], input[type='search']");
  await expect(searchInput).toBeVisible();
});

// ---------------------------------------------------------------------------
// STOR-02: First-visit confirmation prompt
// ---------------------------------------------------------------------------
test("STOR-02: first-time visitor sees confirmation prompt with suggested store", async ({ page }) => {
  await setupSharedNav(page, { clearStorage: true });

  // First-visit prompt should be visible
  const prompt = page.locator("#shared-nav .first-visit-prompt");
  await expect(prompt).toBeVisible();

  // Should contain text about showing flavors
  const text = await prompt.textContent();
  expect(text.toLowerCase()).toMatch(/showing|flavors|for/);

  // Should have a change action
  const changeBtn = prompt.locator(".store-change-btn");
  await expect(changeBtn).toBeVisible();
});

// ---------------------------------------------------------------------------
// STOR-01: First-time visitor is geolocated
// ---------------------------------------------------------------------------
test("STOR-01: first-time visitor is geolocated via IP to nearest store", async ({ page }) => {
  await setupSharedNav(page, { clearStorage: true });

  // The shared-nav should show a store name (from IP geolocation + nearest store lookup)
  const sharedNav = page.locator("#shared-nav");
  await expect(sharedNav).toBeVisible();

  // Either the first-visit prompt or store indicator should show a real store name
  const promptOrIndicator = page.locator("#shared-nav .first-visit-prompt, #shared-nav .store-indicator");
  await expect(promptOrIndicator.first()).toBeVisible();

  // The text should contain a store name from our mock manifest (not empty, not "unknown")
  const text = await promptOrIndicator.first().textContent();
  expect(text.trim().length).toBeGreaterThan(0);
  expect(text.toLowerCase()).not.toContain("unknown");

  // Should match one of the mock stores
  const storeNames = MOCK_STORES.map((s) => s.name.toLowerCase());
  const lowerText = text.toLowerCase();
  const matchesStore = storeNames.some((name) => lowerText.includes(name.toLowerCase()));
  expect(matchesStore).toBe(true);
});
