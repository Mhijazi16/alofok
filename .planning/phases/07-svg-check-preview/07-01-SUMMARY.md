---
phase: 07-svg-check-preview
plan: "01"
subsystem: frontend-utilities
tags: [to-words, micr-font, amount-conversion, check-preview]
dependency_graph:
  requires: []
  provides: [amountToWords-utility, micr-font-declaration]
  affects: [frontend/src/lib/amountToWords.ts, frontend/src/index.css, frontend/public/fonts/MicrE13b.woff2]
tech_stack:
  added: [to-words@5.2.0]
  patterns: [lazy-initialized-converter-map, try-catch-empty-string-fallback]
key_files:
  created:
    - frontend/src/lib/amountToWords.ts
    - frontend/public/fonts/MicrE13b.woff2
  modified:
    - frontend/package.json
    - frontend/bun.lock
    - frontend/src/index.css
key_decisions:
  - "to-words@5.2.0 with doNotAddOnly:true removes 'Only' suffix from output"
  - "MICR font is placeholder (Strategy B) — real OFL font needs manual replacement"
  - "font-display: block used to prevent fallback font flash on check preview"
metrics:
  duration: 143s
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 2
  completed_date: "2026-03-04"
---

# Phase 7 Plan 01: Foundational Utilities — Amount-to-Words and MICR Font Summary

**One-liner:** Install to-words@5.2.0 and create ILS/USD/JOD currency converters with MICR E13B @font-face placeholder for check strip rendering.

## What Was Built

### Task 1: to-words Installation and amountToWords.ts

Installed `to-words@5.2.0` and created `frontend/src/lib/amountToWords.ts` with:

- Three pre-initialized `ToWords` instances (ILS, USD, JOD) stored in a `converters` map
- `convertAmountToWords(amount, currency)` exported function
- Returns empty string for zero, negative, or error cases
- `doNotAddOnly: true` removes the "Only" suffix from output

Verified output:
- `convertAmountToWords(1250.50, "ILS")` → `"One Thousand Two Hundred Fifty Israeli Shekels And Fifty Agorot"`
- `convertAmountToWords(0, "USD")` → `""`
- `convertAmountToWords(-5, "ILS")` → `""`
- `convertAmountToWords(999999.99, "JOD")` → `"Nine Hundred Ninety Nine Thousand Nine Hundred Ninety Nine Jordanian Dinars And Ninety Nine Fils"`

### Task 2: MICR Font and @font-face

- Created `frontend/public/fonts/` directory
- Placed a placeholder `MicrE13b.woff2` (Strategy B — no OFL MICR font was downloadable programmatically)
- Added `@font-face` for `"MICR"` family in `frontend/src/index.css` before `@tailwind base;`
- `font-display: block` prevents fallback font flash during check preview render
- Fallback chain: `MICR, 'Courier New', monospace`

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written.

### Notes

**Strategy B applied for MICR font:** Multiple attempts to download a free MICR E13B woff2 font programmatically failed (GitHub 404s, CDN misses). Per the plan's Strategy B, a placeholder file was created with instructions for manual replacement. The check strip will render using `'Courier New', monospace` fallback until a real font is placed. This is acceptable for this milestone — the MICR strip is decorative.

To replace with a real font:
1. Download GnuMICR from https://sourceforge.net/projects/gnumicr/ (GPL-licensed)
2. Convert to woff2: `woff2_compress MicrE13b.ttf`
3. Place at `frontend/public/fonts/MicrE13b.woff2`

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install to-words and create amountToWords.ts | 7ebd8e5 | frontend/src/lib/amountToWords.ts, package.json, bun.lock |
| 2 | Add MICR E13B web font and @font-face declaration | 338129f | frontend/public/fonts/MicrE13b.woff2, frontend/src/index.css |

## Verification Results

All 7 plan verification criteria passed:
1. `to-words` in package.json: `"to-words": "^5.2.0"` ✓
2. `convertAmountToWords` exported from amountToWords.ts ✓
3. `convertAmountToWords(1250.50, "ILS")` returns "One Thousand Two Hundred Fifty Israeli Shekels And Fifty Agorot" ✓
4. `frontend/public/fonts/MicrE13b.woff2` exists ✓
5. `@font-face` for "MICR" in `index.css` ✓
6. `bunx tsc --noEmit` passes ✓
7. `bun run build` succeeds ✓

## Self-Check: PASSED

Files exist:
- `frontend/src/lib/amountToWords.ts` — FOUND
- `frontend/public/fonts/MicrE13b.woff2` — FOUND
- `frontend/src/index.css` contains `font-family: "MICR"` — FOUND

Commits exist:
- `7ebd8e5` — FOUND
- `338129f` — FOUND
