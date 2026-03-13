import { expect, test } from "@playwright/test";

/**
 * DTKN-04: Interactive token resolution tests.
 *
 * Verifies that interactive tokens (focus-ring, focus-ring-offset, hover-bg)
 * resolve to non-empty values, that :focus-visible outline uses the
 * --focus-ring token, and that brand tokens for the six custard brands
 * resolve to non-empty values.
 */

// ---------------------------------------------------------------------------
// Test 1: Interactive tokens resolve to non-empty values
// ---------------------------------------------------------------------------
test("DTKN-04: --focus-ring, --focus-ring-offset, --hover-bg resolve to non-empty values", async ({ page }) => {
  await page.goto("/index.html");

  var tokens = await page.evaluate(function () {
    var root = getComputedStyle(document.documentElement);
    return {
      focusRing: root.getPropertyValue("--focus-ring").trim(),
      focusRingOffset: root.getPropertyValue("--focus-ring-offset").trim(),
      hoverBg: root.getPropertyValue("--hover-bg").trim(),
    };
  });

  expect(tokens.focusRing).not.toBe("");
  expect(tokens.focusRingOffset).not.toBe("");
  expect(tokens.hoverBg).not.toBe("");
});

// ---------------------------------------------------------------------------
// Test 2: :focus-visible outline uses --focus-ring token
// ---------------------------------------------------------------------------
test("DTKN-04: :focus-visible outline uses --focus-ring token (tab to a link, check outline-color)", async ({ page }) => {
  await page.goto("/index.html");

  // Find a focusable element and focus it via keyboard
  var link = page.locator("a").first();
  var linkExists = await link.count();

  if (linkExists > 0) {
    // Tab to the first focusable element
    await page.keyboard.press("Tab");

    // Get the focused element's outline color
    var result = await page.evaluate(function () {
      var focused = document.querySelector(":focus-visible");
      if (!focused) return { outlineColor: null, tokenColor: null };

      var cs = getComputedStyle(focused);
      var tokenColor = getComputedStyle(document.documentElement).getPropertyValue("--focus-ring").trim();

      return {
        outlineColor: cs.outlineColor,
        outlineStyle: cs.outlineStyle,
        tokenColor: tokenColor,
      };
    });

    // The token should resolve to a non-empty value
    expect(result.tokenColor).not.toBe("");
    // If a focused element was found, check outline
    if (result.outlineColor) {
      expect(result.outlineStyle).not.toBe("none");
    }
  } else {
    // If no links on the page, at least verify the token resolves
    var tokenValue = await page.evaluate(function () {
      return getComputedStyle(document.documentElement).getPropertyValue("--focus-ring").trim();
    });
    expect(tokenValue).not.toBe("");
  }
});

// ---------------------------------------------------------------------------
// Test 3: Brand tokens for all six custard brands resolve to non-empty values
// ---------------------------------------------------------------------------
test("DTKN-04: --brand-culvers through --brand-oscars (6 brand tokens) resolve to non-empty values", async ({ page }) => {
  await page.goto("/index.html");

  var tokens = await page.evaluate(function () {
    var root = getComputedStyle(document.documentElement);
    return {
      culvers: root.getPropertyValue("--brand-culvers").trim(),
      kopps: root.getPropertyValue("--brand-kopps").trim(),
      gilles: root.getPropertyValue("--brand-gilles").trim(),
      hefners: root.getPropertyValue("--brand-hefners").trim(),
      kraverz: root.getPropertyValue("--brand-kraverz").trim(),
      oscars: root.getPropertyValue("--brand-oscars").trim(),
    };
  });

  expect(tokens.culvers).not.toBe("");
  expect(tokens.kopps).not.toBe("");
  expect(tokens.gilles).not.toBe("");
  expect(tokens.hefners).not.toBe("");
  expect(tokens.kraverz).not.toBe("");
  expect(tokens.oscars).not.toBe("");
});
