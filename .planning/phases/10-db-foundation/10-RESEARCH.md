# Phase 10: DB Foundation - Research

**Researched:** 2026-03-05
**Domain:** PostgreSQL schema migrations (Alembic), SQLAlchemy 2.0 models, index design
**Confidence:** HIGH

## Summary

Phase 10 is pure database infrastructure. All work happens in the backend: one or two Alembic migration files, two new SQLAlchemy model files, and one enum extension. No API endpoints, no frontend changes.

The project's migration chain is well-established. Previous enum additions (Opening_Balance, Sat) show the exact pattern needed for the `Purchase` enum value — use `ALTER TYPE ... ADD VALUE IF NOT EXISTS` wrapped in explicit COMMIT/BEGIN because PostgreSQL cannot add enum values inside a transaction block. The same COMMIT/BEGIN wrapper pattern used in `c3d4e5f6a7b8` must be replicated.

The expenses and daily_cash_confirmations tables are straightforward CREATE TABLE operations following the BaseMixin pattern. Three new PostgreSQL enum types are needed: `expensetype`, `expensecategory`, and `expensestatus`. Index additions on the transactions table are simple `op.create_index` calls with no data migrations required.

**Primary recommendation:** Two migrations — first adds the Purchase enum value and the three transaction indexes (fast, no locks); second creates the expenses and daily_cash_confirmations tables with their enum types. Split to keep enum DDL separate from table DDL, matching project convention.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Add indexes on: `created_by`, `type`, `status` on transactions
- Add compound index on: `(created_by, type, created_at)` for reporting queries
- `customer_id`, `delivery_date`, `delivered_date` already indexed — no changes needed
- Single `expenses` table for both field (Sales) and business (Admin) expenses
- `expense_type` enum: `Field` / `Business`
- `category` enum with "Other" option — when "Other" selected, `notes` field is mandatory (enforced at application level, not DB constraint)
- Currency: ILS only — no multi-currency support for expenses
- `status` enum: `Pending` / `Confirmed` / `Flagged` (3 states, no Rejected)
- Admin-submitted expenses auto-set to `Confirmed` status; Sales rep expenses start as `Pending` (application logic, not DB default)
- Expense columns: id (BaseMixin), expense_type, category, amount (Numeric), date, notes, status, created_by (FK users), confirmed_by (FK users, nullable), confirmed_at (DateTime, nullable), flag_notes (String, nullable), created_at, updated_at, is_deleted (BaseMixin)
- `daily_cash_confirmations` table — one row per rep per day (unique constraint on rep_id + date)
- Admin enters the `handed_over_amount` (what the rep physically handed over)
- `confirmed_by` column (FK users) — tracks which admin confirmed
- Daily cash confirmation columns: id (BaseMixin), rep_id (FK users), date (Date), handed_over_amount (Numeric), confirmed_by (FK users, nullable), confirmed_at (DateTime, nullable), is_flagged (Boolean), flag_notes (String, nullable), created_at, updated_at, is_deleted (BaseMixin)
- No daily_cash_reports table — totals always computed from source data
- Add `Purchase` to TransactionType enum
- Purchase transactions use existing Transaction model — no new columns needed
- Amount is negative (reduces customer balance)
- WAC price snapshot can go in JSONB data if needed later — no dedicated column

### Claude's Discretion
- Exact expense category enum values (reasonable set for a painting tools wholesale business)
- Migration ordering and naming conventions
- Index naming conventions

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DB-01 | System has indexes on transactions.created_by, type, status, and compound index on (created_by, type, created_at) | `op.create_index` with standard naming convention; covered in Architecture Patterns below |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Alembic | (pinned in project) | Schema migrations | Already in use; autogenerate + manual op support |
| SQLAlchemy | 2.0 (mapped_column style) | ORM model definition | Already in use; all models follow 2.0 typed style |
| PostgreSQL | (Docker-managed) | Database | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sqlalchemy.dialects.postgresql` | — | UUID, JSONB types | All models use this for UUIDs |
| `sqlalchemy.Enum as SAEnum` | — | Map Python enums to PG enum types | All existing enum columns use this |

### Alternatives Considered
None — stack is fixed by project conventions.

**Installation:**
No new packages required.

## Architecture Patterns

### Recommended Migration Split

Two migration files:

**Migration A** — `e1f2a3b4c5d6_add_transaction_indexes_and_purchase_enum`
- Reason: Indexes and enum extensions are DDL-only, no schema dependencies on new tables
- `ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'Purchase'` (with COMMIT/BEGIN wrapper)
- `op.create_index` for created_by, type, status, compound (created_by, type, created_at)

**Migration B** — `f2a3b4c5d6e7_add_expenses_and_daily_cash_confirmations`
- Reason: Table creation with new enum types; depends on no new data from Migration A
- Creates three PG enum types: `expensetype`, `expensecategory`, `expensestatus`
- Creates `expenses` table
- Creates `daily_cash_confirmations` table with unique constraint

### Recommended Project Structure (new files)
```
backend/
├── app/models/
│   ├── expense.py                  # Expense model + ExpenseType/Category/Status enums
│   └── daily_cash_confirmation.py  # DailyCashConfirmation model
├── app/models/__init__.py          # Add imports for new models
└── alembic/versions/
    ├── e1f2a3b4c5d6_add_transaction_indexes_and_purchase_enum.py
    └── f2a3b4c5d6e7_add_expenses_and_daily_cash_confirmations.py
```

### Pattern 1: Adding a PostgreSQL Enum Value

PostgreSQL requires `ALTER TYPE` to run OUTSIDE a transaction block. Alembic runs everything inside a transaction by default — so you must explicitly COMMIT first and open a new BEGIN after.

```python
# Source: existing project migration c3d4e5f6a7b8_add_opening_balance_txn_type.py
def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("COMMIT"))
    conn.execute(
        sa.text(
            "ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'Purchase'"
        )
    )
    conn.execute(sa.text("BEGIN"))

def downgrade() -> None:
    pass  # PostgreSQL doesn't support removing enum values
```

### Pattern 2: Creating Indexes on Existing Tables

```python
# Source: existing project migration 6b2c3d4e5f6a_add_delivery_date_to_transactions.py
def upgrade() -> None:
    op.create_index(
        "ix_transactions_created_by", "transactions", ["created_by"]
    )
    op.create_index(
        "ix_transactions_type", "transactions", ["type"]
    )
    op.create_index(
        "ix_transactions_status", "transactions", ["status"]
    )
    op.create_index(
        "ix_transactions_created_by_type_created_at",
        "transactions",
        ["created_by", "type", "created_at"],
    )

def downgrade() -> None:
    op.drop_index("ix_transactions_created_by_type_created_at", table_name="transactions")
    op.drop_index("ix_transactions_status", table_name="transactions")
    op.drop_index("ix_transactions_type", table_name="transactions")
    op.drop_index("ix_transactions_created_by", table_name="transactions")
```

### Pattern 3: SQLAlchemy 2.0 Model with Multiple Enums

```python
# Source: existing project app/models/transaction.py
import datetime as _dt
import enum
import uuid
from decimal import Decimal

from sqlalchemy import (
    Boolean, Date, DateTime, Enum as SAEnum,
    ForeignKey, Numeric, String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, BaseMixin


class ExpenseType(str, enum.Enum):
    Field = "Field"
    Business = "Business"


class ExpenseCategory(str, enum.Enum):
    Fuel = "Fuel"
    Food = "Food"
    Accommodation = "Accommodation"
    Supplies = "Supplies"
    Transport = "Transport"
    Maintenance = "Maintenance"
    Marketing = "Marketing"
    Utilities = "Utilities"
    Other = "Other"


class ExpenseStatus(str, enum.Enum):
    Pending = "Pending"
    Confirmed = "Confirmed"
    Flagged = "Flagged"


class Expense(BaseMixin, Base):
    __tablename__ = "expenses"

    expense_type: Mapped[ExpenseType] = mapped_column(
        SAEnum(ExpenseType, name="expensetype"), nullable=False
    )
    category: Mapped[ExpenseCategory] = mapped_column(
        SAEnum(ExpenseCategory, name="expensecategory"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    date: Mapped[_dt.date] = mapped_column(Date, nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[ExpenseStatus] = mapped_column(
        SAEnum(ExpenseStatus, name="expensestatus"),
        default=ExpenseStatus.Pending,
        nullable=False,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    confirmed_at: Mapped[_dt.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    flag_notes: Mapped[str | None] = mapped_column(String, nullable=True)

    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])
    confirmer: Mapped["User | None"] = relationship("User", foreign_keys=[confirmed_by])
```

### Pattern 4: Unique Constraint via __table_args__

```python
# Source: SQLAlchemy 2.0 docs pattern
from sqlalchemy import UniqueConstraint

class DailyCashConfirmation(BaseMixin, Base):
    __tablename__ = "daily_cash_confirmations"
    __table_args__ = (
        UniqueConstraint("rep_id", "date", name="uq_daily_cash_rep_date"),
    )

    rep_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    date: Mapped[_dt.date] = mapped_column(Date, nullable=False, index=True)
    handed_over_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    confirmed_at: Mapped[_dt.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    flag_notes: Mapped[str | None] = mapped_column(String, nullable=True)

    rep: Mapped["User"] = relationship("User", foreign_keys=[rep_id])
    confirmer: Mapped["User | None"] = relationship("User", foreign_keys=[confirmed_by])
```

### Pattern 5: Table Creation with New Enum Types in Migration

```python
# Source: existing project migration 001_initial_models.py + project conventions
def upgrade() -> None:
    # Create enum types first (required before columns that reference them)
    op.execute(
        "CREATE TYPE expensetype AS ENUM ('Field', 'Business')"
    )
    op.execute(
        "CREATE TYPE expensecategory AS ENUM "
        "('Fuel', 'Food', 'Accommodation', 'Supplies', 'Transport', "
        "'Maintenance', 'Marketing', 'Utilities', 'Other')"
    )
    op.execute(
        "CREATE TYPE expensestatus AS ENUM ('Pending', 'Confirmed', 'Flagged')"
    )

    op.create_table(
        "expenses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("expense_type", sa.Enum("Field", "Business", name="expensetype"), nullable=False),
        sa.Column("category", sa.Enum("Fuel", "Food", "Accommodation", "Supplies",
                                      "Transport", "Maintenance", "Marketing",
                                      "Utilities", "Other", name="expensecategory"), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("status", sa.Enum("Pending", "Confirmed", "Flagged", name="expensestatus"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("confirmed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("flag_notes", sa.String(), nullable=True),
    )
    op.create_index("ix_expenses_created_by", "expenses", ["created_by"])
    op.create_index("ix_expenses_date", "expenses", ["date"])

    op.create_table(
        "daily_cash_confirmations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("rep_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("handed_over_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("confirmed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_flagged", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("flag_notes", sa.String(), nullable=True),
        sa.UniqueConstraint("rep_id", "date", name="uq_daily_cash_rep_date"),
    )
    op.create_index("ix_daily_cash_confirmations_rep_id", "daily_cash_confirmations", ["rep_id"])
    op.create_index("ix_daily_cash_confirmations_date", "daily_cash_confirmations", ["date"])


def downgrade() -> None:
    op.drop_table("daily_cash_confirmations")
    op.drop_table("expenses")
    op.execute("DROP TYPE IF EXISTS expensestatus")
    op.execute("DROP TYPE IF EXISTS expensecategory")
    op.execute("DROP TYPE IF EXISTS expensetype")
```

### Anti-Patterns to Avoid
- **Inline enum creation via autogenerate for new types:** Alembic autogenerate sometimes misses new PG enum types or creates them in the wrong order. Manually write the `CREATE TYPE` statements first in the migration.
- **Adding enum value inside a transaction:** PostgreSQL rejects `ALTER TYPE ... ADD VALUE` inside an open transaction. Always use the COMMIT/BEGIN wrapper — the project already has this pattern in `c3d4e5f6a7b8`.
- **Skipping `IF NOT EXISTS` on enum ADD VALUE:** Without it, re-running the migration (e.g., on a DB that already has the value) raises an error.
- **Using `create_constraint=False` on SAEnum:** Omitting this when the PG type already exists can cause Alembic to try to create the type a second time on autogenerate runs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique constraint (rep+date) | Application-level uniqueness check | `UniqueConstraint` in `__table_args__` | Race conditions; DB enforces atomically |
| Enum type management | Python dicts / string columns | `SAEnum` + PG native enum | Type safety, storage efficiency, query filtering |
| Migration ordering | Manual file renaming | Alembic `down_revision` chain | Alembic resolves graph; manual renaming breaks it |

**Key insight:** PostgreSQL native enums save storage and enable direct equality filtering in reporting queries without casting. Stick to the project pattern.

## Common Pitfalls

### Pitfall 1: ALTER TYPE ADD VALUE Inside a Transaction
**What goes wrong:** `ERROR: ALTER TYPE ... ADD VALUE cannot run inside a transaction block`
**Why it happens:** Alembic wraps the entire migration in BEGIN/COMMIT automatically
**How to avoid:** Use the `COMMIT` / `BEGIN` wrapper (see Pattern 1 above). Already established in project migration `c3d4e5f6a7b8`.
**Warning signs:** Migration fails immediately on the ALTER TYPE line with the above error

### Pitfall 2: Model Imported Before its Table Migration Runs
**What goes wrong:** `sqlalchemy.exc.ProgrammingError: relation "expenses" does not exist`
**Why it happens:** New model imported in `__init__.py` causes SQLAlchemy to register the table in metadata, and any eager validation hits the DB before the migration runs
**How to avoid:** Import new models in `app/models/__init__.py` AND run `alembic upgrade head` before starting the server. In Docker dev, rebuild image after model changes.
**Warning signs:** Server fails to start after adding model imports

### Pitfall 3: Two Relationships to Same Table Without explicit foreign_keys
**What goes wrong:** `AmbiguousForeignKeysError` on `Expense` (two FK columns pointing to `users`)
**Why it happens:** `confirmed_by` and `created_by` both point to `users.id` — SQLAlchemy can't resolve which FK a relationship uses without being told
**How to avoid:** Always pass `foreign_keys=[column]` on every `relationship()` when multiple FKs reference the same table (see Pattern 3 above)
**Warning signs:** `AmbiguousForeignKeysError` on first server start after defining relationships

### Pitfall 4: Missing `__table_args__` Tuple Trailing Comma
**What goes wrong:** `TypeError: __table_args__ items must be constraint or Index objects` (when only one constraint exists)
**Why it happens:** Python treats `(UniqueConstraint(...))` as a parenthesized expression, not a tuple
**How to avoid:** Always use `(UniqueConstraint(...),)` with a trailing comma
**Warning signs:** Python TypeError on model class definition

### Pitfall 5: Index Naming Collisions
**What goes wrong:** `psycopg2.errors.DuplicateObject: relation "ix_transactions_created_by" already exists`
**Why it happens:** Attempting to create an index that was already added in a previous migration or by autogenerate
**How to avoid:** Check existing indexes before migration — `created_by` on transactions currently has NO index (confirmed from `001_initial_models.py` and all subsequent migrations — only `ix_transactions_customer_id` exists on that table). Safe to create all four.
**Warning signs:** Migration fails with `DuplicateObject` error

## Code Examples

### Expense Category Values (Claude's Discretion)

Reasonable categories for a painting tools wholesale business:

```python
class ExpenseCategory(str, enum.Enum):
    Fuel = "Fuel"               # Vehicle fuel for sales routes
    Food = "Food"               # Meals during field work
    Accommodation = "Accommodation"  # Overnight stays for distant routes
    Supplies = "Supplies"       # Office/admin supplies
    Transport = "Transport"     # Parking, tolls, other transport costs
    Maintenance = "Maintenance" # Vehicle or equipment maintenance
    Marketing = "Marketing"     # Promotional materials, samples
    Utilities = "Utilities"     # Admin utility bills
    Other = "Other"             # Catch-all — requires notes
```

### Index Naming Convention (Claude's Discretion)

Follow the project convention already visible in migrations:
- Single column: `ix_{tablename}_{columnname}` — e.g., `ix_transactions_created_by`
- Compound: `ix_{tablename}_{col1}_{col2}_{col3}` — e.g., `ix_transactions_created_by_type_created_at`

### Migration Chain (head identification)

The current migration head is `d4e5f6a7b8c9` (reconcile_customer_balances). New migrations must set:
- Migration A: `down_revision = "d4e5f6a7b8c9"`
- Migration B: `down_revision = "e1f2a3b4c5d6"` (Migration A's revision ID)

### Updating `app/models/__init__.py`

```python
# Add after existing imports:
from app.models.expense import Expense, ExpenseType, ExpenseCategory, ExpenseStatus  # noqa: E402, F401
from app.models.daily_cash_confirmation import DailyCashConfirmation  # noqa: E402, F401
```

### Updating `TransactionType` in Python

```python
class TransactionType(str, enum.Enum):
    Order = "Order"
    Payment_Cash = "Payment_Cash"
    Payment_Check = "Payment_Check"
    Check_Return = "Check_Return"
    Opening_Balance = "Opening_Balance"
    Purchase = "Purchase"          # NEW — added in Phase 10
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SQLAlchemy Column() style | `mapped_column()` with type annotations | SQLAlchemy 2.0 | This project already uses 2.0 style — follow it |
| `declarative_base()` | `DeclarativeBase` class | SQLAlchemy 2.0 | Already in project `Base` class |

**Deprecated/outdated:**
- `Column()` without `mapped_column`: Not used in this project — keep using `mapped_column`

## Open Questions

1. **Transaction filters for Purchase type in existing queries**
   - What we know: Existing transaction repositories/services filter by type in various places
   - What's unclear: Whether any existing query has `type != 'Purchase'` guards needed; Phase 10 creates the enum value but no service uses it yet
   - Recommendation: Phase 10 does not need to update service queries — that's Phase 14 (Purchase from Customer). Document as a Phase 14 concern.

2. **`created_by` nullable in current transaction model**
   - What we know: The Python model declares `created_by` as `Mapped[uuid.UUID | None]` (nullable=True), but the initial migration `001` created it as NOT NULL with FK
   - What's unclear: Whether `nullable=True` was intentional or a model drift; the index can be added regardless
   - Recommendation: Add index as-is; do not change the nullable status in Phase 10 (separate concern)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no pytest.ini, no tests/ directory found in backend |
| Config file | None — see Wave 0 |
| Quick run command | `docker compose exec api pytest tests/ -x -q` (once tests exist) |
| Full suite command | `docker compose exec api pytest tests/ -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DB-01 | Transactions table has indexes on created_by, type, status, and compound (created_by, type, created_at) | smoke | `docker compose exec api python -c "from sqlalchemy import inspect, create_engine; e = create_engine('postgresql://...'); i = inspect(e); print([idx['name'] for idx in i.get_indexes('transactions')])"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Verify migration runs without error (`alembic upgrade head`)
- **Per wave merge:** Confirm all four indexes exist via `\d transactions` in psql
- **Phase gate:** All success criteria verified manually before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] No automated test infrastructure exists in backend — manual verification via psql/alembic is the gate for this phase
- [ ] Manual verification commands to run after migrations:
  ```sql
  -- Confirm transaction indexes
  SELECT indexname FROM pg_indexes WHERE tablename = 'transactions';
  -- Confirm new tables exist
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('expenses', 'daily_cash_confirmations');
  -- Confirm Purchase enum value
  SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'transactiontype';
  -- Confirm unique constraint
  SELECT conname FROM pg_constraint WHERE conrelid = 'daily_cash_confirmations'::regclass;
  ```

## Sources

### Primary (HIGH confidence)
- Existing project migrations (`alembic/versions/`) — established patterns for enum ADD VALUE, index creation, table creation
- `app/models/transaction.py` — canonical SQLAlchemy 2.0 model pattern
- `app/models/__init__.py` — import registration pattern
- `001_initial_models.py` — original table definitions and confirmed absence of indexes on created_by/type/status

### Secondary (MEDIUM confidence)
- PostgreSQL documentation on `ALTER TYPE ... ADD VALUE` transaction restriction — confirmed by existing project workaround in `c3d4e5f6a7b8`

### Tertiary (LOW confidence)
- None — all findings verified from project source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tooling already in use in this project
- Architecture: HIGH — patterns are directly copied from existing project migrations
- Pitfalls: HIGH — pitfalls confirmed from existing migration code that already handles them (COMMIT/BEGIN wrapper), or are well-known SQLAlchemy behaviors (AmbiguousForeignKeysError)

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable domain — Alembic/PostgreSQL/SQLAlchemy 2.0 patterns don't change rapidly)
