# Phase 9: Image Capture and OCR - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Camera/gallery capture of check photos with offline-safe storage and upload, plus optional client-side OCR auto-fill from check photos. Photo is stored against the payment's `image_url` field. Check photos are viewable across admin, sales, and customer views. No new payment logic or check lifecycle changes.

</domain>

<decisions>
## Implementation Decisions

### Capture UX
- Photo capture section positioned ABOVE the check SVG preview (capture-first flow — user photographs, then fills/verifies details)
- Two separate buttons: Camera icon + Gallery icon side by side (Android 14+ compatibility, no option sheet)
- After capture: large preview (~40-50% width) showing the check photo clearly, with retake and remove buttons
- Photo attachment is fully optional — user can submit check payment without a photo

### Offline Image Handling
- Upload pending badge visible on check entries with unsynced images (disappears after upload completes)
- Blobs deleted from IndexedDB after successful server upload (keep device storage clean)

### OCR Interaction
- Explicit "Scan Check" button appears after photo capture — OCR never starts automatically
- OCR attempts all fields: bank number, branch number, account number, amount, holder name (best effort)
- Color-coded form field borders for confidence: green = high, yellow = medium, red = low
- Spinner overlay on check photo during OCR processing (form stays as-is until results arrive)
- OCR results pre-fill fields but NEVER auto-submit — user must review and confirm each field (OCR-04)

### Image Display
- Check photos viewable everywhere checks appear: Admin check list, Sales statement, Customer portal statement
- Small thumbnail on every check card/row that has a photo
- Tap thumbnail to view full photo (display method at Claude's discretion)

### Claude's Discretion
- Sync order: upload image first then payment, or payment first then patch image_url — pick best for data integrity
- Image compression strategy: balance OCR accuracy vs storage/upload speed
- Offline upload pending indicator style (follows existing offline patterns in app)
- Full photo viewer implementation (fullscreen lightbox vs inline expand)
- Missing photo indicator on checks without photos (subtle hint vs no indicator)
- Camera/gallery button styling and layout details
- Tesseract.js language pack caching strategy for offline OCR
- OCR field extraction approach (MICR line parsing vs full image analysis vs hybrid)

</decisions>

<specifics>
## Specific Ideas

- Capture-first flow: user photographs the check, then OCR can pre-fill fields, then user verifies — natural left-to-right workflow
- Two-button camera/gallery approach avoids Android 14+ `capture` attribute issues
- Large photo preview lets user verify the image is readable before triggering OCR
- Color-coded borders (green/yellow/red) per field give instant confidence feedback without extra UI elements
- Explicit scan button respects OCR-04 (never auto-submit) and gives user control over when to spend processing time

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FileUpload` component (`frontend/src/components/ui/file-upload.tsx`): Drag-drop + click upload with preview, validation, progress bar. Desktop-oriented but patterns reusable (validation, preview URL management, cleanup)
- `syncQueue.ts` (`frontend/src/lib/syncQueue.ts`): IndexedDB VERSION 1, single `sync_queue` store. Needs VERSION 2 upgrade with new `check_images` object store for blobs
- `image.ts` (`frontend/src/lib/image.ts`): `getImageUrl()` helper resolves paths to `/static` — reuse for check image URLs
- `CheckPreview` component: SVG preview in PaymentFlow — capture section inserts above this
- `useOfflineSync` hook: `isOnline` state — use to decide immediate upload vs queue
- `PaymentFlow.tsx`: All check state vars available; photo capture integrates at top of check section

### Established Patterns
- Inline SVG in React components (CheckPreview pattern)
- `useToast` for success/error feedback
- `useMutation` + `useQueryClient` for server mutations with cache invalidation
- Badge component with `warning`/`success`/`destructive` variants — reuse for upload status
- Glass effects and dark theme — photo viewer should use dark overlay

### Integration Points
- `PaymentFlow.tsx`: Add capture section above `<CheckPreview />`, pass `imageFile` state to submission logic
- `syncQueue.ts`: VERSION 1→2 upgrade, add `check_images` object store, handle fresh install + upgrade
- `salesApi.ts` `CheckData` interface: `image_url` field already exists — needs upload endpoint
- Backend `/static/checks/` directory for served check images (noted: unauthenticated in v1.1)
- Admin `AdminChecksView`, Sales `StatementView`, Customer `StatementView`: Add photo thumbnail rendering
- Backend needs: `POST /checks/upload` endpoint accepting multipart file, returning stored URL

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-image-capture-and-ocr*
*Context gathered: 2026-03-04*
