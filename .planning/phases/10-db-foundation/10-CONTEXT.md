# Phase 10: DB Foundation - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Add performance indexes to the transactions table, create the expenses table and daily cash confirmations table, and add the Purchase enum value to TransactionType. This is pure database infrastructure — no API endpoints, no UI.

</domain>

<decisions>
## Implementation Decisions

### Transaction Indexes
- Add indexes on: `created_by`, `type`, `status`
- Add compound index on: `(created_by, type, created_at)` for reporting queries
- `customer_id`, `delivery_date`, `delivered_date` already indexed — no changes needed

### Expense Table Schema
- Single `expenses` table for both field (Sales) and business (Admin) expenses
- `expense_type` enum column: `Field` / `Business` — distinguishes who submitted
- `category` enum column with "Other" option — when "Other" selected, `notes` field is mandatory
- Currency: ILS only — no multi-currency support for expenses
- `status` enum: `Pending` / `Confirmed` / `Flagged` (3 states, no Rejected)
- Admin-submitted expenses auto-set to `Confirmed` status; Sales rep expenses start as `Pending`
- Columns: id (BaseMixin), expense_type, category, amount (Numeric), date, notes, status, created_by (FK users), confirmed_by (FK users, nullable), confirmed_at (DateTime, nullable), flag_notes (String, nullable), created_at, updated_at, is_deleted (BaseMixin)

### Daily Cash Confirmations Table
- Hybrid approach: totals computed on-the-fly from transactions + expenses, confirmation state stored separately
- `daily_cash_confirmations` table — one row per rep per day (unique constraint on rep_id + date)
- Admin enters the `handed_over_amount` (what the rep physically handed over)
- `confirmed_by` column (FK users) — tracks which admin confirmed
- Columns: id (BaseMixin), rep_id (FK users), date (Date), handed_over_amount (Numeric), confirmed_by (FK users, nullable), confirmed_at (DateTime, nullable), is_flagged (Boolean), flag_notes (String, nullable), created_at, updated_at, is_deleted (BaseMixin)
- No daily_cash_reports table — totals are always computed from source data

### Purchase Enum Value
- Add `Purchase` to TransactionType enum
- Purchase transactions use the existing Transaction model — no new columns needed
- Line items stored in JSONB `data` column (same pattern as orders)
- Amount is negative (follows signed convention: negative = reduces customer balance)
- WAC price snapshot can go in JSONB data if needed later — no dedicated column

### Claude's Discretion
- Exact expense category enum values (reasonable set for a painting tools wholesale business)
- Migration ordering and naming conventions
- Index naming conventions

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BaseMixin` (app/models/__init__.py): Provides id, created_at, updated_at, is_deleted — all new models inherit this
- `Currency` enum (app/models/transaction.py): ILS/USD/JOD — reference only, expenses use ILS only
- `TransactionType` enum (app/models/transaction.py): Needs `Purchase` added
- `TransactionStatus` enum: Not reused for expenses — expenses have their own status enum

### Established Patterns
- All models use `mapped_column` with type annotations (SQLAlchemy 2.0 style)
- Enums defined as `(str, enum.Enum)` and mapped with `SAEnum(EnumClass, name="enumname")`
- ForeignKey references use `UUID(as_uuid=True)` with `ForeignKey("tablename.id")`
- Soft deletes via `is_deleted` boolean — never hard delete
- JSONB for flexible data (check details, order items) — same pattern for purchase line items

### Integration Points
- `app/models/__init__.py`: New models must be imported here for Alembic autogenerate
- `alembic/versions/`: New migration file(s) for schema changes
- `TransactionType` enum: PostgreSQL enum needs ALTER TYPE to add `Purchase` value
- Existing transaction queries (repositories, services): May need to account for new `Purchase` type in filters

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. All decisions are structural/schematic.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-db-foundation*
*Context gathered: 2026-03-05*
