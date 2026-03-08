import { expect, test } from "@playwright/test";

test("shared footer renders Get Updates, GitHub, and Privacy links", async ({ page }) => {
  await page.goto("/index.html");
  const footerLinks = page.locator(".shared-footer-links");
  await expect(footerLinks).toBeVisible();

  const updatesLink = footerLinks.getByRole("link", { name: "Get Updates" });
  await expect(updatesLink).toBeVisible();
  await expect(updatesLink).toHaveAttribute("href", "updates.html");

  const githubLink = footerLinks.getByRole("link", { name: "GitHub" });
  await expect(githubLink).toBeVisible();

  const privacyLink = footerLinks.getByRole("link", { name: "Privacy" });
  await expect(privacyLink).toBeVisible();
  await expect(privacyLink).toHaveAttribute("href", "privacy.html");
});

test("footer renders on compare page too", async ({ page }) => {
  await page.goto("/compare.html");
  const footerLinks = page.locator(".shared-footer-links");
  await expect(footerLinks).toBeVisible();
  await expect(footerLinks.getByRole("link", { name: "Get Updates" })).toBeVisible();
});
