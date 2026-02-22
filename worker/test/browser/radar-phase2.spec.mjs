import { expect, test } from "@playwright/test";

function isoDateOffset(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildForecast(slug, strongTurtle) {
  const top = strongTurtle
    ? [
        { flavor: "Turtle", probability: 0.16, confidence: "high" },
        { flavor: "Caramel Cashew", probability: 0.09, confidence: "medium" },
      ]
    : [
        { flavor: "Chocolate Oreo Volcano", probability: 0.12, confidence: "high" },
        { flavor: "Turtle", probability: 0.03, confidence: "low" },
      ];

  return {
    store_slug: slug,
    generated_at: new Date().toISOString(),
    history_depth: 2100,
    days: [
      {
        date: isoDateOffset(0),
        predictions: top,
        overdue_flavors: [{ flavor: "Turtle", days_since: 45, avg_gap: 24 }],
        prose: "Forecast prose",
      },
      {
        date: isoDateOffset(1),
        predictions: top,
        overdue_flavors: [{ flavor: "Turtle", days_since: 45, avg_gap: 24 }],
        prose: "Forecast prose",
      },
      {
        date: isoDateOffset(2),
        predictions: top,
        overdue_flavors: [{ flavor: "Turtle", days_since: 45, avg_gap: 24 }],
        prose: "Forecast prose",
      },
      {
        date: isoDateOffset(3),
        predictions: top,
        overdue_flavors: [],
        prose: "Forecast prose",
      },
      {
        date: isoDateOffset(4),
        predictions: top,
        overdue_flavors: [],
        prose: "Forecast prose",
      },
      {
        date: isoDateOffset(5),
        predictions: top,
        overdue_flavors: [],
        prose: "Forecast prose",
      },
      {
        date: isoDateOffset(6),
        predictions: top,
        overdue_flavors: [],
        prose: "Forecast prose",
      },
    ],
  };
}

test("radar phase 2 shows next best store, badges, and accuracy dashboard", async ({ page }) => {
  let primarySlug = null;

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === "/api/v1/geolocate") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          state: "WI",
          stateName: "Wisconsin",
          city: "Madison",
          country: "US",
        }),
      });
      return;
    }

    if (path === "/api/v1/flavors") {
      const slug = url.searchParams.get("slug") || "unknown";
      if (!primarySlug) primarySlug = slug;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          slug,
          name: "Test Store",
          address: "123 Main St",
          flavors: [
            { date: isoDateOffset(0), title: "Vanilla", description: "Classic" },
            { date: isoDateOffset(1), title: "Butter Pecan", description: "Nutty" },
          ],
        }),
      });
      return;
    }

    if (path.startsWith("/api/v1/forecast/")) {
      const slug = decodeURIComponent(path.replace("/api/v1/forecast/", ""));
      if (!primarySlug) primarySlug = slug;
      const isPrimary = primarySlug ? slug === primarySlug : false;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildForecast(slug, !isPrimary)),
      });
      return;
    }

    if (path.startsWith("/api/v1/metrics/store/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          slug: decodeURIComponent(path.replace("/api/v1/metrics/store/", "")),
          unique_flavors: 88,
          total_days: 1400,
          recent_history: [
            { date: isoDateOffset(-1), flavor: "Turtle" },
            { date: isoDateOffset(-2), flavor: "Turtle" },
            { date: isoDateOffset(-3), flavor: "Turtle" },
            { date: isoDateOffset(-4), flavor: "Vanilla" },
          ],
          active_streaks: [{ flavor: "Turtle", length: 3, start: isoDateOffset(-3), end: isoDateOffset(-1) }],
        }),
      });
      return;
    }

    if (path.startsWith("/api/v1/metrics/flavor/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          normalized_flavor: decodeURIComponent(path.replace("/api/v1/metrics/flavor/", "")),
          total_appearances: 120,
          store_count: 35,
          recent: [],
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/radar.html");
  await page.waitForSelector("#store-select option:not([disabled])[value]");

  const firstValue = await page.$eval("#store-select option:not([disabled])[value]", (el) => el.value);
  const selected = await page.selectOption("#store-select", firstValue);
  primarySlug = selected[0];

  await page.waitForSelector("#timeline-section:not([hidden])");
  await page.fill("#flavor-search", "turtle");
  await page.waitForSelector("#flavor-results .flavor-result-item .flavor-name");
  const exactTurtle = page.locator("#flavor-results .flavor-result-item", {
    has: page.locator(".flavor-name", { hasText: /^Turtle$/ }),
  });
  if (await exactTurtle.count()) {
    await exactTurtle.first().click();
  } else {
    await page.click("#flavor-results .flavor-result-item");
  }

  await expect(page.locator("#next-best-section")).not.toHaveAttribute("hidden", "");
  await expect(page.locator("#accuracy-section")).not.toHaveAttribute("hidden", "");
  await expect(page.locator("#next-best-list .next-best-card").first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#acc-top1")).not.toHaveText("--");
  await expect(page.locator(".intel-badge").first()).toBeVisible();
});
