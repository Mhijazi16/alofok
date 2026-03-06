# Phase 12: Expense Tracking - Research

**Researched:** 2026-03-06
**Domain:** Expense CRUD via company_ledger, expandable cards, category picker UI
**Confidence:** HIGH

## Summary

Phase 12 adds expense tracking for Sales reps (field expenses) and Admin (business expenses). The key architectural decision -- storing expenses as `company_ledger` entries with `direction: 'outgoing'` -- means the backend already has most of the infrastructure. The `CompanyLedger` model, `LedgerService.create_entry()`, and the daily report query all support outgoing entries natively. Expenses will automatically appear in the existing Daily Cash Report outgoing section.

The work is primarily: (1) a new POST endpoint for creating expense ledger entries, (2) a GET endpoint for reps to see their own expenses, (3) a DELETE endpoint for reps to remove their own pending expenses, (4) a shared expandable expense card component for both Sales RouteView and Admin, and (5) locale keys for categories and UI strings.

**Primary recommendation:** Build a single `ExpenseCard` component that accepts a category set prop (rep vs admin) and reuse it in both RouteView (Sales) and FinanceView/DailyCashReportView (Admin). Backend changes are minimal -- add 3 endpoints to the existing ledger router.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Expenses stored as `company_ledger` entries with `direction: 'outgoing'`, `payment_method: 'cash'`
- Category stored in the existing `category` string column (not a Postgres enum)
- The separate `expenses` table from Phase 10 is NOT used for this feature
- Expenses automatically appear in the daily cash report's outgoing section
- Sales rep expense entry: expandable card on RouteView, ABOVE customers and orders
- Collapsed state shows summary info; tapping expands showing today's rows + "Add" button
- "Add" opens a dialog with colored icon grid for category, amount (ILS only), date picker, optional notes
- Rep can delete their own expenses from the expanded list
- Admin-submitted expenses auto-set to confirmed; rep expenses start as pending
- Rep categories: Food, Fuel, Gifts, CarWash, Other
- Admin categories: All rep categories PLUS Electricity, Internet, CarRepair, Salaries, Other
- NO separate Expenses tab in Finance -- management happens inside daily cash report
- Expense rows in cash report use swipe-to-confirm/flag (existing swipeable-card pattern)
- Rep sees own expenses in expandable card on Route view with status indicators

### Claude's Discretion
- Exact icon and color assignments for each category
- Collapsed card summary content (today's total, count, or both)
- Loading and empty states for the expense card
- Admin expense entry placement (in cash report outgoing section or separate card on overview)
- Whether "Other" category prompts for mandatory notes or not
- Exact popup/dialog styling for the add expense form

### Deferred Ideas (OUT OF SCOPE)
- Expense receipt photo upload -- explicitly out of scope (REQUIREMENTS.md)
- Offline expense submission -- tracked as future OFFL-04
- Expense CSV export -- not discussed
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXP-01 | Sales rep can log a field expense with amount, currency, category, date, and notes | POST `/ledger/expenses` endpoint + ExpenseCard dialog on RouteView |
| EXP-02 | Admin can log a business expense with amount, currency, category, date, and notes | Same POST endpoint (admin role auto-confirms) + ExpenseCard on admin side |
| EXP-03 | Admin can view all expenses filterable by rep, date range, and status | Existing daily ledger report already shows outgoing entries grouped by rep with date nav; status filtering via swipe actions already present |
| EXP-04 | Sales rep can view their own submitted expenses | GET `/ledger/my-expenses` endpoint + ExpenseCard expanded list on RouteView |
| EXP-05 | Admin can confirm or flag an expense with optional notes | PATCH `/ledger/status` already exists and handles confirm/flag with notes |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | current | API endpoints | Project backend framework |
| SQLAlchemy (Async) | current | ORM queries on company_ledger | Project ORM |
| React + Vite | current | Frontend framework | Project frontend |
| @tanstack/react-query | current | Data fetching + mutations | Project data layer |
| shadcn/ui + Tailwind | current | UI components | Project design system |
| lucide-react | current | Icons for category picker | Already used throughout |
| i18next | current | Localization (ar/en) | Project localization |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | current | Date manipulation for expense date filtering | Already used in DailyCashReportView |
| Radix Dialog | current | Add expense popup | Already wrapped in ui/dialog |
| Radix Collapsible | current | Expandable card collapse/expand | May use for card, or simple state toggle |

### No New Dependencies Needed
This phase requires zero new npm packages or Python dependencies. Everything builds on existing infrastructure.

## Architecture Patterns

### Backend: Extend Existing Ledger Layer

The `LedgerService.create_entry()` already accepts all needed parameters. New endpoints go in the existing `ledger.py` router.

```
backend/app/
├── api/endpoints/ledger.py    # ADD: POST /expenses, GET /my-expenses, DELETE /expenses/{id}
├── schemas/ledger.py          # ADD: ExpenseCreateIn schema
├── services/ledger_service.py # ADD: create_expense(), get_rep_expenses(), delete_expense()
├── repositories/ledger_repository.py  # ADD: get_by_rep_and_date_range(), soft_delete()
└── models/ledger.py           # NO CHANGES needed
```

### Frontend: Shared ExpenseCard Component

```
frontend/src/components/
├── shared/
│   └── ExpenseCard.tsx         # Expandable card with category grid dialog, used by Sales + Admin
├── Sales/
│   └── RouteView.tsx           # ADD ExpenseCard at top of content area
└── Admin/
    └── DailyCashReportView.tsx  # Expense rows already appear as outgoing -- swipe already works
```

### Pattern 1: Ledger Entry Creation (Backend)
**What:** Create expense as a company_ledger entry with direction='outgoing', payment_method='cash'
**When:** Sales rep or Admin submits an expense
**Example:**
```python
# In ledger_service.py - reuse existing create_entry
async def create_expense(
    self,
    rep_id: uuid.UUID,
    amount: Decimal,
    category: str,
    expense_date: date,
    notes: str | None = None,
    is_admin: bool = False,
) -> CompanyLedger:
    entry = CompanyLedger(
        direction="outgoing",
        payment_method="cash",
        amount=abs(amount),
        rep_id=rep_id,
        category=category,
        notes=notes,
        date=expense_date,
        status="confirmed" if is_admin else "pending",
    )
    return await self._repo.create(entry)
```

### Pattern 2: Expandable Card with Dialog (Frontend)
**What:** Collapsible card showing expense summary, expandable to show list + add button
**When:** Both Sales RouteView and Admin expense entry
**Example:**
```typescript
// ExpenseCard.tsx - shared component
interface ExpenseCardProps {
  categories: CategoryConfig[];
  expenses: LedgerEntry[];
  isLoading: boolean;
  onAdd: (data: ExpenseFormData) => void;
  onDelete?: (id: string) => void;
  showStatus?: boolean;
}
```

### Pattern 3: Category Grid Picker
**What:** Colored icon grid for fast category selection (mobile-optimized)
**When:** Add expense dialog
**Example:**
```typescript
const REP_CATEGORIES = [
  { key: "Food", icon: UtensilsCrossed, bg: "bg-orange-500/15", color: "text-orange-400" },
  { key: "Fuel", icon: Fuel, bg: "bg-blue-500/15", color: "text-blue-400" },
  { key: "Gifts", icon: Gift, bg: "bg-pink-500/15", color: "text-pink-400" },
  { key: "CarWash", icon: CarFront, bg: "bg-cyan-500/15", color: "text-cyan-400" },
  { key: "Other", icon: MoreHorizontal, bg: "bg-zinc-500/15", color: "text-zinc-400" },
] as const;

const ADMIN_CATEGORIES = [
  ...REP_CATEGORIES.filter(c => c.key !== "Other"),
  { key: "Electricity", icon: Zap, bg: "bg-yellow-500/15", color: "text-yellow-400" },
  { key: "Internet", icon: Wifi, bg: "bg-indigo-500/15", color: "text-indigo-400" },
  { key: "CarRepair", icon: Wrench, bg: "bg-amber-500/15", color: "text-amber-400" },
  { key: "Salaries", icon: Wallet, bg: "bg-emerald-500/15", color: "text-emerald-400" },
  { key: "Other", icon: MoreHorizontal, bg: "bg-zinc-500/15", color: "text-zinc-400" },
] as const;
```

### Anti-Patterns to Avoid
- **Using the `expenses` table from Phase 10:** CONTEXT.md explicitly says NOT to use it. All expenses go in `company_ledger`.
- **Creating a separate Expenses tab in Finance:** Management happens inside the existing daily cash report, not a new tab.
- **Hardcoding category as Postgres enum:** Category is a plain string column. Categories are defined in frontend constants and validated in the Pydantic schema.
- **Building a new confirm/flag flow:** The existing `PATCH /ledger/status` endpoint + swipeable-card pattern already handles this for all ledger entries including expenses.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Expense status management | Custom confirm/flag endpoint | Existing `PATCH /ledger/status` | Already handles confirm/flag/undo with notes for all ledger entries |
| Admin expense viewing | New admin expenses list | Existing `DailyCashReportView` outgoing section | Expenses automatically appear as outgoing ledger entries |
| Swipe actions for expense rows | New swipe component | Existing `SwipeableCard` | Already implements swipe-to-confirm/flag in cash report |
| Date navigation for expense history | New date picker flow | Existing date navigation in DailyCashReportView | Date nav with prev/next already built |
| Form dialog pattern | Custom modal | Existing `Dialog/DialogContent` from ui/dialog | Already used throughout the app |

**Key insight:** The decision to use `company_ledger` for expenses means ~60% of the admin-side functionality (viewing, filtering by date, confirm/flag) is already working. The phase is primarily about expense CREATION and the Sales rep UI.

## Common Pitfalls

### Pitfall 1: Category String Validation
**What goes wrong:** Frontend sends arbitrary category strings, backend stores them without validation.
**Why it happens:** Category is a plain string column, not an enum.
**How to avoid:** Validate categories in the Pydantic `ExpenseCreateIn` schema with a field_validator that checks against an allowed list. Differentiate allowed categories by role (rep vs admin).
**Warning signs:** Invalid categories appearing in the database.

### Pitfall 2: Admin Expenses Need a rep_id
**What goes wrong:** Admin creates an expense but the `company_ledger.rep_id` is NOT NULL, so it fails.
**Why it happens:** The ledger model requires `rep_id` for all entries.
**How to avoid:** When Admin creates an expense, use the Admin's own user ID as `rep_id`. This correctly associates the expense with them and groups it under their name in the daily report.
**Warning signs:** 500 error on admin expense creation due to NULL rep_id.

### Pitfall 3: Expense Deletion vs Soft Delete
**What goes wrong:** Hard-deleting expense rows from `company_ledger` instead of using `is_deleted` soft delete.
**Why it happens:** Implementing a DELETE endpoint with actual row deletion.
**How to avoid:** Use `BaseMixin.is_deleted = True` for "deletion". The daily report query already filters `WHERE is_deleted = false`.
**Warning signs:** Data integrity issues, missing audit trail.

### Pitfall 4: Query Key Invalidation
**What goes wrong:** Adding/deleting an expense doesn't refresh the RouteView expense list or the admin cash report.
**Why it happens:** Forgetting to invalidate the right React Query keys after mutations.
**How to avoid:** After expense create/delete, invalidate both `["my-expenses"]` (for rep view) and `["daily-ledger"]` (for admin view).
**Warning signs:** Stale data after expense actions until manual page refresh.

### Pitfall 5: Locale Keys for Categories
**What goes wrong:** Category names display as raw keys like "CarWash" instead of localized text.
**Why it happens:** Forgetting to add all category locale entries in both ar.json and en.json.
**How to avoid:** Add all 10 category keys (5 rep + 5 admin-only) to both locale files under an `expense` namespace.
**Warning signs:** Raw English keys showing in Arabic UI.

### Pitfall 6: RouteView Already Complex
**What goes wrong:** Adding expense card makes RouteView.tsx unwieldy (already 950 lines).
**Why it happens:** Mixing expense logic into an already large component.
**How to avoid:** Build ExpenseCard as a self-contained component in `shared/` or `Sales/` directory. RouteView just renders `<ExpenseCard />` with minimal props.
**Warning signs:** RouteView exceeding 1200+ lines, making maintenance difficult.

## Code Examples

### Backend: Expense Creation Schema
```python
# schemas/ledger.py - new schema
class ExpenseCreateIn(BaseModel):
    amount: Decimal
    category: str
    date: date
    notes: str | None = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        allowed = {
            "Food", "Fuel", "Gifts", "CarWash", "Other",
            "Electricity", "Internet", "CarRepair", "Salaries",
        }
        if v not in allowed:
            raise ValueError(f"Invalid category: {v}")
        return v

    @field_validator("amount")
    @classmethod
    def validate_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Amount must be positive")
        return v
```

### Backend: Expense Endpoints
```python
# In ledger.py router - add these endpoints

@router.post("/expenses", dependencies=[require_sales])
async def create_expense(
    body: ExpenseCreateIn,
    current_user: CurrentUser,
    service: LedgerSvc,
):
    role = current_user.get("role", "")
    is_admin = role == "Admin"
    entry = await service.create_expense(
        rep_id=current_user["sub"],
        amount=body.amount,
        category=body.category,
        expense_date=body.date,
        notes=body.notes,
        is_admin=is_admin,
    )
    return {"id": str(entry.id)}

@router.get("/my-expenses", dependencies=[require_sales])
async def get_my_expenses(
    current_user: CurrentUser,
    service: LedgerSvc,
    expense_date: date = Query(None, alias="date"),
):
    entries = await service.get_rep_expenses(
        rep_id=current_user["sub"],
        expense_date=expense_date or date.today(),
    )
    return entries

@router.delete("/expenses/{expense_id}", dependencies=[require_sales])
async def delete_expense(
    expense_id: uuid.UUID,
    current_user: CurrentUser,
    service: LedgerSvc,
):
    await service.delete_expense(expense_id, current_user["sub"])
    return {"deleted": True}
```

### Backend: Repository Query for Rep Expenses
```python
# In ledger_repository.py
async def get_by_rep_and_direction(
    self, rep_id: uuid.UUID, direction: str, target_date: date
) -> list[CompanyLedger]:
    result = await self._db.execute(
        select(CompanyLedger)
        .where(
            CompanyLedger.rep_id == rep_id,
            CompanyLedger.direction == direction,
            CompanyLedger.date == target_date,
            CompanyLedger.is_deleted.is_(False),
            CompanyLedger.source_transaction_id.is_(None),  # exclude payment-sourced entries
        )
        .order_by(CompanyLedger.created_at.desc())
    )
    return list(result.scalars().all())
```

### Frontend: API Functions
```typescript
// In salesApi.ts or a shared expenseApi
createExpense: (data: {
  amount: number;
  category: string;
  date: string;
  notes?: string;
}) => api.post("/ledger/expenses", data).then(r => r.data),

getMyExpenses: (date: string) =>
  api.get<LedgerEntry[]>(`/ledger/my-expenses?date=${date}`).then(r => r.data),

deleteExpense: (id: string) =>
  api.delete(`/ledger/expenses/${id}`).then(r => r.data),
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate `expenses` table (Phase 10 design) | `company_ledger` with direction='outgoing' | CONTEXT.md decision | Expenses auto-appear in cash report; no separate queries needed |
| Expense approval workflow | Simple confirm/flag via existing ledger status | CONTEXT.md decision | Reuses Phase 11 infrastructure entirely |

**Note on the `expenses` table:** Phase 10 created an `Expense` model and table. Per CONTEXT.md, this table is NOT used for Phase 12. The table exists in the database but expenses go into `company_ledger`. Consider adding a migration to drop the unused table if/when appropriate, but this is out of scope for Phase 12.

## Open Questions

1. **Admin expense entry placement**
   - What we know: Admin needs an "Add Expense" entry point. CONTEXT.md says same card component reused.
   - What's unclear: Where exactly -- in the cash report outgoing section, or on the Admin overview?
   - Recommendation: Place an "Add Expense" button/card at the top of the DailyCashReportView (above the incoming/outgoing sections). This keeps expense management consolidated in the Finance > Cash Report tab.

2. **Should "Other" category require mandatory notes?**
   - What we know: Listed as Claude's discretion.
   - Recommendation: Yes, prompt for notes when "Other" is selected. Makes expense reports more useful. Implement as a simple conditional required field in the dialog.

3. **Filtering by rep/status on admin side (EXP-03)**
   - What we know: The daily cash report already groups by rep and navigates by date. It shows all statuses with visual indicators.
   - What's unclear: Whether explicit dropdown filters (by rep, by status) are needed beyond what the cash report already provides.
   - Recommendation: The existing cash report satisfies EXP-03 -- it's filterable by date (date nav), shows per-rep grouping, and status is visible on each entry. No additional filter UI needed unless the user requests it.

## Sources

### Primary (HIGH confidence)
- Codebase: `backend/app/models/ledger.py` -- CompanyLedger model with all needed columns
- Codebase: `backend/app/services/ledger_service.py` -- create_entry() and update_status() methods
- Codebase: `backend/app/api/endpoints/ledger.py` -- existing GET /daily and PATCH /status endpoints
- Codebase: `backend/app/schemas/ledger.py` -- LedgerEntryOut, LedgerStatusUpdateIn schemas
- Codebase: `frontend/src/components/Admin/DailyCashReportView.tsx` -- outgoing section with swipe actions
- Codebase: `frontend/src/components/Sales/RouteView.tsx` -- current route view structure (950 lines)
- Codebase: `frontend/src/components/ui/swipeable-card.tsx` -- SwipeableCard with rightActions
- Codebase: `frontend/src/components/Admin/FinanceView.tsx` -- tabs for Cash Report + Checks

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions -- all storage and UI decisions locked by user

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all existing
- Architecture: HIGH -- extending existing ledger layer with well-understood patterns
- Pitfalls: HIGH -- derived from direct codebase inspection (NULL rep_id, soft delete, query invalidation)
- UI patterns: HIGH -- reusing existing Card, Dialog, SwipeableCard components

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- no external dependencies or fast-moving APIs)
