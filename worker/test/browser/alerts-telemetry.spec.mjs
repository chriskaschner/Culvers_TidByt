import { expect, test } from "@playwright/test";

// Skipped: alerts.html is now a redirect stub to updates.html.
// Alert signup features live on updates.html. Telemetry coverage
// for the subscribe flow should be added to updates-page tests
// when the alert form is integrated there.
test.skip("alerts page emits alert_form_view and alert_subscribe_success telemetry", async ({ page }) => {
  // Original test visited /alerts.html expecting full form UI.
  // alerts.html is now a bare redirect stub (~416 bytes).
});
