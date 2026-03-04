# Roadmap: Alofok

## Milestones

- [x] **v1.0 Core Trading Platform** - Phases 1-5 (shipped 2026-03-04)
- [ ] **v1.1 Check Enhancement** - Phases 6-9 (in progress)

## Phases

<details>
<summary>v1.0 Core Trading Platform (Phases 1-5) - SHIPPED 2026-03-04</summary>

Phases 1-5 were pre-GSD tracked via Feature.json. Shipped all 22 original PRD features plus: design system rebuild, customer portal, delivery date routing, bonus orders, multi-select order cards, admin reassignment, order delete/undeliver.

</details>

### v1.1 Check Enhancement (In Progress)

**Milestone Goal:** Transform the basic check payment form into a rich, realistic check capture experience with full lifecycle management and OCR auto-fill.

- [x] **Phase 6: Check Data Foundation** - Expand check schema to full typed model, extend the payment form with bank/branch/account/holder fields (completed 2026-03-04)
- [x] **Phase 7: SVG Check Preview** - Live LTR bank check preview that mirrors a real check and updates as the user types (completed 2026-03-04)
- [x] **Phase 8: Check Lifecycle Management** - Admin can advance checks from Pending to Deposited or Returned with server-enforced state transitions (completed 2026-03-04)
- [ ] **Phase 9: Image Capture and OCR** - Camera/gallery capture with offline-safe upload, plus optional OCR auto-fill from check photos

## Phase Details

### Phase 6: Check Data Foundation
**Goal**: Sales Reps can enter complete check data (bank number, branch, account, holder name) and existing check records load correctly everywhere
**Depends on**: Phase 5 (v1.0 complete)
**Requirements**: CHK-01, CHK-02, CHK-03, CHK-04, CHK-05, CHK-06, CHK-07
**Success Criteria** (what must be TRUE):
  1. User can enter bank number, branch number, and account number when creating a check payment
  2. User can select a bank name from previously used banks or type a new one
  3. All existing check payment records load without errors across statement, admin, and sales views
  4. Backend rejects malformed check payloads and validates check fields via typed schema
**Plans**: 2 plans
  - [ ] 06-01-PLAN.md -- Backend CheckData schema, service validation, data migration, frontend types, locales
  - [ ] 06-02-PLAN.md -- BankAutocomplete component, PaymentFlow form expansion, logout cleanup

### Phase 7: SVG Check Preview
**Goal**: User sees a live, realistic bank check SVG beside the form that reflects exactly what they have entered
**Depends on**: Phase 6
**Requirements**: PRV-01, PRV-02, PRV-03, PRV-04, PRV-05
**Success Criteria** (what must be TRUE):
  1. A check preview SVG appears in the payment form showing bank name, holder name, date, amount, and MICR strip as the user types
  2. The amount displays as both digits and written-out English words on the check face
  3. The check SVG remains left-to-right when the app is in Arabic mode
  4. Typing in the form fields does not cause perceptible lag on a mid-range Android device
**Plans**: 2 plans
  - [ ] 07-01-PLAN.md -- Install to-words, create amountToWords.ts utility, add MICR font and @font-face
  - [ ] 07-02-PLAN.md -- Create CheckPreview SVG component, integrate into PaymentFlow with focusedField tracking

### Phase 8: Check Lifecycle Management
**Goal**: Admin can advance check status from Pending to Deposited, and mark any non-terminal check as Returned, with the UI preventing invalid transitions
**Depends on**: Phase 6
**Requirements**: LCY-01, LCY-02, LCY-03, LCY-04, LCY-05
**Success Criteria** (what must be TRUE):
  1. Admin can mark a Pending check as Deposited from the admin panel
  2. Admin can mark a Pending or Deposited check as Returned, which re-debits the customer balance
  3. Invalid transition buttons (e.g., depositing a Returned check) are absent or disabled in the UI
  4. The backend rejects an invalid transition request with a 409 response even if sent directly
  5. Check status (Pending / Deposited / Returned) is visible in the customer statement view and admin check list
**Plans**: 2 plans
  - [ ] 08-01-PLAN.md -- Backend: deposit_check service method, return_check notes parameter, RBAC endpoints, CheckOut schema, admin check list endpoint
  - [ ] 08-02-PLAN.md -- Frontend: AdminChecksView component with filter pills and deposit/return dialogs, AdminPanel integration, StatementView status badges, locale keys

### Phase 9: Image Capture and OCR
**Goal**: User can photograph or upload a check image that is stored against the payment, and optionally trigger OCR to pre-fill form fields
**Depends on**: Phase 6, Phase 8
**Requirements**: IMG-01, IMG-02, IMG-03, IMG-04, IMG-05, OCR-01, OCR-02, OCR-03, OCR-04, OCR-05, OCR-06
**Success Criteria** (what must be TRUE):
  1. User can take a check photo with the device camera or choose one from the gallery from within the payment form
  2. The check photo uploads to the server and its URL is stored with the check data
  3. Offline check payments queue the image separately and upload it on reconnection without bloating the sync payload
  4. User can trigger OCR on a captured photo and see pre-filled form fields with per-field confidence indicators
  5. OCR results are never auto-submitted — the user must review and confirm each field
  6. If OCR fails or is unavailable, the form remains fully usable and shows a clear error state
**Plans**: 4 plans
Plans:
- [x] 09-01-PLAN.md -- Backend upload endpoint, IndexedDB V2 upgrade, checkImageQueue, imageCompression, salesApi upload
- [ ] 09-02-PLAN.md -- CheckCapture component with camera/gallery, PaymentFlow integration, offline blob queueing
- [ ] 09-03-PLAN.md -- useOcr hook (Tesseract.js), OCR field extraction, confidence borders, error handling
- [ ] 09-04-PLAN.md -- CheckPhotoThumbnail component, photo display in Admin/Sales/Customer views

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 6. Check Data Foundation | 2/2 | Complete   | 2026-03-04 | - |
| 7. SVG Check Preview | 2/2 | Complete   | 2026-03-04 | - |
| 8. Check Lifecycle Management | 2/2 | Complete   | 2026-03-04 | - |
| 9. Image Capture and OCR | 3/4 | In Progress|  | - |
