# Requirements: Alofok

**Defined:** 2026-03-05
**Core Value:** Sales Reps can visit customers, take orders, collect payments, and resolve balance disputes — even with no internet connectivity.

## v1.2 Requirements

Requirements for v1.2 Business Operations milestone. Each maps to roadmap phases.

### Database Performance

- [x] **DB-01**: System has indexes on transactions.created_by, type, status, and compound index on (created_by, type, created_at)

### Expense Tracking

- [x] **EXP-01**: Sales rep can log a field expense with amount, currency, category, date, and notes
- [x] **EXP-02**: Admin can log a business expense with amount, currency, category, date, and notes
- [x] **EXP-03**: Admin can view all expenses filterable by rep, date range, and status
- [x] **EXP-04**: Sales rep can view their own submitted expenses
- [x] **EXP-05**: Admin can confirm or flag an expense with optional notes

### Daily Cash Report

- [x] **CASH-01**: Admin can view a daily cash report showing all incoming payments (cash + checks) and all outgoing expenses across all salesmen and admin
- [x] **CASH-02**: Admin can traverse dates (prev/next day) to view different days' reports
- [x] **CASH-03**: Admin can confirm receiving a salesman's daily cash handover
- [x] **CASH-04**: Admin can flag a discrepancy in a salesman's handover with notes
- [x] **CASH-05**: Discrepancies (>5% difference) are visually highlighted in the report

### Offline Caching

- [x] **OFFL-01**: Product catalog is cached in IndexedDB and available when offline
- [x] **OFFL-02**: Route data (customers, today's orders) is cached and available offline
- [x] **OFFL-03**: Stale cached data shows a "last updated" freshness indicator

### Purchase from Customer

- [ ] **PURCH-01**: Sales rep can create a purchase from a customer by selecting products, quantities, and prices
- [ ] **PURCH-02**: Purchase transaction credits the customer's balance (reduces what they owe)
- [ ] **PURCH-03**: Purchase increases product stock_qty by the purchased quantity
- [ ] **PURCH-04**: Product purchase_price is recalculated using weighted-average cost formula
- [ ] **PURCH-05**: Purchase transactions appear in customer statement with distinct label

### Statement Enhancements

- [ ] **STMT-01**: User can select a custom date range (from/to) for customer statements
- [ ] **STMT-02**: User can export the current statement view as a PDF document
- [ ] **STMT-03**: PDF supports Arabic text and RTL layout

## v1.1 Requirements (Complete)

All v1.1 Check Enhancement requirements shipped — 28/28 complete. See MILESTONES.md for details.

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Notifications

- **NOTF-01**: Admin receives in-app notifications for key events
- **NOTF-02**: Sales rep receives in-app notifications for key events

### Offline Expenses

- **OFFL-04**: Sales rep can submit expenses while offline (queued and synced)

### Expense Receipt Photos

- **EXP-06**: Sales rep can attach a receipt photo to an expense

### Cash Report Enhancements

- **CASH-06**: Admin can export daily cash report as CSV

### Check Management

- **CMGT-01**: Admin can view all checks grouped by bank and deposit date
- **CMGT-02**: Admin can batch-select checks for deposit
- **CMGT-03**: Check reconciliation view against bank statements

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Capacitor mobile wrapper | Defer to future milestone |
| Notification system | Deferred from v1.2, not critical yet |
| Check batching/reconciliation | Beyond current needs |
| Expense approval multi-level workflow | Overkill for small office — simple confirm/flag sufficient |
| Server-side PDF generation | Breaks offline-first; client already has data |
| jsPDF for statements | Arabic RTL rendering issues; @react-pdf/renderer is superior |
| Automatic WAC on product edit | Would corrupt manually set purchase prices |
| Real-time cash report sync | EOD reconciliation doesn't need WebSocket; page refresh sufficient |
| Supplier/purchase order management | Different domain from customer buy-back |
| Expense receipt photo upload | Not needed per user — no receipt image capture |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 10 | Complete |
| EXP-01 | Phase 12 | Complete |
| EXP-02 | Phase 12 | Complete |
| EXP-03 | Phase 12 | Complete |
| EXP-04 | Phase 12 | Complete |
| EXP-05 | Phase 12 | Complete |
| CASH-01 | Phase 11 | Complete |
| CASH-02 | Phase 11 | Complete |
| CASH-03 | Phase 11 | Complete |
| CASH-04 | Phase 11 | Complete |
| CASH-05 | Phase 11 | Complete |
| OFFL-01 | Phase 13 | Complete |
| OFFL-02 | Phase 13 | Complete |
| OFFL-03 | Phase 13 | Complete |
| PURCH-01 | Phase 14 | Pending |
| PURCH-02 | Phase 14 | Pending |
| PURCH-03 | Phase 14 | Pending |
| PURCH-04 | Phase 14 | Pending |
| PURCH-05 | Phase 14 | Pending |
| STMT-01 | Phase 15 | Pending |
| STMT-02 | Phase 15 | Pending |
| STMT-03 | Phase 15 | Pending |

**Coverage:**
- v1.2 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after roadmap creation — all 22 requirements mapped to phases 10-15*
