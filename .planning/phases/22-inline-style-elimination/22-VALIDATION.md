---
phase: 22
slug: inline-style-elimination
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 22 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.0.2 |
| **Config file** | pyproject.toml |
| **Quick run command** | `cd custard-calendar && uv run pytest tests/test_inline_style_elimination.py -v` |
| **Full suite command** | `cd custard-calendar && uv run pytest tests/ -v` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd custard-calendar && uv run pytest tests/test_inline_style_elimination.py -v`
- **After every plan wave:** Run `cd custard-calendar && uv run pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 0 | DTKN-03 | unit (static analysis) | `cd custard-calendar && uv run pytest tests/test_inline_style_elimination.py -v` | Wave 0 | pending |
| 22-02-01 | 02 | 1 | DTKN-03a | unit (static analysis) | `cd custard-calendar && uv run pytest tests/test_inline_style_elimination.py::test_compare_zero_inline_styles -x` | Wave 0 | pending |
| 22-02-02 | 02 | 1 | DTKN-03b | unit (static analysis) | `cd custard-calendar && uv run pytest tests/test_inline_style_elimination.py::test_index_zero_inline_styles -x` | Wave 0 | pending |
| 22-02-03 | 02 | 1 | DTKN-03c | unit (static analysis) | `cd custard-calendar && uv run pytest tests/test_inline_style_elimination.py::test_forecast_map_zero_inline_styles -x` | Wave 0 | pending |
| 22-03-01 | 03 | 2 | DTKN-03d | unit (static analysis) | `cd custard-calendar && uv run pytest tests/test_inline_style_elimination.py::test_no_style_display_in_compare_js -x` | Wave 0 | pending |
| 22-03-02 | 03 | 2 | DTKN-03e | unit (static analysis) | `cd custard-calendar && uv run pytest tests/test_inline_style_elimination.py::test_no_style_display_in_shared_nav_js -x` | Wave 0 | pending |
| 22-03-03 | 03 | 2 | DTKN-03f | unit (static analysis) | `cd custard-calendar && uv run pytest tests/test_inline_style_elimination.py::test_no_inline_style_assignments -x` | Wave 0 | pending |
| 22-03-04 | 03 | 2 | DTKN-03g | unit (static analysis) | `cd custard-calendar && uv run pytest tests/test_inline_style_elimination.py::test_new_classes_use_tokens -x` | Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_inline_style_elimination.py` -- stubs for DTKN-03 (zero inline styles in HTML + zero .style.* in JS + token consumption)
- [ ] `.hidden` CSS class in style.css -- required for classList.toggle('hidden') pattern

*Existing infrastructure (pytest, pyproject.toml, test_design_tokens.py) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual appearance matches before/after | DTKN-03 | Layout/rendering requires browser | Open all 3 HTML pages, verify header/footer/CTA card look identical |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
