---
phase: 20
slug: design-token-expansion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (browser) + Vitest (unit) |
| **Config file** | `worker/playwright.config.mjs` + `worker/vitest.config.*` |
| **Quick run command** | `cd worker && npx playwright test test/browser/dtkn-*.spec.mjs -x` |
| **Full suite command** | `cd worker && npm test && npm run test:browser -- --workers=1` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worker && npx playwright test test/browser/dtkn-*.spec.mjs -x`
- **After every plan wave:** Run `cd worker && npm test && npm run test:browser -- --workers=1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 0 | DTKN-01 | browser | `cd worker && npx playwright test test/browser/dtkn-state-tokens.spec.mjs -x` | No -- Wave 0 | pending |
| 20-01-02 | 01 | 0 | DTKN-02 | browser | `cd worker && npx playwright test test/browser/dtkn-rarity-tokens.spec.mjs -x` | No -- Wave 0 | pending |
| 20-01-03 | 01 | 0 | DTKN-04 | browser | `cd worker && npx playwright test test/browser/dtkn-interactive-tokens.spec.mjs -x` | No -- Wave 0 | pending |
| 20-01-04 | 01 | 0 | Regression | browser | `cd worker && npx playwright test test/browser/vizp-card-system.spec.mjs -x` | Yes | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `worker/test/browser/dtkn-state-tokens.spec.mjs` -- stubs for DTKN-01: getComputedStyle checks that state-colored elements use CSS custom property values
- [ ] `worker/test/browser/dtkn-rarity-tokens.spec.mjs` -- stubs for DTKN-02: verifies popup rarity chips and Today/Compare rarity badges resolve to same hex values; common/staple badges hidden
- [ ] `worker/test/browser/dtkn-interactive-tokens.spec.mjs` -- stubs for DTKN-04: verifies :focus-visible outline uses --focus-ring token; hover-bg token resolves non-empty

*Existing infrastructure covers regression requirement (vizp-card-system.spec.mjs).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual color accuracy | All | Computed values verify token resolution but not perceptual correctness | Open Today, Compare, and map pages; confirm state/rarity colors look correct visually |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
