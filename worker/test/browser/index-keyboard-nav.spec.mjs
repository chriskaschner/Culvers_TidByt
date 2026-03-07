import { expect, test } from "@playwright/test";

test("index SharedNav store picker search filters stores", async ({ page }) => {
  await page.route(
    "https://custard.chriskaschner.com/api/v1/flavor-colors",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          base_colors: {},
          cone_colors: { waffle: "#D2691E", waffle_dark: "#B8860B" },
          topping_colors: {},
          ribbon_colors: {},
          profiles: {},
        }),
      });
    },
  );

  // Mock geolocation API to prevent picker overlay on first visit
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

  // Open SharedNav's store picker via the change button on the first-visit prompt
  const changeBtn = page.locator("#shared-nav .store-change-btn");
  await expect(changeBtn).toBeVisible({ timeout: 10000 });
  await changeBtn.click();

  const pickerSearch = page.locator("#shared-nav .store-picker-search");
  const pickerItems = page.locator("#shared-nav .store-picker-item");

  await expect(pickerSearch).toBeVisible();

  // Type to filter
  await pickerSearch.fill("Madison");

  // Visible items should be filtered
  const visibleItems = page.locator("#shared-nav .store-picker-item:visible");
  await expect.poll(async () => {
    const total = await pickerItems.count();
    const visible = await visibleItems.count();
    return visible < total && visible > 0;
  }).toBeTruthy();

  // Close picker via close button
  const closeBtn = page.locator("#shared-nav .store-picker-close");
  await closeBtn.click();
  await expect(page.locator("#shared-nav .store-picker")).toBeHidden();
});
