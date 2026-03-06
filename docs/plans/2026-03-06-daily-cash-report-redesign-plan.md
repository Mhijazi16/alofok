# Daily Cash Report Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the per-rep cash report with a company ledger system showing individual payment cards with swipe-to-confirm and long-press multi-select.

**Architecture:** New `company_ledger` table auto-populated when payments are created, with a single status-update endpoint. Frontend rebuilt as incoming/outgoing sections with cards grouped by rep, using touch gestures for confirmation.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic (backend); React, @use-gesture/react (frontend); existing shadcn/ui components.

---

## Task 1: Company Ledger Model + Migration

**Files:**
- Create: `backend/app/models/ledger.py`
- Modify: `backend/app/models/__init__.py`
- Create: new Alembic migration

**Step 1: Create the ledger model**

Create `backend/app/models/ledger.py`:

```python
import uuid
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, BaseMixin


class LedgerDirection(str, sa.Enum):
    pass


LedgerDirectionEnum = sa.Enum("incoming", "outgoing", name="ledgerdirection", create_type=False)
LedgerPaymentMethodEnum = sa.Enum("cash", "check", name="ledgerpaymentmethod", create_type=False)
LedgerStatusEnum = sa.Enum("pending", "confirmed", "flagged", name="ledgerstatus", create_type=False)


class CompanyLedger(Base, BaseMixin):
    __tablename__ = "company_ledger"

    direction: Mapped[str] = mapped_column(LedgerDirectionEnum, nullable=False)
    payment_method: Mapped[str] = mapped_column(LedgerPaymentMethodEnum, nullable=False)
    amount: Mapped[float] = mapped_column(sa.Numeric(12, 2), nullable=False)
    category: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    rep_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("customers.id"), nullable=True
    )
    source_transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("transactions.id"), nullable=True, unique=True
    )

    status: Mapped[str] = mapped_column(LedgerStatusEnum, nullable=False, server_default="pending")
    confirmed_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    flag_notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    date: Mapped[date] = mapped_column(sa.Date, nullable=False)

    __table_args__ = (
        sa.Index("ix_company_ledger_date", "date"),
        sa.Index("ix_company_ledger_rep_id", "rep_id"),
        sa.Index("ix_company_ledger_direction", "direction"),
        sa.Index("ix_company_ledger_status", "status"),
    )
```

**Step 2: Register the model in `__init__.py`**

Add to `backend/app/models/__init__.py` at the end:

```python
from app.models.ledger import CompanyLedger, LedgerDirectionEnum, LedgerPaymentMethodEnum, LedgerStatusEnum  # noqa: E402, F401
```

**Step 3: Generate the migration**

Run:
```bash
cd backend && alembic revision --autogenerate -m "add_company_ledger_table"
```

**Step 4: Review the generated migration**

Open the generated file in `backend/alembic/versions/`. Ensure:
- The three enums (`ledgerdirection`, `ledgerpaymentmethod`, `ledgerstatus`) are created with `op.execute("CREATE TYPE ...")` BEFORE `op.create_table`
- All columns, indexes, and foreign keys are present
- Downgrade drops the table and enums

Manually fix the migration if needed — use module-level `sa.Enum` objects to avoid DuplicateObjectError (same pattern as Phase 10 migration).

**Step 5: Run the migration**

Run:
```bash
cd backend && alembic upgrade head
```
Expected: Migration completes, `company_ledger` table exists in DB.

**Step 6: Commit**

```bash
git add backend/app/models/ledger.py backend/app/models/__init__.py backend/alembic/versions/*add_company_ledger*
git commit -m "feat: add company_ledger model and migration"
```

---

## Task 2: Ledger Repository

**Files:**
- Create: `backend/app/repositories/ledger_repository.py`
- Modify: `backend/app/api/deps.py`

**Step 1: Create the repository**

Create `backend/app/repositories/ledger_repository.py`:

```python
import uuid
from datetime import date

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ledger import CompanyLedger


class LedgerRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def create(self, entry: CompanyLedger) -> CompanyLedger:
        self._db.add(entry)
        await self._db.flush()
        await self._db.refresh(entry)
        return entry

    async def get_by_date(self, report_date: date) -> list[CompanyLedger]:
        result = await self._db.execute(
            select(CompanyLedger)
            .where(
                CompanyLedger.date == report_date,
                CompanyLedger.is_deleted.is_(False),
            )
            .order_by(CompanyLedger.created_at.asc())
        )
        return list(result.scalars().all())

    async def get_by_ids(self, ids: list[uuid.UUID]) -> list[CompanyLedger]:
        result = await self._db.execute(
            select(CompanyLedger).where(
                CompanyLedger.id.in_(ids),
                CompanyLedger.is_deleted.is_(False),
            )
        )
        return list(result.scalars().all())

    async def bulk_update_status(
        self, ids: list[uuid.UUID], values: dict
    ) -> int:
        result = await self._db.execute(
            update(CompanyLedger)
            .where(CompanyLedger.id.in_(ids), CompanyLedger.is_deleted.is_(False))
            .values(**values)
        )
        await self._db.commit()
        return result.rowcount
```

**Step 2: Register in deps.py**

Add to `backend/app/api/deps.py`:

After the existing repository imports (line 14), add:
```python
from app.repositories.ledger_repository import LedgerRepository
```

After `get_customer_auth_repo` (line 128), add:
```python
def get_ledger_repo(db: DbSession) -> LedgerRepository:
    return LedgerRepository(db)
```

After `CustomerAuthRepo` (line 135), add:
```python
LedgerRepo = Annotated[LedgerRepository, Depends(get_ledger_repo)]
```

**Step 3: Commit**

```bash
git add backend/app/repositories/ledger_repository.py backend/app/api/deps.py
git commit -m "feat: add LedgerRepository and wire into deps"
```

---

## Task 3: Ledger Schemas

**Files:**
- Create: `backend/app/schemas/ledger.py`

**Step 1: Create the schemas**

Create `backend/app/schemas/ledger.py`:

```python
import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator


class LedgerEntryOut(BaseModel):
    id: uuid.UUID
    direction: str
    payment_method: str
    amount: Decimal
    category: str | None = None
    notes: str | None = None
    rep_id: uuid.UUID
    rep_name: str | None = None  # populated by service join
    customer_id: uuid.UUID | None = None
    customer_name: str | None = None  # populated by service join
    source_transaction_id: uuid.UUID | None = None
    status: str
    confirmed_at: datetime | None = None
    flag_notes: str | None = None
    date: date
    created_at: datetime

    model_config = {"from_attributes": True}


class RepLedgerGroup(BaseModel):
    rep_id: uuid.UUID
    rep_name: str
    entries: list[LedgerEntryOut]


class DailyLedgerReportOut(BaseModel):
    report_date: str
    incoming: list[RepLedgerGroup]
    outgoing: list[RepLedgerGroup]


class LedgerStatusUpdateIn(BaseModel):
    ids: list[uuid.UUID]
    status: str
    flag_notes: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ("pending", "confirmed", "flagged"):
            raise ValueError("status must be pending, confirmed, or flagged")
        return v

    @field_validator("flag_notes")
    @classmethod
    def require_notes_for_flag(cls, v: str | None, info) -> str | None:
        if info.data.get("status") == "flagged" and not v:
            raise ValueError("flag_notes required when status is flagged")
        return v
```

**Step 2: Commit**

```bash
git add backend/app/schemas/ledger.py
git commit -m "feat: add ledger schemas — LedgerEntryOut, DailyLedgerReportOut, LedgerStatusUpdateIn"
```

---

## Task 4: Ledger Service + API Endpoints

**Files:**
- Create: `backend/app/services/ledger_service.py`
- Create: `backend/app/api/endpoints/ledger.py`
- Modify: `backend/app/main.py` (add router)
- Modify: `backend/app/api/deps.py` (add service)

**Step 1: Create the ledger service**

Create `backend/app/services/ledger_service.py`:

```python
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from collections import defaultdict

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ledger import CompanyLedger
from app.repositories.ledger_repository import LedgerRepository
from app.schemas.ledger import (
    DailyLedgerReportOut,
    LedgerEntryOut,
    RepLedgerGroup,
)


class LedgerService:
    def __init__(self, db: AsyncSession, ledger_repo: LedgerRepository):
        self._db = db
        self._repo = ledger_repo

    async def create_entry(
        self,
        direction: str,
        payment_method: str,
        amount: Decimal,
        rep_id: uuid.UUID,
        entry_date: date,
        customer_id: uuid.UUID | None = None,
        source_transaction_id: uuid.UUID | None = None,
        category: str | None = None,
        notes: str | None = None,
    ) -> CompanyLedger:
        entry = CompanyLedger(
            direction=direction,
            payment_method=payment_method,
            amount=abs(amount),
            rep_id=rep_id,
            customer_id=customer_id,
            source_transaction_id=source_transaction_id,
            category=category,
            notes=notes,
            date=entry_date,
            status="pending",
        )
        return await self._repo.create(entry)

    async def get_daily_report(self, report_date: date) -> DailyLedgerReportOut:
        rows = await self._db.execute(
            text("""
                SELECT
                    cl.id, cl.direction, cl.payment_method, cl.amount,
                    cl.category, cl.notes, cl.rep_id, cl.customer_id,
                    cl.source_transaction_id, cl.status, cl.confirmed_at,
                    cl.flag_notes, cl.date, cl.created_at,
                    u.username AS rep_name,
                    c.name AS customer_name
                FROM company_ledger cl
                JOIN users u ON u.id = cl.rep_id
                LEFT JOIN customers c ON c.id = cl.customer_id
                WHERE cl.date = :report_date
                  AND cl.is_deleted = false
                ORDER BY u.username, cl.created_at ASC
            """),
            {"report_date": report_date},
        )

        incoming_map: dict[uuid.UUID, list[LedgerEntryOut]] = defaultdict(list)
        outgoing_map: dict[uuid.UUID, list[LedgerEntryOut]] = defaultdict(list)
        rep_names: dict[uuid.UUID, str] = {}

        for r in rows:
            rep_names[r.rep_id] = r.rep_name
            entry = LedgerEntryOut(
                id=r.id,
                direction=r.direction,
                payment_method=r.payment_method,
                amount=Decimal(str(r.amount)),
                category=r.category,
                notes=r.notes,
                rep_id=r.rep_id,
                rep_name=r.rep_name,
                customer_id=r.customer_id,
                customer_name=r.customer_name,
                source_transaction_id=r.source_transaction_id,
                status=r.status,
                confirmed_at=r.confirmed_at,
                flag_notes=r.flag_notes,
                date=r.date,
                created_at=r.created_at,
            )
            if r.direction == "incoming":
                incoming_map[r.rep_id].append(entry)
            else:
                outgoing_map[r.rep_id].append(entry)

        def build_groups(m: dict) -> list[RepLedgerGroup]:
            return [
                RepLedgerGroup(rep_id=rid, rep_name=rep_names[rid], entries=entries)
                for rid, entries in m.items()
            ]

        return DailyLedgerReportOut(
            report_date=report_date.isoformat(),
            incoming=build_groups(incoming_map),
            outgoing=build_groups(outgoing_map),
        )

    async def update_status(
        self,
        ids: list[uuid.UUID],
        status: str,
        confirmer_id: uuid.UUID,
        flag_notes: str | None = None,
    ) -> int:
        values: dict = {"status": status, "updated_at": datetime.now(timezone.utc)}

        if status == "confirmed":
            values["confirmed_at"] = datetime.now(timezone.utc)
            values["flag_notes"] = None
        elif status == "flagged":
            values["confirmed_at"] = None
            values["flag_notes"] = flag_notes
        else:  # pending
            values["confirmed_at"] = None
            values["flag_notes"] = None

        return await self._repo.bulk_update_status(ids, values)
```

**Step 2: Create the API endpoints**

Create `backend/app/api/endpoints/ledger.py`:

```python
from datetime import date

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, require_admin, LedgerSvc
from app.schemas.ledger import DailyLedgerReportOut, LedgerStatusUpdateIn

router = APIRouter(prefix="/ledger", tags=["ledger"])


@router.get("/daily", response_model=DailyLedgerReportOut, dependencies=[require_admin])
async def get_daily_ledger(
    service: LedgerSvc,
    report_date: date = Query(..., alias="date"),
):
    return await service.get_daily_report(report_date)


@router.patch("/status", dependencies=[require_admin])
async def update_ledger_status(
    body: LedgerStatusUpdateIn,
    current_user: CurrentUser,
    service: LedgerSvc,
):
    count = await service.update_status(
        ids=body.ids,
        status=body.status,
        confirmer_id=current_user["sub"],
        flag_notes=body.flag_notes,
    )
    return {"updated": count}
```

**Step 3: Wire into deps.py**

Add import at top of `backend/app/api/deps.py`:
```python
from app.services.ledger_service import LedgerService
```

Add after `get_admin_service` (line 186):
```python
def get_ledger_service(db: DbSession, ledger_repo: LedgerRepo) -> LedgerService:
    return LedgerService(db, ledger_repo)

LedgerSvc = Annotated[LedgerService, Depends(get_ledger_service)]
```

**Step 4: Register router in main.py**

In `backend/app/main.py`, add after the existing router imports:
```python
from app.api.endpoints.ledger import router as ledger_router
```

Add to the `app.include_router()` calls:
```python
app.include_router(ledger_router)
```

**Step 5: Verify the backend starts**

Run:
```bash
docker compose up
```

Test endpoints:
```bash
curl -H "Authorization: Bearer <admin_token>" "http://localhost:8000/ledger/daily?date=2026-03-06"
```
Expected: `{"report_date": "2026-03-06", "incoming": [], "outgoing": []}`

**Step 6: Commit**

```bash
git add backend/app/services/ledger_service.py backend/app/api/endpoints/ledger.py backend/app/api/deps.py backend/app/main.py
git commit -m "feat: add ledger service and API endpoints — GET /ledger/daily, PATCH /ledger/status"
```

---

## Task 5: Auto-Create Ledger on Payment

**Files:**
- Modify: `backend/app/services/payment_service.py`
- Modify: `backend/app/api/deps.py`

**Step 1: Add ledger repo to PaymentService**

Modify `backend/app/services/payment_service.py`:

Update the constructor (line 23-29) to accept ledger repo:

```python
from app.models.ledger import CompanyLedger
from app.repositories.ledger_repository import LedgerRepository

class PaymentService:
    def __init__(
        self,
        customer_repo: CustomerRepository,
        transaction_repo: TransactionRepository,
        ledger_repo: LedgerRepository,
    ):
        self._customers = customer_repo
        self._transactions = transaction_repo
        self._ledger = ledger_repo
```

After `txn = await self._transactions.create(txn)` (line 88), before the return, add:

```python
        # Auto-create ledger entry
        ledger_entry = CompanyLedger(
            direction="incoming",
            payment_method="cash" if body.type == TransactionType.Payment_Cash else "check",
            amount=ils_amount,
            rep_id=creator_id,
            customer_id=body.customer_id,
            source_transaction_id=txn.id,
            date=txn.created_at.date(),
            status="pending",
        )
        self._ledger._db.add(ledger_entry)
        await self._ledger._db.flush()
```

**Step 2: Update deps.py to pass ledger repo to PaymentService**

Modify `get_payment_service` in `backend/app/api/deps.py` (line 179-182):

```python
def get_payment_service(
    customer_repo: CustomerRepo, transaction_repo: TransactionRepo, ledger_repo: LedgerRepo
) -> PaymentService:
    return PaymentService(customer_repo, transaction_repo, ledger_repo)
```

**Step 3: Verify with a test payment**

Create a payment via the API and verify a ledger entry appears:
```bash
# Create payment
curl -X POST -H "Authorization: Bearer <sales_token>" -H "Content-Type: application/json" \
  -d '{"customer_id":"...","type":"Payment_Cash","currency":"ILS","amount":100}' \
  http://localhost:8000/payments

# Check ledger
curl -H "Authorization: Bearer <admin_token>" "http://localhost:8000/ledger/daily?date=2026-03-06"
```
Expected: One incoming entry in the response.

**Step 4: Commit**

```bash
git add backend/app/services/payment_service.py backend/app/api/deps.py
git commit -m "feat: auto-create ledger entry when payment is collected"
```

---

## Task 6: Install @use-gesture/react

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install the gesture library**

Run:
```bash
cd frontend && bun add @use-gesture/react
```

**Step 2: Verify installation**

Run:
```bash
cd frontend && bun build
```
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/package.json frontend/bun.lock
git commit -m "chore: add @use-gesture/react for swipe interactions"
```

---

## Task 7: Frontend API Types + Calls

**Files:**
- Modify: `frontend/src/services/adminApi.ts`

**Step 1: Add new types and API calls**

Add new interfaces after the existing types in `frontend/src/services/adminApi.ts`:

```typescript
// ── Ledger types ──

export interface LedgerEntry {
  id: string;
  direction: "incoming" | "outgoing";
  payment_method: "cash" | "check";
  amount: number;
  category: string | null;
  notes: string | null;
  rep_id: string;
  rep_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  source_transaction_id: string | null;
  status: "pending" | "confirmed" | "flagged";
  confirmed_at: string | null;
  flag_notes: string | null;
  date: string;
  created_at: string;
}

export interface RepLedgerGroup {
  rep_id: string;
  rep_name: string;
  entries: LedgerEntry[];
}

export interface DailyLedgerReport {
  report_date: string;
  incoming: RepLedgerGroup[];
  outgoing: RepLedgerGroup[];
}

export interface LedgerStatusPayload {
  ids: string[];
  status: "pending" | "confirmed" | "flagged";
  flag_notes?: string;
}
```

Add new API methods to the `adminApi` object:

```typescript
  getDailyLedger: (reportDate: string) =>
    api.get<DailyLedgerReport>(`/ledger/daily?date=${reportDate}`).then((r) => r.data),

  updateLedgerStatus: (payload: LedgerStatusPayload) =>
    api.patch<{ updated: number }>("/ledger/status", payload).then((r) => r.data),
```

**Step 2: Verify build**

Run: `cd frontend && bun build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/src/services/adminApi.ts
git commit -m "feat: add ledger API types and calls to adminApi"
```

---

## Task 8: Locale Keys

**Files:**
- Modify: `frontend/src/locales/ar.json`
- Modify: `frontend/src/locales/en.json`

**Step 1: Update Arabic locale**

Replace existing `cash.*` keys and add new ones in `ar.json`:

```json
"cash.title": "تقرير النقدية اليومية",
"cash.incoming": "الوارد",
"cash.outgoing": "الصادر",
"cash.noActivity": "لا نشاط",
"cash.confirm": "ترحيل",
"cash.flag": "تعليم",
"cash.undo": "تراجع",
"cash.flagNotes": "ملاحظات",
"cash.flagNotesRequired": "الملاحظات مطلوبة عند التعليم",
"cash.confirmed": "تم الترحيل",
"cash.flagged": "تم التعليم",
"cash.undone": "تم التراجع",
"cash.cashPayment": "نقدي",
"cash.checkPayment": "شيك",
"cash.selectedCount": "{{count}} محدد",
"cash.confirmSelected": "ترحيل المحدد",
"cash.flagSelected": "تعليم المحدد",
"cash.swipeToAct": "اسحب للإجراء"
```

**Step 2: Update English locale**

Replace existing `cash.*` keys and add new ones in `en.json`:

```json
"cash.title": "Daily Cash Report",
"cash.incoming": "Incoming",
"cash.outgoing": "Outgoing",
"cash.noActivity": "No activity",
"cash.confirm": "Confirm",
"cash.flag": "Flag",
"cash.undo": "Undo",
"cash.flagNotes": "Notes",
"cash.flagNotesRequired": "Notes are required when flagging",
"cash.confirmed": "Confirmed",
"cash.flagged": "Flagged",
"cash.undone": "Undone",
"cash.cashPayment": "Cash",
"cash.checkPayment": "Check",
"cash.selectedCount": "{{count}} selected",
"cash.confirmSelected": "Confirm Selected",
"cash.flagSelected": "Flag Selected",
"cash.swipeToAct": "Swipe to act"
```

**Step 3: Remove old keys that are no longer needed**

Remove from both files:
- `cash.cashPayments`, `cash.checkPayments`, `cash.expenses`, `cash.netHandover`
- `cash.handedOver`, `cash.undoConfirm`, `cash.discrepancy`
- `cash.repHandovers`, `cash.selectRep`, `cash.paymentType`, `cash.paymentTime`, `cash.payments`

**Step 4: Commit**

```bash
git add frontend/src/locales/ar.json frontend/src/locales/en.json
git commit -m "feat: update cash report locale keys for ledger redesign"
```

---

## Task 9: SwipeableCard Component

**Files:**
- Create: `frontend/src/components/ui/swipeable-card.tsx`

**Step 1: Create the swipeable card component**

Create `frontend/src/components/ui/swipeable-card.tsx`:

```tsx
import { useRef, type ReactNode } from "react";
import { useDrag } from "@use-gesture/react";
import { Card, CardContent } from "./card";

interface SwipeAction {
  label: string;
  icon: ReactNode;
  color: string; // tailwind bg class e.g. "bg-emerald-500"
  onClick: () => void;
}

interface SwipeableCardProps {
  children: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  className?: string;
  disabled?: boolean;
}

const ACTION_WIDTH = 72;

export function SwipeableCard({
  children,
  leftActions = [],
  rightActions = [],
  className = "",
  disabled = false,
}: SwipeableCardProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);

  const maxLeft = rightActions.length * ACTION_WIDTH;
  const maxRight = leftActions.length * ACTION_WIDTH;

  const bind = useDrag(
    ({ movement: [mx], last, cancel, direction: [dx] }) => {
      if (disabled) { cancel?.(); return; }

      const el = contentRef.current;
      if (!el) return;

      if (last) {
        // Snap open or closed
        const threshold = ACTION_WIDTH * 0.5;
        let target = 0;
        if (mx < -threshold && rightActions.length) target = -maxLeft;
        if (mx > threshold && leftActions.length) target = maxRight;
        el.style.transition = "transform 200ms ease-out";
        el.style.transform = `translateX(${target}px)`;
        offsetRef.current = target;
        return;
      }

      // Clamp during drag
      const clamped = Math.max(-maxLeft, Math.min(maxRight, mx + offsetRef.current));
      el.style.transition = "none";
      el.style.transform = `translateX(${clamped}px)`;
    },
    { axis: "x", filterTaps: true, from: () => [offsetRef.current, 0] }
  );

  const resetSwipe = () => {
    const el = contentRef.current;
    if (!el) return;
    el.style.transition = "transform 200ms ease-out";
    el.style.transform = "translateX(0)";
    offsetRef.current = 0;
  };

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      {/* Right actions (revealed on swipe left) */}
      {rightActions.length > 0 && (
        <div className="absolute inset-y-0 end-0 flex items-stretch" dir="ltr">
          {rightActions.map((action, i) => (
            <button
              key={i}
              className={`flex items-center justify-center px-4 text-white text-xs font-medium gap-1 ${action.color}`}
              style={{ width: ACTION_WIDTH }}
              onClick={() => { action.onClick(); resetSwipe(); }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Left actions (revealed on swipe right) */}
      {leftActions.length > 0 && (
        <div className="absolute inset-y-0 start-0 flex items-stretch" dir="ltr">
          {leftActions.map((action, i) => (
            <button
              key={i}
              className={`flex items-center justify-center px-4 text-white text-xs font-medium gap-1 ${action.color}`}
              style={{ width: ACTION_WIDTH }}
              onClick={() => { action.onClick(); resetSwipe(); }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Main content — draggable */}
      <div ref={contentRef} {...bind()} className="relative z-10 touch-pan-y">
        {children}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd frontend && bun build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/src/components/ui/swipeable-card.tsx
git commit -m "feat: add SwipeableCard component with gesture-based actions"
```

---

## Task 10: Rewrite DailyCashReportView

**Files:**
- Rewrite: `frontend/src/components/Admin/DailyCashReportView.tsx`

**Step 1: Full rewrite of DailyCashReportView**

Replace the entire contents of `frontend/src/components/Admin/DailyCashReportView.tsx` with a new implementation that:

1. **Data fetching:** Uses `adminApi.getDailyLedger(dateStr)` instead of `getDailyCashReport`
2. **Layout:** Date nav (unchanged) -> Incoming section -> Outgoing section
3. **Sections:** Each section has a header (icon + title) and rep groups
4. **Rep groups:** Header with rep name, then list of ledger entry cards
5. **Cards:** Each card is a `SwipeableCard` showing customer name/category, amount, payment method icon, status indicator
6. **Swipe actions:** Based on current status:
   - pending: swipe reveals Confirm + Flag
   - confirmed: swipe reveals Undo + Flag
   - flagged: swipe reveals Confirm + Undo
7. **Long-press multi-select:** Same pattern as RouteView — `selectedIds` Set, `longPressTimer` ref, pointer events, floating bottom bar
8. **Flag dialog:** When flagging (single or batch), show a dialog/inline input for notes
9. **Status mutation:** Single `adminApi.updateLedgerStatus({ ids, status, flag_notes })` call
10. **Tap to expand:** Shows time, notes, flag notes

Key implementation details:

- Import `SwipeableCard` from `@/components/ui/swipeable-card`
- Use existing icons: `CheckCircle2`, `Flag`, `Undo2`, `Banknote`, `CreditCard`, `ArrowDownCircle`, `ArrowUpCircle`, `CheckSquare`, `Square`, `X`
- Status mutation uses `useMutation` with `onSuccess` invalidating `["daily-ledger"]`
- Long-press uses 500ms timeout (same as RouteView)
- Selection mode shows checkboxes on cards, floating bar at bottom
- Flag notes: use a small `Dialog` component with textarea when flagging

This is a full rewrite — the file will be ~350-400 lines. Refer to:
- Design doc: `docs/plans/2026-03-06-daily-cash-report-redesign.md`
- Long-press pattern: `frontend/src/components/Sales/RouteView.tsx` lines 92-122 and 855-890
- Current date nav: keep the exact same date navigation from current file lines 171-189

**Step 2: Verify build and visual test**

Run: `cd frontend && bun build`
Then: `cd frontend && bun dev` — open browser, navigate to Finance > Cash Report tab.

Expected:
- Date nav works (prev/next/picker)
- Incoming/Outgoing sections show with rep groups
- Cards are swipeable (reveals confirm/flag buttons)
- Long-press enters multi-select with floating bar
- Status changes persist after mutation

**Step 3: Commit**

```bash
git add frontend/src/components/Admin/DailyCashReportView.tsx
git commit -m "feat: rewrite DailyCashReportView with ledger cards, swipe actions, and multi-select"
```

---

## Task 11: Walk-In Customer Seed

**Files:**
- Create: new Alembic migration (data migration)

**Step 1: Create a data migration to seed Walk-In customer**

Run:
```bash
cd backend && alembic revision -m "seed_walkin_customer"
```

Edit the generated migration:

```python
from alembic import op
import uuid

WALKIN_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

def upgrade():
    op.execute(
        f"""
        INSERT INTO customers (id, name, phone, city, is_walkin, is_deleted, balance, created_at, updated_at)
        VALUES (
            '{WALKIN_ID}',
            'Walk-In',
            '0000000000',
            'N/A',
            true,
            false,
            0,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO NOTHING;
        """
    )

def downgrade():
    op.execute(f"DELETE FROM customers WHERE id = '{WALKIN_ID}';")
```

Note: This requires adding `is_walkin` column to customers table. Add to the same migration:

```python
def upgrade():
    op.add_column("customers", sa.Column("is_walkin", sa.Boolean(), server_default="false", nullable=False))
    # ... then the INSERT above
```

Also update `backend/app/models/customer.py` to add:
```python
is_walkin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
```

**Step 2: Run migration**

```bash
cd backend && alembic upgrade head
```

**Step 3: Commit**

```bash
git add backend/app/models/customer.py backend/alembic/versions/*seed_walkin*
git commit -m "feat: add is_walkin column to customers and seed Walk-In customer"
```

---

## Task 12: Clean Up Deprecated Code

**Files:**
- Modify: `backend/app/api/endpoints/admin.py` — remove old cash report endpoints (lines 127-178)
- Modify: `backend/app/services/admin_service.py` — remove old methods (lines 231-467)
- Modify: `backend/app/schemas/admin.py` — remove old schemas (RepCashSummaryOut, DailyCashReportOut, ConfirmHandoverIn, FlagHandoverIn, RepPaymentDetail, RepPaymentsOut)
- Modify: `frontend/src/services/adminApi.ts` — remove old types (RepCashSummary, DailyCashReport, ConfirmHandoverPayload, FlagHandoverPayload, RepPaymentDetail, RepPaymentsResponse) and old API calls (getDailyCashReport, confirmHandover, flagHandover, getRepPaymentDetails)

Do NOT delete the `daily_cash_confirmations` table or model yet — just stop using it. It can be dropped in a future cleanup migration.

**Step 1: Remove backend endpoints**

Remove from `backend/app/api/endpoints/admin.py`:
- `get_cash_report` endpoint
- `confirm_cash_handover` endpoint
- `flag_cash_handover` endpoint
- `get_rep_payment_details` endpoint

**Step 2: Remove backend service methods**

Remove from `backend/app/services/admin_service.py`:
- `get_daily_cash_report` method
- `confirm_handover` method
- `flag_handover` method
- `get_rep_payment_details` method

Remove unused imports (DailyCashConfirmation, pg_insert, etc.)

**Step 3: Remove backend schemas**

Remove from `backend/app/schemas/admin.py`:
- `RepConfirmationOut`, `RepCashSummaryOut`, `DailyCashReportOut`
- `ConfirmHandoverIn`, `FlagHandoverIn`
- `RepPaymentDetail`, `RepPaymentsOut`

**Step 4: Remove frontend types and calls**

Remove from `frontend/src/services/adminApi.ts`:
- Old interfaces: `RepConfirmation`, `RepCashSummary`, `DailyCashReport`, `ConfirmHandoverPayload`, `FlagHandoverPayload`, `RepPaymentDetail`, `RepPaymentsResponse`
- Old API calls: `getDailyCashReport`, `confirmHandover`, `flagHandover`, `getRepPaymentDetails`

**Step 5: Verify everything builds**

Run:
```bash
cd backend && python -c "from app.main import app; print('OK')"
cd frontend && bun build
```
Expected: Both pass with no import errors.

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove deprecated cash report endpoints, schemas, and frontend types"
```

---

## Execution Order Summary

| Task | Description | Depends On |
|------|-------------|------------|
| 1 | Company Ledger model + migration | - |
| 2 | Ledger Repository | 1 |
| 3 | Ledger Schemas | - |
| 4 | Ledger Service + API endpoints | 2, 3 |
| 5 | Auto-create ledger on payment | 2 |
| 6 | Install @use-gesture/react | - |
| 7 | Frontend API types + calls | 3 |
| 8 | Locale keys | - |
| 9 | SwipeableCard component | 6 |
| 10 | Rewrite DailyCashReportView | 7, 8, 9 |
| 11 | Walk-In customer seed | 1 |
| 12 | Clean up deprecated code | 4, 5, 10 |

**Parallelizable groups:**
- Wave 1: Tasks 1, 3, 6, 8 (no dependencies)
- Wave 2: Tasks 2, 7, 9, 11 (depend on wave 1)
- Wave 3: Tasks 4, 5, 10 (depend on wave 2)
- Wave 4: Task 12 (cleanup, depends on everything)
