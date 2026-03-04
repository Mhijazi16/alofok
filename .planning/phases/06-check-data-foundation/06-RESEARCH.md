# Phase 6: Check Data Foundation — Research

**Researched:** 2026-03-04
**Domain:** Pydantic schema typing, JSONB backward compatibility, combobox UI, TypeScript interface expansion
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHK-01 | User can enter bank number (required for check payments) | New required form field in PaymentFlow.tsx; backend `CheckData.bank_number: str` |
| CHK-02 | User can enter branch number (required for check payments) | New required form field; backend `CheckData.branch_number: str` |
| CHK-03 | User can enter account number (required for check payments) | New required form field; backend `CheckData.account_number: str` |
| CHK-04 | User can enter holder name (optional) | New optional form field; backend `CheckData.holder_name: str \| None = None` |
| CHK-05 | User can select bank name from dropdown of previously used banks or type a new one | BankAutocomplete component; `cmdk@^1.1.1` + Radix Popover; localStorage keyed by user ID |
| CHK-06 | Existing check records (pre-v1.1) load without errors through all read paths | All new CheckData fields must be optional with None defaults; all read paths use `CheckData.model_validate(data or {})` |
| CHK-07 | Backend validates check data via typed CheckData model (not raw dict) | Replace `data: dict \| None` with `data: CheckData \| None` in `PaymentCreate` schema |
</phase_requirements>

---

## Summary

Phase 6 is the foundational data layer for the entire v1.1 milestone. Every subsequent phase (SVG preview in Phase 7, lifecycle management in Phase 8, image capture and OCR in Phase 9) reads check data through the schema being established here. The current baseline has `Transaction.data` as an untyped `dict | None` JSONB column containing only `{bank, due_date, image_url}`. Existing check rows in the database contain exactly this shape — no more. Phase 6 expands the Pydantic schema to a typed `CheckData` model with 7 fields and expands the form to capture the new fields.

The primary technical risk is backward compatibility: every read path that processes `Payment_Check` transactions must handle old rows that lack the new keys. The fix is straightforward — all new `CheckData` fields must have `None` defaults, and all read paths must use `CheckData.model_validate(transaction.data or {})` rather than raw dict access. A one-time Alembic data migration that backfills `None` for new keys on existing rows is strongly recommended so JSONB operator queries (used in the admin overdue check SQL) return consistent results. No Alembic schema migration is needed — the `data` column already exists as `JSONB`.

The UI addition is a `BankAutocomplete` combobox component built with `cmdk@^1.1.1` (the only new dependency for this phase) and the already-installed `@radix-ui/react-popover`. Three numeric text fields (bank number, branch number, account number) and one text field (holder name) are added to the PaymentFlow check tab. The bank autocomplete replaces the plain text input for bank name. Locale keys for all new fields must be added to both `en.json` and `ar.json`.

**Primary recommendation:** Build backend schema first (CheckData model, PaymentCreate update, data migration), then the BankAutocomplete component, then wire all four new fields into PaymentFlow.tsx. Verify every existing read path (StatementView, Admin DebtStats overdue checks, salesApi `returnCheck`) handles old rows before marking the phase done.

---

## Codebase Baseline (Current State)

### What Currently Exists

Direct inspection of the codebase reveals:

**Backend — `backend/app/schemas/transaction.py`:**
```python
class PaymentCreate(BaseModel):
    customer_id: uuid.UUID
    type: TransactionType  # Payment_Cash or Payment_Check
    currency: Currency
    amount: Decimal
    notes: str | None = None
    data: dict | None = None  # {"bank": str, "due_date": str, "image_url": str}
```
`TransactionOut.data` is also typed as `dict | None`. No `CheckData` model exists anywhere in the backend.

**Backend — `backend/app/api/endpoints/payments.py`:**
The `PUT /payments/checks/{transaction_id}/status` endpoint ignores the request body entirely — it always calls `service.return_check()` regardless. The `status` field in the request body is currently unused (Phase 8 will fix this, but Phase 6 does not need to touch this endpoint).

**Backend — `backend/app/services/admin_service.py` (overdue check query):**
```sql
SELECT t.data->>'bank' AS bank, t.data->>'due_date' AS due_date
FROM transactions t
WHERE t.type = 'Payment_Check' AND t.status = 'Pending'
  AND t.data->>'due_date' IS NOT NULL AND t.data->>'due_date' < :today
```
This raw SQL uses `->>'bank'` and `->>'due_date'` directly. New JSONB keys will simply return NULL via `->>'key'` if not present — safe, no code change needed for the query itself, but the `OverdueCheckOut` schema only surfaces `bank` and `due_date`. Phase 6 does not need to expose more fields here.

**Frontend — `frontend/src/services/salesApi.ts`:**
```typescript
export interface PaymentCreate {
  customer_id: string;
  type: "Payment_Cash" | "Payment_Check";
  currency: "ILS" | "USD" | "JOD";
  amount: number;
  notes?: string;
  data?: {
    bank?: string;
    due_date?: string;
    image_url?: string;
  };
}

export interface Transaction {
  // ...
  data: Record<string, unknown> | null;  // completely untyped
}
```

**Frontend — `frontend/src/components/Sales/PaymentFlow.tsx`:**
Check tab currently has exactly 2 fields: bank name (plain `<Input>`) and due date. Form state: `bankName: string` and `dueDate: string`. Payload builds `data: { bank: bankName.trim(), due_date: dueDate || undefined }`.

**Frontend — `frontend/src/components/Sales/StatementView.tsx`:**
Renders `tx.data` in check transactions — currently only `tx.notes` and the check type badge are shown. The `data` field is not rendered at all in the timeline. No null-guard issues today because nothing accesses `data` properties. Adding data display in Phase 6 will need guards for all fields.

**Frontend — `frontend/src/components/Admin/DebtStats.tsx`:**
Overdue checks table renders `check.bank ?? "—"` and `check.due_date ?? "—"` from the `OverdueCheck` interface. Safe — the `??` guards handle nulls. No changes needed in Phase 6.

**Existing locale keys for payment (en.json):**
```json
"payment": {
  "cash": "Cash",
  "check": "Check",
  "amount": "Amount",
  "currency": "Currency",
  "bank": "Bank",
  "dueDate": "Due Date",
  "notes": "Notes",
  "checkImage": "Check Image",
  ...
}
```
Missing keys that Phase 6 must add: `bankNumber`, `branchNumber`, `accountNumber`, `holderName`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Pydantic v2 | Already installed | `CheckData` model with field validation | Project already uses Pydantic v2 throughout; `model_validate()` is the v2 API |
| `@radix-ui/react-popover` | ^1.1.6 (installed) | Popover base for bank autocomplete | Already in package.json; the shadcn Combobox pattern is built on this |
| `cmdk` | ^1.1.1 | Command palette primitive for bank name combobox | Only new dep for Phase 6; the shadcn Combobox docs use `cmdk` as the canonical choice |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `localStorage` (browser built-in) | N/A | Persist recent bank names per user | Small, static list; no backend round-trip needed; scoped by user ID to prevent shared-device leakage |
| `inputMode="numeric"` (HTML attr) | N/A | Numeric keyboard on mobile for bank/branch/account number inputs | Use on number-only fields to avoid full keyboard on mobile |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `cmdk` + Radix Popover | `react-select` | react-select adds 50KB, CSS-in-JS conflicts with Tailwind; cmdk is the shadcn-native choice |
| `cmdk` + Radix Popover | Plain `<datalist>` | datalist has poor styling control and no keyboard navigation; cmdk gives full control |
| localStorage bank history | `GET /payments/banks/used` backend endpoint | Backend query returns all reps' banks (noise), adds network round-trip; localStorage per-device is fine for the personal bank set |

**Installation (only new dep):**
```bash
# From /frontend
bun add cmdk@^1.1.1
```

---

## Architecture Patterns

### Recommended Project Structure (new/modified files)

```
backend/app/
└── schemas/
    └── transaction.py       # MODIFIED — add CheckData model, update PaymentCreate.data type

frontend/src/
├── components/
│   ├── ui/
│   │   └── bank-autocomplete.tsx   # NEW — combobox + localStorage history
│   └── Sales/
│       └── PaymentFlow.tsx         # MODIFIED — 4 new fields + BankAutocomplete
├── services/
│   └── salesApi.ts                 # MODIFIED — expand CheckData interface, Transaction.data type
└── locales/
    ├── en.json                     # MODIFIED — 4 new payment keys
    └── ar.json                     # MODIFIED — 4 new payment keys
```

No new backend service methods, no new endpoints, no Alembic schema migration (JSONB column already exists). One Alembic **data** migration (Python script, not schema change) to backfill `None` values for new keys.

### Pattern 1: JSONB Schema Extension Without Schema Migration

**What:** Replace `data: dict | None` with `data: CheckData | None` in the Pydantic schema. All new fields in `CheckData` have `None` defaults so old rows remain valid.

**When to use:** Adding optional fields to an existing JSONB column. Mandatory new fields would require a real column + migration.

**Example (backend):**
```python
# backend/app/schemas/transaction.py
from pydantic import BaseModel

class CheckData(BaseModel):
    bank: str | None = None           # existing field — kept optional for compat
    bank_number: str | None = None    # NEW — CHK-01
    branch_number: str | None = None  # NEW — CHK-02
    account_number: str | None = None # NEW — CHK-03
    holder_name: str | None = None    # NEW — CHK-04 (optional per requirement)
    due_date: str | None = None       # existing field
    image_url: str | None = None      # existing field

class PaymentCreate(BaseModel):
    customer_id: uuid.UUID
    type: TransactionType
    currency: Currency
    amount: Decimal
    notes: str | None = None
    data: CheckData | None = None     # replaces: data: dict | None = None
```

**Validation note:** The service layer currently checks `if body.type in _CHECK_TYPES and not body.data`. This is still correct — `CheckData` with all `None` fields is falsy in Python only if the object itself is `None`. A `CheckData()` instance with all None fields is truthy. The validation should be updated to check that at minimum `bank_number` is provided when type is `Payment_Check`. See Common Pitfalls section.

**Read path — all read paths must use this pattern:**
```python
# Everywhere TransactionOut.data is accessed for check transactions:
check_data = CheckData.model_validate(transaction.data or {})
# Never: transaction.data["bank_number"]  — KeyError on old rows
# Never: transaction.data.get("bank_number")  — works but bypasses typing
```

**Frontend interface expansion:**
```typescript
// frontend/src/services/salesApi.ts

export interface CheckData {
  bank?: string;           // existing — kept optional
  bank_number?: string;    // NEW — CHK-01
  branch_number?: string;  // NEW — CHK-02
  account_number?: string; // NEW — CHK-03
  holder_name?: string;    // NEW — CHK-04
  due_date?: string;       // existing
  image_url?: string;      // existing
}

export interface PaymentCreate {
  customer_id: string;
  type: "Payment_Cash" | "Payment_Check";
  currency: "ILS" | "USD" | "JOD";
  amount: number;
  notes?: string;
  data?: CheckData;        // was: data?: { bank?: string; due_date?: string; image_url?: string; }
}

export interface Transaction {
  // ...
  data: CheckData | null;  // was: Record<string, unknown> | null — now typed
}
```

### Pattern 2: Bank Name Autocomplete (shadcn Combobox)

**What:** A combobox that combines a Popover and the `Command` component from `cmdk`. On open, shows recently-used bank names filtered by what the user types. Also allows free-text entry of a new bank name.

**When to use:** Short, repetitive personal lists where backend query is overkill. The rep's personal bank set is 5–15 banks max.

**localStorage key pattern — MUST be user-scoped:**
```typescript
// frontend/src/components/ui/bank-autocomplete.tsx
const BANK_STORAGE_KEY = (userId: string) => `alofok_banks_${userId}`;
const MAX_HISTORY = 20;

export function getBankHistory(userId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(BANK_STORAGE_KEY(userId)) ?? "[]");
  } catch {
    return [];
  }
}

export function saveBankToHistory(bank: string, userId: string): void {
  const current = getBankHistory(userId);
  const updated = [bank, ...current.filter((b) => b !== bank)].slice(0, MAX_HISTORY);
  localStorage.setItem(BANK_STORAGE_KEY(userId), JSON.stringify(updated));
}

export function clearBankHistory(userId: string): void {
  localStorage.removeItem(BANK_STORAGE_KEY(userId));
}
```

**cmdk import pattern (shadcn Combobox):**
```typescript
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "cmdk";
import * as Popover from "@radix-ui/react-popover";
```

**Known issue:** When `cmdk` `Command` is nested inside a `Dialog`, the popover z-index needs `z-[100]` to appear above the dialog backdrop. Apply this to the `Popover.Content` wrapper. PaymentFlow does not use a Dialog wrapper currently, but may in future — add the class preemptively.

**Component interface:**
```typescript
interface BankAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  userId: string;  // for localStorage scoping
  placeholder?: string;
}
```

**Logout cleanup:** Call `clearBankHistory(userId)` in the Redux logout action / onLogout handler. Check where logout is handled in the app's auth flow and add this call there.

### Pattern 3: Alembic Data Migration (backfill None for new JSONB keys)

**What:** A Python migration that iterates existing `Payment_Check` rows and merges `{}` with the current JSONB so new key accesses don't trip on missing keys in JSONB operator expressions.

**Why it matters:** PostgreSQL `data->>'bank_number'` returns NULL (not an error) for rows that don't have `bank_number`. The Python `CheckData.model_validate({})` also returns None for all fields. So technically the application layer handles old rows without this migration. However, the migration is recommended to make the data consistent and avoid future confusion.

**Whether to include in Phase 6:** The migration is a low-risk, low-effort safety net. Include it. The data migration approach (using `op.execute()` in Alembic) does not require `autogenerate` because it does not change the schema.

```python
# alembic/versions/XXXX_backfill_check_data_nulls.py
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.execute("""
        UPDATE transactions
        SET data = data || jsonb_build_object(
            'bank_number', NULL,
            'branch_number', NULL,
            'account_number', NULL,
            'holder_name', NULL
        )
        WHERE type = 'Payment_Check'
          AND is_deleted = false
    """)

def downgrade():
    # Remove the new keys from all check rows (safe — they're NULL)
    op.execute("""
        UPDATE transactions
        SET data = data - 'bank_number' - 'branch_number' - 'account_number' - 'holder_name'
        WHERE type = 'Payment_Check'
    """)
```

**Note:** `jsonb_build_object` with `NULL` values and `||` (jsonb concatenation) overwrites existing keys only if the new value is not null — actually, `||` always overwrites. Use `jsonb_build_object` with `COALESCE` to be safe:
```sql
SET data = jsonb_build_object(
    'bank',           data->>'bank',
    'bank_number',    COALESCE(data->>'bank_number', NULL),
    'branch_number',  COALESCE(data->>'branch_number', NULL),
    'account_number', COALESCE(data->>'account_number', NULL),
    'holder_name',    COALESCE(data->>'holder_name', NULL),
    'due_date',       data->>'due_date',
    'image_url',      data->>'image_url'
)
WHERE type = 'Payment_Check' AND is_deleted = false
```

This reconstructs each row's JSONB with all 7 keys present (null for missing). Existing values are preserved.

### Pattern 4: PaymentFlow Form Field Addition

**What:** Add 3 required and 1 optional input fields to the check tab in `PaymentFlow.tsx`. Use `inputMode="numeric"` for number fields to get the numeric keyboard on mobile.

**Form state to add:**
```typescript
const [bankNumber, setBankNumber] = useState("");    // CHK-01
const [branchNumber, setBranchNumber] = useState(""); // CHK-02
const [accountNumber, setAccountNumber] = useState(""); // CHK-03
const [holderName, setHolderName] = useState("");   // CHK-04
// bankName remains but is now powered by BankAutocomplete (CHK-05)
```

**Updated validation:**
```typescript
const isValid =
  parsedAmount > 0 &&
  (paymentType === "Payment_Cash" ||
    (bankName.trim().length > 0 &&
     bankNumber.trim().length > 0 &&
     branchNumber.trim().length > 0 &&
     accountNumber.trim().length > 0));
```

**Updated payload:**
```typescript
...(paymentType === "Payment_Check" && {
  data: {
    bank: bankName.trim(),
    bank_number: bankNumber.trim(),
    branch_number: branchNumber.trim(),
    account_number: accountNumber.trim(),
    holder_name: holderName.trim() || undefined,
    due_date: dueDate || undefined,
  },
}),
```

**After successful submit:** Call `saveBankToHistory(bankName.trim(), userId)` before clearing form.

### Anti-Patterns to Avoid

- **Raw dict access on JSONB data:** Never do `transaction.data["bank_number"]` or `check_data.get("bank_number")` without a default — use `CheckData.model_validate(transaction.data or {})` on the backend and the typed `CheckData` interface on the frontend with optional chaining (`tx.data?.bank_number`).
- **Non-user-scoped localStorage key:** `alofok_banks` (global) vs `alofok_banks_{userId}` — always include user ID to prevent data leakage on shared devices.
- **Unnamed bank field ambiguity:** The current schema has `bank` (free-text bank name). The new fields are `bank_number`, `branch_number`, `account_number`. Keep the existing `bank` field — it is what the autocomplete saves. The three new numeric fields are separate concerns.
- **Making new fields required in CheckData:** If `bank_number: str` (no default) is added to `CheckData`, all existing check rows will fail `model_validate()` and break every read path. ALL new fields must be `| None = None`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Combobox with keyboard navigation, filtering, empty state | Custom `<select>` or `<ul>` with `onKeyDown` handlers | `cmdk` + Radix Popover (shadcn Combobox pattern) | Focus management, ARIA, search filtering, keyboard nav — 200+ edge cases in a combobox; cmdk handles all of them |
| localStorage access with try/catch | Bare `localStorage.getItem()` | Wrap in try/catch (localStorage can throw in private browsing) | Safari private mode throws `SecurityError` on `localStorage` access; always wrap |

**Key insight:** The combobox problem is well-solved by `cmdk`. The localStorage problem is trivial but has a real failure mode in Safari private mode. Both are worth the wrapper overhead.

---

## Common Pitfalls

### Pitfall 1: New CheckData Fields Without None Defaults Breaking Existing Rows

**What goes wrong:** `CheckData` is defined with `bank_number: str` (required, no default). All existing check rows in the DB have `data = {"bank": "X", "due_date": "2024-01-01"}`. `CheckData.model_validate({"bank": "X", "due_date": "2024-01-01"})` raises `ValidationError: bank_number field required`. Every statement load, admin debt stats query, and check return endpoint breaks for historic data.

**Why it happens:** The developer thinks "bank_number is required for new payments" and defines it as required in the model. But the model is also used to parse existing data on read.

**How to avoid:** ALL new fields in `CheckData` must be `str | None = None`. Required-ness for new payments is enforced in the service layer (`if body.type == Payment_Check and not body.data.bank_number: raise HorizonException(400, ...)`), not in the Pydantic model.

**Warning signs:** Any `CheckData` field without a default value. Any `ValidationError` when loading a transaction via GET /customers/{id}/statement.

### Pitfall 2: PaymentCreate Service Validation Not Updated

**What goes wrong:** The service currently checks `if body.type in _CHECK_TYPES and not body.data`. After the change, `body.data` is a `CheckData` object (truthy even when all fields are None) rather than a dict or None. The check `not body.data` stops working — a check payment with `data=CheckData()` (all None) passes validation and creates a transaction with no meaningful data.

**Why it happens:** The conditional `not body.data` worked when `data` was `dict | None` (empty dict is falsy). A Pydantic model instance is always truthy in Python.

**How to avoid:** Update the service validation to check the specific required fields:
```python
if body.type in _CHECK_TYPES:
    if not body.data:
        raise HorizonException(400, "Check payments require data")
    if not body.data.bank_number:
        raise HorizonException(400, "bank_number is required for check payments")
    if not body.data.branch_number:
        raise HorizonException(400, "branch_number is required for check payments")
    if not body.data.account_number:
        raise HorizonException(400, "account_number is required for check payments")
```

### Pitfall 3: StatementView Rendering data.bank_number Without Null Guard

**What goes wrong:** StatementView is updated to display `tx.data?.bank_number` for check entries. A pre-v1.1 check row has `data: { bank: "X", due_date: "2024-01-01" }` — `tx.data.bank_number` is `undefined`. If the code does `tx.data.bank_number.toUpperCase()` or any method call, it throws. More subtle: if the code renders `{tx.data.bank_number}` and the value is `undefined`, React renders nothing — which is acceptable but means the display looks incomplete for old records.

**How to avoid:** Always use optional chaining: `tx.data?.bank_number ?? "—"` for display. The TypeScript interface uses `bank_number?: string` so TypeScript will flag missing null checks.

### Pitfall 4: cmdk z-index Under Dialog Backdrop

**What goes wrong:** If PaymentFlow is ever wrapped in a Dialog (possible future refactor), the BankAutocomplete Popover renders under the Dialog backdrop and is invisible/unclickable.

**How to avoid:** Apply `className="z-[100]"` to the `Popover.Content` wrapper now, preemptively. Cost: zero. Benefit: prevents a hard-to-debug layering issue later.

### Pitfall 5: bank vs bank_number Field Naming Confusion

**What goes wrong:** The existing schema has `bank: str` (free-text bank name like "Bank Hapoalim"). The new requirements add `bank_number` (a numeric code like "12"). These are different things. If a developer conflates them and removes `bank` in favor of `bank_number`, the existing admin overdue checks SQL (`t.data->>'bank'`) breaks and the BankAutocomplete history loses its display value.

**How to avoid:** Keep both fields. `bank` = human-readable bank name (used by autocomplete, displayed in admin). `bank_number` = numeric bank identifier (new field for CHK-01). Both are stored in the same JSONB object.

---

## Code Examples

### CheckData Pydantic Model (backend)

```python
# Source: Direct implementation — no external source needed
# backend/app/schemas/transaction.py

class CheckData(BaseModel):
    bank: str | None = None            # existing: free-text bank name
    bank_number: str | None = None     # CHK-01: numeric bank code
    branch_number: str | None = None   # CHK-02: branch code
    account_number: str | None = None  # CHK-03: account number
    holder_name: str | None = None     # CHK-04: optional holder name
    due_date: str | None = None        # existing: ISO date string
    image_url: str | None = None       # existing: photo URL

class PaymentCreate(BaseModel):
    customer_id: uuid.UUID
    type: TransactionType
    currency: Currency
    amount: Decimal
    notes: str | None = None
    data: CheckData | None = None
```

### Read Path Guard (backend)

```python
# Safe read pattern — handles old rows with missing keys
check_data = CheckData.model_validate(transaction.data or {})
# check_data.bank_number is None for old rows — safe
```

### TypeScript CheckData Interface

```typescript
// frontend/src/services/salesApi.ts
export interface CheckData {
  bank?: string;
  bank_number?: string;
  branch_number?: string;
  account_number?: string;
  holder_name?: string;
  due_date?: string;
  image_url?: string;
}

export interface Transaction {
  id: string;
  customer_id: string;
  type: string;
  currency: string;
  amount: number;
  status: string | null;
  notes: string | null;
  data: CheckData | null;  // was: Record<string, unknown> | null
  created_at: string;
  related_transaction_id: string | null;
  delivery_date: string | null;
}
```

### BankAutocomplete localStorage Pattern

```typescript
// frontend/src/components/ui/bank-autocomplete.tsx
const BANK_STORAGE_KEY = (userId: string) => `alofok_banks_${userId}`;
const MAX_HISTORY = 20;

export function getBankHistory(userId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(BANK_STORAGE_KEY(userId)) ?? "[]");
  } catch {
    return [];
  }
}

export function saveBankToHistory(bank: string, userId: string): void {
  const current = getBankHistory(userId);
  const deduped = [bank, ...current.filter((b) => b !== bank)].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(BANK_STORAGE_KEY(userId), JSON.stringify(deduped));
  } catch {
    // localStorage full or private mode — fail silently
  }
}
```

### New Locale Keys to Add

```json
// en.json additions under "payment":
"bankNumber": "Bank Number",
"branchNumber": "Branch Number",
"accountNumber": "Account Number",
"holderName": "Holder Name"
```

```json
// ar.json additions under "payment":
"bankNumber": "رقم البنك",
"branchNumber": "رقم الفرع",
"accountNumber": "رقم الحساب",
"holderName": "اسم صاحب الشيك"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `data: dict \| None` (untyped JSONB) | `data: CheckData \| None` (typed Pydantic model) | Phase 6 | All read/write paths get validation and IDE completion |
| Plain `<Input>` for bank name | `BankAutocomplete` combobox with history | Phase 6 | Reduces data entry time for repeat banks |
| 2-field check form (bank + date) | 6-field check form (bank name, bank number, branch, account, holder, date) | Phase 6 | Captures complete check data needed for reconciliation |

**No deprecated approaches in this phase.** The changes are additive.

---

## Open Questions

1. **Where is the userId available in PaymentFlow.tsx?**
   - What we know: Redux store holds auth state (`src/store/`). The `current_user` is in the store somewhere.
   - What's unclear: The exact selector/hook to get the logged-in user ID in a component.
   - Recommendation: Before implementing BankAutocomplete, grep for how other components access the logged-in user ID. Likely `useSelector((state) => state.auth.user.id)` or similar.

2. **Where is logout handled (for bank history cleanup)?**
   - What we know: There is Redux Toolkit auth state. Logout likely dispatches a Redux action.
   - What's unclear: The specific logout action file/location to add `clearBankHistory(userId)`.
   - Recommendation: Find the logout flow before implementing the component. The cleanup is a one-liner but must be in the right place.

3. **Should `bank_number` be typed as `string` or `number` in the schema?**
   - What we know: Bank numbers in Israel/Palestine/Jordan are numeric codes (e.g., "12" for Bank Hapoalim). But they have leading zeros in some cases and are used as identifiers, not for arithmetic.
   - Recommendation: Keep as `str` / `string`. Avoids leading-zero stripping and is consistent with how account numbers work. Use `inputMode="numeric"` on the form field to get the numeric keyboard on mobile.

4. **Does `TransactionOut.data` also need to be typed as `CheckData | None`?**
   - What we know: `TransactionOut` currently has `data: dict | None`. The response serialization uses `model_validate` which will serialize the JSONB dict as-is.
   - Recommendation: Update `TransactionOut.data` to `CheckData | None` on the backend too. This validates outgoing data and makes the API contract explicit. Pydantic v2 serializes `CheckData` correctly to JSON.

---

## Validation Architecture

The `.planning/config.json` does not have `workflow.nyquist_validation` set (key absent). Skipping automated test infrastructure section per instructions — validation is manual for this project.

**Manual verification checklist for Phase 6:**

- [ ] POST a new check payment with all 6 fields — verify all fields stored in DB JSONB
- [ ] GET statement for a customer with a pre-v1.1 check row (only `{bank, due_date}` in data) — verify no 500 error or validation exception
- [ ] GET admin debt stats — verify overdue checks table still loads correctly
- [ ] PUT `/payments/checks/{id}/status` (return check) — verify still works with new schema
- [ ] In the UI: enter all 4 new fields and submit — verify correct payload in network tab
- [ ] In the UI: open BankAutocomplete — verify recently-used bank names appear
- [ ] Switch app language to Arabic — verify all 4 new field labels show Arabic translations
- [ ] Log in as User A, enter a bank name. Log out. Log in as User B — verify User B's autocomplete is empty

---

## Sources

### Primary (HIGH confidence)

- Direct codebase analysis: `backend/app/schemas/transaction.py` — confirmed `data: dict | None`, no CheckData model
- Direct codebase analysis: `backend/app/services/payment_service.py` — confirmed validation gap with Pydantic model truthiness
- Direct codebase analysis: `backend/app/api/endpoints/payments.py` — confirmed current endpoint structure
- Direct codebase analysis: `frontend/src/components/Sales/PaymentFlow.tsx` — confirmed 2-field check form
- Direct codebase analysis: `frontend/src/services/salesApi.ts` — confirmed `data: Record<string, unknown> | null`
- Direct codebase analysis: `frontend/src/components/Sales/StatementView.tsx` — confirmed no data rendering in check entries
- Direct codebase analysis: `frontend/src/components/Admin/DebtStats.tsx` — confirmed `check.bank ?? "—"` pattern (safe)
- Direct codebase analysis: `frontend/src/locales/en.json` — confirmed existing payment keys, missing 4 new keys
- [npmjs.com/package/cmdk](https://www.npmjs.com/package/cmdk) — v1.1.1 is current stable (from STACK.md)
- [shadcn/ui Combobox docs](https://ui.shadcn.com/docs/components/combobox) — Popover + Command composition pattern (from STACK.md)

### Secondary (MEDIUM confidence)

- [cmdk shadcn bug #2963](https://github.com/shadcn-ui/ui/issues/2963) — Dialog z-index conflict, mitigation via `z-[100]` (from STACK.md)
- Pitfalls research (PITFALLS.md, Pitfall 7) — localStorage scoping by user ID for bank autocomplete

### Tertiary (LOW confidence)

- None for Phase 6. All claims are based on direct code inspection or verified library documentation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `cmdk@^1.1.1` confirmed stable; Radix Popover already installed; Pydantic v2 already in use
- Architecture: HIGH — derived from direct inspection of 8 actual source files; no assumptions
- Pitfalls: HIGH — 4 of 5 pitfalls confirmed by direct code inspection; 1 (z-index) from verified GitHub issue

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable stack, no fast-moving dependencies in this phase)
