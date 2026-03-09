---
phase: 17-backend-code-consolidation
plan: 02
subsystem: api
tags: [refactoring, deduplication, database-filtering, statement]

requires:
  - phase: 17-backend-code-consolidation
    provides: "Typed OrderItemSchema and N+1 fix from plan 01"
provides:
  - "Shared _statement.py module with find_since_zero_index and build_statement helpers"
  - "Portal statement with DB-level date filtering (no Python filtering)"
  - "exclude_drafts parameter on customer_service.get_statement"
affects: [18-frontend-shared-utilities]

tech-stack:
  added: []
  patterns: [shared-helper-module, db-level-filtering]

key-files:
  created: [backend/app/services/_statement.py]
  modified: [backend/app/services/customer_service.py, backend/app/services/customer_portal_service.py]

key-decisions:
  - "Extracted helpers to _statement.py module rather than composing services via dependency injection"
  - "Used in-service draft filtering after DB fetch to keep repository interface stable"

patterns-established:
  - "Shared service helpers in underscore-prefixed modules (_statement.py)"

requirements-completed: [BACK-03, BACK-05]

duration: 1min
completed: 2026-03-09
---

# Phase 17 Plan 02: Statement Dedup & Portal DB Filtering Summary

**Shared statement helpers eliminate duplicated code; portal get_statement now uses DB-level date filtering via repository start/end params instead of Python list comprehension filtering**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-09T12:14:47Z
- **Completed:** 2026-03-09T12:16:10Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Extracted `find_since_zero_index` and `build_statement` into shared `_statement.py` module
- Portal `get_statement` now passes `start`/`end` to `get_for_customer()` for DB-level filtering (fixes BACK-05)
- Removed duplicated `_find_since_zero_index` from both customer_service.py and customer_portal_service.py
- Added `exclude_drafts` parameter to customer_service.get_statement for future reuse

## Task Commits

Each task was committed atomically:

1. **Task 1: Consolidate statement logic and fix portal DB filtering** - `7d02e14` (refactor)

## Files Created/Modified
- `backend/app/services/_statement.py` - Shared statement helpers (find_since_zero_index, build_statement)
- `backend/app/services/customer_service.py` - Uses shared helpers, added exclude_drafts param
- `backend/app/services/customer_portal_service.py` - DB-level date filtering, uses shared helpers, removed duplicate code

## Decisions Made
- Extracted helpers to a standalone `_statement.py` module rather than using service composition (simpler, no DI changes needed)
- Draft filtering done in-service after DB fetch (1-line filter) to avoid changing repository interface
- Named shared functions without leading underscore (`find_since_zero_index`, `build_statement`) since they are imported across modules

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Shared statement pattern available for any future statement-related features
- Portal and sales statement paths now consistent and maintainable

---
*Phase: 17-backend-code-consolidation*
*Completed: 2026-03-09*
