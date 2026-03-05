---
phase: 10
slug: db-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected — no pytest.ini, no tests/ directory in backend |
| **Config file** | none — manual verification via psql/alembic |
| **Quick run command** | `docker compose exec api alembic upgrade head` |
| **Full suite command** | `docker compose exec db psql -U postgres -d horizon -c "SELECT indexname FROM pg_indexes WHERE tablename = 'transactions';"` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `docker compose exec api alembic upgrade head`
- **After every plan wave:** Run manual SQL verification queries
- **Before `/gsd:verify-work`:** All success criteria verified via psql
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | DB-01 | smoke | `docker compose exec api alembic upgrade head` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | DB-01 | manual | `SELECT indexname FROM pg_indexes WHERE tablename = 'transactions';` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 1 | (SC-2) | smoke | `docker compose exec api alembic upgrade head` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 1 | (SC-3) | manual | `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('expenses', 'daily_cash_confirmations');` | ❌ W0 | ⬜ pending |
| 10-02-03 | 02 | 1 | (SC-4) | manual | `SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'transactiontype';` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No automated test infrastructure — manual psql verification is the gate for this phase
- [ ] Docker Compose must be running (`docker compose up db`) for all verification commands

*Existing infrastructure (Alembic + psql) covers all phase requirements without new test files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Transaction indexes exist | DB-01 | No pytest infrastructure | `SELECT indexname FROM pg_indexes WHERE tablename = 'transactions';` — verify 4 new indexes |
| Expenses table exists | SC-2 | No pytest infrastructure | `\d expenses` in psql — verify all columns and types |
| Daily cash confirmations table exists | SC-3 | No pytest infrastructure | `\d daily_cash_confirmations` — verify columns and unique constraint |
| Purchase enum value exists | SC-4 | No pytest infrastructure | `SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'transactiontype';` — verify Purchase in list |

---

## Validation Sign-Off

- [ ] All tasks have manual verify commands documented
- [ ] Sampling continuity: every task has a verification step
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
