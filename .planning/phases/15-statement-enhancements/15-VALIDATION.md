---
phase: 15
slug: statement-enhancements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend), pytest 7.x (backend — no backend changes expected) |
| **Config file** | frontend/vitest.config.ts (if exists), otherwise vite.config.ts |
| **Quick run command** | `cd frontend && bun run build` |
| **Full suite command** | `cd frontend && bunx tsc --noEmit && bun run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && bunx tsc --noEmit`
- **After every plan wave:** Run `cd frontend && bunx tsc --noEmit && bun run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | STMT-01 | build | `cd frontend && bunx tsc --noEmit` | ✅ | ⬜ pending |
| 15-02-01 | 02 | 1 | STMT-02 | build | `cd frontend && bunx tsc --noEmit` | ✅ | ⬜ pending |
| 15-02-02 | 02 | 1 | STMT-03 | manual | N/A — visual Arabic rendering | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework setup needed — TypeScript compilation and Vite build serve as automated verification.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Arabic text renders correctly in PDF | STMT-03 | Visual rendering quality cannot be automated | 1. Open customer statement 2. Click PDF download 3. Verify Arabic names, headers, amounts display correctly in RTL |
| Date range picker selects custom range | STMT-01 | UI interaction flow | 1. Open statement 2. Click "Custom" tab 3. Select from/to dates 4. Verify transactions filter and running balance recalculates |
| PDF content matches screen | STMT-02 | Visual comparison | 1. Apply a filter 2. Download PDF 3. Compare PDF content matches on-screen transactions |

*Arabic rendering is the highest-risk manual verification — test early in development.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
