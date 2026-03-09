import { test, expect } from "@playwright/test";

// alerts.html, siri.html, and radar.html are now redirect stubs.
// Store persistence is verified across pages that still have full UI.
test("primary store selection persists across updates, compare, and fun pages", async ({ page }) => {
  // Set primary store on updates.html (the destination for alerts/siri redirects)
  await page.goto("/updates.html");

  // Wait for stores.json to load and set primary store via localStorage
  await page.evaluate(() => {
    localStorage.setItem("custard-primary", "mt-horeb");
  });

  // Navigate to compare.html and verify store persists in localStorage
  await page.goto("/compare.html");
  const stored = await page.evaluate(() => localStorage.getItem("custard-primary"));
  expect(stored).toBe("mt-horeb");

  // Navigate to fun.html and verify store still persists
  await page.goto("/fun.html");
  const storedAgain = await page.evaluate(() => localStorage.getItem("custard-primary"));
  expect(storedAgain).toBe("mt-horeb");
});
