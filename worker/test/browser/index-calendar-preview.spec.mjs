import { expect, test } from "@playwright/test";

// Skipped: calendar preview section removed from index.html in Phase 2 (TDAY-07)
test.skip("index calendar preview renders and updates with selected store context", async ({ page }) => {
  const todayIso = new Date().toISOString().slice(0, 10);

  await page.route(
    "https://custard.chriskaschner.com/api/v1/flavor-colors",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          base_colors: { vanilla: "#F5DEB3" },
          cone_colors: { waffle: "#D2691E", waffle_dark: "#B8860B" },
          topping_colors: {},
          ribbon_colors: {},
          profiles: {},
        }),
      });
    },
  );

  await page.route(
    /https:\/\/custard-calendar\.chris-kaschner\.workers\.dev\/api\/v1\/flavors\?slug=.*/,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          fetched_at: new Date().toISOString(),
          flavors: [
            {
              date: todayIso,
              title: "Turtle",
              description: "A Culver's classic with caramel and pecans.",
            },
          ],
        }),
      });
    },
  );

  await page.route(
    /https:\/\/custard-calendar\.chris-kaschner\.workers\.dev\/api\/v1\/forecast\/.*/,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ days: [] }),
      });
    },
  );

  await page.route(
    /https:\/\/custard-calendar\.chris-kaschner\.workers\.dev\/api\/v1\/today\?slug=.*/,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rarity: null }),
      });
    },
  );

  // Mock geolocation API to prevent picker overlay
  await page.context().route(
    "**/api/v1/geolocate",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ lat: 43.07, lon: -89.40 }),
      });
    },
  );

  await page.goto("/index.html");

  await expect(page.locator("#calendar-preview-section")).toBeVisible();
  await expect(page.locator("#calendar-preview-section")).toContainText("Google Calendar style");
  await expect(page.locator("#calendar-preview-section")).toContainText("Apple Calendar style");

  // Use SharedNav store picker to select a store (legacy search is hidden)
  const changeBtn = page.locator("#shared-nav .store-change-btn");
  await changeBtn.click();

  const pickerSearch = page.locator("#shared-nav .store-picker-search");
  await expect(pickerSearch).toBeVisible();
  await pickerSearch.fill("Madison");

  const pickerItems = page.locator("#shared-nav .store-picker-item:visible");
  await expect.poll(async () => pickerItems.count()).toBeGreaterThan(0);
  await pickerItems.first().click();

  // Store indicator should show after selection
  await expect(page.locator("#shared-nav .store-indicator")).toBeVisible();
  await expect(page.locator("#sample-google-location")).not.toContainText("Select a store");
  await expect(page.locator("#sample-apple-location")).not.toContainText("Select a store");
});
