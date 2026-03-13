import { expect, test } from "@playwright/test";

/**
 * DTKN-02: Rarity token resolution tests.
 *
 * Verifies that rarity tokens (ultra-rare, rare, uncommon) resolve to
 * non-empty values from :root, that popup rarity chips and Today/Compare
 * rarity badges use the same computed colors (palette unification), and
 * that common/staple badges are hidden (display:none).
 */

// ---------------------------------------------------------------------------
// Test 1: Rarity tokens resolve to non-empty values
// ---------------------------------------------------------------------------
test("DTKN-02: --rarity-ultra-rare-bg, --rarity-rare-bg, --rarity-uncommon-bg resolve to non-empty values", async ({ page }) => {
  await page.goto("/index.html");

  var tokens = await page.evaluate(function () {
    var root = getComputedStyle(document.documentElement);
    return {
      ultraRareBg: root.getPropertyValue("--rarity-ultra-rare-bg").trim(),
      rareBg: root.getPropertyValue("--rarity-rare-bg").trim(),
      uncommonBg: root.getPropertyValue("--rarity-uncommon-bg").trim(),
    };
  });

  expect(tokens.ultraRareBg).not.toBe("");
  expect(tokens.rareBg).not.toBe("");
  expect(tokens.uncommonBg).not.toBe("");
});

// ---------------------------------------------------------------------------
// Test 2: Popup and badge use same computed background color (palette unification)
// ---------------------------------------------------------------------------
test("DTKN-02: .popup-rarity-chip.rarity-ultra-rare and .rarity-badge-ultra-rare resolve to same computed background", async ({ page }) => {
  await page.goto("/index.html");

  var result = await page.evaluate(function () {
    // Create test elements for each class
    var popupChip = document.createElement("span");
    popupChip.className = "popup-rarity-chip rarity-ultra-rare";
    popupChip.textContent = "Ultra Rare";
    document.body.appendChild(popupChip);

    var badge = document.createElement("span");
    badge.className = "rarity-badge rarity-badge-ultra-rare";
    badge.textContent = "Ultra Rare";
    document.body.appendChild(badge);

    var popupBg = getComputedStyle(popupChip).backgroundColor;
    var badgeBg = getComputedStyle(badge).backgroundColor;

    return {
      popupBg: popupBg,
      badgeBg: badgeBg,
    };
  });

  // Both should resolve to the same background color (unified palette)
  expect(result.popupBg).toBe(result.badgeBg);
});

// ---------------------------------------------------------------------------
// Test 3: Common and staple rarity badges have display:none
// ---------------------------------------------------------------------------
test("DTKN-02: .rarity-badge-common and .rarity-badge-staple have display:none", async ({ page }) => {
  await page.goto("/index.html");

  var result = await page.evaluate(function () {
    var common = document.createElement("span");
    common.className = "rarity-badge rarity-badge-common";
    common.textContent = "Common";
    document.body.appendChild(common);

    var staple = document.createElement("span");
    staple.className = "rarity-badge rarity-badge-staple";
    staple.textContent = "Staple";
    document.body.appendChild(staple);

    return {
      commonDisplay: getComputedStyle(common).display,
      stapleDisplay: getComputedStyle(staple).display,
    };
  });

  expect(result.commonDisplay).toBe("none");
  expect(result.stapleDisplay).toBe("none");
});

// ---------------------------------------------------------------------------
// Test 4: Popup common and staple chips also have display:none
// ---------------------------------------------------------------------------
test("DTKN-02: .popup-rarity-chip.rarity-common and .popup-rarity-chip.rarity-staple have display:none", async ({ page }) => {
  await page.goto("/index.html");

  var result = await page.evaluate(function () {
    var common = document.createElement("span");
    common.className = "popup-rarity-chip rarity-common";
    common.textContent = "Common";
    document.body.appendChild(common);

    var staple = document.createElement("span");
    staple.className = "popup-rarity-chip rarity-staple";
    staple.textContent = "Staple";
    document.body.appendChild(staple);

    return {
      commonDisplay: getComputedStyle(common).display,
      stapleDisplay: getComputedStyle(staple).display,
    };
  });

  expect(result.commonDisplay).toBe("none");
  expect(result.stapleDisplay).toBe("none");
});

// ---------------------------------------------------------------------------
// Test 5: Rarity pill text is white for ultra-rare, rare, uncommon
// ---------------------------------------------------------------------------
test("DTKN-02: Rarity pill text is white (#fff) for ultra-rare, rare, uncommon", async ({ page }) => {
  await page.goto("/index.html");

  var result = await page.evaluate(function () {
    var levels = ["ultra-rare", "rare", "uncommon"];
    var colors = {};

    for (var i = 0; i < levels.length; i++) {
      var level = levels[i];
      var chip = document.createElement("span");
      chip.className = "popup-rarity-chip rarity-" + level;
      chip.textContent = level;
      document.body.appendChild(chip);
      colors[level] = getComputedStyle(chip).color;
    }

    return colors;
  });

  // White text should be rgb(255, 255, 255)
  expect(result["ultra-rare"]).toBe("rgb(255, 255, 255)");
  expect(result["rare"]).toBe("rgb(255, 255, 255)");
  expect(result["uncommon"]).toBe("rgb(255, 255, 255)");
});
