---
phase: 11
slug: daily-cash-report
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Not yet established — no test runner configured |
| **Config file** | None detected |
| **Quick run command** | `docker compose up` + manual browser test |
| **Full suite command** | `docker compose up` + manual browser test |
| **Estimated runtime** | ~60 seconds (manual) |

---

## Sampling Rate

- **After every task commit:** Run `docker compose up` + verify affected endpoint
- **After every plan wave:** Full manual browser walkthrough of cash report page
- **Before `/gsd:verify-work`:** All 5 success criteria verified manually
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | CASH-01 | integration | Manual: GET /admin/cash-report returns correct totals | N/A | ⬜ pending |
| 11-01-02 | 01 | 1 | CASH-03 | integration | Manual: POST confirm creates DailyCashConfirmation | N/A | ⬜ pending |
| 11-01-03 | 01 | 1 | CASH-04 | integration | Manual: POST flag sets is_flagged + stores notes | N/A | ⬜ pending |
| 11-02-01 | 02 | 1 | CASH-01 | manual | Manual: Report page renders with grouped data | N/A | ⬜ pending |
| 11-02-02 | 02 | 1 | CASH-02 | manual | Manual: Date nav changes day without reload | N/A | ⬜ pending |
| 11-02-03 | 02 | 1 | CASH-03 | manual | Manual: Confirm button persists on refresh | N/A | ⬜ pending |
| 11-02-04 | 02 | 1 | CASH-04 | manual | Manual: Flag with note visible on report | N/A | ⬜ pending |
| 11-02-05 | 02 | 1 | CASH-05 | manual | Manual: >5% diff highlighted visually | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- No test infrastructure detected in project. All validation is manual browser testing against the running Docker stack.
- Recommend: `docker compose up` → navigate to Admin → Overview → Daily Cash stat card → verify report renders for today.

*Existing manual testing workflow covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Report page renders grouped data for any day | CASH-01 | No test framework | Admin → Cash Report → verify rep groupings |
| Date navigation without page reload | CASH-02 | UI interaction | Click forward/back arrows, verify no full reload |
| Confirm handover persists on refresh | CASH-03 | Stateful UI | Click confirm → refresh → verify still confirmed |
| Flag with note visible | CASH-04 | Stateful UI | Click flag → enter note → verify flag + note shown |
| >5% discrepancy highlighted | CASH-05 | Visual styling | Compare handed-over vs computed, verify highlight |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
