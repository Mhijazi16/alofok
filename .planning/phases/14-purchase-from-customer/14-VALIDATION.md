---
phase: 14
slug: purchase-from-customer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend), vitest (frontend — not configured) |
| **Config file** | backend: pytest in pyproject.toml / frontend: none detected |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** `bun build` (frontend) + `black --check backend/` (backend)
- **After every plan wave:** Full build clean check
- **Before `/gsd:verify-work`:** `bun build` + `tsc --noEmit` + manual smoke test of purchase flow
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | PURCH-01 | unit | `pytest tests/test_purchases.py::test_create_purchase -x` | No — W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | PURCH-02 | unit | `pytest tests/test_purchases.py::test_balance_credit -x` | No — W0 | ⬜ pending |
| 14-01-03 | 01 | 1 | PURCH-03 | unit | `pytest tests/test_purchases.py::test_stock_increase -x` | No — W0 | ⬜ pending |
| 14-01-04 | 01 | 1 | PURCH-04 | unit | `pytest tests/test_purchases.py::test_wac_recalculation -x` | No — W0 | ⬜ pending |
| 14-02-01 | 02 | 1 | PURCH-05 | manual | Manual — verify StatementView renders Purchase badge | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_purchases.py` — stubs for PURCH-01 through PURCH-04
- [ ] Test fixtures for product with stock_qty/purchase_price setup
- [ ] Note: No existing test infrastructure detected in backend/tests/; may need conftest.py setup

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Purchase appears in statement with distinct color/label | PURCH-05 | UI rendering verification | Open customer statement after creating a purchase, verify "Purchase" badge with distinct color appears |
| Purchase flow accessible from CustomerDashboard | PURCH-01 | UI navigation flow | Tap Purchase action button, verify catalog browser opens |
| Daily Cash Report shows purchases as outgoing | N/A | Admin UI integration | Create purchase, check Admin cash report for outgoing entry |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
