---
phase: 7
slug: production-deploy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 7 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.58.2 (browser), vitest 3.0 (worker unit), pytest (Python) |
| **Config file** | worker/playwright.config.mjs, worker/vitest.config.js |
| **Quick run command** | `cd worker && npm test` |
| **Full suite command** | `cd worker && npm test && npm run test:browser -- --workers=1` |
| **Estimated runtime** | ~65 seconds (3.4s unit + ~60s browser) |

---

## Sampling Rate

- **After every task commit:** Run `cd worker && npm test`
- **After every plan wave:** Run `cd worker && npm test && npm run test:browser -- --workers=1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 65 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | DEPL-01 | smoke | `curl -sI -o /dev/null -w '%{http_code}' https://custard.chriskaschner.com/` | N/A (curl) | pending |
| 07-01-02 | 01 | 1 | DEPL-02 | smoke | `curl -s "https://custard.chriskaschner.com/api/v1/today?slug=mt-horeb" \| python3 -m json.tool` | N/A (curl) | pending |
| 07-01-03 | 01 | 1 | DEPL-03 | smoke + browser | curl -sI for each nav page | Partial (Playwright local) | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed. Smoke testing uses curl against live URLs.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full user navigation flow | DEPL-03 | Browser interaction + visual verification on live site | Navigate Today, Compare, Map, Fun, Get Updates pages on custard.chriskaschner.com in a browser |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 65s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
