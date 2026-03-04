---
phase: 09-image-capture-and-ocr
plan: 02
subsystem: ui
tags: [react, camera, indexeddb, file-api, offline-sync, image-upload]

requires:
  - phase: 09-01
    provides: imageCompression.ts, checkImageQueue.ts, uploadCheckImage endpoint, syncQueue VERSION 2

provides:
  - CheckCapture component with camera/gallery capture, photo preview, retake/remove buttons
  - CheckCapture integrated above CheckPreview in PaymentFlow for check payments
  - Online path: uploadCheckImage before createPayment, image_url in CheckData
  - Offline path: checkImageQueue.pushImage, pending_image_id in queued payload
  - useOfflineSync flush enhanced to upload pending images before submitting queued payments
  - Locale keys under 'capture' namespace in ar.json and en.json

affects: [09-03-ocr, PaymentFlow, useOfflineSync]

tech-stack:
  added: []
  patterns:
    - "Two hidden file inputs (capture=environment / no capture) for Android 14+ camera + gallery separation"
    - "Blob lifecycle: createObjectURL for preview, revokeObjectURL in cleanup effect and on remove/retake"
    - "Offline image pipeline: IndexedDB blob store -> pending_image_id in queue item -> upload on flush"

key-files:
  created:
    - frontend/src/components/Sales/CheckCapture.tsx
  modified:
    - frontend/src/components/Sales/PaymentFlow.tsx
    - frontend/src/hooks/useOfflineSync.ts
    - frontend/src/locales/ar.json
    - frontend/src/locales/en.json

key-decisions:
  - "Image upload failure on online path is non-fatal — payment submits without image_url rather than blocking user"
  - "pending_image_id stripped from payload before createPayment call (server does not accept that field)"
  - "Blob cleaned from IndexedDB immediately after successful upload during flush, not on payment success (avoids orphaned blobs)"
  - "useOfflineSync flush handles missing blob gracefully (duplicate flush, already deleted) — proceeds without image"
  - "CheckCapture exposes isScanning and onScanCheck prop slots as no-ops now, wired in Plan 03"

patterns-established:
  - "Locale namespace 'capture' for all photo/scanning UI strings"

requirements-completed: [IMG-01, IMG-02, IMG-04, IMG-05]

duration: 8min
completed: 2026-03-04
---

# Phase 09 Plan 02: Check Capture Component and PaymentFlow Integration Summary

**CheckCapture component with camera/gallery buttons and photo preview integrated into PaymentFlow — online submissions upload the image first, offline submissions store the blob in IndexedDB and upload on reconnect.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-04T16:10:00Z
- **Completed:** 2026-03-04T16:18:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- CheckCapture component with two hidden file inputs (camera + gallery), image compression on selection, preview with retake/remove
- PaymentFlow renders CheckCapture above CheckPreview for check payments; image state managed with proper URL lifecycle cleanup
- useOfflineSync flush extended to handle `pending_image_id` — uploads blob from IndexedDB, injects `image_url` into CheckData, removes blob after successful upload

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CheckCapture component** - `e810f8c` (feat)
2. **Task 2: Integrate CheckCapture into PaymentFlow with online upload and offline blob queueing** - `3f46d7e` (feat)

**Plan metadata:** (final commit — see below)

## Files Created/Modified

- `frontend/src/components/Sales/CheckCapture.tsx` - Camera/gallery capture component with photo preview, retake/remove, scanning overlay slot
- `frontend/src/components/Sales/PaymentFlow.tsx` - Added imageBlob/imagePreviewUrl/imageUrl state, CheckCapture render, online upload path, offline blob queue path
- `frontend/src/hooks/useOfflineSync.ts` - flush extended to detect pending_image_id, upload blob, inject image_url, remove blob from IndexedDB
- `frontend/src/locales/ar.json` - Added 'capture' namespace with 8 Arabic keys
- `frontend/src/locales/en.json` - Added 'capture' namespace with 8 English keys

## Decisions Made

- Image upload failure on the online path is non-fatal — payment submits without `image_url` rather than blocking the user (failure is logged, toast goes through normally)
- `pending_image_id` is stripped from payload before `createPayment` (server schema does not accept that field)
- Blob is removed from IndexedDB immediately after successful upload during flush, not waiting for payment success
- `useOfflineSync` handles missing/already-deleted blob gracefully — proceeds without image rather than throwing
- `isScanning` and `onScanCheck` prop slots in CheckCapture are wired as optional no-ops; Plan 03 will provide real values

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed spurious Plan 03 imports added by linter**
- **Found during:** Task 2 (PaymentFlow integration)
- **Issue:** A linter/formatter injected `useOcr`, `OcrConfidenceLevel`, `confidenceBorderClass` imports that don't exist yet (Plan 03 artifacts)
- **Fix:** Removed the spurious import line from PaymentFlow.tsx
- **Files modified:** frontend/src/components/Sales/PaymentFlow.tsx
- **Verification:** `bunx tsc --noEmit` passes; `bunx vite build` succeeds
- **Committed in:** `3f46d7e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix prevented build failure from non-existent imports. No scope creep.

## Issues Encountered

None beyond the linter deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CheckCapture slots (`isScanning`, `onScanCheck`) are ready for Plan 03 to wire OCR
- PaymentFlow already tracks `imageBlob` for OCR to read from
- useOfflineSync flush is complete — no further changes needed for image sync

---
*Phase: 09-image-capture-and-ocr*
*Completed: 2026-03-04*
