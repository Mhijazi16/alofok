# Daily Cash Report Redesign

## Summary

Redesign the Daily Cash Report tab to show individual payment cards (incoming/outgoing) instead of aggregated rep summaries. Introduce a `company_ledger` table as the single source of truth for all company money movements. Replace the current rep dropdown + confirm/flag-per-rep flow with swipe-to-confirm on individual cards and long-press multi-select for batch operations.

## Data Model

### New table: `company_ledger`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| direction | enum: `incoming` / `outgoing` | Money flow direction |
| payment_method | enum: `cash` / `check` | How the money moved |
| amount | Decimal | Always positive, direction determines sign |
| category | String (nullable) | For non-customer entries: "electricity", "gas", etc. |
| notes | Text (nullable) | Free text |
| rep_id | FK -> users | Which sales rep handled this |
| customer_id | FK -> customers (nullable) | Null for pure expenses |
| source_transaction_id | FK -> transactions (nullable, unique) | Links to customer transaction |
| status | enum: `pending` / `confirmed` / `flagged` | Confirmation status |
| confirmed_at | Timestamp (nullable) | When confirmed, cleared on undo |
| flag_notes | Text (nullable) | Required when flagging |
| date | Date | Business day |
| created_at | Timestamp | Auto |
| updated_at | Timestamp | Auto |

### How ledger entries get created

- Rep collects cash/check from customer -> `transaction` row (customer balance) + `ledger` row (pending, direction=incoming)
- Rep pays for gas/electricity/etc -> `ledger` row only (pending, direction=outgoing, customer_id=null, category set)
- Rep pays out to a customer (refund, purchase) -> `transaction` row + `ledger` row (pending, direction=outgoing)
- Walk-in customer buys something -> `transaction` row (under Walk-In customer) + `ledger` row (pending, direction=incoming)

### Status lifecycle

All transitions are reversible: `pending` <-> `confirmed`, `pending` <-> `flagged`, `confirmed` <-> `flagged`.

### Walk-In customer

Single seeded customer record with `is_walkin=true` flag for one-off purchases.

### Deprecates

- `daily_cash_confirmations` table (per-rep confirmation replaced by per-payment ledger status)

## API

### Single status endpoint

`PATCH /ledger/status`

```json
{
  "ids": ["uuid1", "uuid2"],
  "status": "pending" | "confirmed" | "flagged",
  "flag_notes": "optional, required when status=flagged"
}
```

Works for single or batch. Confirm, flag, and undo all use the same endpoint.

### Daily report endpoint

`GET /ledger/daily?date=YYYY-MM-DD`

Returns ledger entries grouped by direction (incoming/outgoing) and then by rep.

### Auto-creation

Ledger entries are auto-created when a payment transaction is created (in existing payment endpoint logic).

### Deprecated endpoints

- `confirmHandover`, `flagHandover`, `getRepPaymentDetails` — replaced by ledger endpoints

## Frontend — DailyCashReportView

### Layout

1. **Date navigation** — prev/next arrows + date picker (unchanged)
2. **Incoming section** — all incoming ledger entries as individual cards, grouped by rep
3. **Outgoing section** — all outgoing ledger entries as individual cards, grouped by rep

Removed: grand total cards, net handover card, rep dropdown, per-rep summary grids.

### Grouping

```
-- Incoming --
  -- Ahmad --
    [payment card: Customer X, 500 cash]
    [payment card: Customer Y, 200 check]
  -- Khalil --
    [payment card: Walk-In, 100 cash]

-- Outgoing --
  -- Ahmad --
    [expense card: Gas, 50 cash]
  -- Khalil --
    [payment card: Customer Z, 300 cash]
```

### Payment card content

- Customer name OR category label (for non-customer entries)
- Amount + payment method icon (cash/check)
- Status indicator: checkmark (confirmed), flag (flagged), nothing (pending)
- Tap to expand: time, type badge, notes, flag notes

### Card actions

**Swipe:**
- Pending card -> Confirm / Flag
- Confirmed card -> Undo / Flag
- Flagged card -> Confirm / Undo
- Confirm action label in Arabic: "ترحيل"

**Long-press:**
- Enters multi-select mode (same pattern as order card multi-select)
- Checkboxes appear on all cards
- Floating bottom bar with Confirm / Flag buttons for batch operation
- Tap outside or X to exit selection mode

**Flag flow:**
- Shows notes input before submitting (required)

### Visibility

All entries always visible. Confirmed/flagged entries show visual indicator, not hidden.
