---
phase: 09-image-capture-and-ocr
plan: "01"
subsystem: image-upload-infrastructure
tags: [backend, indexeddb, offline, image-upload, compression]
dependency_graph:
  requires: []
  provides: [check-image-upload-endpoint, image-compression-utility, check-image-blob-queue, salesapi-upload-method]
  affects: [09-02, 09-03]
tech_stack:
  added: []
  patterns: [canvas-blob-compression, indexeddb-v2-upgrade, formdata-multipart-upload]
key_files:
  created:
    - frontend/src/lib/imageCompression.ts
    - frontend/src/lib/checkImageQueue.ts
  modified:
    - backend/app/api/endpoints/payments.py
    - frontend/src/lib/syncQueue.ts
    - frontend/src/services/salesApi.ts
decisions:
  - "checkImageQueue duplicates openDB() rather than importing from syncQueue to avoid circular dependencies"
  - "onblocked handler added to both openDB implementations to warn about cross-tab upgrade conflicts"
  - "compressImage always outputs JPEG regardless of input format for consistent OCR pipeline"
metrics:
  duration: 120s
  completed_date: "2026-03-04"
  tasks_completed: 2
  files_changed: 5
---

# Phase 9 Plan 1: Image Upload Infrastructure Summary

**One-liner:** Canvas-based JPEG compression, IndexedDB VERSION 2 blob store, and FastAPI multipart upload endpoint for check images.

## What Was Built

All image capture primitives required by subsequent plans (capture UI, OCR, thumbnails):

1. **Backend upload endpoint** (`POST /payments/checks/upload-image`) — Sales-scoped, saves files to `static/checks/`, returns `{"url": "/static/checks/<uuid>.jpg"}`. Mirrors the products upload pattern exactly using `aiofiles` and UUID filenames.

2. **Image compression utility** (`frontend/src/lib/imageCompression.ts`) — Canvas 2D API scales images wider than `maxWidth` (default 1200px) while preserving aspect ratio, then converts to JPEG at configurable quality (default 0.8). Always outputs JPEG for a consistent format regardless of camera output. Cleans up object URLs after load.

3. **salesApi.uploadCheckImage** — FormData POST to `/payments/checks/upload-image`, mirrors the `uploadAvatar` pattern. Accepts `File | Blob` and returns `Promise<{ url: string }>`.

4. **IndexedDB VERSION 2 upgrade** (`frontend/src/lib/syncQueue.ts`) — Bumped `VERSION` from 1 to 2, added idempotent `check_images` object store creation in `onupgradeneeded`. Added `onblocked` handler warning about cross-tab upgrade conflicts. Exported `IMAGE_STORE` constant.

5. **checkImageQueue module** (`frontend/src/lib/checkImageQueue.ts`) — Offline blob storage with `pushImage(blob)`, `getImage(id)`, `removeImage(id)`. Intentionally duplicates `openDB()` to avoid circular imports with `syncQueue.ts`. Both modules open the same DB and must stay in sync on VERSION bumps.

## Verification

- `bunx tsc --noEmit` — passed cleanly
- `bunx vite build` — succeeded (4.27s)
- Backend endpoint: `upload_check_image` function confirmed in payments.py
- `syncQueue.ts`: VERSION = 2, check_images store creation confirmed
- `checkImageQueue.ts`: pushImage, getImage, removeImage all exported
- `imageCompression.ts`: compressImage exported
- `salesApi.ts`: uploadCheckImage method added

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | edd7734 | feat(09-01): backend check image upload endpoint + frontend compression and API utilities |
| 2 | 91b2d19 | feat(09-01): IndexedDB VERSION 2 upgrade with check_images store + checkImageQueue module |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- backend/app/api/endpoints/payments.py: FOUND
- frontend/src/lib/imageCompression.ts: FOUND
- frontend/src/lib/checkImageQueue.ts: FOUND
- frontend/src/lib/syncQueue.ts: FOUND (VERSION=2)
- frontend/src/services/salesApi.ts: FOUND (uploadCheckImage)

Commits verified:
- edd7734: FOUND
- 91b2d19: FOUND
