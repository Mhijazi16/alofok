---
phase: 07-svg-check-preview
plan: "02"
subsystem: ui
tags: [react, svg, check-preview, payment, ltr, micr, bank-autocomplete]

# Dependency graph
requires:
  - phase: 07-01
    provides: convertAmountToWords utility and MICR E13B font foundation
provides:
  - CheckPreview inline SVG component (600x275 viewBox, LTR, memoized)
  - focusedField tracking in PaymentFlow with per-field highlight zones
  - onFocus/onBlur on BankAutocomplete trigger button
affects:
  - Phase 8 (Check Lifecycle) — check form UI patterns established
  - Phase 9 (Image Capture/OCR) — PaymentFlow shape established

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "React.memo + useMemo pattern for expensive SVG memoization"
    - "dir=ltr wrapper + direction=ltr on all SVG text elements for RTL isolation"
    - "textLength/lengthAdjust auto-shrink for long SVG text overflow"
    - "focusedField state with onFocus/onBlur to highlight SVG zones"

key-files:
  created:
    - frontend/src/components/Sales/CheckPreview.tsx
  modified:
    - frontend/src/components/Sales/PaymentFlow.tsx
    - frontend/src/components/ui/bank-autocomplete.tsx

key-decisions:
  - "dir=ltr on outer div + direction=ltr on every SVG text element (belt-and-suspenders RTL protection)"
  - "textLength + lengthAdjust=spacingAndGlyphs for written amount >60 chars (no truncation)"
  - "focusedField state lives in PaymentFlow, passed as prop to CheckPreview (single source of truth)"
  - "MICR strip rendered with Unicode check symbols: ⑆ (transit) and ⑈⑉ (routing/amount)"
  - "Warm cream paper (#faf7f2) with inner decorative border for realistic check aesthetic"

patterns-established:
  - "SVG check zones: top-left bank name, top-right holder, date, amount box, written pay line, MICR strip"
  - "Focus highlight: <rect fill=#dc2626 fillOpacity=0.06 rx=4> over active zone"
  - "Placeholder vs value text: #b0a898 for empty, #1a1a1a for real values"

requirements-completed: [PRV-01, PRV-02, PRV-03, PRV-04, PRV-05]

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 7 Plan 02: SVG Check Preview Summary

**Memoized inline SVG bank check (600x275 LTR) with live field updates, focus zone highlights, and MICR strip integrated into PaymentFlow**

## Performance

- **Duration:** ~2 min (131 seconds)
- **Started:** 2026-03-04T12:54:26Z
- **Completed:** 2026-03-04T12:56:37Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Created `CheckPreview.tsx`: realistic bank check SVG with all zones (bank name, holder, date, amount box, written amount, MICR strip), wrapped in `React.memo` with `useMemo` for `convertAmountToWords`
- Integrated `CheckPreview` into `PaymentFlow.tsx` above the check form fields with `focusedField` state tracking across all 7 check form inputs
- Added `onFocus`/`onBlur` optional props to `BankAutocomplete` component, wired to the Popover trigger button

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CheckPreview SVG component and add onFocus/onBlur to BankAutocomplete** - `a5bdedd` (feat)
2. **Task 2: Integrate CheckPreview into PaymentFlow and wire focusedField tracking** - `0a78ab6` (feat)

**Plan metadata:** See final commit below.

## Files Created/Modified

- `frontend/src/components/Sales/CheckPreview.tsx` - Memoized inline SVG check preview component, 387 lines
- `frontend/src/components/Sales/PaymentFlow.tsx` - Added CheckPreview integration, focusedField state, onFocus/onBlur on all check inputs
- `frontend/src/components/ui/bank-autocomplete.tsx` - Added onFocus/onBlur optional props to interface and trigger button

## Decisions Made

- dir=ltr on outer div wrapper AND direction=ltr attribute on every `<text>` element and the `<svg>` element itself — belt-and-suspenders protection against Android WebView RTL inheritance
- Auto-shrink written amount text using `textLength={552}` + `lengthAdjust="spacingAndGlyphs"` when `amountInWords.length > 60` — no truncation
- `focusedField` state lives in PaymentFlow and is passed as a prop to CheckPreview — single source of truth, clean unidirectional data flow
- MICR line uses Unicode symbols ⑆ (transit routing) and ⑈⑉ (on-us fields) for visual realism pending actual MICR E13B font
- Paper background #faf7f2 (warm cream) with subtle inner decorative border — contrasts well against app's dark theme

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — TypeScript compiled cleanly after all edits, Vite build succeeded (4.26s, 3529 modules).

## User Setup Required

None — no external service configuration required.

## Self-Check: PASSED

- `frontend/src/components/Sales/CheckPreview.tsx` — FOUND
- `frontend/src/components/Sales/PaymentFlow.tsx` — FOUND
- `frontend/src/components/ui/bank-autocomplete.tsx` — FOUND
- Commit `a5bdedd` — FOUND
- Commit `0a78ab6` — FOUND
- `React.memo` wrapping — FOUND (line 387)
- `viewBox="0 0 600 275"` — FOUND (line 106)
- `setFocusedField` occurrences in PaymentFlow — 15 (covers all 7 fields with focus+blur pairs plus state declaration)

## Next Phase Readiness

- Phase 7 complete: live check SVG preview is fully integrated and functional
- Ready for Phase 8: Check Lifecycle Management (Deposit + Return, state machine)
- CheckPreview renders correctly with MICR font placeholder — actual OFL-licensed font file replacement still flagged (Phase 7 Decision)

---
*Phase: 07-svg-check-preview*
*Completed: 2026-03-04*
