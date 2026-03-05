# Phase 11: Daily Cash Report - Research

**Researched:** 2026-03-05
**Domain:** Admin dashboard sub-view — data aggregation, date navigation, confirm/flag workflow
**Confidence:** HIGH (all findings based on direct codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Report Layout:**
- Card per rep — each rep gets a glass card showing 4 totals: cash payments, check payments, expenses, and net cash to hand over (cash - expenses)
- Cards are expandable — tap to see individual payment and expense transactions for that rep on that day
- Grand totals bar at the top of the page showing the day's total cash, total checks, total expenses, and grand net across all reps
- Totals are computed on-the-fly from transactions + expenses tables (no snapshot)

**Date Navigation:**
- Arrow buttons flanking the current date (◀ March 5, 2026 ▶) for quick prev/next day
- Tap the date text to open the existing DatePicker calendar for jumping to specific dates
- Default view: today's date
- Forward arrow disabled when viewing today — no future dates allowed in calendar either
- Navigation does not trigger page reload (client-side state change, new API query)

**Confirmation and Flagging Flow:**
- Inline on the card: amount input field pre-filled with computed net, Confirm button, and Flag button
- Admin enters the handed-over amount (what the rep physically gave) — compared to the computed net
- When handed-over amount differs from computed net by >5%, discrepancy is visually highlighted (warning color, percentage shown) but NOT auto-flagged — admin must manually click Flag
- Confirmed state: card shows green/success border, confirmed_at timestamp, confirmer name
- Flagged state: card shows red/destructive border, flag icon next to rep name, flag_notes visible below totals
- Pending state: default card style, no border color
- Allow un-confirm: confirmed cards show a subtle Edit/Undo button to re-open for adjustment
- Flag action requires a notes field (mandatory free-text explaining the discrepancy)

**Nav Placement:**
- Cash report is a sub-view of the Admin Overview, NOT a new bottom nav item
- Accessed via a stat card on the Overview page showing today's cash summary (e.g. "Daily Cash: ₪12,500")
- Cash report view has a back button (top-left arrow) to return to Overview, same pattern as CustomerDashboard
- Bottom nav remains visible with Overview as active item
- New AdminView type value: "cashReport"

### Claude's Discretion
- Exact stat card design on Overview (icon, label, value format)
- Loading and empty states for the cash report
- Exact styling of the expandable transaction list inside rep cards
- API endpoint naming and response shape
- How to handle multi-currency payments in the report (ILS/USD/JOD) — show breakdown or convert

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CASH-01 | Admin can view a daily cash report showing all incoming payments (cash + checks) and all outgoing expenses across all salesmen and admin | Backend: new SQL query joining transactions + expenses by date grouped by rep; Frontend: DailyCashReportView component |
| CASH-02 | Admin can traverse dates (prev/next day) to view different days' reports | Frontend: date state with prev/next buttons + DatePicker; React Query re-fetches on date change without page reload |
| CASH-03 | Admin can confirm receiving a salesman's daily cash handover | Backend: POST/PUT to daily_cash_confirmations; Frontend: inline Confirm button with handed_over_amount input |
| CASH-04 | Admin can flag a discrepancy in a salesman's handover with notes | Backend: is_flagged + flag_notes on DailyCashConfirmation; Frontend: Flag button opens notes textarea inline or in Dialog |
| CASH-05 | Discrepancies (>5% difference) are visually highlighted in the report | Frontend-only: computed in component — abs(handed_over - computed) / computed > 0.05, show warning color/icon |
</phase_requirements>

---

## Summary

Phase 11 is primarily a read-heavy data aggregation feature with a focused write workflow (confirm/flag). The backend must aggregate two separate data sources — `transactions` (payments) and `expenses` — grouped by `created_by` (rep) for a given calendar date. The `daily_cash_confirmations` table from Phase 10 already exists with the exact schema needed (rep_id, date, handed_over_amount, confirmed_by, confirmed_at, is_flagged, flag_notes).

The frontend work follows the established Admin sub-view pattern (`AdminView` type + `renderView()` switch). The component is a new `DailyCashReportView` file. Date navigation is purely client-side state — React Query re-fetches when the date changes. The discrepancy highlight (CASH-05) is pure frontend math, no backend involvement.

The most technically interesting part is the backend aggregation query: it must join users, transactions (type in Payment_Cash, Payment_Check filtered by date), and expenses (filtered by date), then LEFT JOIN daily_cash_confirmations for the confirmation state. This is best done as a single raw SQL query following the pattern already used in `admin_service.py`, or broken into two simpler queries and merged in Python.

**Primary recommendation:** Single backend endpoint `GET /admin/cash-report?date=YYYY-MM-DD` returning an array of per-rep summaries plus confirmation state. Write endpoints `POST /admin/cash-report/confirm` and `POST /admin/cash-report/flag`. Frontend is a new component file `DailyCashReportView.tsx` using established patterns.

---

## Standard Stack

### Core (already in project — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Query (`@tanstack/react-query`) | existing | Data fetching, cache invalidation | Already used for all API calls in Admin |
| FastAPI | existing | Backend endpoints | Project backend framework |
| SQLAlchemy Async | existing | DB queries | Project ORM |
| shadcn/ui components | existing | Card, Button, Badge, Separator, Dialog | Already installed |
| date-fns | existing | Date formatting in DatePicker | Already a transitive dep via react-day-picker |
| lucide-react | existing | Icons (ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, Flag) | Already used throughout |

### No new packages required

All required UI primitives, hooks, and API infrastructure already exist. This phase is entirely additive — no new dependencies.

---

## Architecture Patterns

### Recommended File Structure

```
backend/app/
├── api/endpoints/admin.py          # Add 3 new routes
├── services/admin_service.py       # Add get_daily_cash_report(), confirm_handover(), flag_handover()
├── schemas/admin.py                # Add RepCashSummary, DailyCashReportOut, ConfirmHandoverIn, FlagHandoverIn
└── repositories/
    └── (queries inline in admin_service — consistent with existing pattern)

frontend/src/
├── components/Admin/
│   ├── index.tsx                   # Add "cashReport" to AdminView type, add case to renderView()
│   ├── Overview.tsx                # Add clickable stat card for daily cash
│   └── DailyCashReportView.tsx     # NEW — main report component
└── services/adminApi.ts            # Add getDailyCashReport(), confirmHandover(), flagHandover()
```

### Pattern 1: Admin Sub-View Navigation (existing)

The codebase uses a typed union for views and a switch statement in `renderView()`. The cash report must slot in exactly the same way as "sales", "debt", "checks".

```typescript
// In frontend/src/components/Admin/index.tsx
type AdminView =
  | "overview" | "sales" | "debt"
  | "checks"
  | "cashReport"                       // ADD THIS
  | "customers" | "addCustomer" | ...;

// In renderView():
case "cashReport":
  return <DailyCashReportView onBack={() => setActiveView("overview")} />;
```

The `isMainView` array and `bottomNavActiveValue` logic must treat `"cashReport"` as a sub-view of `"overview"`:
```typescript
// bottomNavActiveValue — cashReport maps to overview active item
: activeView === "cashReport" ? "overview"
```

### Pattern 2: Backend Raw SQL Aggregation (existing pattern)

The project uses `text()` raw SQL in `admin_service.py` for multi-table aggregation. The daily cash report query follows this pattern exactly.

```python
# Source: backend/app/services/admin_service.py (get_sales_stats pattern)
rows = await self.db.execute(
    text("""
        SELECT
            u.id          AS rep_id,
            u.username    AS rep_name,
            COALESCE(SUM(CASE WHEN t.type = 'Payment_Cash'
                              THEN ABS(t.amount) ELSE 0 END), 0) AS cash_total,
            COALESCE(SUM(CASE WHEN t.type = 'Payment_Check'
                              THEN ABS(t.amount) ELSE 0 END), 0) AS check_total,
            COUNT(CASE WHEN t.type IN ('Payment_Cash', 'Payment_Check') THEN 1 END)
                          AS payment_count
        FROM users u
        LEFT JOIN transactions t ON t.created_by = u.id
            AND t.is_deleted = false
            AND t.created_at::date = :report_date
            AND t.type IN ('Payment_Cash', 'Payment_Check')
        WHERE u.role = 'Sales'
          AND u.is_deleted = false
        GROUP BY u.id, u.username
        ORDER BY u.username
    """),
    {"report_date": report_date},
)
```

Then a second query for expenses (separate table, no customer_id join needed):
```python
expense_rows = await self.db.execute(
    text("""
        SELECT
            e.created_by  AS rep_id,
            COALESCE(SUM(e.amount), 0) AS expense_total,
            COUNT(e.id)   AS expense_count
        FROM expenses e
        WHERE e.is_deleted = false
          AND e.date = :report_date
        GROUP BY e.created_by
    """),
    {"report_date": report_date},
)
```

Then a third query to fetch existing confirmation records for the day:
```python
conf_rows = await self.db.execute(
    select(DailyCashConfirmation, User.username.label("confirmer_name"))
    .outerjoin(User, DailyCashConfirmation.confirmed_by == User.id)
    .where(DailyCashConfirmation.date == report_date)
)
```

Merge the three result sets in Python by `rep_id`. This is cleaner than a single 3-way LEFT JOIN and easier to maintain.

### Pattern 3: React Query with Date-Keyed Queries

```typescript
// In DailyCashReportView.tsx
const [reportDate, setReportDate] = useState<Date>(new Date());

const { data, isLoading } = useQuery({
  queryKey: ["daily-cash-report", toLocalDateStr(reportDate)],
  queryFn: () => adminApi.getDailyCashReport(toLocalDateStr(reportDate)),
});

// Navigate dates
const goToPrev = () => setReportDate(d => subDays(d, 1));
const goToNext = () => setReportDate(d => addDays(d, 1));
const isToday = toLocalDateStr(reportDate) === toLocalDateStr(new Date());
```

`toLocalDateStr` already exists in `frontend/src/lib/utils.ts`. `subDays` / `addDays` from `date-fns` are available as transitive dependencies.

### Pattern 4: Confirm/Flag Mutations with Cache Invalidation

```typescript
const confirmMutation = useMutation({
  mutationFn: (payload: ConfirmHandoverPayload) => adminApi.confirmHandover(payload),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["daily-cash-report"] });
    toast({ title: t("cash.confirmed"), variant: "success" });
  },
});

const flagMutation = useMutation({
  mutationFn: (payload: FlagHandoverPayload) => adminApi.flagHandover(payload),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["daily-cash-report"] });
    toast({ title: t("cash.flagged"), variant: "warning" });
  },
});
```

### Pattern 5: Discrepancy Calculation (frontend-only)

```typescript
// CASH-05 — no backend involvement
const computedNet = cashTotal - expenseTotal;
const handedOver = parseFloat(handedOverInput) || 0;
const diff = Math.abs(handedOver - computedNet);
const pct = computedNet !== 0 ? diff / Math.abs(computedNet) : 0;
const hasDiscrepancy = pct > 0.05;
```

Apply warning styling when `hasDiscrepancy` is true. Show percentage: `(pct * 100).toFixed(1) + "%"`.

### Anti-Patterns to Avoid

- **Joining all three data sources in one SQL query:** Three-way LEFT JOINs produce cartesian products when reps have both payments and expenses. Merge in Python instead.
- **Storing computed net in the database:** The decision is on-the-fly aggregation — do not add a `computed_net` column to `daily_cash_confirmations`.
- **Auto-flagging on discrepancy:** The highlight is visual only. The admin must manually click Flag. Do not auto-insert a confirmation record when a discrepancy is detected.
- **Re-using `is_deleted` soft-delete on confirmations:** Confirmations should be updated in-place (upsert pattern), not soft-deleted. The unique constraint `(rep_id, date)` enforces one record per rep per day.
- **Fetching individual transactions inline in the component:** The expandable section showing individual transactions should be fetched lazily (only when a card is expanded). Do not include full transaction lists in the main report endpoint.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date arithmetic (prev/next day) | Custom date math | `date-fns` `subDays`/`addDays` (already in dep tree) | Handles month/year boundaries, DST |
| Date formatting for display | Custom formatter | `date-fns` `format(date, "PPP")` or locale-aware format | Already used in DatePicker |
| Disabled future date in DatePicker | Custom calendar | `DayPicker` `disabled` prop with `{ after: new Date() }` | DatePicker already wraps DayPicker |
| Upsert (confirm or update) | Custom check-then-insert | PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` via SQLAlchemy | Atomically handles first confirm and re-confirm |
| Toast notifications | Custom alert | `useToast` hook (already exists) | Consistent UX, already wired |

**Key insight:** The upsert pattern is critical for the confirm endpoint. A rep's confirmation record may need to be updated (un-confirm → re-confirm, or confirm → flag). Use `INSERT INTO daily_cash_confirmations ... ON CONFLICT (rep_id, date) DO UPDATE SET ...` rather than a DELETE+INSERT.

---

## Common Pitfalls

### Pitfall 1: Transactions Signed Amount Convention

**What goes wrong:** `Transaction.amount` is signed — payments are **negative** (money flowing out of customer balance). Summing `amount` directly gives wrong totals.

**Why it happens:** The convention is documented in CLAUDE.md but easy to miss in aggregate queries.

**How to avoid:** Always use `ABS(t.amount)` when summing payment amounts for cash reports. Verified in existing `get_sales_stats` query which uses `ABS(t.amount)`.

**Warning signs:** Cash totals that appear as negative numbers in the UI.

### Pitfall 2: Date Filtering on `created_at` vs `date` Column

**What goes wrong:** Filtering transactions by `created_at::date = :report_date` can be slow without the right index and can miss timezone edge cases.

**Why it happens:** `created_at` is `DateTime(timezone=True)`. Casting to `::date` in Postgres uses the DB server timezone, not necessarily the business timezone.

**How to avoid:** The existing indexes added in Phase 10 include `(created_by, type, created_at)`. The `::date` cast will use the index efficiently. For the daily cash report, the business is in a single timezone (Israel, Asia/Jerusalem). Accept the server default timezone and document it. If timezone precision becomes an issue in the future, filter on a datetime range instead.

**Warning signs:** Reports showing different totals depending on time of day for transactions created near midnight.

### Pitfall 3: Reps With No Activity Still Appear

**What goes wrong:** If a rep has no transactions and no expenses on a given day, they are absent from the LEFT JOIN result if the transactions table is the driving table.

**Why it happens:** `LEFT JOIN transactions ... GROUP BY user` — if the user table is not the left side, reps with zero activity disappear.

**How to avoid:** Start the query FROM users WHERE role = 'Sales', then LEFT JOIN transactions. This guarantees all active reps appear even with zero activity. (See the query pattern in Architecture Patterns above.)

**Warning signs:** Number of rep cards on the report changes between busy and quiet days.

### Pitfall 4: Un-Confirm Flow Needs Careful State Reset

**What goes wrong:** When admin clicks "Edit/Undo" to re-open a confirmed card, the handed_over_amount input must reset to the previously saved value (not the computed net), otherwise the admin loses what they previously entered.

**Why it happens:** Pre-filling from computed net is the initial state, but after a confirm, the source of truth is `DailyCashConfirmation.handed_over_amount`.

**How to avoid:** When the report loads, pre-fill `handedOverInput` from `confirmation.handed_over_amount` if a confirmation record exists. Only fall back to `computedNet` when no confirmation record exists yet.

**Warning signs:** Admin sees a different pre-filled amount after un-confirming than what they originally entered.

### Pitfall 5: Multi-Currency Totals (Claude's Discretion area)

**What goes wrong:** Summing ILS + USD + JOD payments as if they were the same currency gives meaningless totals.

**Why it happens:** The `Transaction.currency` field allows three currencies. The existing payment flow lets reps collect in any currency.

**How to avoid (recommended approach):** Show totals broken down by currency (e.g., "₪1,200 + $300 + 50 JOD") rather than attempting conversion. This is the safest approach given no exchange rate table is in scope. The `data` JSONB column on transactions stores exchange rates for existing transactions — do not rely on it for display totals.

**Warning signs:** Totals that don't match what reps physically collected.

### Pitfall 6: Flag Requires Notes — Frontend Validation

**What goes wrong:** Admin clicks Flag without entering notes — the backend will receive empty `flag_notes`.

**Why it happens:** The decision says flag_notes is mandatory. Backend schema may accept null; frontend must enforce.

**How to avoid:** Disable the Flag submit button until `flag_notes.trim().length > 0`. Also add backend validation (non-empty string check in Pydantic schema).

---

## Code Examples

### Backend: Upsert Confirm Handover

```python
# Source: pattern derived from DailyCashConfirmation model (backend/app/models/daily_cash_confirmation.py)
# UniqueConstraint("rep_id", "date", name="uq_daily_cash_rep_date") enables safe upsert

from sqlalchemy.dialects.postgresql import insert as pg_insert

async def confirm_handover(
    self,
    rep_id: uuid.UUID,
    report_date: date,
    handed_over_amount: Decimal,
    confirmer_id: uuid.UUID,
) -> DailyCashConfirmation:
    stmt = pg_insert(DailyCashConfirmation).values(
        rep_id=rep_id,
        date=report_date,
        handed_over_amount=handed_over_amount,
        confirmed_by=confirmer_id,
        confirmed_at=datetime.now(timezone.utc),
        is_flagged=False,
        flag_notes=None,
    ).on_conflict_do_update(
        constraint="uq_daily_cash_rep_date",
        set_={
            "handed_over_amount": handed_over_amount,
            "confirmed_by": confirmer_id,
            "confirmed_at": datetime.now(timezone.utc),
            "is_flagged": False,
            "flag_notes": None,
            "updated_at": datetime.now(timezone.utc),
        }
    ).returning(DailyCashConfirmation)
    result = await self.db.execute(stmt)
    await self.db.commit()
    return result.scalar_one()
```

### Backend: Flag Handover

```python
async def flag_handover(
    self,
    rep_id: uuid.UUID,
    report_date: date,
    handed_over_amount: Decimal,
    flag_notes: str,
    confirmer_id: uuid.UUID,
) -> DailyCashConfirmation:
    stmt = pg_insert(DailyCashConfirmation).values(
        rep_id=rep_id,
        date=report_date,
        handed_over_amount=handed_over_amount,
        confirmed_by=confirmer_id,
        confirmed_at=datetime.now(timezone.utc),
        is_flagged=True,
        flag_notes=flag_notes,
    ).on_conflict_do_update(
        constraint="uq_daily_cash_rep_date",
        set_={
            "handed_over_amount": handed_over_amount,
            "confirmed_by": confirmer_id,
            "confirmed_at": datetime.now(timezone.utc),
            "is_flagged": True,
            "flag_notes": flag_notes,
            "updated_at": datetime.now(timezone.utc),
        }
    ).returning(DailyCashConfirmation)
    result = await self.db.execute(stmt)
    await self.db.commit()
    return result.scalar_one()
```

### Backend: Pydantic Schemas

```python
# Add to backend/app/schemas/admin.py

import uuid
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, field_validator

class RepPaymentItemOut(BaseModel):
    id: uuid.UUID
    type: str           # "Payment_Cash" | "Payment_Check"
    amount: Decimal     # stored as absolute value
    currency: str
    customer_name: str
    created_at: datetime
    model_config = {"from_attributes": True}

class RepExpenseItemOut(BaseModel):
    id: uuid.UUID
    amount: Decimal
    currency: str       # expenses also have currency
    category: str
    notes: str | None
    model_config = {"from_attributes": True}

class RepConfirmationOut(BaseModel):
    handed_over_amount: Decimal
    confirmed_at: datetime | None
    confirmer_name: str | None
    is_flagged: bool
    flag_notes: str | None

class RepCashSummaryOut(BaseModel):
    rep_id: uuid.UUID
    rep_name: str
    cash_total: Decimal         # abs sum of Payment_Cash
    check_total: Decimal        # abs sum of Payment_Check
    expense_total: Decimal      # sum of expenses
    computed_net: Decimal       # cash_total - expense_total
    payment_count: int
    expense_count: int
    confirmation: RepConfirmationOut | None

class DailyCashReportOut(BaseModel):
    report_date: str
    grand_cash: Decimal
    grand_checks: Decimal
    grand_expenses: Decimal
    grand_net: Decimal
    reps: list[RepCashSummaryOut]

class ConfirmHandoverIn(BaseModel):
    rep_id: uuid.UUID
    report_date: date
    handed_over_amount: Decimal

class FlagHandoverIn(BaseModel):
    rep_id: uuid.UUID
    report_date: date
    handed_over_amount: Decimal
    flag_notes: str

    @field_validator("flag_notes")
    @classmethod
    def notes_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("flag_notes cannot be empty")
        return v
```

### Frontend: adminApi additions

```typescript
// Add to frontend/src/services/adminApi.ts

export interface RepConfirmation {
  handed_over_amount: number;
  confirmed_at: string | null;
  confirmer_name: string | null;
  is_flagged: boolean;
  flag_notes: string | null;
}

export interface RepCashSummary {
  rep_id: string;
  rep_name: string;
  cash_total: number;
  check_total: number;
  expense_total: number;
  computed_net: number;
  payment_count: number;
  expense_count: number;
  confirmation: RepConfirmation | null;
}

export interface DailyCashReport {
  report_date: string;
  grand_cash: number;
  grand_checks: number;
  grand_expenses: number;
  grand_net: number;
  reps: RepCashSummary[];
}

export interface ConfirmHandoverPayload {
  rep_id: string;
  report_date: string;
  handed_over_amount: number;
}

export interface FlagHandoverPayload {
  rep_id: string;
  report_date: string;
  handed_over_amount: number;
  flag_notes: string;
}

// In adminApi object:
getDailyCashReport: (reportDate: string) =>
  api.get<DailyCashReport>("/admin/cash-report", { params: { date: reportDate } })
    .then(r => r.data),

confirmHandover: (payload: ConfirmHandoverPayload) =>
  api.post("/admin/cash-report/confirm", payload).then(r => r.data),

flagHandover: (payload: FlagHandoverPayload) =>
  api.post("/admin/cash-report/flag", payload).then(r => r.data),
```

### Frontend: Rep Card Border Styling

```typescript
// Derive card border class from confirmation state
function repCardBorderClass(confirmation: RepConfirmation | null): string {
  if (!confirmation) return ""; // default glass card, no border override
  if (confirmation.is_flagged) return "border-destructive ring-1 ring-destructive";
  return "border-success ring-1 ring-success"; // confirmed
}
```

### Frontend: DailyCashReportView skeleton structure

```typescript
// frontend/src/components/Admin/DailyCashReportView.tsx
export function DailyCashReportView({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentUser = useAppSelector(s => s.auth);

  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [expandedReps, setExpandedReps] = useState<Set<string>>(new Set());
  const [handedOverInputs, setHandedOverInputs] = useState<Record<string, string>>({});
  const [flagInputs, setFlagInputs] = useState<Record<string, string>>({});
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const isToday = toLocalDateStr(reportDate) === toLocalDateStr(new Date());
  const dateStr = toLocalDateStr(reportDate);

  const { data: report, isLoading } = useQuery({
    queryKey: ["daily-cash-report", dateStr],
    queryFn: () => adminApi.getDailyCashReport(dateStr),
  });

  // Initialize handedOverInputs from confirmation data when report loads
  useEffect(() => {
    if (!report) return;
    const inputs: Record<string, string> = {};
    for (const rep of report.reps) {
      const saved = rep.confirmation?.handed_over_amount;
      inputs[rep.rep_id] = saved !== undefined
        ? String(saved)
        : String(rep.computed_net);
    }
    setHandedOverInputs(inputs);
  }, [report]);

  // ... confirm/flag mutations, render ...
}
```

---

## Integration Map

### Files to Modify

| File | Change |
|------|--------|
| `backend/app/api/endpoints/admin.py` | Add 3 routes: `GET /cash-report`, `POST /cash-report/confirm`, `POST /cash-report/flag` |
| `backend/app/services/admin_service.py` | Add `get_daily_cash_report()`, `confirm_handover()`, `flag_handover()` methods |
| `backend/app/schemas/admin.py` | Add 6 new Pydantic models (see Code Examples) |
| `frontend/src/components/Admin/index.tsx` | Add `"cashReport"` to `AdminView` type, add `renderView()` case, update `isMainView` and `bottomNavActiveValue` |
| `frontend/src/components/Admin/Overview.tsx` | Add clickable `StatCard` for daily cash that calls `setActiveView("cashReport")` via prop |
| `frontend/src/services/adminApi.ts` | Add 3 new API calls + 4 new TypeScript interfaces |
| `frontend/src/locales/ar.json` | Add `cash.*` keys |
| `frontend/src/locales/en.json` | Add `cash.*` keys |

### Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/components/Admin/DailyCashReportView.tsx` | Main new component |

### Required locale keys (both ar.json and en.json)

```
cash.title             — "Daily Cash Report" / "تقرير النقدية اليومية"
cash.grandTotals       — "Grand Totals" / "الإجماليات الكلية"
cash.cashPayments      — "Cash Payments" / "مدفوعات نقدية"
cash.checkPayments     — "Check Payments" / "مدفوعات شيكات"
cash.expenses          — "Expenses" / "مصاريف"
cash.netHandover       — "Net to Hand Over" / "الصافي للتسليم"
cash.handedOver        — "Handed Over Amount" / "المبلغ المسلّم"
cash.confirm           — "Confirm Handover" / "تأكيد التسليم"
cash.flag              — "Flag Discrepancy" / "الإبلاغ عن فارق"
cash.flagNotes         — "Discrepancy Notes" / "ملاحظات الفارق"
cash.flagNotesRequired — "Notes are required" / "الملاحظات مطلوبة"
cash.confirmed         — "Handover Confirmed" / "تم تأكيد التسليم"
cash.flagged           — "Discrepancy Flagged" / "تم الإبلاغ عن الفارق"
cash.undoConfirm       — "Edit" / "تعديل"
cash.discrepancy       — "{{pct}}% discrepancy" / "فارق {{pct}}%"
cash.noActivity        — "No activity" / "لا نشاط"
cash.statCardLabel     — "Today's Cash" / "نقدية اليوم"
cash.pendingStatus     — "Pending" / "معلّق"
cash.confirmedStatus   — "Confirmed" / "مؤكّد"
cash.flaggedStatus     — "Flagged" / "مُبلَّغ"
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Snapshot stored in DB | On-the-fly aggregation from transactions + expenses | Phase 10 decision — no snapshot table needed |
| Single monolithic query | Three separate queries merged in Python | Avoids cartesian product from multi-table LEFT JOINs |
| New nav item for cash report | Sub-view of Overview (no new nav item) | Phase 11 decision — preserves clean bottom nav |

---

## Open Questions

1. **Lazy loading of individual transaction details in expanded cards**
   - What we know: The main report endpoint returns totals per rep; individual transactions are not included
   - What's unclear: Should expanded view make a second API call, or should the main endpoint include full transaction lists?
   - Recommendation: Make a second call on expand (e.g., `GET /admin/cash-report/details?rep_id=X&date=Y`) to keep the main report response fast. Or include in main response if total data volume is small (typical day: <50 transactions across all reps). For v1.2, include inline to reduce API round trips — revisit if performance degrades.

2. **Multi-currency display format**
   - What we know: Claude's Discretion area. Payments can be ILS/USD/JOD.
   - What's unclear: User preference for currency breakdown vs. unified view
   - Recommendation: Show ILS total prominently; show other currencies as small badges below if non-zero (e.g., "+ $300 + 50 JOD"). Net handover calculation should be ILS-only with a note if other currencies exist.

---

## Validation Architecture

> nyquist_validation key is absent from .planning/config.json — treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Not yet established for this project |
| Config file | None detected |
| Quick run command | N/A — no test runner configured |
| Full suite command | N/A |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CASH-01 | GET /admin/cash-report returns correct aggregated totals | integration | N/A — Wave 0 gap | No |
| CASH-02 | Date navigation changes query key and triggers re-fetch | manual | Manual browser test | N/A |
| CASH-03 | POST /admin/cash-report/confirm creates/updates DailyCashConfirmation | integration | N/A — Wave 0 gap | No |
| CASH-04 | POST /admin/cash-report/flag sets is_flagged=True, stores notes | integration | N/A — Wave 0 gap | No |
| CASH-05 | >5% diff shows warning styling in UI | manual | Manual browser test | N/A |

### Wave 0 Gaps

- No test infrastructure detected in project. All validation is manual browser testing against the running Docker stack.
- Recommend: `docker compose up` → navigate to Admin → Overview → Daily Cash stat card → verify report renders for today.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `backend/app/models/daily_cash_confirmation.py` — confirmed schema fields
- Direct codebase inspection: `backend/app/models/expense.py` — confirmed expense fields (date, amount, created_by)
- Direct codebase inspection: `backend/app/models/transaction.py` — confirmed signed amount convention, Payment_Cash/Payment_Check types
- Direct codebase inspection: `backend/app/services/admin_service.py` — confirmed raw SQL pattern with `text()`
- Direct codebase inspection: `frontend/src/components/Admin/index.tsx` — confirmed AdminView union type and renderView() pattern
- Direct codebase inspection: `frontend/src/services/adminApi.ts` — confirmed API call pattern
- Direct codebase inspection: `frontend/src/components/ui/date-picker.tsx` — confirmed DatePicker wraps DayPicker, supports `disabled` prop
- Direct codebase inspection: `.planning/phases/11-daily-cash-report/11-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- SQLAlchemy `insert().on_conflict_do_update()` — standard PostgreSQL upsert pattern, well-documented; exact syntax verified against SQLAlchemy async docs pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in project
- Architecture patterns: HIGH — derived from direct inspection of existing code
- Pitfalls: HIGH — signed amounts verified in models; join strategy derived from SQL knowledge
- Locale keys: HIGH — derived from existing locale file structure and feature decisions

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable stack, 30-day horizon)
