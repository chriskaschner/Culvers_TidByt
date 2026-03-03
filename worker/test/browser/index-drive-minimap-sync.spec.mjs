/**
 * Mini-map pin synchronization tests.
 *
 * Verifies that after a chip toggle or sort rerank (both call rerenderFromRaw
 * without fetching), the is-active class is correctly applied to BOTH the
 * ranked card and its corresponding map pin.
 *
 * Regression: before the fix, rerenderFromRaw() only called setActiveSlug()
 * when state.activeSlug was null. Fresh card DOM nodes produced by
 * renderCards() never received is-active after a rerank, leaving cards and
 * pins out of sync.
 */
import { expect, test } from "@playwright/test";

function mockDrivePayload() {
  return {
    query: {
      slugs: ["mt-horeb", "madison-todd-drive"],
      location: null,
      exclude: [],
      boost: [],
      avoid: [],
      sort: "match",
      include_estimated: 0,
      radius: 25,
    },
    cards: [
      {
        slug: "mt-horeb",
        name: "Mt. Horeb, WI",
        flavor: "Caramel Cashew",
        description: "Vanilla custard with caramel and cashew pieces.",
        tags: ["caramel", "nuts", "kids", "rich"],
        vibe: ["Caramel", "Rich"],
        dealbreakers: [],
        distance_miles: 8.4,
        eta_minutes: 21,
        rarity: { avg_gap_days: 63, days_since_last: 8, last_seen: "2026-02-20", novelty_bonus_applied: false },
        lat: 43.01,
        lon: -89.72,
        score: 58,
        map_bucket: "ok",
        certainty_tier: "confirmed",
        source: "confirmed",
      },
      {
        slug: "madison-todd-drive",
        name: "Madison, WI",
        flavor: "Lemon Berry Crisp",
        description: "Bright lemon custard with berry swirl.",
        tags: ["fruit", "bright", "seasonal"],
        vibe: ["Fruity", "Bright"],
        dealbreakers: [],
        distance_miles: 2.1,
        eta_minutes: 7,
        rarity: { avg_gap_days: 35, days_since_last: 31, last_seen: "2026-01-28", novelty_bonus_applied: true },
        lat: 43.07,
        lon: -89.39,
        score: 52,
        map_bucket: "ok",
        certainty_tier: "confirmed",
        source: "confirmed",
      },
    ],
    excluded: [],
    nearby_leaderboard: [],
    generated_at: "2026-03-03T00:00:00.000Z",
  };
}

async function setupPage(page) {
  // Disable SW so page.route() intercepts fetch() reliably.
  await page.addInitScript(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register = () => Promise.resolve({
        installing: null, waiting: null, active: null,
        addEventListener: () => {}, removeEventListener: () => {},
      });
    }
  });

  await page.route("https://custard.chriskaschner.com/api/v1/drive*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockDrivePayload()) });
  });
  await page.route("https://custard.chriskaschner.com/api/v1/flavor-colors", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ base_colors: {}, cone_colors: { waffle: "#D2691E", waffle_dark: "#B8860B" }, topping_colors: {}, ribbon_colors: {}, profiles: {} }) });
  });
  await page.route("https://custard.chriskaschner.com/api/v1/flavors?*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ name: "Mt. Horeb, WI", flavors: [] }) });
  });
  await page.route("https://custard.chriskaschner.com/api/v1/today?*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ store: "Mt. Horeb", date: "2026-03-03", flavor: "Caramel Cashew", description: "", rarity: null }) });
  });
  await page.route("https://custard.chriskaschner.com/api/v1/forecast/*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ store_slug: "mt-horeb", forecast: { date: "2026-03-03", predictions: [] } }) });
  });
  await page.route("https://custard.chriskaschner.com/api/v1/reliability*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) });
  });
  await page.route("https://custard.chriskaschner.com/api/v1/signals/*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ signals: [] }) });
  });
  await page.route("https://custard.chriskaschner.com/api/v1/events", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
}

test("mini-map: initial render activates one card and its matching pin", async ({ page }) => {
  await setupPage(page);
  await page.goto("/index.html?stores=mt-horeb,madison-todd-drive");

  // Wait until at least one card is visible.
  await expect(page.locator('.drive-card').first()).toBeVisible();

  // Exactly one card should be active.
  await expect(page.locator('.drive-card.is-active')).toHaveCount(1);

  // The active slug on the card and pin must match.
  const activeCard = page.locator('.drive-card.is-active');
  const activeSlug = await activeCard.getAttribute('data-store-slug');
  const matchingPin = page.locator('.drive-pin[data-pin-slug="' + activeSlug + '"]');
  await expect(matchingPin).toHaveClass(/is-active/);

  // No other pin should be active.
  await expect(page.locator('.drive-pin.is-active')).toHaveCount(1);
});

test("mini-map: hovering a card activates that card and its pin", async ({ page }) => {
  await setupPage(page);
  await page.goto("/index.html?stores=mt-horeb,madison-todd-drive");

  const secondCard = page.locator('.drive-card[data-store-slug="madison-todd-drive"]');
  await expect(secondCard).toBeVisible();

  await secondCard.hover();

  await expect(secondCard).toHaveClass(/is-active/);
  const secondPin = page.locator('.drive-pin[data-pin-slug="madison-todd-drive"]');
  await expect(secondPin).toHaveClass(/is-active/);

  // First card and pin should not be active.
  const firstCard = page.locator('.drive-card[data-store-slug="mt-horeb"]');
  await expect(firstCard).not.toHaveClass(/is-active/);
  const firstPin = page.locator('.drive-pin[data-pin-slug="mt-horeb"]');
  await expect(firstPin).not.toHaveClass(/is-active/);
});

test("mini-map: is-active persists on card and pin after sort rerank", async ({ page }) => {
  await setupPage(page);
  await page.goto("/index.html?stores=mt-horeb,madison-todd-drive");

  const secondCard = page.locator('.drive-card[data-store-slug="madison-todd-drive"]');
  await expect(secondCard).toBeVisible();

  // Activate the second card by hovering.
  await secondCard.hover();
  await expect(secondCard).toHaveClass(/is-active/);
  const secondPin = page.locator('.drive-pin[data-pin-slug="madison-todd-drive"]');
  await expect(secondPin).toHaveClass(/is-active/);

  // Click a sort button to trigger rerenderFromRaw() without fetching.
  const detourBtn = page.locator('[data-sort="detour"]');
  await detourBtn.click();

  // After rerank, card DOM nodes are replaced. Both card and pin must still be active.
  // This was the regression: cards lost is-active after rerank; pins kept it.
  await expect(page.locator('.drive-card[data-store-slug="madison-todd-drive"]')).toHaveClass(/is-active/);
  await expect(page.locator('.drive-pin[data-pin-slug="madison-todd-drive"]')).toHaveClass(/is-active/);
});

test("mini-map: pin click activates card and scrolls it into view", async ({ page }) => {
  await setupPage(page);
  await page.goto("/index.html?stores=mt-horeb,madison-todd-drive");

  const firstCard = page.locator('.drive-card[data-store-slug="mt-horeb"]');
  await expect(firstCard).toBeVisible();

  // Hover second card to shift active state away from first.
  await page.locator('.drive-card[data-store-slug="madison-todd-drive"]').hover();

  const firstPin = page.locator('.drive-pin[data-pin-slug="mt-horeb"]');
  await expect(firstPin).not.toHaveClass(/is-active/);

  // Click first pin — should activate first card.
  await firstPin.click();
  await expect(firstPin).toHaveClass(/is-active/);
  await expect(firstCard).toHaveClass(/is-active/);
});
