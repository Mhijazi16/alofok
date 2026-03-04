# Project Research Summary

**Project:** Alofok v1.1 — Check Payment Enhancement
**Domain:** Financial document capture, lifecycle management, and OCR for a wholesale trading app
**Researched:** 2026-03-04
**Confidence:** HIGH

## Executive Summary

This milestone transforms the existing but incomplete check payment workflow in Alofok from a minimal 2-field form (bank name + due date only) into a rich capture experience with visual preview, full data capture, lifecycle management, and optional OCR auto-fill. The baseline already has the correct data model shape (`Transaction.data` JSONB, `TransactionStatus` enum with all 4 states) and image upload infrastructure (aiofiles + `/static` mount) — the gap is entirely in the application layer, not infrastructure. This is an additive milestone with no destructive changes required: JSONB expansion needs no migration, the existing upload pattern is directly reusable, and the status state machine already has the right values. The implementation risk is low-to-medium.

The recommended approach is to build in dependency order across 4 phases: (1) expand the check data schema and form fields as the foundational piece everything else depends on, (2) add the SVG check preview as pure UI with no backend involvement, (3) close the backend lifecycle gap by implementing the deposit/clear status transitions, then (4) layer on image capture and OCR as progressive enhancement. Stack additions are minimal — only `cmdk@^1.1.1` and `tesseract.js@^5.1.1` on the frontend; no backend dependency changes for the core milestone. For OCR, research is split: STACK.md recommends client-side Tesseract.js (no Docker changes), while ARCHITECTURE.md recommends server-side pytesseract (adds ~50MB to Docker image). The client-side approach wins on offline-first grounds and is the recommended path.

The highest risks are not architectural — they are execution details. The critical ones are: JSONB expansion must be backward-compatible with all existing check rows (a data migration backfilling `None` for new keys is required before deploying the schema change); image capture must handle the Android 14+ Chrome regression that removed the camera option from `<input capture>` (requires two separate input buttons); and images must not be embedded in the offline sync queue as base64 (requires a separate IndexedDB object store with a version bump). These pitfalls are well-understood and preventable with the patterns documented in PITFALLS.md.

---

## Key Findings

### Recommended Stack

The existing project stack already provides everything needed except two frontend packages. No backend dependency changes are required for the core milestone. The stack strategy is to minimize additions and reuse proven patterns (avatar upload for check image upload, existing Radix Popover for bank autocomplete combobox, existing FileUpload component for camera capture).

**Core technologies:**

- `tesseract.js@^5.1.1`: Browser-side OCR via WASM — no server round-trip, offline-capable after first language data load, Arabic + English support. v5.1.1 chosen over v7.0.0 (too new) for stability. Lazy-load only on user action; ~4MB language data cached by browser after first use.
- `cmdk@^1.1.1`: Command palette primitive for bank name combobox — the shadcn-native choice, pairs with already-installed `@radix-ui/react-popover`. Only missing package for the bank autocomplete feature. Known z-index issue when nested in a Dialog; fixed with `z-[100]` CSS.
- `CheckPreview` (inline SVG, zero deps): Pure React JSX SVG for live check visualization — no library needed, reactive via props, renders immediately, zero bundle cost.
- `<input capture="environment">` (HTML built-in): Camera access on mobile without react-webcam. Must be paired with a non-capture fallback input for Android 14+ compatibility.

See `.planning/research/STACK.md` for full alternatives considered and version compatibility matrix.

### Expected Features

The feature audit reveals four must-have features for this milestone and two should-have features for a follow-up, with a clear dependency order that must be respected.

**Must have (table stakes for v1.1):**
- **Extended check data fields** (bank number, branch, account, holder name) — foundation for everything; JSONB expansion with no migration; 4 new form inputs in PaymentFlow.tsx
- **Live SVG check preview** — LTR layout, updates as user types, white/cream paper look inside dark UI; zero backend dependencies
- **Check status lifecycle UI** (Pending → Deposited → Cleared/Returned) — closes the biggest functional gap; two new backend endpoints (`/deposit`, `/clear`); Admin-only action; state machine validated server-side
- **Check photo capture and storage** — legal record requirement; identical pattern to existing product image upload (`aiofiles` + `/static/checks/`); two-button UX for Android compatibility

**Should have (v1.x, after validation):**
- **OCR auto-fill from check photo** — progressive enhancement on top of image capture; treats results as suggestions with confidence indicators, never auto-submits
- **Overdue check quick-action in Admin** — convenience shortcut reusing lifecycle endpoints; low cost to add once lifecycle is stable

**Defer (v2+):**
- Amount in words in Arabic/Hebrew (English fallback acceptable for v1 preview)
- Check batch/reconciliation view (explicitly out of scope per PROJECT.md)

See `.planning/research/FEATURES.md` for full feature dependency graph and OCR accuracy benchmarks.

### Architecture Approach

The architecture is a focused extension of the existing system: expand one Pydantic model (`CheckData` replacing `data: dict | None`), add two backend endpoints (image upload, status transitions), add three frontend components (`CheckPreview`, `BankAutocomplete`, `useCheckOCR`), and modify four existing files (`PaymentFlow.tsx`, `StatementView.tsx`, `salesApi.ts`, `adminApi.ts`). No new top-level directories, no Alembic schema migrations, no new backend services. The build order is fully determined by dependencies and can be parallelized at the frontend UI component level.

**Major components:**

1. `CheckData` Pydantic model (backend) — typed schema replacing the untyped `dict | None`; all new fields optional for backward compatibility with historic rows; enforced on both read and write paths
2. `update_check_status()` service method with `_ALLOWED_TRANSITIONS` dict (backend) — state machine guard; routes `Returned` through existing `return_check()` to preserve balance side-effect logic; raises `HorizonException(409)` for invalid transitions
3. `POST /payments/checks/upload-image` endpoint (backend) — direct copy of avatar upload pattern; UUID-named files in `/static/checks/`; returns URL for inclusion in payment payload
4. `CheckPreview.tsx` (frontend) — pure presentational SVG component; `dir="ltr"` on root; `React.memo` + 150ms debounced props for input responsiveness on mid-range Android
5. `BankAutocomplete.tsx` (frontend) — `cmdk` + Radix Popover combobox; localStorage history keyed by user ID; max 20 entries; cleared on logout
6. `useCheckOCR.ts` (frontend hook) — wraps Tesseract.js worker lifecycle; lazy-loads on first scan; surfaces confidence per field; never auto-submits

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams and code-level patterns.

### Critical Pitfalls

1. **JSONB expansion breaking existing check reads** — All existing `Payment_Check` rows contain only `{bank, due_date, image_url}`. New `CheckData` Pydantic fields must have `None` defaults; all read paths must use `CheckData.model_validate(data or {})`, never raw dict access. A one-time Alembic data migration should backfill `None` values for new keys on existing rows before deploying. Must be addressed in Phase 1 before anything else is built.

2. **Check status transitions without server-side enforcement** — A generic `PATCH /checks/{id}/status` that writes any status value will allow impossible transitions (e.g., `Cleared → Returned`) that corrupt customer balances. The `_ALLOWED_TRANSITIONS` dict in the service layer is the single source of truth. Named endpoints (`/deposit`, `/clear`) are preferable to a generic status endpoint to prevent this pattern. Terminal states (`Cleared`, `Returned`) have empty allowed sets.

3. **SVG re-renders blocking input on Android** — Naive implementation passes form state directly to SVG props; every keystroke triggers a full re-render, causing >100ms input latency on mid-range Android (actual target hardware). Prevention: `React.memo` on the SVG component, 150ms debounce on prop updates, `useTransition` for non-urgent renders. Test on CPU-throttled DevTools (4x slowdown) before marking done.

4. **Image capture cross-platform failure on Android 14+** — Chrome for Android 14+ removed the camera option from `<input accept="image/*" capture>`. Single-input implementations break silently. Use two separate buttons: "Take Photo" (with `capture="environment"`) and "Choose from Gallery" (without `capture`). Test explicitly on Android Chrome before shipping.

5. **Large check images bloating the offline sync queue** — The existing `syncQueue` stores plain JSON payloads in IndexedDB. Base64-encoded check images (4–11 MB) embedded in sync payloads cause IndexedDB bloat and sync timeouts. Prevention: store image `Blob` objects in a separate `image_uploads` IndexedDB object store (requires version bump to 2); upload image first on reconnect, get URL, then submit payment JSON. Never embed binary in the sync payload.

6. **Bank autocomplete leaking across users on shared devices** — localStorage key must be scoped to user ID (`alofok_banks_{userId}`). Clear on logout. Shared field devices (one phone per route) make this a real multi-user scenario.

7. **SVG RTL/LTR direction conflict** — The app is Arabic-first RTL; the check SVG must be LTR regardless. Set `dir="ltr"` on the SVG root as the first line. Use explicit `text-anchor="start"` on all `<text>` elements. Arabic holder names within the SVG use `unicode-bidi: plaintext`. Amount fields must use Western Arabic numerals (0–9), not Eastern Arabic (٠–٩).

---

## Implications for Roadmap

Based on feature dependencies, architecture build order, and pitfall-phase mapping from research, the milestone should be structured into 4 sequential phases with optional parallelism within Phase 2.

### Phase 1: Enhanced Check Data Schema and Form

**Rationale:** Every other feature depends on the check form having the right fields and the backend schema being typed. This must come first to avoid building on an unstable foundation. The JSONB backward-compatibility pitfall is a blocking risk that must be resolved here before any UI is built on top.

**Delivers:** Extended check form (4 new fields), `CheckData` Pydantic model on backend, TypeScript `CheckData` interface on frontend, Alembic data migration backfilling existing rows, scoped bank name localStorage pattern, updated locale files.

**Addresses (from FEATURES.md):** Extended check data fields (P1)

**Avoids (from PITFALLS.md):**
- Pitfall 1: JSONB expansion breaking old reads — data migration + optional fields with `None` defaults
- Pitfall 7: Bank autocomplete data leaking — user-scoped localStorage key from the start

**Research flag:** Standard patterns — no additional phase research needed. JSONB expansion and form field additions are well-understood.

---

### Phase 2: SVG Check Preview

**Rationale:** Pure UI with no backend dependency. Can be built immediately after Phase 1 provides the form fields that feed the preview. Zero risk to data integrity. Delivers high-value visual feedback that improves data quality for all subsequent features.

**Delivers:** `CheckPreview.tsx` component (inline SVG, LTR, dark-theme compatible with white paper background), `React.memo` + debounce wiring for Android performance, integrated into PaymentFlow check tab.

**Addresses (from FEATURES.md):** Live SVG check preview (P1)

**Avoids (from PITFALLS.md):**
- Pitfall 2: SVG blocking input — bake in memo + debounce from the start
- Pitfall 8: RTL/LTR direction conflict — `dir="ltr"` on SVG root as first line

**Research flag:** Standard patterns — SVG layout and React.memo patterns are well-documented. No research phase needed. Verify with CPU-throttled DevTools test before marking done.

---

### Phase 3: Check Lifecycle Management

**Rationale:** The backend has the `TransactionStatus` enum but only the `Returned` transition is implemented. Admin cannot mark checks as deposited or cleared — these records are stuck at `Pending` indefinitely. This is a functional gap that makes check data unreliable. Backend must come before Admin UI; Admin UI must come before the overdue check quick-action (which reuses the same mutations).

**Delivers:** `update_check_status()` service method with explicit `_ALLOWED_TRANSITIONS` dict, `PATCH /payments/checks/{id}/deposit` and `PATCH /payments/checks/{id}/clear` endpoints (or a modified generic route with transition validation), lifecycle action buttons in StatementView and Admin check panel, React Query invalidation on status change, state machine tests for all invalid transitions.

**Addresses (from FEATURES.md):** Check status lifecycle UI (P1), Overdue check quick-action in Admin (P2)

**Avoids (from PITFALLS.md):**
- Pitfall 3: Lifecycle without backend enforcement — `_ALLOWED_TRANSITIONS` as single source of truth; named endpoints preferred
- Integration gotcha: No optimistic updates on financial state — wait for server confirmation, then invalidate queries

**Research flag:** Standard patterns — state machine with named transition endpoints is a well-documented FastAPI pattern. No research phase needed.

---

### Phase 4: Image Capture and OCR Auto-fill

**Rationale:** Progressive enhancement built on top of the stable foundation from Phases 1-3. Image capture requires the IndexedDB architecture decision (separate Blob store, version bump) before any capture code is shipped. OCR is layered on top of image capture and should be treated as optional — the form remains fully usable without it. This phase has the most platform variance and requires explicit cross-device testing.

**Delivers:**
- `POST /payments/checks/upload-image` backend endpoint (UUID filenames, MIME validation, 5MB size cap)
- Two-button camera/gallery UX in PaymentFlow check tab (Android 14+ compatible)
- IndexedDB v2 upgrade with separate `image_uploads` Blob store
- Offline-first image sync strategy (upload image on reconnect, then submit payment)
- `useCheckOCR.ts` hook with lazy-loaded Tesseract.js worker
- Per-field confidence indicators in the form (green/yellow/red)
- "Clear OCR results" button; spinner with cancel for 2-20s OCR duration

**Addresses (from FEATURES.md):** Check photo capture (P1), OCR auto-fill (P2)

**Avoids (from PITFALLS.md):**
- Pitfall 4: OCR partial result UX — confidence indicators mandatory; never auto-submit
- Pitfall 5: Image capture cross-platform — two inputs, platform detection, explicit Android Chrome test
- Pitfall 6: Large images in sync queue — separate IndexedDB Blob store, IndexedDB VERSION bump to 2

**Research flag:** Needs attention. The two-button capture UX, IndexedDB version upgrade handler, and Tesseract.js lazy-loading pattern are each straightforward in isolation but their integration with the existing offline sync architecture requires careful coordination. Review `frontend/src/lib/syncQueue.ts` and `frontend/src/hooks/useOfflineSync.ts` before designing Phase 4 implementation details.

---

### Phase Ordering Rationale

- **Phase 1 must be first** — all features read check data; backward-compat JSONB schema is the prerequisite for correct reads everywhere
- **Phase 2 can be parallelized within Phase 1** — `CheckPreview.tsx` is pure UI with no backend calls; it can be built in isolation and integrated once Phase 1 form fields exist
- **Phase 3 must follow Phase 1** — service layer and endpoints need typed `CheckData` schema to validate check payment types correctly
- **Phase 4 must follow Phase 1 and 3** — image upload endpoint needs stable payment schema; OCR hook needs form fields to auto-fill; offline sync architecture must be in place before capture is shipped
- **Phases 2 and 3 can be built in parallel** by splitting backend (Phase 3) and frontend UI (Phase 2) work between team members

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4:** IndexedDB version upgrade strategy must be reviewed against the actual `syncQueue.ts` implementation before any code is written. The offline image sync architecture (Blob store, upload-then-create-payment flow) is a non-trivial coordination problem with the existing offline sync hook.

Phases with standard patterns (skip research-phase):
- **Phase 1:** JSONB expansion, Pydantic schema typing, and form field additions are well-documented patterns confirmed by direct codebase analysis.
- **Phase 2:** SVG component patterns and React.memo/debounce for performance are standard React. LTR isolation in RTL app is solved by a single `dir="ltr"` attribute.
- **Phase 3:** FastAPI state machine pattern (transition dict + named endpoints) is standard. React Query invalidation on mutation is documented.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All decisions verified against official docs, npm registry, and GitHub releases. Only 2 new packages; both stable. The one OCR approach conflict (client-side vs server-side) is resolved in favor of client-side on offline-first grounds. |
| Features | HIGH | Based on direct code audit of the actual PaymentFlow.tsx, transaction model, and payment service. Gap analysis is accurate to the current codebase state. OCR accuracy benchmarks are MEDIUM (multiple sources agree on 60-85% range for mobile photos). |
| Architecture | HIGH | Build order derived from direct dependency analysis of actual source files. Data flow diagrams match the codebase. The ARCHITECTURE.md's OCR approach (server-side) contradicts STACK.md (client-side); client-side is the correct choice and ARCHITECTURE.md's Pattern 5 should be ignored. |
| Pitfalls | HIGH | All critical pitfalls are verified against the actual codebase (JSONB gap, sync queue structure, status enum) or against official platform sources (Android 14 capture regression, IndexedDB Blob storage). |

**Overall confidence:** HIGH

### Gaps to Address

- **OCR approach conflict:** STACK.md (correctly) recommends client-side Tesseract.js. ARCHITECTURE.md (incorrectly for this project) documents a server-side pytesseract pattern and calls client-side an anti-pattern, citing a 20MB WASM bundle. Research confirms the WASM bundle for Tesseract.js v5.1.1 is significantly smaller than claimed (language data is ~4MB, loaded lazily, cached after first use). Tesseract.js is the correct choice. Do not add pytesseract to the Docker image.

- **OCR accuracy on Arabic mixed-content checks:** The 60-85% accuracy estimate is for printed text under good conditions. Real-world field conditions (low light, glare, handwritten amounts, MICR font confusion) will push accuracy lower. The confidence indicator UX must be prominent, not subtle, or users will trust wrong OCR values.

- **IndexedDB VERSION upgrade for existing installs:** The current syncQueue IndexedDB is at VERSION 1. Adding the `image_uploads` Blob store requires VERSION 2. The `onupgradeneeded` handler must handle both fresh installs (create all stores from scratch) and upgrades from v1 (add only the new store without touching the existing queue). This logic must be verified against the actual syncQueue initialization code before Phase 4 is designed.

- **Static check image access control:** Check images served from `/static/checks/` are currently unauthenticated — any authenticated user who knows a UUID filename can access another customer's check image. This is acceptable for v1.1 (low risk in a single-business internal app) but should be flagged for a future security review or migration to pre-signed URLs.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase analysis: `backend/app/models/transaction.py`, `services/payment_service.py`, `api/endpoints/payments.py`, `schemas/transaction.py`, `api/endpoints/products.py`
- Direct codebase analysis: `frontend/src/components/Sales/PaymentFlow.tsx`, `StatementView.tsx`, `services/salesApi.ts`, `lib/syncQueue.ts`, `hooks/useOfflineSync.ts`
- [tesseract.js GitHub — releases and bundle size](https://github.com/naptha/tesseract.js/releases)
- [cmdk npm — v1.1.1 current stable](https://www.npmjs.com/package/cmdk)
- [shadcn/ui Combobox docs](https://ui.shadcn.com/docs/components/combobox)
- [MDN: HTML capture attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture)
- [W3C: SVG Tiny in RTL scripts](https://www.w3.org/International/tutorials/svg-tiny-bidi/)

### Secondary (MEDIUM confidence)

- [Smashing Magazine: Image to Text with React and Tesseract.js](https://www.smashingmagazine.com/2021/06/image-text-conversion-react-tesseract-js-ocr/) — OCR accuracy limitations for mobile photos
- [KlearStack: Bank Check Extraction with OCR](https://klearstack.com/bank-check-extraction-using-ocr) — accuracy benchmarks by field type
- [Android 14 file input camera regression — addpipe.com](https://blog.addpipe.com/html-file-input-accept-video-camera-option-is-missing-android-14-15/)
- [Dexie.js: Storing images in IndexedDB as Blobs](https://medium.com/dexie-js/keep-storing-large-images-just-dont-index-the-binary-data-itself-10b9d9c5c5d7)
- [tkdodo: Concurrent optimistic updates in React Query](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)

### Tertiary (LOW confidence — flagged for validation)

- OCR field-level accuracy estimates (amount: MEDIUM, account number: LOW-MEDIUM, holder name: LOW) — based on documented benchmarks, but real-world check photo conditions in the field may produce different results. Validate during Phase 4 QA with real check photos.

---

*Research completed: 2026-03-04*
*Ready for roadmap: yes*
