# Requirements: Alofok v1.1 — Check Enhancement

**Defined:** 2026-03-04
**Core Value:** Sales Reps can capture complete check data with visual confirmation, and Admins can manage check lifecycle from pending to cleared.

## v1.1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Check Data

- [x] **CHK-01**: User can enter bank number (required for check payments)
- [x] **CHK-02**: User can enter branch number (required for check payments)
- [x] **CHK-03**: User can enter account number (required for check payments)
- [x] **CHK-04**: User can enter holder name (optional)
- [x] **CHK-05**: User can select bank name from dropdown of previously used banks or type a new one
- [x] **CHK-06**: Existing check records (pre-v1.1) load without errors through all read paths
- [x] **CHK-07**: Backend validates check data via typed CheckData model (not raw dict)

### Check Preview

- [x] **PRV-01**: User sees a realistic LTR bank check SVG that updates live as they type
- [x] **PRV-02**: Check SVG shows bank name (top left), holder name (top right), date + amount + currency (center), MICR strip `#check# #branch#extra# #account#` (bottom)
- [x] **PRV-03**: Amount is displayed both as digits and written-out words (English)
- [x] **PRV-04**: Check SVG renders correctly when app language is Arabic (no RTL mirroring)
- [x] **PRV-05**: Check SVG input updates are performant on mid-range Android (no input lag)

### Check Lifecycle

- [x] **LCY-01**: Admin can mark a Pending check as Deposited
- [x] **LCY-02**: Admin can mark a Pending or Deposited check as Returned (creates Check_Return debit transaction)
- [x] **LCY-03**: Backend enforces valid transitions only (rejects invalid ones with 409)
- [ ] **LCY-04**: Invalid transition buttons are disabled/hidden in the UI
- [ ] **LCY-05**: Check status is visible in customer statement and admin views

### Check Image

- [ ] **IMG-01**: User can take a photo of a check using device camera
- [ ] **IMG-02**: User can select a check photo from device gallery
- [ ] **IMG-03**: Check photo is uploaded to server and URL stored with check data
- [ ] **IMG-04**: Check photo works across iOS, Android Chrome, and desktop browsers
- [ ] **IMG-05**: Offline check payments queue the image separately (no base64 bloat in sync queue)

### OCR

- [ ] **OCR-01**: User can trigger OCR scan from a captured check photo
- [ ] **OCR-02**: OCR pre-fills form fields (bank number, branch number, account number, amount, holder name)
- [ ] **OCR-03**: OCR results show confidence indicators (high/medium/low per field)
- [ ] **OCR-04**: OCR never auto-submits — user must review and confirm
- [ ] **OCR-05**: OCR works offline (client-side Tesseract.js, language packs cached after first load)
- [ ] **OCR-06**: OCR gracefully handles failure (shows error state, form remains usable)

## Future Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Check Management

- **CMGT-01**: Admin can view all checks grouped by bank and deposit date
- **CMGT-02**: Admin can batch-select checks for deposit
- **CMGT-03**: Check reconciliation view against bank statements

### Check Automation

- **CAUT-01**: Notification when check due date is approaching
- **CAUT-02**: Automatic reminders for overdue checks

## Out of Scope

| Feature | Reason |
|---------|--------|
| MICR magnetic ink decoding | Mobile cameras cannot read MICR magnetic encoding — manual entry with visual preview is sufficient |
| Automatic check status progression (cron) | Business rules vary by bank; auto-advancing without human confirmation creates false accounting state |
| Server-side OCR | Breaks offline-first requirement; client-side Tesseract.js works in Web Worker |
| Full auto-OCR without review | 60-85% accuracy on mobile check photos; financial data errors cost more than typing |
| Check batching/reconciliation | Beyond current needs; overdue checks table is sufficient |
| Cleared status | User chose Deposit + Return only for this milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CHK-01 | Phase 6 | Complete |
| CHK-02 | Phase 6 | Complete |
| CHK-03 | Phase 6 | Complete |
| CHK-04 | Phase 6 | Complete |
| CHK-05 | Phase 6 | Complete |
| CHK-06 | Phase 6 | Complete |
| CHK-07 | Phase 6 | Complete |
| PRV-01 | Phase 7 | Complete |
| PRV-02 | Phase 7 | Complete |
| PRV-03 | Phase 7 | Complete |
| PRV-04 | Phase 7 | Complete |
| PRV-05 | Phase 7 | Complete |
| LCY-01 | Phase 8 | Complete |
| LCY-02 | Phase 8 | Complete |
| LCY-03 | Phase 8 | Complete |
| LCY-04 | Phase 8 | Pending |
| LCY-05 | Phase 8 | Pending |
| IMG-01 | Phase 9 | Pending |
| IMG-02 | Phase 9 | Pending |
| IMG-03 | Phase 9 | Pending |
| IMG-04 | Phase 9 | Pending |
| IMG-05 | Phase 9 | Pending |
| OCR-01 | Phase 9 | Pending |
| OCR-02 | Phase 9 | Pending |
| OCR-03 | Phase 9 | Pending |
| OCR-04 | Phase 9 | Pending |
| OCR-05 | Phase 9 | Pending |
| OCR-06 | Phase 9 | Pending |

**Coverage:**
- v1.1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after roadmap creation*
