# Architecture Research

**Domain:** Check Enhancement Integration — wholesale trading app (Alofok v1.1)
**Researched:** 2026-03-04
**Confidence:** HIGH (based on direct codebase analysis + verified web sources)

---

## Existing Architecture Baseline

Before describing new integration points, this is the current state of the relevant stack:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (React + Vite)                     │
├──────────────────┬──────────────────────┬───────────────────────┤
│  Sales/          │  Sales/              │  Sales/               │
│  PaymentFlow.tsx │  StatementView.tsx   │  CustomerDashboard    │
│  (Check tab:     │  (Renders tx.data    │  (returnCheck()       │
│   bank + date    │   but not check      │   → only transition   │
│   only)          │   detail fields)     │   is Returned)        │
├──────────────────┴──────────────────────┴───────────────────────┤
│  salesApi.ts  →  PaymentCreate.data = { bank?, due_date?,       │
│                  image_url? }  (flat dict, weakly typed)         │
├─────────────────────────────────────────────────────────────────┤
│  IndexedDB syncQueue  →  persists payment payload as-is         │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP / Bearer JWT
┌────────────────────────▼────────────────────────────────────────┐
│                    Backend (FastAPI + async SA)                   │
├─────────────────────────────────────────────────────────────────┤
│  POST /payments  →  PaymentService.create_payment()             │
│  PUT  /payments/checks/{id}/status  →  return_check() only      │
│                                        (no deposit/clear paths)  │
├─────────────────────────────────────────────────────────────────┤
│  Transaction.data (JSONB)  →  { bank, due_date, image_url }     │
│  Transaction.status  →  Pending | Deposited | Returned | Cleared │
│  (enum exists; only Returned path implemented)                   │
├─────────────────────────────────────────────────────────────────┤
│  /static/avatars/  →  aiofiles write, StaticFiles mount         │
│  (avatar upload pattern; no check-image upload endpoint yet)     │
└─────────────────────────────────────────────────────────────────┘
```

**Current gaps:**
- `Transaction.data` holds only `{bank, due_date, image_url}` — bank/branch/account/holder fields missing
- Status transitions Deposited and Cleared exist in the enum but have no endpoint or service logic
- No check image upload endpoint (avatar upload exists as the template)
- No OCR endpoint
- PaymentFlow check tab has only 2 fields; no SVG preview, no camera capture, no lifecycle UI
- StatementView shows check transactions but does not render check detail fields from `data`
- Admin overdue checks query uses `t.data->>'bank'` only — extended fields need same pattern

---

## System Overview: Post-Enhancement Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Frontend (React + Vite)                        │
├───────────────────────┬─────────────────────┬───────────────────────┤
│  Sales/PaymentFlow    │  Sales/CheckLifecycle│  Admin/ChecksPanel   │
│  (MODIFIED — extends  │  (NEW — status UI    │  (NEW — deposit/clear │
│   check tab with      │   for existing       │   actions on overdue  │
│   5 new fields +      │   checks in          │   check list)         │
│   SVG preview +       │   StatementView or   │                       │
│   camera/OCR)         │   standalone)        │                       │
├───────────────────────┴─────────────────────┴───────────────────────┤
│  ui/CheckPreview.tsx (NEW — pure presentational SVG component)       │
│  ui/BankAutocomplete.tsx (NEW — combobox with localStorage history)  │
│  hooks/useCheckOCR.ts (NEW — image → OCR → field fill)              │
├─────────────────────────────────────────────────────────────────────┤
│  salesApi.ts (MODIFIED — expanded PaymentCreate.data type,          │
│               new updateCheckStatus(), new uploadCheckImage())       │
│  adminApi.ts (MODIFIED — new check lifecycle actions)               │
├─────────────────────────────────────────────────────────────────────┤
│  IndexedDB syncQueue (UNCHANGED — payload passthrough)              │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP / Bearer JWT
┌────────────────────────────▼────────────────────────────────────────┐
│                     Backend (FastAPI + async SA)                      │
├─────────────────────────────────────────────────────────────────────┤
│  POST /payments           (UNCHANGED — now accepts extended data)    │
│  POST /payments/checks/upload-image  (NEW — returns image_url)      │
│  POST /payments/checks/ocr           (NEW — returns extracted fields)│
│  PUT  /payments/checks/{id}/status   (MODIFIED — all transitions)   │
├─────────────────────────────────────────────────────────────────────┤
│  PaymentService (MODIFIED)                                           │
│    create_payment() — validation updated for extended data           │
│    return_check()  — unchanged                                       │
│    update_check_status() — NEW method, Deposited + Cleared paths     │
├─────────────────────────────────────────────────────────────────────┤
│  Transaction.data (JSONB) — schema expands in-place (no migration): │
│  { bank, branch_number?, account_number?, holder_name?,             │
│    due_date?, image_url? }                                           │
│  (JSONB schema changes need NO Alembic migration)                    │
├─────────────────────────────────────────────────────────────────────┤
│  /static/checks/{uuid}.jpg  (NEW upload dir, same static mount)     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### New Components

| Component | File | Responsibility | Notes |
|-----------|------|----------------|-------|
| CheckPreview | `ui/CheckPreview.tsx` | Pure SVG check render, LTR layout, updates live as user types | Props-driven, no state, reusable |
| BankAutocomplete | `ui/BankAutocomplete.tsx` | Combobox with recent bank names from localStorage | localStorage key: `alofok_banks_history`, max 20 entries |
| useCheckOCR | `hooks/useCheckOCR.ts` | Camera/file → backend OCR → return field map | Returns `{bank?, account?, holder?}` |
| CheckLifecycleActions | inline in relevant view | Status transition buttons (Deposit / Clear / Return) based on current status | NOT a standalone component — embed in StatementView or Admin checks panel |

### Modified Components

| Component | File | What Changes |
|-----------|------|--------------|
| PaymentFlow | `Sales/PaymentFlow.tsx` | Check tab adds 4 fields + BankAutocomplete + CheckPreview + camera/OCR trigger |
| StatementView | `Sales/StatementView.tsx` | Check transactions gain expanded data display + lifecycle action buttons |
| salesApi.ts | `services/salesApi.ts` | `PaymentCreate.data` type expanded; add `updateCheckStatus()`, `uploadCheckImage()`, `ocrCheckImage()` |
| adminApi.ts | `services/adminApi.ts` | Add `updateCheckStatus()` for Admin check panel |
| en.json / ar.json | `locales/` | New keys for all new fields and actions |

### Modified Backend

| File | What Changes |
|------|--------------|
| `schemas/transaction.py` | `PaymentCreate.data` typed more strictly (optional CheckData model) |
| `services/payment_service.py` | `update_check_status()` method for Deposited/Cleared transitions |
| `api/endpoints/payments.py` | New upload-image route, OCR route, status update route expansion |

---

## Recommended Project Structure (new files only)

```
frontend/src/
├── components/
│   ├── ui/
│   │   ├── CheckPreview.tsx        # SVG check preview (LTR, pure)
│   │   └── BankAutocomplete.tsx    # Combobox + localStorage history
│   └── Sales/
│       └── PaymentFlow.tsx         # MODIFIED — extended check tab
├── hooks/
│   └── useCheckOCR.ts              # Image → OCR → field map hook
└── services/
    └── salesApi.ts                 # MODIFIED — new types + endpoints

backend/app/
├── api/endpoints/
│   └── payments.py                 # MODIFIED — image upload + OCR + status routes
└── services/
    └── payment_service.py          # MODIFIED — update_check_status()
```

No new top-level directories. No Alembic migration needed for JSONB expansion.

---

## Architectural Patterns

### Pattern 1: JSONB Schema Extension Without Migration

**What:** Add new fields to `Transaction.data` JSONB by expanding the Pydantic schema on both read and write paths. Existing rows with partial data continue to work because unset keys return `None`.

**When to use:** Adding optional fields to an already-JSONB column. Mandatory fields would require a real column + migration instead.

**Trade-offs:** No migration needed, no downtime. Downside is no DB-level constraint on structure — application layer must validate.

**Example (backend schema):**
```python
class CheckData(BaseModel):
    bank: str
    branch_number: str | None = None
    account_number: str | None = None
    holder_name: str | None = None
    due_date: str | None = None       # ISO date string
    image_url: str | None = None

class PaymentCreate(BaseModel):
    customer_id: uuid.UUID
    type: TransactionType
    currency: Currency
    amount: Decimal
    notes: str | None = None
    data: CheckData | None = None     # replaces dict | None
```

Existing rows with `{"bank": "X", "due_date": "2024-01-01"}` still validate against `CheckData` because all new fields are optional.

**Example (frontend type):**
```typescript
export interface CheckData {
  bank: string;
  branch_number?: string;
  account_number?: string;
  holder_name?: string;
  due_date?: string;
  image_url?: string;
}

export interface PaymentCreate {
  customer_id: string;
  type: "Payment_Cash" | "Payment_Check";
  currency: "ILS" | "USD" | "JOD";
  amount: number;
  notes?: string;
  data?: CheckData;
}
```

---

### Pattern 2: Inline React SVG Check Preview

**What:** A pure React component that renders an SVG check using `<svg>` JSX directly. Fields are placed via SVG `<text>` elements at fixed coordinates matching a real check layout. LTR direction enforced via `direction="ltr"` on the SVG root.

**When to use:** Live preview that updates as the user types (no round-trip, no image loading). Avoids external dependencies.

**Trade-offs:** SVG positioning is fiddly — coordinates need careful calibration. But zero bundle overhead vs any external library.

**Example:**
```tsx
// components/ui/CheckPreview.tsx
interface CheckPreviewProps {
  bank: string;
  holderName: string;
  accountNumber?: string;
  branchNumber?: string;
  amount: string;
  dueDate: string;
}

export function CheckPreview({ bank, holderName, accountNumber, branchNumber, amount, dueDate }: CheckPreviewProps) {
  return (
    <svg
      viewBox="0 0 520 200"
      xmlns="http://www.w3.org/2000/svg"
      direction="ltr"
      className="w-full rounded-xl border border-border bg-white font-mono text-black"
    >
      {/* Check background */}
      <rect width="520" height="200" fill="#fafafa" rx="8" />
      {/* Bank name */}
      <text x="24" y="36" fontSize="14" fontWeight="bold" fill="#111">{bank || "Bank Name"}</text>
      {/* Date line */}
      <text x="380" y="36" fontSize="11" fill="#555">Date:</text>
      <text x="420" y="36" fontSize="11" fill="#111">{dueDate || "__/__/____"}</text>
      {/* Pay to line */}
      <text x="24" y="80" fontSize="11" fill="#555">Pay to the order of:</text>
      <line x1="160" y1="82" x2="496" y2="82" stroke="#ccc" strokeWidth="0.5" />
      <text x="164" y="80" fontSize="13" fill="#111">{holderName || ""}</text>
      {/* Amount box */}
      <rect x="390" y="88" width="106" height="24" fill="#fff" stroke="#ccc" strokeWidth="0.8" rx="2" />
      <text x="494" y="105" fontSize="14" fontWeight="bold" fill="#111" textAnchor="end">{amount || "0.00"}</text>
      {/* Branch / Account */}
      <text x="24" y="160" fontSize="10" fill="#555" fontFamily="monospace">
        {branchNumber ? `Branch: ${branchNumber}` : ""}
        {accountNumber ? `  Acct: ${accountNumber}` : ""}
      </text>
      {/* MICR line */}
      <text x="24" y="185" fontSize="9" fill="#888" fontFamily="monospace">
        ⑆{branchNumber || "000000"}⑆  {accountNumber || "000000000000"}
      </text>
    </svg>
  );
}
```

---

### Pattern 3: Check Status State Machine (Backend)

**What:** Explicit allowed transitions enforced in the service layer. Current status → allowed next statuses. Violations raise `HorizonException(409)`.

**When to use:** Any lifecycle with invalid transition prevention.

**Trade-offs:** Simple to implement. Does not block concurrent updates (no optimistic locking). Acceptable given single-operator use case.

**Example:**
```python
_ALLOWED_TRANSITIONS: dict[TransactionStatus, set[TransactionStatus]] = {
    TransactionStatus.Pending:    {TransactionStatus.Deposited, TransactionStatus.Returned},
    TransactionStatus.Deposited:  {TransactionStatus.Cleared, TransactionStatus.Returned},
    TransactionStatus.Returned:   set(),   # terminal
    TransactionStatus.Cleared:    set(),   # terminal
}

async def update_check_status(
    self, transaction_id: uuid.UUID, new_status: TransactionStatus, creator_id: uuid.UUID
) -> TransactionOut:
    check_txn = await self._transactions.get_by_id(transaction_id)
    if check_txn is None or check_txn.type != TransactionType.Payment_Check:
        raise HorizonException(404, "Check transaction not found")

    allowed = _ALLOWED_TRANSITIONS.get(check_txn.status, set())
    if new_status not in allowed:
        raise HorizonException(409, f"Cannot transition from {check_txn.status} to {new_status}")

    if new_status == TransactionStatus.Returned:
        # Re-use existing return_check() which creates Check_Return transaction
        return await self.return_check(transaction_id, creator_id)

    check_txn.status = new_status
    await self._transactions.update(check_txn)
    return TransactionOut.model_validate(check_txn)
```

**Endpoint pattern:**
```python
# MODIFIED: payments.py
class CheckStatusUpdate(BaseModel):
    status: TransactionStatus  # Deposited | Cleared | Returned

@router.put("/checks/{transaction_id}/status", response_model=TransactionOut)
async def update_check_status(
    transaction_id: uuid.UUID,
    body: CheckStatusUpdate,
    current_user: CurrentUser,
    service: PaymentSvc,
) -> TransactionOut:
    return await service.update_check_status(
        transaction_id, body.status, uuid.UUID(current_user["sub"])
    )
```

The existing `return_check()` endpoint becomes redundant — the new generic route handles all transitions including Returned.

---

### Pattern 4: Check Image Upload (Reuse Avatar Upload Pattern)

**What:** New FastAPI endpoint under `/payments/checks/upload-image` using the same `aiofiles` pattern as `/customers/upload-avatar`. Returns `{"url": "/static/checks/{uuid}.jpg"}`. Frontend then includes this URL in the `data.image_url` field of `PaymentCreate`.

**When to use:** Whenever an image needs to be captured before form submission.

**Trade-offs:** Two-step flow (upload first, then submit payment) is necessary to get the `image_url` before the transaction is created. Alternative (submit together as multipart) would require restructuring the payment creation endpoint significantly — not worth it.

**Backend:**
```python
@router.post("/checks/upload-image", response_model=dict, dependencies=[require_sales])
async def upload_check_image(file: UploadFile):
    ext = Path(file.filename).suffix or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    path = Path("static/checks") / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(path, "wb") as f:
        await f.write(await file.read())
    return {"url": f"/static/checks/{filename}"}
```

**Frontend capture pattern (HTML input with camera):**
```tsx
<input
  type="file"
  accept="image/*"
  capture="environment"   // rear camera on mobile; ignored on desktop
  onChange={handleCameraCapture}
  className="hidden"
  ref={cameraInputRef}
/>
<Button onClick={() => cameraInputRef.current?.click()}>
  {t("payment.captureCheck")}
</Button>
```

No additional library needed. `capture="environment"` opens the rear camera on Android/iOS. On desktop it falls back to a standard file picker. Confidence: HIGH — MDN confirms this behavior as of July 2025.

---

### Pattern 5: Server-Side OCR Endpoint

**What:** Backend endpoint that accepts an image upload, runs pytesseract against it, and returns extracted field candidates. Frontend applies the results to form fields (user can override). OCR runs on the server to avoid shipping the ~20MB Tesseract WASM bundle to mobile clients.

**When to use:** Check photos contain printed text (bank name, account, holder). OCR accuracy varies; results are always suggestions, not authoritative.

**Trade-offs:** Server-side OCR requires `pytesseract` + Tesseract system binary in the Docker image (+~50MB image size). Tesseract.js browser-side would avoid server changes but adds ~20MB to initial JS bundle — unacceptable for offline-first mobile UX.

**Example:**
```python
# In payments.py
@router.post("/checks/ocr", response_model=dict, dependencies=[require_sales])
async def ocr_check_image(file: UploadFile):
    import pytesseract
    from PIL import Image
    import io
    content = await file.read()
    img = Image.open(io.BytesIO(content))
    text = pytesseract.image_to_string(img, lang="ara+eng")
    # Return raw text; frontend parses into fields
    return {"raw_text": text}
```

**Frontend hook:**
```typescript
// hooks/useCheckOCR.ts
export function useCheckOCR() {
  const ocrMutation = useMutation({
    mutationFn: (file: File) => salesApi.ocrCheckImage(file),
  });

  const extractFields = (rawText: string) => {
    // Heuristic: find sequences that look like account numbers (digits), etc.
    // Return partial match; user fills the rest
    return { raw: rawText };
  };

  return { run: ocrMutation.mutateAsync, extractFields, isPending: ocrMutation.isPending };
}
```

OCR accuracy on check photos will be imperfect — the UX must make clear results are suggestions. Auto-fill then let user correct.

---

### Pattern 6: Bank Name Autocomplete with localStorage History

**What:** A combobox component that shows a dropdown of recently-used bank names. On each payment submission, the bank name is saved to `localStorage` (key: `alofok_banks_history`, max 20 items, deduped). No backend endpoint required.

**When to use:** The set of banks a given sales rep encounters is small and repetitive. localStorage is sufficient; no need to query the server.

**Trade-offs:** Per-device history (not shared across reps). Acceptable — each rep's bank set is personal. If cross-device history is needed later, a `GET /payments/checks/banks` endpoint returning distinct bank values from `Transaction.data->>'bank'` is straightforward to add via PostgreSQL JSONB extraction.

**Component pattern:**
```typescript
// components/ui/BankAutocomplete.tsx
const STORAGE_KEY = "alofok_banks_history";
const MAX_HISTORY = 20;

export function saveBankToHistory(bank: string) {
  const current: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  const updated = [bank, ...current.filter((b) => b !== bank)].slice(0, MAX_HISTORY);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function getBankHistory(): string[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
}
```

Call `saveBankToHistory(bankName)` in `PaymentFlow.handleSubmit()` before mutation fires.

---

## Data Flow

### Flow 1: New Check Payment with Image + OCR

```
User taps "Capture Check Photo"
    ↓
<input capture="environment"> opens camera (mobile) / file picker (desktop)
    ↓
handleCameraCapture(file)
    ├─→ salesApi.uploadCheckImage(file)  →  POST /payments/checks/upload-image
    │       ↓ returns { url: "/static/checks/uuid.jpg" }
    │       ↓ store imageUrl in local state
    └─→ salesApi.ocrCheckImage(file)     →  POST /payments/checks/ocr
            ↓ returns { raw_text: "..." }
            ↓ extractFields() → auto-fill bank, account, holder in form
            ↓ user verifies / corrects fields
            ↓ CheckPreview SVG updates live from form state
User taps Confirm
    ↓
handleSubmit():
  payload = { ..., data: { bank, branch_number, account_number, holder_name, due_date, image_url } }
  saveBankToHistory(bank)
  isOnline ? paymentMutation.mutate(payload) : syncQueue.push("payment", payload)
    ↓
POST /payments  →  PaymentService.create_payment()
    ↓
Transaction.data JSONB = { bank, branch_number?, account_number?, holder_name?, due_date?, image_url? }
Transaction.status = Pending
```

### Flow 2: Check Lifecycle Transition (Admin or Sales)

```
Admin/Sales opens check list or StatementView
    ↓
Check card shows current status badge (Pending/Deposited)
Deposit button visible if status = Pending
Clear button visible if status = Deposited
Return button visible if status = Pending | Deposited
    ↓
User taps "Mark Deposited"
    ↓
salesApi.updateCheckStatus(checkId, "Deposited")
    →  PUT /payments/checks/{id}/status  { status: "Deposited" }
    →  PaymentService.update_check_status()
    →  validates transition (Pending → Deposited allowed)
    →  txn.status = Deposited; commit
    ↓
React Query invalidates:  ["statement", customerId]  +  ["admin-debt-stats"]
    ↓
UI re-renders with updated badge
```

### Flow 3: Offline Check Payment (No Image/OCR)

```
User fills check form fields manually (offline — no camera capture)
    ↓
handleSubmit() → isOnline = false
    ↓
syncQueue.push("payment", payload)  →  IndexedDB
    ↓
connectivity resumes → useOfflineSync drains queue
    ↓
salesApi.createPayment(payload)  →  POST /payments
    ↓ (same as online flow from here)
```

Note: Check image upload and OCR require network — these features degrade gracefully when offline. The form fields remain fully manual-enterable. Image capture is disabled with a tooltip when offline.

---

## Integration Points

### Backend Integration Points

| Point | Type | What Changes |
|-------|------|--------------|
| `POST /payments` | MODIFIED | `PaymentCreate.data` accepts `CheckData` model with 6 fields; validation updated to require only `bank` as mandatory for checks |
| `PUT /payments/checks/{id}/status` | MODIFIED | Now accepts any valid `TransactionStatus` (not just Returned); service routes Returned through existing `return_check()` |
| `POST /payments/checks/upload-image` | NEW | `UploadFile` → writes to `static/checks/`, returns URL; same auth as payments |
| `POST /payments/checks/ocr` | NEW | `UploadFile` → pytesseract → returns `{raw_text}` |
| `app/schemas/transaction.py` | MODIFIED | Add `CheckData` Pydantic model; replace `data: dict | None` with `data: CheckData | None` in `PaymentCreate` |
| `PaymentService.update_check_status()` | NEW METHOD | Handles Deposited and Cleared transitions; delegates Returned to existing `return_check()` |
| `Dockerfile` | MODIFIED | Add `tesseract-ocr` + `python-pytesseract` + `Pillow` to image |
| Admin overdue query in `admin_service.py` | REVIEW | Raw SQL extracts `t.data->>'bank'` — will continue to work; optionally extend to surface new fields |

### Frontend Integration Points

| Point | Type | What Changes |
|-------|------|--------------|
| `Sales/PaymentFlow.tsx` — check tab | MODIFIED | Add: branch_number, account_number, holder_name fields; BankAutocomplete; camera button; OCR trigger; CheckPreview render |
| `services/salesApi.ts` | MODIFIED | Expand `PaymentCreate.data` type; add `uploadCheckImage()`, `ocrCheckImage()`, `updateCheckStatus()` |
| `services/adminApi.ts` | MODIFIED | Add `updateCheckStatus()` for Admin check management |
| `Sales/StatementView.tsx` | MODIFIED | Check transaction rows render expanded data fields; add status transition buttons for Pending/Deposited checks |
| `ui/CheckPreview.tsx` | NEW | Inline SVG component; props-only, no side effects |
| `ui/BankAutocomplete.tsx` | NEW | Combobox + localStorage history; uses existing `Input` + `dropdown-menu` patterns |
| `hooks/useCheckOCR.ts` | NEW | Wraps OCR mutation, handles loading state, returns field candidates |
| `locales/en.json` + `ar.json` | MODIFIED | New keys: `payment.branchNumber`, `payment.accountNumber`, `payment.holderName`, `payment.captureCheck`, `payment.ocrAutoFill`, `payment.checkPreview`, `payment.checkStatus.*`, `actions.deposit`, `actions.clear` |

---

## Build Order (Dependency-First)

This order ensures each phase can be tested without waiting for later phases:

**1. Backend: JSONB schema expansion + status transitions** (no frontend dependency)
- Update `CheckData` Pydantic model in `schemas/transaction.py`
- Update `PaymentService.update_check_status()` with state machine
- Modify `PUT /payments/checks/{id}/status` to use new service method
- Test: POST check with extended data; PUT status through all transitions
- No Alembic migration needed

**2. Backend: Image upload + OCR endpoints** (depends on #1 for context; independent of frontend)
- Add `POST /payments/checks/upload-image` (copy avatar upload pattern)
- Add pytesseract + Pillow to Docker image
- Add `POST /payments/checks/ocr`
- Test: Upload image, verify URL in static; upload image, verify raw_text returned

**3. Frontend: API types + service layer** (depends on #1, #2 complete)
- Update `PaymentCreate.data` type in `salesApi.ts`
- Add `uploadCheckImage()`, `ocrCheckImage()`, `updateCheckStatus()` to `salesApi.ts`
- Update `adminApi.ts` with check status action
- Update locale files (en.json + ar.json) with all new keys

**4. Frontend: CheckPreview SVG component** (no backend dependency; pure UI)
- Build `ui/CheckPreview.tsx` as pure presentational component
- Use Storybook-style isolation: render with dummy props to calibrate coordinates
- This can be built in parallel with step 3

**5. Frontend: BankAutocomplete component** (no backend dependency; localStorage only)
- Build `ui/BankAutocomplete.tsx`
- Can be built in parallel with steps 3 and 4

**6. Frontend: PaymentFlow enhancement** (depends on #3, #4, #5)
- Extend check tab with 4 new fields
- Integrate BankAutocomplete for bank field
- Add CheckPreview below the form fields
- Add camera capture button (`<input capture="environment">`)
- Wire useCheckOCR hook: image → OCR → auto-fill

**7. Frontend: Check lifecycle UI in StatementView** (depends on #3)
- Render expanded `data` fields on check transaction cards
- Add Deposit/Clear/Return action buttons conditional on status
- React Query invalidation on success

**8. Admin check management** (depends on #3, #7)
- Admin panel check list with lifecycle actions (Deposit/Clear/Return)
- Extends existing overdue check list in Overview.tsx

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Bank History in the Database

**What people do:** Create a `GET /payments/checks/banks` endpoint that queries `SELECT DISTINCT data->>'bank' FROM transactions` to power the autocomplete.

**Why it's wrong:** Adds a network round-trip and a new endpoint for something that can be solved with localStorage. The rep's personal bank history (5-15 banks) fits easily in localStorage. A database query returns all reps' banks — creating noise rather than relevance.

**Do this instead:** localStorage with per-device history capped at 20 entries. If cross-device sync is needed in a future milestone, the PostgreSQL JSONB distinct-query endpoint is a 10-line addition at that point.

---

### Anti-Pattern 2: Client-Side Tesseract.js for OCR

**What people do:** Import `tesseract.js` in the frontend and run OCR in the browser to avoid a new backend endpoint.

**Why it's wrong:** Tesseract.js loads a ~20MB WebAssembly bundle. On mobile networks, this is a 30-60 second first-load penalty. The app is offline-first and targets field sales reps on mobile — the bundle cost is unacceptable. Browser-side OCR also has lower accuracy on Arabic text vs server-side Tesseract with `lang="ara"`.

**Do this instead:** Server-side pytesseract endpoint. Adds ~50MB to the Docker image (one-time build cost, not per-request). OCR only triggers when online — clearly communicated in the UI.

---

### Anti-Pattern 3: Multipart Check Submission (Image + Payment in One Request)

**What people do:** Restructure `POST /payments` to accept `multipart/form-data` so image and payment data submit together in one request.

**Why it's wrong:** Requires restructuring the payment creation endpoint, breaking the existing `PaymentCreate` JSON schema that the offline sync queue serializes. The sync queue stores plain JSON — binary image data cannot be queued in IndexedDB without complex Blob serialization.

**Do this instead:** Two-step: upload image first (online-only action), get `image_url`, include in payment payload. If offline, disable image capture and require manual field entry. Keep the payment endpoint as JSON.

---

### Anti-Pattern 4: Check Status Transitions Without State Machine Validation

**What people do:** Accept any status value in the update endpoint and write it directly to the database without checking current state.

**Why it's wrong:** Allows impossible transitions (Cleared → Pending). Creates data integrity bugs that are hard to detect and corrects. The `TransactionStatus` enum already has the right values — the missing piece is the transition table.

**Do this instead:** Explicit `_ALLOWED_TRANSITIONS` dict in the service layer. Raises `409 Conflict` for invalid transitions. Terminal states (Returned, Cleared) have empty allowed sets.

---

### Anti-Pattern 5: RTL Check Preview

**What people do:** Render the SVG check preview in RTL because the app is Arabic-first.

**Why it's wrong:** Bank checks are a globally standardized LTR document format regardless of the surrounding UI language. An RTL check preview would be unrecognizable as a check and confuse users. PROJECT.md explicitly calls out "LTR check layout — standard check format, universal numerals."

**Do this instead:** `direction="ltr"` on the SVG root. `unicode-bidi="embed"` on text elements if needed. The surrounding UI stays RTL; the check card is isolated.

---

## Scaling Considerations

This milestone adds no architectural changes that affect scale. The check domain is low-volume (tens per day per rep). The main concern is practical:

| Concern | Current Scale | Consideration |
|---------|---------------|---------------|
| Static check images | Per rep: ~5/day | `/static/checks/` dir grows indefinitely — add periodic cleanup or S3 migration in a future milestone |
| OCR endpoint load | Sporadic, not cached | Synchronous pytesseract is fine at this scale; async subprocess if it blocks event loop |
| JSONB query performance | Admin overdue check SQL uses `data->>'bank'` | Add GIN index on `transactions.data` if query time degrades: `CREATE INDEX ON transactions USING GIN (data)` |

---

## Sources

- Direct codebase analysis: `backend/app/models/transaction.py`, `services/payment_service.py`, `api/endpoints/payments.py`, `schemas/transaction.py`
- Direct codebase analysis: `frontend/src/components/Sales/PaymentFlow.tsx`, `StatementView.tsx`
- Direct codebase analysis: `frontend/src/services/salesApi.ts`, `lib/syncQueue.ts`, `lib/image.ts`
- Direct codebase analysis: `backend/app/services/admin_service.py` (overdue check query pattern)
- [Tesseract.js GitHub](https://github.com/naptha/tesseract.js) — browser OCR, v6.0.0 WASM bundle size
- [MDN: HTML capture attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture) — camera capture on mobile, confirmed July 2025
- [FastAPI Partial Updates](https://fastapi.tiangolo.com/tutorial/body-updates/) — `exclude_unset` pattern for PATCH/JSONB
- [SQLAlchemy JSONB partial update](https://www.geeksforgeeks.org/partial-json-update-using-sqlalchemy-expression/) — JSONB merge operator
- [pytesseract PyPI](https://pypi.org/project/pytesseract/) — Python Tesseract wrapper for backend OCR

---

*Architecture research for: Check Enhancement Integration (Alofok v1.1)*
*Researched: 2026-03-04*
