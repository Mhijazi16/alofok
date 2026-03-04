# Feature Research

**Domain:** Check payment enhancement — SVG preview, lifecycle management, OCR auto-fill
**Researched:** 2026-03-04
**Confidence:** HIGH (existing code fully audited) / MEDIUM (OCR behavior, verified via Tesseract.js docs + Smashing Magazine)

---

## Context: What Already Exists

The baseline before this milestone (from code audit):

| What exists | Where | Notes |
|-------------|-------|-------|
| `Payment_Check` transaction type | `transaction.py` model | Stored in JSONB `data` col |
| Check `data` JSONB: `{bank, due_date, image_url}` | Backend | bank = free-text name only |
| `TransactionStatus` enum: Pending/Deposited/Returned/Cleared | Model | Only `Returned` has UI action |
| Return check workflow | `payment_service.py` | Creates re-debit `Check_Return` txn |
| `return_check` endpoint | `/payments/{id}/return` | Only lifecycle mutation that exists |
| Overdue checks list | Admin `DebtStats.tsx` | Read-only table, no status mutations |
| PaymentFlow check form | `PaymentFlow.tsx` | Bank name (text) + due date only |
| Product image upload pattern | `products.py` | `aiofiles` + `/static/products/` — reusable |

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the accounting team and admin consider non-negotiable for the check workflow to be useful.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Extended check data fields** (bank number, branch number, account number, holder name) | A check without these numbers is useless for reconciliation and banking. Current form only captures bank name (free text). | LOW | Backend: expand `data` JSONB keys — no migration needed (JSONB). Frontend: 4 new `FormField` inputs in `PaymentFlow.tsx`. Validation: bank number required for check payments. |
| **Live SVG check preview** (updates as user types, LTR layout) | Mental confirmation that data is correct before submitting. Standard UX in any serious check-writing software. Users catch typos before they become accounting disputes. | MEDIUM | Pure SVG rendered in React from form state — no library needed. LTR forced regardless of app RTL via `dir="ltr"` wrapper. Dark theme compatible. Fields: holder name, amount in digits + words, bank name, bank number, branch, account, due date. Check number auto-generated (transaction ID prefix). |
| **Check status lifecycle UI** (Pending → Deposited, Pending/Deposited → Cleared, Pending/Deposited → Returned) | All 4 status values exist in the backend enum; only `Returned` has a UI action. Admin cannot mark checks as deposited or cleared without the UI. Creates dead data. | MEDIUM | Two new backend endpoints: `PATCH /payments/{id}/deposit`, `PATCH /payments/{id}/clear`. Frontend: action buttons in Admin check table and/or check detail sheet. State machine: Pending → {Deposited, Returned}; Deposited → {Cleared, Returned}; Cleared and Returned are terminal. |
| **Check photo capture and storage** (camera + file upload, image stored, visible in Admin) | Physical check must be photographed as legal record. Mandatory for any business that handles post-dated checks. `image_url` field already in JSONB schema but is never populated via UI. | MEDIUM | Pattern is identical to product image upload (already working: `aiofiles`, `/static/checks/`, return URL). Frontend: `<input type="file" accept="image/*" capture="environment">` in PaymentFlow check form. No new library needed. Preview thumbnail before submit. |

### Differentiators (Competitive Advantage)

Features that make this check workflow materially better than a manual paper process.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **OCR auto-fill from check photo** | Reduces data entry errors. Sales rep photographs the check, fields pre-populate, rep corrects if needed. Faster workflow in the field. | HIGH | See OCR Analysis section below for approach decision. Recommended: client-side Tesseract.js v5 (no server round-trip, offline-capable), Arabic + English language packs, treat output as suggestions not authoritative values. Must be progressive — form stays usable if OCR fails or is slow. |
| **Amount in words auto-generation** (Hebrew/Arabic/English from numeric amount) | Check preview shows amount spelled out — reduces fraud risk, looks professional. Standard on real checks. | LOW | JavaScript: `Intl.NumberFormat` does not produce written-out words. Use a small utility function or `number-to-words` npm package (1.8kB). Hebrew/Arabic word-form for amounts is complex — English fallback acceptable since the check preview is LTR / English-format. |
| **Check number on preview** | Real checks have sequential check numbers. Audit trail. | LOW | Derive from transaction ID (first 8 chars of UUID) displayed in MICR position on preview. No separate counter needed. |
| **Overdue check quick-action from Admin** | Admin can deposit/clear/return directly from the overdue checks table without navigating to the customer statement. | LOW | Add action dropdown to existing `DebtStats.tsx` table rows. Reuses lifecycle endpoints above. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full automatic OCR with no manual review** | "Save time, don't make users type" | Bank check OCR accuracy with mobile photos is 60-85% at best (lighting, angle, MICR font, Arabic mixed content). Financial data errors from uncorrected OCR create accounting disputes that cost far more time to fix than typing. | Always pre-fill as suggestions in editable fields. User must confirm. OCR result is an assist, not a replacement. |
| **MICR line decoding** (routing/account from magnetic ink) | Looks impressive, solves routing number capture | Mobile phone cameras cannot read MICR magnetic encoding — MICR scanners use magnetic heads. OCR of MICR characters is unreliable due to E-13B font design. | Manual entry of bank number, branch number, account number — with the preview giving visual feedback. |
| **Real-time server-side OCR** (upload photo → API → return fields) | Server can use heavier models | Breaks offline-first requirement (Sales rep critical path). Adds latency, cost, server complexity. Tesseract.js v5 works in a Web Worker — does not block the UI. | Client-side Tesseract.js in Web Worker. Offline-safe. |
| **Automatic check status progression** (cron marks Deposited after N days) | "Checks clear automatically after 3 business days" | Business rules vary by bank, currency, relationship. Auto-advancing status without human confirmation creates false accounting state. | Manual status updates by Admin. Clear audit trail of who changed status and when. |
| **Check batching / reconciliation view** | "Show me all checks due this week grouped by bank" | Out of scope for this milestone (explicitly excluded in PROJECT.md). Adds significant backend query complexity. | The overdue checks table in Admin already surfaces urgency via days-overdue badges. Sufficient for now. |

---

## Feature Dependencies

```
[Extended check data fields]
    └──enables──> [Live SVG check preview]  (preview needs the data to display)
    └──enables──> [Check photo capture]     (image_url goes into same data JSONB)

[Check photo capture]
    └──enables──> [OCR auto-fill]           (OCR needs a photo to process)

[Check status lifecycle UI]
    └──requires──> [deposit endpoint]       (backend must exist first)
    └──requires──> [clear endpoint]         (backend must exist first)
    └──enhances──> [Overdue check quick-action]  (same mutations, different entry point)

[Live SVG check preview]
    └──enhances──> [Extended check data fields]  (visual feedback loop improves data quality)

[OCR auto-fill]
    └──enhances──> [Extended check data fields]  (pre-populates but does not replace)
```

### Dependency Notes

- **Extended fields must come first:** SVG preview, photo capture, and OCR all depend on the form having the right fields. This is the foundational piece.
- **Backend lifecycle endpoints must precede Admin UI:** `PATCH /deposit` and `PATCH /clear` must exist before adding action buttons to the UI.
- **OCR is optional progressive enhancement:** The check form works without OCR. Photo capture works without OCR. OCR layered on top after both exist.
- **No conflicts:** All five features stack cleanly. No feature excludes another.

---

## MVP Definition

This milestone has a single clear goal: transform the basic check form into a rich capture experience. The features below are ordered by dependency, not just value.

### Launch With (this milestone, v1.1)

- [x] **Extended check data fields** — foundation for everything else; backend JSONB expansion, 4 new form inputs, updated validation
- [x] **Live SVG check preview** — immediate visual payoff; zero dependencies beyond form state; motivates correct data entry
- [x] **Check status lifecycle UI** — closes the biggest functional gap; checks currently get stuck at Pending forever
- [x] **Check photo capture and storage** — legal record requirement; pattern already proven by product image upload

### Add After Validation (v1.x)

- [ ] **OCR auto-fill** — adds on top of photo capture; requires Tesseract.js Web Worker integration; highest complexity item; must not block form if slow
- [ ] **Overdue check quick-action in Admin** — convenience shortcut; the lifecycle endpoints from above make this trivial to add

### Future Consideration (v2+)

- [ ] **Amount in words (Arabic/Hebrew)** — nice on the preview but complex locale-correct implementation; English words acceptable as v1 fallback
- [ ] **Check batch/reconciliation view** — explicitly out of scope per PROJECT.md; defer until admin requests it with specific requirements

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Extended check data fields | HIGH | LOW | P1 |
| Live SVG check preview | HIGH | MEDIUM | P1 |
| Check status lifecycle UI | HIGH | MEDIUM | P1 |
| Check photo capture and storage | HIGH | LOW-MEDIUM | P1 |
| OCR auto-fill | MEDIUM | HIGH | P2 |
| Overdue check quick-action | MEDIUM | LOW | P2 |
| Amount in words | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for this milestone
- P2: Should have, add when P1 is stable
- P3: Nice to have, future consideration

---

## OCR Analysis (Detailed)

### Approach: Client-side Tesseract.js v5 in a Web Worker

**Why client-side:** The offline-first constraint eliminates server-side OCR. Sales reps operate in the field without reliable connectivity.

**Why Tesseract.js:** Pure JavaScript, no server dependency, 100+ language support (Arabic + English both available), runs in Web Worker (non-blocking), actively maintained (GitHub: naptha/tesseract.js, 35k+ stars).

**Realistic accuracy expectations for check photos (MEDIUM confidence, multiple sources):**
- Clean printed text on white check: 80-90% character accuracy
- Mobile phone photo under field lighting: 60-80%
- Handwritten amounts: 30-50% (unreliable)
- MICR E-13B font characters: unreliable via camera (not magnetic)
- Arabic text mixed with numbers: accuracy degrades vs pure Latin

**Implementation pattern:**
```
User captures photo → image stored → Tesseract worker processes in background
→ extracted text parsed for number-like fields → fields pre-populated as suggestions
→ user reviews and corrects → submits
```

**The OCR result must never auto-submit.** It fills form fields. User confirms.

**Bundle size concern:** Tesseract.js language packs are large (Arabic: ~4MB, English: ~3MB). Load language packs lazily only when user taps the OCR button. Do not import at app startup.

### What OCR can reliably extract from a check photo

| Field | OCR Reliability | Notes |
|-------|----------------|-------|
| Amount (numeric) | MEDIUM | Printed clearly, but decimal point confusion |
| Due date | MEDIUM | Printed, but format varies |
| Bank name | MEDIUM | Printed, may overlap with logo |
| Account number | LOW-MEDIUM | Printed numbers, but MICR font is tricky |
| Branch number | LOW-MEDIUM | Short numeric sequence, easier |
| Holder name | LOW | Often handwritten or cursive |

### What OCR cannot reliably do

- Understand check layout/zones (it returns a blob of text, not structured fields)
- Handle handwriting with financial accuracy
- Read MICR magnetic ink line (camera-only limitation)

**Conclusion:** OCR is a useful assist, not a replacement for manual entry. Implement as an optional "scan to pre-fill" button that activates after photo is captured. Always allow manual override. Flag extracted values visually so user knows they came from OCR.

---

## Check Lifecycle State Machine

```
[Pending]
    ├── deposit() → [Deposited]
    └── return()  → [Returned]  (terminal)

[Deposited]
    ├── clear()   → [Cleared]   (terminal)
    └── return()  → [Returned]  (terminal)

[Cleared]   — no further transitions
[Returned]  — no further transitions (Check_Return transaction created by existing logic)
```

### Transition rules (business logic)

- Only Admin can advance check status (Sales creates, Admin manages lifecycle)
- Each transition creates an audit entry (use existing `notes` field + `updated_at`)
- `Cleared` does NOT create a new transaction (the payment already reduced the balance; clearing is confirmation only)
- `Returned` uses the existing `return_check` service method (creates `Check_Return` re-debit txn)
- `Deposited` is informational only — no balance change

---

## SVG Check Preview Design Specification

### Layout (LTR, always — regardless of app RTL)

A realistic check preview should mirror the standard horizontal check format:

```
┌─────────────────────────────────────────────────────┐
│  [Holder Name]                         Check #XXXXX │
│  [Address line — static placeholder]         [Date] │
│                                                     │
│  Pay to the order of: _________________________    │
│                                                     │
│  Amount: [numeric]     [Amount in words]________   │
│                                                     │
│  [Bank Name]                                        │
│  Branch: [branch]  Account: [account]               │
│                                                     │
│  Memo: _____________________   [Signature line]    │
│                                                     │
│  ⠿⠿ [MICR-style decorative line] ⠿⠿               │
└─────────────────────────────────────────────────────┘
```

### Dark theme adaptation

Real checks are white/cream on dark theme screens. Two options:
1. Render check as white background (paper color) inside dark UI — most realistic
2. Invert to dark check — less realistic but more consistent

**Recommendation:** White/cream background (like actual paper) inside a dark card container. This is what users recognize as a check. Contrast is higher for readability.

### What updates live as user types

- Holder name → top left
- Due date → top right
- Amount (numeric) → amount box
- Bank name → bottom left
- Bank/branch/account numbers → bottom number region
- Check number → auto from UUID prefix (static once created)

---

## Integration Points with Existing Code

| New Feature | Touches Existing | Change Type |
|-------------|-----------------|-------------|
| Extended data fields | `PaymentFlow.tsx`, `payment_service.py`, `schemas/transaction.py` | Add fields; JSONB — no migration |
| SVG preview | `PaymentFlow.tsx` | New sub-component, no backend |
| Photo capture | `PaymentFlow.tsx`, new `POST /payments/upload-image` endpoint | Pattern from products.py is identical |
| Lifecycle UI | `Admin/DebtStats.tsx`, new `PATCH /payments/{id}/deposit` + `/clear` | Extend existing admin view |
| OCR | `PaymentFlow.tsx`, Tesseract.js Web Worker | Client-only, no backend change |

---

## Sources

- Code audit: `/home/ka1ser/projects/alofok/frontend/src/components/Sales/PaymentFlow.tsx`
- Code audit: `/home/ka1ser/projects/alofok/backend/app/models/transaction.py`
- Code audit: `/home/ka1ser/projects/alofok/backend/app/services/payment_service.py`
- Code audit: `/home/ka1ser/projects/alofok/backend/app/api/endpoints/products.py` (image upload pattern)
- [Tesseract.js GitHub](https://github.com/naptha/tesseract.js) — OCR library reference
- [Image to Text with React and Tesseract.js — Smashing Magazine](https://www.smashingmagazine.com/2021/06/image-text-conversion-react-tesseract-js-ocr/) — accuracy limitations
- [Microsoft Azure Document Intelligence — Bank Check Extraction](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/bank-check?view=doc-intel-4.0.0) — standard check fields reference
- [Complete Guide to Bank Check Extraction using OCR — KlearStack](https://klearstack.com/bank-check-extraction-using-ocr) — accuracy benchmarks
- [react-webcam npm](https://www.npmjs.com/package/react-webcam) — camera capture library (alternative to native input)
- [FastAPI File Uploads — official docs](https://fastapi.tiangolo.com/tutorial/request-files/) — upload endpoint pattern

---

*Feature research for: Alofok v1.1 Check Enhancement milestone*
*Researched: 2026-03-04*
