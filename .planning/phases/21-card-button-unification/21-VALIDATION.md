---
phase: 21
slug: card-button-unification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 21 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright + pytest |
| **Config file** | `worker/playwright.config.mjs` |
| **Quick run command** | `cd custard-calendar/worker && npx playwright test test/browser/vizp-card-system.spec.mjs` |
| **Full suite command** | `cd custard-calendar && uv run pytest tests/test_design_tokens.py -v && cd worker && npx playwright test test/browser/vizp-card-system.spec.mjs test/browser/dtkn-state-tokens.spec.mjs test/browser/dtkn-rarity-tokens.spec.mjs` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd custard-calendar/worker && npx playwright test test/browser/vizp-card-system.spec.mjs --workers=1`
- **After every plan wave:** Run `cd custard-calendar && uv run pytest tests/test_design_tokens.py -v && cd worker && npx playwright test --workers=1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | CARD-01 | browser | `npx playwright test test/browser/vizp-card-system.spec.mjs` | Partial | pending |
| 21-01-02 | 01 | 1 | CARD-02 | static analysis | `uv run pytest tests/test_design_tokens.py -v` | Needs new test | pending |
| 21-01-03 | 01 | 1 | CARD-03 | static analysis | New grep-based test | Needs new test | pending |
| 21-01-04 | 01 | 1 | CARD-04 | static + browser | Combined grep + Playwright | Partial | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_card_button_unification.py` -- static analysis test: grep for inline button styles, count button class definitions, verify .card presence on all card elements
- [ ] Expand `vizp-card-system.spec.mjs` or create `card-unification.spec.mjs` -- browser tests covering full 27-card inventory
- [ ] New grep-based test for zero inline style button overrides (CARD-03)

*Existing infrastructure covers partial requirements; Wave 0 must fill gaps above.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual consistency of card shadows/radii | CARD-01 | Visual regression needs human eye | Open each page, verify cards look consistent |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
