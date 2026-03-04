# Phase 9: Image Capture and OCR - Research

**Researched:** 2026-03-04
**Domain:** Mobile image capture, IndexedDB blob storage, client-side OCR (Tesseract.js), FastAPI multipart upload
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Photo capture section positioned ABOVE the check SVG preview (capture-first flow)
- Two separate buttons: Camera icon + Gallery icon side by side (Android 14+ compatibility, no option sheet)
- After capture: large preview (~40-50% width) showing the check photo, with retake and remove buttons
- Photo attachment is fully optional — user can submit check payment without a photo
- Upload pending badge visible on check entries with unsynced images (disappears after upload completes)
- Blobs deleted from IndexedDB after successful server upload (keep device storage clean)
- Explicit "Scan Check" button appears after photo capture — OCR never starts automatically
- OCR attempts all fields: bank number, branch number, account number, amount, holder name (best effort)
- Color-coded form field borders for confidence: green = high, yellow = medium, red = low
- Spinner overlay on check photo during OCR processing (form stays as-is until results arrive)
- OCR results pre-fill fields but NEVER auto-submit — user must review and confirm each field (OCR-04)
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IMG-01 | User can take a photo of a check using device camera | Two hidden `<input type="file">` elements: one with `capture="environment"`, one without — avoids Android 14+ option-sheet regression |
| IMG-02 | User can select a check photo from device gallery | Hidden `<input type="file" accept="image/*">` without `capture` attribute; triggers gallery on mobile |
| IMG-03 | Check photo is uploaded to server and URL stored with check data | New `POST /payments/checks/upload-image` FastAPI endpoint (mirrors `/products/upload-image` pattern); URL stored in `CheckData.image_url` via PATCH or at payment creation |
| IMG-04 | Check photo works across iOS, Android Chrome, and desktop browsers | `accept="image/*"` without `capture` forces gallery on iOS (no native split); two-button approach sidesteps Android 14+ `capture` attribute behavior |
| IMG-05 | Offline check payments queue the image separately (no base64 bloat in sync queue) | IndexedDB VERSION 1→2 upgrade adds `check_images` object store; Blob stored separately from payment JSON payload |
| OCR-01 | User can trigger OCR scan from a captured check photo | Explicit "Scan Check" button after photo capture; calls `worker.recognize()` with canvas-drawn image |
| OCR-02 | OCR pre-fills form fields (bank number, branch number, account number, amount, holder name) | Tesseract.js v5 returns `data.words[]` with `text` + `confidence`; regex patterns extract MICR-format numbers |
| OCR-03 | OCR results show confidence indicators (high/medium/low per field) | Color-coded border: green ≥ 70, yellow 40–69, red < 40; driven by per-word avg confidence from Tesseract |
| OCR-04 | OCR never auto-submits — user must review and confirm | OCR results pre-populate state only; existing confirmation flow unchanged |
| OCR-05 | OCR works offline (client-side Tesseract.js, language packs cached after first load) | Tesseract.js uses IndexedDB for `eng.traineddata` cache automatically; `cacheMethod: 'write'` (default) on first run |
| OCR-06 | OCR gracefully handles failure (shows error state, form remains usable) | try/catch around `worker.recognize()`; toast error + clear spinner; form fields remain unchanged |
</phase_requirements>

---

## Summary

Phase 9 adds two capabilities to the check payment flow: (1) capturing or selecting a check photo and syncing it to the server, and (2) optionally triggering client-side OCR to pre-fill form fields. Both are optional — the form works without a photo and OCR errors don't block submission.

The image capture path is pure HTML: two hidden `<input type="file">` elements triggered by Camera and Gallery buttons. This two-button approach is mandated because Android 14+ changed the behavior of a single input with `capture="environment"` — it now bypasses the option sheet and goes directly to camera, removing gallery access. Separating them into two explicit buttons gives predictable cross-platform behavior.

The offline path uses an IndexedDB version upgrade from 1 to 2, adding a `check_images` object store for Blob storage. The payment JSON queue entry stores a `pending_image_id` foreign key. On reconnect, the sync flusher uploads the blob first to get a URL, patches the payment's `image_url`, then deletes the blob from IndexedDB.

Tesseract.js v7 is the current stable version. The API has been stable since v5 — `createWorker(lang)` then `worker.recognize(image)`. Language packs are auto-cached in IndexedDB by Tesseract itself, so offline OCR works after first use without extra infrastructure.

**Primary recommendation:** Mirror the existing `/products/upload-image` endpoint pattern for the new `/payments/checks/upload-image` endpoint. Use `require_sales` dependency. Store images in `static/checks/`. Tesseract.js runs in its own Web Worker (off main thread) to avoid blocking the UI during recognition.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tesseract.js | ^5.1.0 (v7 available) | Client-side OCR in Web Worker | Locked decision; pure JS, no server round-trip, offline-capable |
| HTML `<input type="file">` | Native | Camera + gallery capture | No library needed; native browser API handles file selection across platforms |
| Canvas 2D API | Native | Image compression before upload/OCR | Built-in; `canvas.toBlob()` handles JPEG compression with quality parameter |
| IndexedDB | Native (via current syncQueue.ts) | Offline Blob storage | Already used in project (VERSION 1); upgrade to VERSION 2 needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| browser-image-compression | ^2.0.2 | JPEG compression before upload | Optional — Canvas API alone is sufficient; only add if EXIF orientation fix is needed |
| aiofiles | 24.1.0 (already installed) | Async file write in FastAPI | Already in requirements.txt; same pattern as products/upload-image |
| python-multipart | 0.0.17 (already installed) | FastAPI multipart form handling | Already in requirements.txt |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tesseract.js v5 | Tesseract.js v7 | v7 is latest with 15-35% faster runtime via relaxedsimd; v5 still works. Use latest stable at install time (`bun add tesseract.js`) |
| Canvas compression | browser-image-compression | browser-image-compression auto-fixes EXIF orientation (mobile camera rotation); Canvas requires manual EXIF handling. Use Canvas first; add library only if rotated images are reported |
| Two `<input>` elements | Capacitor Camera plugin | Capacitor requires native build; not needed for web-first phase |

**Installation:**
```bash
# From /frontend
bun add tesseract.js
```

---

## Architecture Patterns

### Recommended File/Component Structure
```
frontend/src/
├── components/Sales/
│   ├── PaymentFlow.tsx         # Modified: add CheckCapture section above CheckPreview
│   └── CheckCapture.tsx        # NEW: camera/gallery buttons, preview, OCR trigger
├── components/ui/
│   └── check-photo-thumbnail.tsx  # NEW: small thumbnail + lightbox viewer for all views
├── lib/
│   ├── syncQueue.ts            # Modified: VERSION 1→2, add check_images store
│   ├── checkImageQueue.ts      # NEW: push/get/remove for check_images blob store
│   └── imageCompression.ts    # NEW: canvas-based JPEG resize+compress
├── hooks/
│   └── useOcr.ts               # NEW: Tesseract worker lifecycle, recognize, loading state
└── services/
    └── salesApi.ts             # Modified: add uploadCheckImage()

backend/app/
├── api/endpoints/
│   └── payments.py             # Modified: add POST /checks/upload-image endpoint
└── static/
    └── checks/                 # NEW directory (mkdir in endpoint handler)
```

### Pattern 1: Two-Button Camera/Gallery Capture
**What:** Two separate hidden `<input type="file">` elements, each triggered by a distinct icon button.
**When to use:** Always — locked decision for Android 14+ compatibility.
**Example:**
```tsx
// Source: MDN HTML capture attribute + web.dev media-capturing-images
const cameraInputRef = useRef<HTMLInputElement>(null);
const galleryInputRef = useRef<HTMLInputElement>(null);

// Camera button: capture="environment" goes straight to rear camera
<input
  ref={cameraInputRef}
  type="file"
  accept="image/*"
  capture="environment"
  className="hidden"
  onChange={(e) => handleFile(e.target.files?.[0])}
/>

// Gallery button: no capture attribute = file picker / gallery
<input
  ref={galleryInputRef}
  type="file"
  accept="image/*"
  className="hidden"
  onChange={(e) => handleFile(e.target.files?.[0])}
/>

<div className="flex gap-2">
  <Button variant="outline" size="icon" onClick={() => cameraInputRef.current?.click()}>
    <Camera className="h-4 w-4" />
  </Button>
  <Button variant="outline" size="icon" onClick={() => galleryInputRef.current?.click()}>
    <ImageIcon className="h-4 w-4" />
  </Button>
</div>
```

### Pattern 2: Canvas Image Compression
**What:** Resize image to max 1200px wide, compress to JPEG 80% quality before upload and OCR.
**When to use:** Before any upload or OCR call — balance OCR accuracy (needs readable text) vs storage (10MB raw camera photos are too large).
**Example:**
```tsx
// Source: PQINA compress-image-before-upload guide (HIGH confidence)
async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob!), "image/jpeg", quality);
    };
    img.src = url;
  });
}
```

### Pattern 3: Tesseract.js Worker (createWorker v5+ API)
**What:** Create a persistent worker, run recognition, extract word-level confidence.
**When to use:** In `useOcr` hook — create worker lazily on first OCR call, reuse for session, terminate on unmount.
**Example:**
```tsx
// Source: tesseract.js GitHub docs/api.md (HIGH confidence)
import { createWorker } from "tesseract.js";

// Worker creation (lazy — only when user clicks "Scan Check")
const worker = await createWorker("eng", 1, {
  cacheMethod: "write",   // auto-caches eng.traineddata in IndexedDB
  // langPath: undefined   // uses CDN default; cached after first load
});

// Recognition
const { data } = await worker.recognize(imageBlob);

// data.words: Array of { text: string, confidence: number, bbox: {...} }
// data.text: full recognized text string
// data.lines: line-level results

// Cleanup
await worker.terminate();
```

### Pattern 4: IndexedDB VERSION 1→2 Upgrade
**What:** Add `check_images` object store to the existing `alofok_offline` database during version upgrade.
**When to use:** In the upgraded `openDB()` function — must handle both fresh install (creates both stores) and upgrade from VERSION 1 (creates only new store).
**Example:**
```typescript
// Source: MDN IndexedDB Using_IndexedDB (HIGH confidence)
const DB_NAME = "alofok_offline";
const STORE = "sync_queue";
const IMAGE_STORE = "check_images";
const VERSION = 2;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      // Always idempotent: only create if not exists
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
```

### Pattern 5: FastAPI Check Image Upload Endpoint
**What:** `POST /payments/checks/upload-image` — mirrors the existing `/products/upload-image` pattern exactly.
**When to use:** Whenever a check photo needs to be stored. Called (a) immediately after capture when online, or (b) by sync flusher after reconnect.
**Example:**
```python
# Source: existing /products/upload-image in products.py (HIGH confidence — direct codebase pattern)
import os, uuid
import aiofiles
from fastapi import APIRouter, UploadFile, File
from app.api.deps import require_sales

CHECKS_UPLOAD_DIR = "static/checks"

@router.post(
    "/checks/upload-image",
    response_model=dict,
    status_code=201,
    dependencies=[require_sales],
)
async def upload_check_image(file: UploadFile = File(...)) -> dict:
    os.makedirs(CHECKS_UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    path = os.path.join(CHECKS_UPLOAD_DIR, filename)
    async with aiofiles.open(path, "wb") as f:
        content = await file.read()
        await f.write(content)
    return {"url": f"/static/checks/{filename}"}
```

### Pattern 6: Confidence-Colored Form Field Borders
**What:** Apply Tailwind ring class to Input components based on OCR confidence level.
**When to use:** After OCR results arrive and before user confirmation.
**Example:**
```tsx
// Source: project design system patterns (HIGH confidence — CVA variant pattern already in codebase)
type OcrConfidence = "high" | "medium" | "low" | null;

function confidenceBorderClass(confidence: OcrConfidence): string {
  if (confidence === "high")   return "ring-2 ring-green-500";
  if (confidence === "medium") return "ring-2 ring-yellow-500";
  if (confidence === "low")    return "ring-2 ring-red-500";
  return "";
}

// In JSX — add className to the Input component
<Input
  value={bankNumber}
  onChange={(e) => setBankNumber(e.target.value)}
  className={cn("...", confidenceBorderClass(ocrConfidence.bankNumber))}
/>
```

### Offline Sync Order (Claude's Discretion Decision)
**Recommendation:** Upload image FIRST, then submit payment with `image_url` in the payload.
**Rationale:** Prevents orphaned payment records without images. If image upload fails, payment is not submitted yet and the user can retry. For offline queued items, the sync flusher uploads the blob first, gets the URL, then pushes the payment to the server with `image_url` already populated in `CheckData`. This keeps the server state consistent — a payment always either has no image, or has a valid image URL.

```typescript
// Offline sync queue entry structure
interface PaymentQueueItem {
  type: "payment";
  payload: PaymentCreate;           // CheckData.image_url may be null
  pending_image_id?: number;        // IDB key in check_images store
  created_at: string;
}

// Sync flusher logic (in useOfflineSync or sync drain)
for (const item of await syncQueue.all()) {
  if (item.type === "payment" && item.pending_image_id) {
    // Upload blob first
    const blob = await checkImageQueue.get(item.pending_image_id);
    const { url } = await salesApi.uploadCheckImage(blob);
    item.payload.data!.image_url = url;
    await checkImageQueue.remove(item.pending_image_id);
  }
  await salesApi.createPayment(item.payload);
  await syncQueue.remove(item.id!);
}
```

### Anti-Patterns to Avoid
- **Storing Base64 in sync queue:** Never encode image as base64 string inside the payment JSON payload. A 3MB photo becomes 4MB base64 and bloats the sync queue + serialization cost. Use the separate `check_images` blob store.
- **Auto-starting OCR on capture:** OCR can take 5-15 seconds on mid-range mobile. Starting automatically wastes processing if the user retakes the photo. Use the explicit "Scan Check" button.
- **Creating a new Tesseract worker per recognition:** Worker initialization + language pack load is the expensive step (~2-3s first time). Create once per session/component mount, reuse for multiple recognitions.
- **Using `capture` attribute on a single input:** On Android 14+, a single `<input capture="environment">` bypasses the option sheet and goes directly to camera, removing gallery access. Two separate buttons with two separate inputs is the correct approach.
- **Blocking the main thread with OCR:** `createWorker` already runs Tesseract in a Web Worker. Do not try to run recognition synchronously.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OCR text recognition | Custom WASM OCR engine | tesseract.js | 50+ person-years of Tesseract development, supports 100+ languages, handles document layouts |
| Language pack caching | Custom IndexedDB caching layer for traineddata | Tesseract.js built-in caching | Tesseract.js already caches in IndexedDB automatically; re-implementing adds complexity with no benefit |
| Image compression | Manual pixel-by-pixel manipulation | Canvas 2D API (toBlob) | Browser-native, hardware-accelerated, 3 lines of code |
| EXIF orientation correction | Custom EXIF parser | browser-image-compression library (if needed) | EXIF parsing has 50+ edge cases across camera manufacturers; use proven library |
| File type validation | Custom MIME detection | `file.type.startsWith("image/")` + `accept="image/*"` on input | Browser handles initial filtering; type check in handler catches edge cases |

**Key insight:** Tesseract.js already solves the hardest problems (WASM loading, Web Worker management, language pack caching). The custom code needed is only: (1) wire the File → Canvas → Blob → worker.recognize() pipeline, and (2) map word-level confidence scores to the three-tier visual indicator system.

---

## Common Pitfalls

### Pitfall 1: Android 14+ `capture` Attribute Regression
**What goes wrong:** A single `<input type="file" accept="image/*" capture="environment">` on Android 14+ opens the camera directly, with no option to choose from gallery. Users who already took a photo lose gallery access.
**Why it happens:** Android 14 tightened the semantics of the `capture` attribute to be a strict directive rather than a preference.
**How to avoid:** Two separate inputs — one with `capture="environment"`, one without `capture`. Locked decision from CONTEXT.md.
**Warning signs:** QA testers on Android 14 reporting inability to choose gallery images.

### Pitfall 2: iOS Safari `capture` Attribute Behavior
**What goes wrong:** `capture="environment"` on iOS Safari is ignored — iOS always shows a native picker with Camera/Photo Library/Browse options regardless. Adding `capture` has no negative effect but is also not needed for iOS.
**Why it happens:** iOS handles file input with its own native sheet.
**How to avoid:** Two-button approach still works correctly on iOS (both inputs show the iOS native picker, but "Camera" button labels set user intent). No special iOS code needed.
**Warning signs:** None (iOS degrades gracefully).

### Pitfall 3: IndexedDB Version Conflict During Upgrade
**What goes wrong:** If a tab is open with VERSION 1 and another tab opens with VERSION 2, the `versionchange` event fires on the old tab but is not handled, blocking the upgrade.
**Why it happens:** IndexedDB requires all connections at the old version to close before `onupgradeneeded` can fire.
**How to avoid:** Add `req.onblocked` handler to `openDB()` that logs a warning. In practice for this app (single-user mobile), version conflicts are rare, but the handler prevents silent hangs.
**Warning signs:** `openDB()` Promise never resolves in multi-tab browser scenarios.

```typescript
req.onblocked = () => {
  console.warn("[syncQueue] IndexedDB upgrade blocked — close other tabs");
};
```

### Pitfall 4: Tesseract.js Worker Not Terminated on Unmount
**What goes wrong:** `createWorker()` launches a Web Worker thread. If the component unmounts without calling `worker.terminate()`, the thread leaks and keeps the language pack loaded in memory.
**Why it happens:** Web Workers are not garbage collected when a component unmounts.
**How to avoid:** Return `worker.terminate()` from the `useOcr` hook's `useEffect` cleanup.
```typescript
useEffect(() => {
  return () => { workerRef.current?.terminate(); };
}, []);
```
**Warning signs:** Memory usage climbing over repeated payment flow opens/closes.

### Pitfall 5: OCR Performance on Arabic Text
**What goes wrong:** The check form fields are numbers (bank number, branch, account, amount) — Tesseract's `eng` language pack handles these well. But holder names in Arabic will produce garbage with `eng` only.
**Why it happens:** `eng` traineddata doesn't include Arabic character recognition.
**How to avoid:** Use `createWorker(["eng", "ara"])` to include Arabic. This doubles the download on first use (~2MB for `eng`, ~4MB for `ara`). Since holder name is optional and OCR is best-effort, this is a worthwhile trade-off.
**Warning signs:** Holder name field always returns garbled characters for Arabic names.
**Mitigation:** Can also use `eng` only and skip holder_name field in OCR results (set confidence to "low" / don't pre-fill if Arabic characters detected).

### Pitfall 6: Offline Blob Store Grows Indefinitely
**What goes wrong:** If the sync flusher fails repeatedly or the user never reconnects, blobs accumulate in the `check_images` store indefinitely.
**Why it happens:** Deletion only happens on successful upload confirmation.
**How to avoid:** Blobs are deleted after successful upload (per CONTEXT.md locked decision). No TTL needed for v1.1 — this is acceptable. Future: add a max-age cleanup pass in the sync flusher.
**Warning signs:** IndexedDB storage quota warnings on devices with limited storage.

### Pitfall 7: Image URL Not in Sync Queue When Offline
**What goes wrong:** User submits check payment offline without an image (image_url = null). Later adds a photo. The check is already in the sync queue without the photo. Photo gets lost.
**Why it happens:** The sync queue stores a snapshot of the payment at submission time.
**How to avoid:** This is out of scope for v1.1 — photos captured before submission are included; photos attached after offline submission are not supported. The UI should make this clear (capture photo before hitting submit).
**Warning signs:** Users reporting photos not appearing on synced payments.

---

## Code Examples

Verified patterns from official sources and codebase:

### Frontend: uploadCheckImage in salesApi.ts
```typescript
// Mirrors existing uploadAvatar pattern in salesApi.ts (HIGH confidence)
uploadCheckImage: (file: File | Blob) => {
  const form = new FormData();
  form.append("file", file, "check.jpg");
  return api
    .post<{ url: string }>("/payments/checks/upload-image", form)
    .then((r) => r.data);
},
```

### Frontend: useOcr Hook Skeleton
```typescript
// Source: tesseract.js docs/api.md (HIGH confidence)
import { createWorker, Worker } from "tesseract.js";
import { useRef, useState } from "react";

export type OcrConfidenceLevel = "high" | "medium" | "low";
export interface OcrFieldResult {
  value: string;
  confidence: OcrConfidenceLevel;
}
export interface OcrResult {
  bankNumber?: OcrFieldResult;
  branchNumber?: OcrFieldResult;
  accountNumber?: OcrFieldResult;
  amount?: OcrFieldResult;
  holderName?: OcrFieldResult;
}

function toConfidenceLevel(score: number): OcrConfidenceLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function useOcr() {
  const workerRef = useRef<Worker | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function scan(imageBlob: Blob): Promise<OcrResult> {
    setIsScanning(true);
    setError(null);
    try {
      if (!workerRef.current) {
        // langs: "eng" for numbers; add "ara" for Arabic holder names
        workerRef.current = await createWorker(["eng", "ara"], 1, {
          cacheMethod: "write",
        });
      }
      const { data } = await workerRef.current.recognize(imageBlob);
      return extractCheckFields(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR failed");
      return {};
    } finally {
      setIsScanning(false);
    }
  }

  return { scan, isScanning, error };
}

// Field extraction: regex-based parsing of Tesseract word output
function extractCheckFields(data: Tesseract.Page): OcrResult {
  const words = data.words ?? [];
  const result: OcrResult = {};

  // Numbers extracted from full text using MICR-style patterns
  // bank_number, branch_number, account_number are numeric sequences
  const allText = data.text;

  // Example: extract sequences of 2-6 digits separated by delimiters
  // Actual patterns refined during implementation based on real check samples
  const numericGroups = [...allText.matchAll(/\b(\d{2,10})\b/g)].map((m) => m[1]);

  // Amount: look for decimal number pattern
  const amountMatch = allText.match(/\b(\d{1,6}[.,]\d{2})\b/);
  if (amountMatch) {
    const wordsNearAmount = words.filter((w) =>
      w.text.includes(amountMatch[1].replace(",", "."))
    );
    const avgConf = wordsNearAmount.length
      ? wordsNearAmount.reduce((s, w) => s + w.confidence, 0) / wordsNearAmount.length
      : 50;
    result.amount = { value: amountMatch[1], confidence: toConfidenceLevel(avgConf) };
  }

  // For MICR line numbers: typically 3 groups at bottom of check
  // Assign in order: branch, account, check number (bank number from elsewhere)
  if (numericGroups.length >= 3) {
    // Placeholder assignment — real assignment depends on check format
    result.branchNumber = { value: numericGroups[0], confidence: "medium" };
    result.accountNumber = { value: numericGroups[1], confidence: "medium" };
  }

  return result;
}
```

### Backend: Check Image Upload Endpoint (in payments.py)
```python
# Source: mirroring /products/upload-image (HIGH confidence — direct project pattern)
import os
import uuid
import aiofiles
from fastapi import UploadFile, File

CHECKS_UPLOAD_DIR = "static/checks"

@router.post(
    "/checks/upload-image",
    response_model=dict,
    status_code=201,
    dependencies=[require_sales],
)
async def upload_check_image(file: UploadFile = File(...)) -> dict:
    os.makedirs(CHECKS_UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    path = os.path.join(CHECKS_UPLOAD_DIR, filename)
    async with aiofiles.open(path, "wb") as f:
        content = await file.read()
        await f.write(content)
    return {"url": f"/static/checks/{filename}"}
```

### IndexedDB: checkImageQueue.ts (new file)
```typescript
// Separate module — only for check image blobs; does not touch sync_queue store
// Uses same DB opened by syncQueue.ts (same DB_NAME, VERSION 2)
const DB_NAME = "alofok_offline";
const IMAGE_STORE = "check_images";
const VERSION = 2;

export interface CheckImageItem {
  id?: number;
  blob: Blob;
  created_at: string;
}

// openDB for VERSION 2 — same upgrade handler as syncQueue.ts (must stay in sync)
function openDB(): Promise<IDBDatabase> { /* VERSION 2 handler — see syncQueue pattern */ }

async function pushImage(blob: Blob): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    const item: CheckImageItem = { blob, created_at: new Date().toISOString() };
    const req = tx.objectStore(IMAGE_STORE).add(item);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

async function getImage(id: number): Promise<Blob | null> { /* ... */ }
async function removeImage(id: number): Promise<void> { /* ... */ }

export const checkImageQueue = { pushImage, getImage, removeImage };
```

### Thumbnail Display Pattern
```tsx
// Re-use existing zoom overlay pattern from check-detail-dialog.tsx
function CheckPhotoThumbnail({ imageUrl }: { imageUrl: string | null | undefined }) {
  const [zoomed, setZoomed] = useState(false);
  const url = getImageUrl(imageUrl);  // from src/lib/image.ts
  if (!url) return null;

  return (
    <>
      <img
        src={url}
        alt="Check photo"
        className="h-10 w-14 rounded object-cover border border-border cursor-zoom-in"
        onClick={() => setZoomed(true)}
      />
      {zoomed && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 cursor-zoom-out"
          onClick={() => setZoomed(false)}
        >
          <img src={url} alt="Check photo" className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `<input capture>` for both camera and gallery | Two separate inputs (camera button + gallery button) | Android 14 (2023) | Mandatory for Android compatibility; two-button is the correct pattern |
| `worker.loadLanguage()` + `worker.initialize()` | `createWorker(lang)` handles all init | Tesseract.js v5 (2023) | Simpler API; old multi-step init causes errors in v5+ |
| Manual IndexedDB tessdata caching | Tesseract.js automatic IndexedDB cache | Tesseract.js v3+ | No custom caching code needed; just use `cacheMethod: 'write'` |
| Base64 offline image storage | Blob in separate IndexedDB store | Best practice (always) | 33% smaller; not double-stringified |

**Deprecated/outdated:**
- `worker.loadLanguage()` + `worker.initialize()`: Removed in Tesseract.js v5. Use `createWorker(lang)` only.
- `worker.setParameters()` for PSM: Still available but default PSM 3 (auto) is best for full check images.

---

## Claude's Discretion Recommendations

### Sync Order: Upload Image First, Then Submit Payment
Store `pending_image_id` in the queue item alongside the payment payload. On reconnect, flush images before payments. This ensures `CheckData.image_url` is always populated before the payment record is created. If image upload fails, the payment stays queued — user is notified and can retry.

### Image Compression Strategy
Compress to JPEG at 80% quality, max 1200px width. This balances:
- OCR accuracy: MICR numbers at 1200px remain legible at OCR resolution
- Upload size: Most phone cameras produce 3-8MB; at 1200px/80% JPEG this drops to 200-400KB
- Storage: `static/checks/` stays manageable without server-side cleanup job

### Photo Viewer: Reuse Existing Zoom Pattern
The `check-detail-dialog.tsx` already has a fullscreen zoom overlay using `fixed inset-0 z-[100] bg-black/80`. Reuse the same pattern for check photo lightbox — no new library needed.

### Offline Upload Pending Indicator
Use the existing `Badge` component with `variant="warning"` and a `Clock` icon (lucide-react). Same style as other status badges in the app. Show on check cards in AdminChecksView, Sales StatementView, and Customer StatementView when `data.image_url` is null but a `pending_image_id` exists in local IndexedDB.

### OCR Field Extraction Approach: Full Image with MICR Regex Post-Processing
Run Tesseract on the full check image (not a cropped MICR region). This captures both printed text (holder name, bank name) and the numeric sequences. Post-process the recognized words with regex to identify numeric groups. For MICR at bottom of check, Tesseract's OCR produces approximate numbers — the confidence threshold (green/yellow/red) communicates reliability to the user. Do not try to pre-crop the MICR region as the camera framing varies.

### Missing Photo Indicator
No indicator for checks without photos. The thumbnail only appears when `image_url` is set. This keeps the UI clean and avoids pressure on users to photograph every check.

---

## Open Questions

1. **Tesseract.js v5 vs v7 at install time**
   - What we know: v7.0.0 is the latest (released December 2025) with ~15-35% faster recognition via `relaxedsimd`. v5.1.1 is stable and well-documented.
   - What's unclear: Whether v7 has breaking API changes from v5. Based on release notes, v7 is primarily a performance improvement without API breaks.
   - Recommendation: Run `bun add tesseract.js` (installs latest, currently v7). Verify API signature matches v5 pattern (`createWorker(langs, oem, options)`). If breaking, pin to `tesseract.js@^5`.

2. **Arabic OCR for holder names**
   - What we know: `ara` traineddata adds ~4MB download. Holder name field is optional.
   - What's unclear: Whether Arabic check holder names are worth the extra download.
   - Recommendation: Include `["eng", "ara"]` in `createWorker`. The per-field confidence system communicates reliability — low Arabic OCR results will show red borders and the user will re-type. The holder name field is optional so low confidence is acceptable.

3. **`static/checks/` authentication**
   - What we know: STATE.md explicitly flags "Static check images at /static/checks/ are unauthenticated — acceptable for v1.1, flagged for future security review."
   - What's unclear: Nothing — this is a known and accepted limitation for v1.1.
   - Recommendation: Document the security note in code comments. No action needed in this phase.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `/backend/app/api/endpoints/products.py` — upload-image pattern to mirror
- Existing codebase: `/frontend/src/lib/syncQueue.ts` — IndexedDB VERSION 1 implementation
- Existing codebase: `/frontend/src/components/Sales/PaymentFlow.tsx` — integration point
- Existing codebase: `/frontend/src/components/ui/check-detail-dialog.tsx` — zoom overlay pattern
- [MDN: Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) — VERSION upgrade and `onupgradeneeded` patterns
- [MDN: HTML capture attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/capture) — camera/gallery input behavior
- [tesseract.js GitHub docs/api.md](https://github.com/naptha/tesseract.js/blob/master/docs/api.md) — `createWorker` API, caching, output structure

### Secondary (MEDIUM confidence)
- [tesseract.js releases](https://github.com/naptha/tesseract.js/releases) — v7 is current latest (December 2025); v5 API patterns confirmed stable
- [web.dev: Capturing images from the user](https://web.dev/media-capturing-images/) — verified best practices for `accept="image/*"` + `capture` combinations
- [PQINA: Compress image before upload](https://pqina.nl/blog/compress-image-before-upload/) — Canvas `toBlob()` compression pattern

### Tertiary (LOW confidence)
- WebSearch results for Android 14 `capture` attribute behavior — not sourced from official Android/Chrome changelog; confirmed via multiple community reports

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are either already in the project or have verified API docs
- Architecture: HIGH — patterns directly mirror existing codebase (products upload, syncQueue, check-detail-dialog)
- Pitfalls: HIGH for camera/IndexedDB/Tesseract worker; MEDIUM for OCR field extraction accuracy
- OCR field extraction regex: LOW — patterns need refinement against real Palestinian/Jordanian bank check samples

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (Tesseract.js is actively developed; check for API changes before implementing)
