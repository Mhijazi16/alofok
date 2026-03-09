# Requirements: Alofok

**Defined:** 2026-03-09
**Core Value:** Sales Reps can visit customers, take orders, collect payments, and resolve balance disputes — even offline.

## v1.3 Requirements

Requirements for Code Quality & Simplification milestone. Each maps to roadmap phases.

### Database Schema

- [x] **SCHEMA-01**: Add missing index on customers.assigned_to column used in daily rep queries
- [x] **SCHEMA-02**: Sync ExpenseCategory enum between model and Pydantic schema validator
- [x] **SCHEMA-03**: Add CHECK constraints (expense amount > 0, product stock_qty >= 0, discount_type as enum)

### Backend Fixes

- [x] **BACK-01**: Fix return_check() to persist original check's Returned status to database
- [x] **BACK-02**: Optimize get_my_orders_today() to use JOIN instead of N+1 per-order customer fetches
- [x] **BACK-03**: Consolidate duplicate statement logic between customer_service and customer_portal_service
- [x] **BACK-04**: Create typed OrderItem schema for OrderCreate.items validation
- [x] **BACK-05**: Fix portal statement to pass date params to repository instead of Python-level filtering
- [x] **BACK-06**: Standardize service return types to always return Pydantic schemas (not ORM models)

### Frontend Deduplication

- [ ] **FRONT-01**: Extract shared useCart() hook from Sales and Customer root components
- [ ] **FRONT-02**: Extract shared StatementViewBase component from duplicate StatementViews
- [ ] **FRONT-03**: Extract shared ProfileView component from Admin/Sales/Designer profiles
- [x] **FRONT-04**: Extract formatCurrency/formatDate/formatTime to src/lib/format.ts
- [x] **FRONT-05**: Extract JWT decode utility to src/lib/jwt.ts
- [x] **FRONT-06**: Extract getProductName utility to shared location

### Frontend Simplification

- [ ] **SIMP-01**: Break up Sales/index.tsx (1048 lines) into separate view files
- [ ] **SIMP-02**: Replace raw button elements with shadcn Button component

## Future Requirements

None — this is a cleanup milestone.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Denormalized customer.balance removal | High-risk refactor; needs careful migration strategy in dedicated milestone |
| Products.created_by index | No queries filter on this column |
| Expenses.status index | Expense table not actively queried; CompanyLedger has its own index |
| Auth checks in delete/undeliver order | Already protected by RBAC middleware |
| Phone sync Customer/CustomerAuth | Intentionally separate (login credential vs contact info) |
| CompanyLedger Mapped[str] type hints | Runtime works fine; cosmetic annotation |
| DailyCashConfirmation explicit status | Implicit status via nullable columns is valid design |
| Audit trail for check status changes | Requires new audit table; defer to future |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | Phase 16 | Complete |
| SCHEMA-02 | Phase 16 | Complete |
| SCHEMA-03 | Phase 16 | Complete |
| BACK-01 | Phase 16 | Complete |
| BACK-02 | Phase 17 | Complete |
| BACK-03 | Phase 17 | Complete |
| BACK-04 | Phase 17 | Complete |
| BACK-05 | Phase 17 | Complete |
| BACK-06 | Phase 17 | Complete |
| FRONT-01 | Phase 18 | Pending |
| FRONT-04 | Phase 18 | Complete |
| FRONT-05 | Phase 18 | Complete |
| FRONT-06 | Phase 18 | Complete |
| FRONT-02 | Phase 19 | Pending |
| FRONT-03 | Phase 19 | Pending |
| SIMP-01 | Phase 19 | Pending |
| SIMP-02 | Phase 19 | Pending |

**Coverage:**
- v1.3 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after roadmap creation*
