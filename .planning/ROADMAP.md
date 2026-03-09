# Roadmap: Alofok

## Milestones

- [x] **v1.0 Core Trading Platform** — Phases 1-5 (shipped 2026-03-04)
- [x] **v1.1 Check Enhancement** — Phases 6-9 (shipped 2026-03-04)
- [x] **v1.2 Business Operations** — Phases 10-15 (shipped 2026-03-09)
- [ ] **v1.3 Code Quality & Simplification** — Phases 16-19 (in progress)

## Phases

<details>
<summary>v1.0 Core Trading Platform (Phases 1-5) — SHIPPED 2026-03-04</summary>

Phases 1-5 were pre-GSD tracked via Feature.json. Shipped all 22 original PRD features plus: design system rebuild, customer portal, delivery date routing, bonus orders, multi-select order cards, admin reassignment, order delete/undeliver.

</details>

<details>
<summary>v1.1 Check Enhancement (Phases 6-9) — SHIPPED 2026-03-04</summary>

Enhanced check data capture (CheckData model, bank/branch/account fields), live SVG check preview, check lifecycle management (Pending → Deposited → Returned), and camera/OCR image capture.

</details>

<details>
<summary>v1.2 Business Operations (Phases 10-15) — SHIPPED 2026-03-09</summary>

Expense tracking, daily cash report with admin confirm/flag, offline catalog + route caching via IndexedDB, purchase from customer with WAC, and customer statement enhancements (custom date range + Arabic PDF export). 6 phases, 11 plans, 22 requirements — all complete.

See: `.planning/milestones/v1.2-ROADMAP.md` for full details.

</details>

### v1.3 Code Quality & Simplification (In Progress)

**Milestone Goal:** Eliminate code duplication, fix bugs, add missing DB constraints/indexes, and simplify monolithic components.

- [x] **Phase 16: Schema Hardening & Critical Bug Fix** - DB indexes, enum sync, constraints, and return_check persistence fix
- [x] **Phase 17: Backend Code Consolidation** - N+1 fix, statement dedup, typed schemas, DB-level filtering, standardized returns (completed 2026-03-09)
- [x] **Phase 18: Frontend Shared Utilities** - Extract reusable hooks and utility functions before component work (completed 2026-03-09)
- [ ] **Phase 19: Frontend Component Dedup & Simplification** - Shared components, monolith breakup, raw button replacement

## Phase Details

### Phase 16: Schema Hardening & Critical Bug Fix
**Goal**: Database schema is correct, constrained, and the return_check bug no longer loses data
**Depends on**: Nothing (first phase of v1.3)
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03, BACK-01
**Success Criteria** (what must be TRUE):
  1. Queries filtering customers by assigned rep use an index (customers.assigned_to indexed)
  2. Creating an expense with any valid category succeeds without enum mismatch errors
  3. Database rejects negative expense amounts, negative stock quantities, and invalid discount types at the constraint level
  4. Returning a check via the admin UI persists the original check's Returned status — verified by reloading and confirming the status stuck
**Plans:** 1/1 plans complete

Plans:
- [x] 16-01-PLAN.md — Schema hardening (index, enum sync, CHECK constraints) and return_check bug fix

### Phase 17: Backend Code Consolidation
**Goal**: Backend services are deduplicated, type-safe, and free of N+1 query patterns
**Depends on**: Phase 16
**Requirements**: BACK-02, BACK-03, BACK-04, BACK-05, BACK-06
**Success Criteria** (what must be TRUE):
  1. Loading a sales rep's daily orders page fires a single SQL query with JOINs instead of N+1 per-order customer lookups
  2. Customer statement returns identical results whether accessed from the sales rep view or the customer portal
  3. Creating an order with malformed items (wrong types, missing fields) returns a clear validation error from the typed OrderItem schema
  4. Portal statement with date filters applies them at the database level — no full-table Python filtering
  5. All service functions return Pydantic schema instances, not raw ORM model objects
**Plans:** 3/3 plans complete

Plans:
- [ ] 17-01-PLAN.md — N+1 query fix (JOIN for orders) and typed OrderItemSchema
- [ ] 17-02-PLAN.md — Statement logic dedup and portal DB-level date filtering
- [ ] 17-03-PLAN.md — Standardize service return types to Pydantic schemas

### Phase 18: Frontend Shared Utilities
**Goal**: Common frontend logic lives in shared modules instead of being duplicated across role components
**Depends on**: Phase 16 (no backend dependency, but sequenced for focus)
**Requirements**: FRONT-01, FRONT-04, FRONT-05, FRONT-06
**Success Criteria** (what must be TRUE):
  1. Both Sales and Customer catalog views use the same useCart() hook — adding/removing items works identically in both
  2. Currency, date, and time formatting is consistent across all views (single source in src/lib/format.ts)
  3. JWT decode logic exists in one place (src/lib/jwt.ts) and all consumers import from there
  4. Product name resolution (with Arabic/English fallback) uses a single getProductName() function from a shared location
**Plans:** 2/2 plans complete

Plans:
- [ ] 18-01-PLAN.md — Extract format.ts, jwt.ts, and product.ts utility modules; replace all inline duplicates
- [ ] 18-02-PLAN.md — Extract useCart hook; replace inline cart logic in Sales, Customer, and Admin

### Phase 19: Frontend Component Dedup & Simplification
**Goal**: Duplicated view components are consolidated and the Sales monolith is broken into manageable files
**Depends on**: Phase 18 (uses extracted utilities)
**Requirements**: FRONT-02, FRONT-03, SIMP-01, SIMP-02
**Success Criteria** (what must be TRUE):
  1. Statement view exists as a single shared StatementViewBase component used by Sales, Customer, and Admin — not three separate copies
  2. Profile view exists as a single shared ProfileView component used by all roles
  3. Sales/index.tsx is under 200 lines, with each view in its own file under Sales/views/
  4. No raw `<button>` elements remain in the codebase — all replaced with the shadcn Button component
**Plans:** 1/2 plans executed

Plans:
- [ ] 19-01-PLAN.md — Sales monolith breakup + StatementViewBase extraction
- [ ] 19-02-PLAN.md — Shared ProfileView + raw button replacement

## Progress

**Execution Order:**
Phases execute in numeric order: 16 -> 17 -> 18 -> 19

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-5. Core Platform | v1.0 | — | Complete | 2026-03-04 |
| 6-9. Check Enhancement | v1.1 | 10/10 | Complete | 2026-03-04 |
| 10-15. Business Operations | v1.2 | 11/11 | Complete | 2026-03-09 |
| 16. Schema Hardening & Critical Bug Fix | v1.3 | Complete    | 2026-03-09 | 2026-03-09 |
| 17. Backend Code Consolidation | 3/3 | Complete    | 2026-03-09 | - |
| 18. Frontend Shared Utilities | 2/2 | Complete    | 2026-03-09 | - |
| 19. Frontend Component Dedup & Simplification | 1/2 | In Progress|  | - |
