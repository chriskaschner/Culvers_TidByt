---
created: 2026-03-09T17:22:58.245Z
title: Clean up stale browser tests for removed pages
area: testing
files:
  - custard-calendar/worker/test/browser/drive-preferences.spec.mjs
  - custard-calendar/worker/test/browser/index-drive-minimap-sync.spec.mjs
  - custard-calendar/worker/test/browser/index-todays-drive.spec.mjs
  - custard-calendar/worker/test/browser/index-drive-defaults.spec.mjs
  - custard-calendar/worker/test/browser/index-drive-error-recovery.spec.mjs
  - custard-calendar/worker/test/browser/radar-phase2.spec.mjs
  - custard-calendar/worker/test/browser/alerts-telemetry.spec.mjs
  - custard-calendar/worker/test/browser/index-calendar-preview.spec.mjs
  - custard-calendar/worker/test/browser/quiz-personality.spec.mjs
  - custard-calendar/worker/test/browser/quiz-trivia-dynamic.spec.mjs
---

## Problem

24 browser tests (14 failing, 10 skipped) target pages/features that no longer exist:

**14 failing (not marked skip):**
- drive-preferences.spec.mjs (6) -- expect `.drive-card` on index.html, removed in Phase 2
- index-drive-minimap-sync.spec.mjs (4) -- expect `.drive-pin` minimap on index.html, removed in Phase 2
- index-todays-drive.spec.mjs (1) -- expects "Today's Drive" heading on index.html, removed in Phase 2
- index-drive-defaults.spec.mjs (1) -- minimap test, removed in Phase 2
- quiz-personality.spec.mjs (1) -- pre-existing failure, unrelated to page removal
- quiz-trivia-dynamic.spec.mjs (1) -- pre-existing failure, unrelated to page removal

**10 skipped (marked test.skip):**
- radar-phase2.spec.mjs (4) -- radar.html is now a redirect stub (Phase 10)
- alerts-telemetry.spec.mjs (1) -- alerts.html is now a redirect stub (Phase 10)
- index-calendar-preview.spec.mjs (1) -- calendar.html is now a redirect stub (Phase 10)
- index-drive-defaults.spec.mjs (2) -- CustardDrive removed from index.html (Phase 2)
- index-drive-error-recovery.spec.mjs (2) -- CustardDrive removed from index.html (Phase 2)

## Solution

Options per test group:
- **CustardDrive tests (12 failing, 4 skipped):** Delete entirely -- CustardDrive UI was removed in Phase 2 and isn't coming back
- **Redirect stub tests (6 skipped):** Delete or convert to redirect-verification tests
- **Quiz tests (2 failing):** Investigate root cause separately -- these test quiz.html which still exists
