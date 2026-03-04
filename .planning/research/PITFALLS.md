# Pitfalls Research

**Domain:** Check payment enhancement — SVG preview, lifecycle management, OCR, image capture
**Researched:** 2026-03-04
**Confidence:** HIGH (codebase inspected directly; patterns verified against official sources and community post-mortems)

---

## Critical Pitfalls

### Pitfall 1: JSONB Expansion That Breaks Existing Check Reads

**What goes wrong:**
The existing `Transaction.data` JSONB column contains `{bank, due_date, image_url}` for all historic check payments. When code starts writing the expanded schema `{bank, branch, account_number, holder_name, due_date, image_url, check_number}`, queries and serializers that assume the old shape break for old records. Pydantic models that declare required fields without defaults will raise validation errors when loading rows that lack the new keys. Statement views and admin dashboards that destructure `transaction.data` with direct key access will render broken UI for every pre-v1.1 check.

**Why it happens:**
JSONB's "flexible schema" benefit is also its trap: there is no migration that adds a column default, so old rows stay as-is. Developers expand the write path and forget the read path must be defensive for all time. This project already has this exact vulnerability — `PaymentCreate.data` is typed as `dict | None` with no field-level schema, so nothing enforces structure today.

**How to avoid:**
- Define a `CheckData` Pydantic model with all new fields **optional with `None` defaults**.
- Use `CheckData.model_validate(transaction.data or {})` everywhere check data is read, never raw dict access.
- Write a one-time Alembic data migration that backfills new keys with `None` on all existing `Payment_Check` rows so queries against JSONB operators return consistent results.
- In the backend `PaymentCreate` schema, replace `data: dict | None` with `data: CheckData | None` so the write path is validated too.
- Test by loading a pre-v1.1 check (seed one with only `{bank, due_date}`) through every read path before shipping.

**Warning signs:**
- Any code doing `transaction.data["branch"]` or `transaction.data.get("branch")` without a default.
- Pydantic `CheckData` fields that are required (no default).
- Admin or statement views rendering `undefined` / `None` for bank fields on old checks.
- TypeScript frontend doing `data.account_number.toUpperCase()` without a null guard.

**Phase to address:** Phase 1 — Enhanced check form and data schema. Must be the first thing built; all later phases depend on reading check data correctly.

---

### Pitfall 2: SVG Preview Blocking the UI Thread on Every Keystroke

**What goes wrong:**
The SVG check preview re-renders synchronously on every `onChange` event from amount, bank name, branch, holder name, and account number fields. With 5+ inputs each firing 10–30 events per second while the user types, React re-renders the full SVG subtree on every event. On mid-range Android devices this causes visible lag (>100ms input latency), making the form feel broken. The SVG itself involves text layout calculations that are more expensive than plain DOM.

**Why it happens:**
The straightforward implementation passes form state directly as SVG props. React re-renders children whenever parent state changes, and `onChange` fires on every character. Developers test on developer laptops (fast) and miss the issue on target hardware (mid-range Android, which is the actual field device).

**How to avoid:**
- Wrap the SVG preview component in `React.memo` so it only re-renders when its props change.
- Debounce SVG prop updates with a 150ms debounce — store raw form state locally, push debounced values to the SVG. Use `useTransition` (React 18) to mark SVG updates as non-urgent so input stays responsive.
- Keep the SVG component pure — no derived state inside it, all values passed as props.
- `useMemo` for any text-fitting or scaling calculations within the SVG.
- Test on a real Android device or Chrome DevTools throttled to 4x CPU slowdown before considering this done.

**Warning signs:**
- SVG component receives the same object reference as the entire form state.
- No `memo`, `useTransition`, or debounce wrapping the SVG update path.
- Input latency >50ms measured in DevTools Performance tab.
- The SVG re-render shows up as a long task in the performance flame graph.

**Phase to address:** Phase 2 — SVG check preview. Bake in memo + debounce from the start; retrofitting is harder.

---

### Pitfall 3: Check Lifecycle Transitions Not Enforced on the Backend

**What goes wrong:**
The current `return_check` endpoint checks `status == Returned` to block a second return, but the new lifecycle (Pending → Deposited → Cleared / Returned) has more edges. Without backend guards, the frontend can send a PATCH that moves a `Cleared` check to `Returned`, or moves a check from `Returned` to `Deposited`. These invalid transitions corrupt the customer's balance — the `Check_Return` debit transaction gets created (or not) at wrong times — and there is no recovery path without a manual database correction.

**Why it happens:**
Developers build the UI state machine carefully but implement the API as a simple `status` field update. The backend trusts the client to send valid transitions. The existing code already half-does this: `return_check` has transition logic but it lives in one endpoint; a generic PATCH `/checks/{id}/status` endpoint would bypass all of it.

**How to avoid:**
- Define the transition matrix explicitly in `payment_service.py`:
  ```python
  VALID_TRANSITIONS = {
      TransactionStatus.Pending: {TransactionStatus.Deposited, TransactionStatus.Returned},
      TransactionStatus.Deposited: {TransactionStatus.Cleared, TransactionStatus.Returned},
      TransactionStatus.Returned: set(),   # terminal
      TransactionStatus.Cleared: set(),    # terminal
  }
  ```
- Every status-change endpoint validates against this matrix and raises `HorizonException(409, ...)` for invalid transitions.
- Keep separate named endpoints (`/deposit`, `/clear`, `/return`) rather than a generic status PATCH — each endpoint owns its side effects (balance adjustments, linked Check_Return creation).
- The `Returned` transition must always create a `Check_Return` transaction and re-debit the customer. The `Cleared` transition must not touch balance. These effects belong in the service layer, not the endpoint.

**Warning signs:**
- A generic `PATCH /checks/{id}` endpoint that accepts arbitrary `status` values.
- Status change logic duplicated between frontend and backend with no single source of truth.
- `Check_Return` transaction creation happening in the frontend or conditionally skipped on the backend.
- No test asserting that `Cleared → Returned` is rejected with 409.

**Phase to address:** Phase 3 — Check lifecycle management. Backend transition guards must be in place before any lifecycle UI is built.

---

### Pitfall 4: OCR Fallback UX That Silently Discards Partial Results

**What goes wrong:**
Tesseract.js (or any browser OCR) returns a confidence score per word. When OCR extracts 3 of 5 check fields with low confidence, a naive implementation either (a) fills all extracted fields and discards low-confidence ones, or (b) fills nothing unless everything exceeds the threshold. Case (a) corrupts form data with wrong values the user doesn't notice. Case (b) wastes the partial result and forces the user to type everything manually. Both options degrade trust in the feature.

**Why it happens:**
Developers design for the happy path (clear photo, high confidence, all fields extracted correctly). Real bank checks in the field have handwritten amounts, stamps over text, glare from phone screens, and low-light conditions. Tesseract accuracy on mobile camera images without preprocessing is often 40–70% for printed text and much lower for handwritten fields.

**How to avoid:**
- Show per-field confidence as a visual indicator (green = high, yellow = medium, red = low / not found).
- Pre-fill all extracted fields regardless of confidence, but mark low-confidence fields visually so the user knows to review them.
- Never auto-submit or auto-advance after OCR — always leave the form editable.
- Add a basic image preprocessing step before OCR: convert to grayscale, increase contrast. Even simple preprocessing improves Tesseract accuracy by 15–25%.
- Define confidence thresholds: >80% = high (show normally), 50–80% = medium (yellow border + "please verify"), <50% = low (pre-fill with red border + "OCR uncertain").
- Provide a "clear OCR results" button so users can start fresh if OCR mangled the form.
- Budget 2–20 seconds for OCR on mobile — show a spinner with a cancel option; never block the form.

**Warning signs:**
- OCR result applied to form without confidence checks.
- No visual distinction between OCR-filled and manually-typed fields.
- Form auto-submits after OCR completion.
- OCR failure (exception or zero fields extracted) crashes the component rather than showing an error state.
- No preprocessing before passing image to Tesseract.

**Phase to address:** Phase 4 — OCR auto-fill. Design the confidence UX model before writing any OCR integration code.

---

### Pitfall 5: Image Capture Behaves Differently Across iOS, Android, and Desktop

**What goes wrong:**
Using `<input type="file" accept="image/*" capture="environment">` works inconsistently:
- On Chrome for Android 14+, the camera option is removed from the file picker; only gallery selection works.
- On iOS, `capture` launches the camera directly but the user cannot select an existing photo from the gallery — the two behaviors are mutually exclusive.
- The `capture="user"` vs `capture="environment"` preference is ignored on most Android browsers (opens environment camera regardless).
- Desktop browsers ignore `capture` entirely and show a file picker.
- On older Androids, `capture` on a video input can fail silently.

This results in a feature that appears to work in testing (developer iPhone) but breaks on the majority of field devices (Android).

**How to avoid:**
- Use two separate inputs: one with `capture="environment"` (camera) and one without `capture` (gallery), presented as two distinct buttons: "Take Photo" and "Choose from Gallery."
- Never rely on `capture` attribute alone as the only camera access path.
- On desktop, show only the gallery/file picker option; skip the camera button since `capture` is a no-op.
- Detect mobile vs. desktop via `navigator.maxTouchPoints > 0` or user agent, but degrade gracefully — always show file picker as the fallback.
- Capacitor is planned but not yet added; this web-based approach must work standalone. When Capacitor is added, it provides proper camera plugin access that replaces the file input approach.

**Warning signs:**
- Single `<input>` with `capture` and `accept="image/*"` as the only camera access mechanism.
- Testing done only on iOS or developer's device.
- No fallback for desktop users who need to upload from filesystem.
- Feature listed as "done" before testing on an Android Chrome device.

**Phase to address:** Phase 4 — Check image capture. Platform matrix must be tested explicitly before marking done.

---

### Pitfall 6: Large Check Images Bloating the Offline Sync Queue

**What goes wrong:**
The current sync queue stores `payload: unknown` in IndexedDB as a JSON blob. Check images captured offline will be included in the payment payload. A typical phone camera image is 3–8 MB; base64-encoded, it becomes 4–11 MB. Storing multiple queued check payments with embedded base64 images causes:
- IndexedDB quota exhaustion (browsers cap at 50–80% of available disk space, but the cap is opaque)
- Sync flush timing out because it tries to upload a 10 MB JSON body
- GZip middleware compressing the body but still hitting FastAPI's default 100 MB body limit only by luck
- Performance degradation as IndexedDB reads large base64 strings synchronously before flushing

**Why it happens:**
The current queue was designed for lightweight JSON payloads (orders and cash payments). Image data requires a fundamentally different sync strategy: binary blobs should not be embedded in the sync payload.

**How to avoid:**
- Store check images as `Blob` objects in a separate IndexedDB object store, referenced by a local UUID in the payment payload (e.g., `data.local_image_id`).
- Do not base64-encode images for IndexedDB storage — store raw `Blob` objects, which IndexedDB supports natively and handles more efficiently.
- During sync flush, upload the image first via `multipart/form-data`, get back a server `image_url`, then include that URL in the payment payload.
- Cap accepted image sizes at 5 MB on the frontend before accepting a capture.
- If image upload fails during sync, still submit the payment without the image (image upload should be a separate, retryable step, not a prerequisite for payment submission).
- Add a separate `image_uploads` object store to the IndexedDB schema — this requires a VERSION bump to 2 with the upgrade handler creating the new store.

**Warning signs:**
- Payment payload stored in sync queue contains a base64 string longer than ~1000 characters.
- No size check on camera-captured images before queuing.
- IndexedDB `VERSION` is still 1 after image support is added.
- Sync flush sends a single multipart request containing both image binary and payment JSON.

**Phase to address:** Phase 4 — Check image capture + offline sync integration. This is an architectural decision that must be made before image capture is shipped.

---

### Pitfall 7: Bank Name Autocomplete Leaking Data Across Customers / Sessions

**What goes wrong:**
Bank names from previously submitted checks are stored in `localStorage` to power an autocomplete `<datalist>`. This creates two problems:
1. If the storage key is not scoped to the current user or session, bank names entered by a previous user on a shared device appear as suggestions.
2. The bank name list in `localStorage` is readable by any JavaScript on the page. While the bank name itself is not highly sensitive, it is financial context data. XSS attacks targeting the app could exfiltrate the history.

**Why it happens:**
Developers reach for `localStorage` for small, persistent UI hints without considering multi-user scenarios. Shared field devices (one phone per route, not one per rep) make this a real problem for this app.

**How to avoid:**
- Scope the localStorage key to the authenticated user's ID: `alofok_banks_{userId}` not `alofok_banks`.
- Limit the stored list to the 10–20 most recently used values; do not accumulate indefinitely.
- A better alternative: fetch the user's previously used bank names from the backend as a query (e.g., `GET /payments/banks/used` that aggregates `data->>'bank'` from the user's own check transactions). This is server-authoritative and survives device changes.
- If localStorage is used, clear it on logout.
- Never store account numbers, branch codes, or any numeric financial identifiers in localStorage.

**Warning signs:**
- localStorage key does not include user ID.
- Bank name list grows unbounded.
- localStorage contains account numbers, check numbers, or branch codes.
- No clear-on-logout logic.

**Phase to address:** Phase 1 — Enhanced check form (when bank name field is added). Set the pattern correctly from the start.

---

### Pitfall 8: SVG Check Layout Breaking in RTL App Context

**What goes wrong:**
The app is RTL-first (Arabic primary). A bank check is LTR by design — the physical check format is fixed, with account number on the left, payee name spanning left to right, and the amount box in the lower right. When the SVG is rendered inside an RTL document, CSS logical properties, SVG `text-anchor` attributes, and inherited `direction: rtl` can flip text alignment, mirror number positions, or corrupt amount display. Arabic numerals within the check (account number, amount) are already LTR in context, but if `direction: rtl` propagates into the SVG, the Unicode bidi algorithm may reorder them incorrectly.

**Why it happens:**
The PROJECT.md decision record already acknowledges this: "LTR check layout — Standard check format — Pending." Developers building an RTL-first app often forget to explicitly isolate SVG elements from the inherited document direction.

**How to avoid:**
- Set `dir="ltr"` and `direction: ltr` explicitly on the SVG element itself — do not rely on inheritance from the page.
- Use explicit `text-anchor="start"` on all SVG `<text>` elements rather than inheriting from the document direction.
- For Arabic holder names or bank names displayed on the check, use `unicode-bidi: plaintext` or wrap in `<tspan direction="rtl">` to allow RTL rendering of Arabic text within an overall LTR SVG.
- Amount fields must use Western Arabic numerals (0–9), not Eastern Arabic numerals (٠–٩), because the physical check format requires it.
- Test the SVG preview with an Arabic locale active (`i18n.language === "ar"`) before shipping.

**Warning signs:**
- SVG element has no explicit `dir` attribute.
- Amount or account number appears mirrored or in wrong position when app language is Arabic.
- `text-anchor` not set on SVG text elements (inherits from body).
- Eastern Arabic numerals (`٠١٢`) appearing in the amount box.

**Phase to address:** Phase 2 — SVG check preview. Set `dir="ltr"` on the SVG root as the very first line of the component.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `data: dict \| None` in PaymentCreate instead of typed CheckData model | No Pydantic schema to maintain | Impossible to add validation without a breaking change; every consumer reads raw dict keys | Never for new fields |
| Single `<input capture>` for camera | Simpler component | Broken on Android 14+ Chrome, iOS shows no gallery option | Never if the feature matters |
| Base64 images embedded in sync queue payload | Zero infra changes | IndexedDB bloat, sync timeouts, degraded performance on reconnect | Never for images >50KB |
| Generic `PATCH /checks/{id}/status` endpoint | Fewer endpoints | Client controls transitions, no server enforcement, balance corruption risk | Never for financial state |
| `localStorage` bank autocomplete without user scoping | 5-line implementation | Data leaks between users on shared devices | MVP only if single-user per device is guaranteed |
| No image preprocessing before OCR | Simpler code | 40–60% accuracy on real field photos, high user frustration | Never for a feature being marketed as "OCR auto-fill" |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| FastAPI file upload | Using user-provided filename as storage path | Generate UUID filename server-side; store original name in DB if needed; use `python-magic` to verify MIME, not just extension |
| Tesseract.js | Loading full language model on page load even if OCR is never used | Lazy-load the Tesseract worker only when user taps "Scan Check"; use `createWorker` with `{ langPath }` pointing to a CDN |
| IndexedDB schema upgrade | Adding new object store without bumping `VERSION` | Increment `VERSION` to 2; handle `onupgradeneeded` for both v1→v2 (existing install) and fresh install |
| React Query + check status mutation | Optimistic update on status transition causing UI flip when server rejects | Do not use optimistic updates for financial state transitions; wait for server confirmation, then invalidate queries |
| SVG in RTL page | CSS `direction: rtl` propagating into SVG text rendering | Explicitly set `direction: ltr` and `unicode-bidi: isolate` on SVG root element |
| `capture` attribute on iOS | `capture` blocks gallery access; no `capture` blocks camera on some Androids | Two buttons: one input with `capture`, one without; user picks their intent |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| SVG re-renders on every keystroke | Input lag >50ms on Android; form feels sluggish | `React.memo` + 150ms debounce on SVG props + `useTransition` | First device test on mid-range Android |
| Tesseract.js WASM loaded eagerly | 3–5s page load delay on first visit; unnecessary if user never scans | Lazy-load worker on first scan tap | From day 1 if loaded at app startup |
| IndexedDB read of large base64 images during flush | Sync flush takes 10+ seconds; main thread blocked | Store images as Blobs in separate store; read only metadata for queue inspection | First time a check image is captured offline |
| Unbounded bank name list in localStorage | localStorage getItem/setItem slows for large serialized arrays | Cap list at 20 entries; trim on every write | After ~200 unique entries |
| Image upload + payment creation in single request | Request timeout on slow field connections (edge-of-coverage 3G) | Upload image first, get URL, then create payment as separate requests | Any upload >2 MB on a 3G connection |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing user-provided filename on filesystem | Path traversal attack (`../../etc/passwd`) | Generate UUID filename server-side; sanitize with `pathlib.Path(filename).name` if original name needed |
| Trusting client MIME type (`Content-Type: image/jpeg`) | Attacker uploads malicious file with image extension | Validate file magic bytes with `python-magic` server-side |
| No file size limit on check image upload | DoS via 1 GB upload; disk exhaustion | Set `FastAPI File(max_size=5*1024*1024)` and nginx `client_max_body_size 6M` |
| `localStorage` bank autocomplete without user scoping | Financial context visible to other users on shared device | Key by user ID; clear on logout |
| Status transition via generic PATCH | Client can set any status without balance side effects | Named endpoints only; transition matrix enforced in service layer |
| Check image served from `/static` with predictable paths | Any authenticated user can guess and access another customer's check image | Generate UUID filenames; add per-user authorization check before serving, or use signed tokens for static assets |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| OCR fills form and user doesn't notice wrong values | Wrong check details submitted, causes payment reconciliation errors later | Yellow/red border on low-confidence OCR fields; always require user to confirm before submit |
| No progress indicator during OCR (2–20s on mobile) | User thinks app is frozen; double-taps, crashes OCR worker | Spinner with "Scanning check…" text + cancel button; disable the scan button while in progress |
| Check lifecycle buttons visible when transition is invalid | User taps "Mark Deposited" on a Cleared check; error toast confuses them | Grey out / hide buttons for transitions that are not valid from current state; show tooltip explaining why |
| SVG preview not showing immediately (loads lazily) | User sees blank space instead of preview, doesn't know the feature exists | SVG renders immediately with placeholder values on load; fills in as user types |
| Image capture replaces form fill — user loses typed data | Rep typed bank name, tapped scan, OCR overwrites with wrong value | OCR only fills empty fields by default; prompt user before overwriting non-empty fields |
| Camera button appears on desktop but does nothing useful | Confusing for admin users testing on desktop | Show camera button only on touch devices; always show file picker |

---

## "Looks Done But Isn't" Checklist

- [ ] **JSONB expansion:** Verify all existing `Payment_Check` rows load without error through the new `CheckData` Pydantic model — seed a row with `{bank, due_date}` only and run it through every read path.
- [ ] **SVG preview:** Test with CPU throttled 4x in Chrome DevTools on Android. Input latency must be <50ms.
- [ ] **Lifecycle transitions:** Write a test that attempts `Cleared → Returned` and asserts 409. Write a test that attempts `Pending → Cleared` (skipping Deposited) and asserts 409.
- [ ] **OCR partial result:** Take a blurry photo of a check in low light. Verify the form shows confidence indicators, not a crash or silent empty form.
- [ ] **Image capture on Android Chrome:** Test camera capture on Android Chrome 114+ (which removed the camera option from file picker for `<input accept="image/*">`). Verify the "Take Photo" button still works.
- [ ] **Offline image sync:** Queue a check payment with a photo while offline. Toggle online. Verify image uploads first, then payment is submitted with the returned URL.
- [ ] **RTL SVG:** Switch app language to Arabic. Verify check preview numbers are not mirrored and Arabic text (holder name) renders correctly within the LTR check layout.
- [ ] **Bank autocomplete scoping:** Log in as user A, enter "Hapoalim". Log out, log in as user B. Verify "Hapoalim" does not appear in user B's suggestions.
- [ ] **File security:** Upload a `.php` file renamed to `.jpg`. Verify backend rejects it (magic byte check) and does not store it.
- [ ] **Check_Return on return transition:** Mark a `Deposited` check as `Returned`. Verify a `Check_Return` transaction exists and the customer's balance increased by the check amount.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Old check rows break on new CheckData model | MEDIUM | Write Alembic data migration to backfill `None` for new keys; deploy migration before code change |
| Invalid status transition corrupted customer balance | HIGH | Manual SQL to find affected transactions; recalculate balance from transaction history; add audit log going forward |
| IndexedDB bloated with base64 images | MEDIUM | Release IndexedDB v2 upgrade that clears the old sync queue store and creates a fresh one + image_uploads store; users lose queued offline data (acceptable) |
| SVG performance regression shipped | LOW | Add `React.memo` + debounce as a hotfix PR; no data migration needed |
| User-provided filenames stored on filesystem | HIGH | Audit existing stored files; rename to UUIDs; update DB records; review for path traversal attempts in access logs |
| OCR silently corrupting form data | LOW | Add confidence indicators as a UI-only change; no backend migration needed |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| JSONB expansion breaking old reads | Phase 1: Enhanced check form + data schema | Load pre-v1.1 check through all read paths; run Alembic data migration in CI |
| Bank autocomplete data leaking across users | Phase 1: Enhanced check form | Log in as two users on same device; verify suggestions are isolated |
| SVG re-renders blocking input | Phase 2: SVG check preview | CPU throttle test on DevTools; latency <50ms |
| SVG RTL/LTR direction confusion | Phase 2: SVG check preview | Switch locale to Arabic; verify layout correct |
| Lifecycle transitions without backend enforcement | Phase 3: Check lifecycle management | Integration tests for all invalid transition combinations |
| Optimistic update on status change | Phase 3: Check lifecycle management | Do not implement optimistic updates for status; verify query invalidation pattern |
| Image capture cross-platform inconsistency | Phase 4: Check image capture | Test on Android Chrome + iOS Safari + desktop Chrome |
| Large images in sync queue | Phase 4: Check image capture + offline sync | Queue check with photo offline; measure IndexedDB size; verify separate image store |
| File upload security (filename, MIME) | Phase 4: Check image capture | Upload non-image file; verify 422 rejection |
| OCR fallback UX for partial/failed reads | Phase 4: OCR auto-fill | Intentionally blurry photo test; verify confidence UI shown |

---

## Sources

- Direct codebase inspection: `/home/ka1ser/projects/alofok/backend/app/models/transaction.py`, `backend/app/services/payment_service.py`, `frontend/src/lib/syncQueue.ts`, `frontend/src/hooks/useOfflineSync.ts`, `frontend/src/components/Sales/PaymentFlow.tsx`
- [Zero-Downtime PostgreSQL JSONB Migration](https://medium.com/@shinyjai2011/zero-downtime-postgresql-jsonb-migration-a-practical-guide-for-scalable-schema-evolution-9f74124ef4a1)
- [Implementing Secure File Uploads in FastAPI](https://blog.greeden.me/en/2026/03/03/implementing-secure-file-uploads-in-fastapi-practical-patterns-for-uploadfile-size-limits-virus-scanning-s3-compatible-storage-and-presigned-urls/)
- [Android 14 & 15 File Inputs: Camera Option Missing](https://blog.addpipe.com/html-file-input-accept-video-camera-option-is-missing-android-14-15/)
- [Keep storing large images, don't index the binary data](https://medium.com/dexie-js/keep-storing-large-images-just-dont-index-the-binary-data-itself-10b9d9c5c5d7)
- [Tesseract.js GitHub Issues — different results on different devices](https://github.com/naptha/tesseract.js/issues/8)
- [Boost Tesseract OCR Accuracy: Advanced Tips](https://sparkco.ai/blog/boost-tesseract-ocr-accuracy-advanced-tips-techniques)
- [Concurrent Optimistic Updates in React Query — tkdodo](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)
- [Stop fixing Numbers. RTL in a web platform](https://medium.com/xgeeks/stop-fixing-numbers-96a0a1915719)
- [Creating SVG Tiny Pages in Arabic and RTL scripts — W3C](https://www.w3.org/International/tutorials/svg-tiny-bidi/)
- [React Performance Optimization Best Practices 2025](https://dev.to/frontendtoolstech/react-performance-optimization-best-practices-for-2025-2g6b)
- [Capturing an image from the user — web.dev](https://web.dev/media-capturing-images/)

---
*Pitfalls research for: Alofok v1.1 Check Enhancement (SVG preview, lifecycle management, OCR, image capture)*
*Researched: 2026-03-04*
