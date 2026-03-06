---
phase: 13
slug: offline-caching
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) |
| **Config file** | frontend/vite.config.ts |
| **Quick run command** | `cd frontend && bun run build` |
| **Full suite command** | `cd frontend && bun run build && bun run lint` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && bun run build`
- **After every plan wave:** Run `cd frontend && bun run build && bun run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | OFFL-01 | build + manual | `cd frontend && bun run build` | N/A | pending |
| 13-01-02 | 01 | 1 | OFFL-02 | build + manual | `cd frontend && bun run build` | N/A | pending |
| 13-02-01 | 02 | 1 | OFFL-03 | build + manual | `cd frontend && bun run build` | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] Install `idb-keyval` and `@tanstack/react-query-persist-client` packages
- [ ] Verify build still passes after dependency additions

*Existing infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Catalog loads offline | OFFL-01 | Requires airplane mode toggle | 1. Open app online, wait for cache 2. Enable airplane mode 3. Navigate to catalog — products visible |
| Route loads offline | OFFL-02 | Requires airplane mode toggle | 1. Open app online, wait for cache 2. Enable airplane mode 3. Navigate to route — customers and orders visible |
| Freshness indicator shows | OFFL-03 | Visual UI check | 1. Open profile tab 2. Verify sync card shows last-updated times per data type |
| Sync Now refreshes data | OFFL-03 | Interactive UI check | 1. Open profile sync card 2. Tap Sync Now 3. Verify animation plays and timestamps update |

*Offline caching is inherently manual-test-heavy — airplane mode cannot be simulated in CI.*

---

## Validation Sign-Off

- [ ] All tasks have automated build verify
- [ ] Sampling continuity: build runs after every commit
- [ ] Wave 0 covers dependency installation
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
