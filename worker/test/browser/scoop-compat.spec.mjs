import { expect, test } from "@playwright/test";

// scoop.html is now a redirect stub to index.html.
// This test verifies the redirect preserves query params.
test("scoop.html redirects to index.html preserving ?stores= query param", async ({ page }) => {
  await page.goto("/scoop.html?stores=mt-horeb,madison-todd-drive");

  // Should redirect to index.html with query params intact
  await page.waitForURL(/\/index\.html\?stores=mt-horeb,madison-todd-drive/);

  const url = new URL(page.url());
  expect(url.pathname).toContain("index.html");
  expect(url.searchParams.get("stores")).toBe("mt-horeb,madison-todd-drive");
});
