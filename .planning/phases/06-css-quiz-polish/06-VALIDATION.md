---
phase: 6
slug: css-quiz-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (existing) |
| **Config file** | pyproject.toml (existing) |
| **Quick run command** | `cd /Users/chriskaschner/Documents/GitHub/custard/custard-calendar && uv run pytest tests/test_design_tokens.py -x` |
| **Full suite command** | `cd /Users/chriskaschner/Documents/GitHub/custard/custard-calendar && uv run pytest tests/ -v` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `uv run pytest tests/test_design_tokens.py -x`
- **After every plan wave:** Run `uv run pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 0 | TOKN-01 | unit (static analysis) | `uv run pytest tests/test_design_tokens.py::test_no_hardcoded_colors -x` | W0 | pending |
| 06-01-02 | 01 | 0 | TOKN-02 | unit (static analysis) | `uv run pytest tests/test_design_tokens.py::test_no_hardcoded_spacing -x` | W0 | pending |
| 06-01-03 | 01 | 0 | TOKN-03 | unit (static analysis) | `uv run pytest tests/test_design_tokens.py::test_no_inline_hardcoded_values -x` | W0 | pending |
| 06-02-01 | 02 | 1 | TOKN-01 | unit (static analysis) | `uv run pytest tests/test_design_tokens.py::test_no_hardcoded_colors -x` | W0 | pending |
| 06-02-02 | 02 | 1 | TOKN-02 | unit (static analysis) | `uv run pytest tests/test_design_tokens.py::test_no_hardcoded_spacing -x` | W0 | pending |
| 06-03-01 | 03 | 1 | TOKN-03 | unit (static analysis) | `uv run pytest tests/test_design_tokens.py::test_no_inline_hardcoded_values -x` | W0 | pending |
| 06-04-01 | 04 | 2 | QUIZ-01 | manual-only | Visual inspection of each quiz mode | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_design_tokens.py` -- stubs for TOKN-01, TOKN-02, TOKN-03
  - Test: parse style.css for remaining hardcoded hex outside allowed-list (brand-specific, semantic, fronts dark theme)
  - Test: parse fun.html and updates.html for `style=""` attributes with hardcoded color/spacing values
  - Test: verify `:root` block contains expected token count
- [ ] No framework install needed -- pytest already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Each quiz mode shows distinct visual treatment | QUIZ-01 | Visual appearance requires human evaluation | Open quiz.html, cycle through Classic, Weather, Trivia, Date Night, Build-a-Scoop, Compatibility modes. Verify each has a unique accent color on hero, submit button, and option highlight. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
