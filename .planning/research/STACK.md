# Stack Research

**Domain:** Check payment enhancement — SVG preview, OCR, camera capture, bank autocomplete
**Researched:** 2026-03-04
**Confidence:** HIGH (core decisions verified against official docs and GitHub releases)

---

## Existing Stack (Do Not Re-Research)

These are already shipped and validated. Listed only to show integration points.

| Layer | Tech | Relevant to This Milestone |
|-------|------|---------------------------|
| Frontend | React 18, Vite, Bun | Entry point for all new components |
| UI | shadcn/ui + Tailwind + Radix UI | Design system to extend |
| State | React Query + Redux Toolkit | OCR loading state, form state |
| File upload | `FileUpload` component + FastAPI `/static` | Check photo upload pipeline |
| Camera input | `<input type="file">` pattern in `FileUpload` | Needs `capture` attribute added |
| Popover | `@radix-ui/react-popover` ^1.1.6 (installed) | Base for bank autocomplete |

---

## New Stack Additions

### Frontend — New Dependencies Required

| Library | Version | Purpose | Why This, Not Something Else |
|---------|---------|---------|------------------------------|
| `cmdk` | ^1.1.1 | Command palette primitive for bank autocomplete | shadcn's Combobox pattern is built on cmdk + Radix Popover. Already have Popover, only missing cmdk. v1.1.1 is current stable as of 2025. |
| `tesseract.js` | ^5.1.1 | Browser-side OCR for check photo field extraction | Runs in-browser via WASM — no backend OCR service needed. 54% smaller language data than v4. Arabic+English in one worker. v7 (Dec 2025) too new, v5.1.1 is battle-tested. |

**Total new frontend deps: 2 packages.**

### Frontend — Zero New Deps (Built With What's Already There)

| Feature | Approach | Why No Library |
|---------|----------|----------------|
| SVG check preview | Inline JSX SVG component with React state interpolation into `<text>` elements | Pure JSX SVG is the right tool. A bank check is a static layout with dynamic text fields — no animation library, no D3, no react-pdf needed. Props flow in, SVG text nodes update. |
| Camera/image capture | Extend existing `FileUpload` with `capture="environment"` on `<input>` | HTML `capture` attribute triggers native camera on mobile. Project already has a working `FileUpload` component with preview, file validation, and upload logic. No `react-webcam` needed for single-photo check capture. |

### Backend — No New Dependencies Required

The backend already has everything needed:

| Need | Already Available | Notes |
|------|-------------------|-------|
| Receive check image upload | `python-multipart` ^0.0.17 + `aiofiles` 24.1.0 | Already in `requirements.txt` |
| Store image to disk | FastAPI `/static` mount + `aiofiles` | Already in use for product images |
| Return image URL | `image_url` already in check JSONB | Schema expansion needed, not new tech |

**OCR runs in the browser via tesseract.js. The backend does not run OCR.** This avoids adding PyTorch/EasyOCR (which balloons the Docker image by ~2.7GB) or system-level Tesseract (C binary, complex Docker layer) to the backend.

---

## Installation

```bash
# From /frontend — run with bun
bun add cmdk@^1.1.1
bun add tesseract.js@^5.1.1
```

No backend changes to `requirements.txt`.

---

## Feature-by-Feature Integration Notes

### 1. SVG Check Preview

**Pattern:** Single `CheckPreview` component in `src/components/ui/check-preview.tsx`.

```tsx
// Receives form state as props, renders inline SVG
interface CheckPreviewProps {
  bankName: string;
  amount: string;
  holderName: string;
  accountNumber: string;
  checkNumber: string;
  dueDate: string;
  currency: 'ILS' | 'USD' | 'JOD';
}
```

The SVG is LTR (standard check format, per PROJECT.md decision). Use `<foreignObject>` for text that needs Arabic font fallback if holder names are Arabic. Otherwise, plain SVG `<text>` elements are sufficient.

**No library needed.** React's JSX IS the template engine.

### 2. tesseract.js OCR Integration

**Architecture:** Lazy-loaded web worker. Do not import at module level — tesseract.js spins up a WASM worker on first use, which costs 1-3 seconds. Only initialize when user taps "Scan Check."

```ts
// Lazy init pattern
import { createWorker } from 'tesseract.js';

async function ocrCheckImage(imageFile: File): Promise<Partial<CheckFields>> {
  const worker = await createWorker(['eng', 'ara']);
  const { data } = await worker.recognize(imageFile);
  await worker.terminate();
  // Parse data.text for check fields with regex
  return extractCheckFields(data.text, data.words);
}
```

**Language data:** Load `eng` (English) for amounts and account numbers (always Latin digits on Israeli/Palestinian/Jordanian checks), and `ara` (Arabic) for holder name field if needed. WASM + language data downloads ~4MB on first use, then cached by browser.

**Confidence threshold:** Only autofill a field if `word.confidence > 70`. Present OCR results as suggestions, not hard overwrites — user must confirm.

**Offline:** tesseract.js WASM is bundled. Language data is fetched from CDN on first use. After first use, cached by browser. If offline on first use, OCR unavailable — degrade gracefully (show "OCR unavailable offline" and let user type manually).

### 3. Camera / Image Capture

**Pattern:** Extend `FileUpload` component or create `CheckPhotoCapture` variant:

```tsx
<input
  type="file"
  accept="image/*"
  capture="environment"   // rear camera, standard for document scanning
  onChange={handleCapture}
/>
```

On desktop: opens file picker (no camera). On Android/iOS mobile: opens camera directly. Both result in a `File` object — same upload pipeline.

**FileUpload already handles:** preview URL generation, file validation, upload progress, error state. Only new behavior is triggering OCR after capture.

### 4. Bank Name Autocomplete (Combobox)

**Pattern:** shadcn Combobox = `Popover` (already installed) + `Command` (from cmdk v1.1.1).

```tsx
// src/components/ui/combobox.tsx
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from 'cmdk';
import * as Popover from '@radix-ui/react-popover';
```

**Bank data:** Static JSON file at `src/data/banks.ts` — a hardcoded list of Israeli, Palestinian, and Jordanian banks (Bank Hapoalim, Bank Leumi, Arab Bank, Bank of Jordan, etc.). No API call. The list is stable and short (~20-30 banks).

**Styling:** cmdk v1.1.1 ships unstyled — apply existing Tailwind tokens. Known issue: when nested inside a `Dialog`, popover z-index needs `z-[100]` to appear above dialog backdrop. Apply this in the component.

---

## Alternatives Considered

| Feature | Recommended | Alternative Considered | Why Not |
|---------|-------------|------------------------|---------|
| OCR | tesseract.js (browser WASM) | EasyOCR + pytesseract (backend) | EasyOCR requires PyTorch → +2.7GB Docker image. pytesseract requires system Tesseract binary → complex Docker layer. Browser-side is lighter and avoids network round-trip for OCR. |
| OCR | tesseract.js v5.1.1 | tesseract.js v7.0.0 | v7 released December 2025, very new. v5.1.1 is stable with known Arabic support. Upgrade path is trivial when v7 matures. |
| Bank autocomplete | cmdk + Popover (shadcn pattern) | react-select, downshift | react-select adds 50KB, conflicts with shadcn styling. downshift is lower-level and requires more implementation. cmdk is the shadcn-native choice, already used internally by shadcn's Command palette. |
| SVG preview | Inline JSX SVG | react-pdf, html-to-image, canvas | react-pdf is for PDF generation. html-to-image/canvas are for export — overkill for a live form preview. Inline SVG gives zero-dependency reactive preview. |
| Camera capture | HTML `capture` attribute | react-webcam | react-webcam opens a live video stream (WebRTC, requires HTTPS). For single-photo check scan, `capture="environment"` is simpler and works offline. react-webcam would make sense if multi-frame capture or video were needed. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `easyocr` (Python) | PyTorch dependency = 2.7GB Docker layer, incompatible with the project's lightweight container strategy | `tesseract.js` in browser |
| `pytesseract` (Python) | Requires Tesseract C binary in Docker image, platform-specific installation, no benefit vs browser approach | `tesseract.js` in browser |
| `react-webcam` | WebRTC stream needs HTTPS everywhere, heavier than needed for one-shot check scan, overkill | `<input capture="environment">` |
| `react-select` | CSS-in-JS conflicts with Tailwind, 50KB, poor dark mode customization | `cmdk` + shadcn Combobox pattern |
| `tesseract.js` v7.0.0 | Released December 2025, minimal community validation, API stable but v5.x is proven | `tesseract.js` ^5.1.1 |
| SVG libraries (react-pdf, konva) | Wrong abstraction layer for a live form preview | Inline JSX SVG with React state |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `tesseract.js@^5.1.1` | React 18, Vite 6, modern browsers (Chrome 80+, Firefox 79+, Safari 14+) | Uses WASM + SharedArrayBuffer. Vite serves WASM natively. No Vite plugin required. |
| `cmdk@^1.1.1` | `@radix-ui/react-popover@^1.1.6` (installed) | v1.1.x is compatible with current Radix Popover. Known bug: nested inside Dialog requires `z-[100]` override. Fixed with CSS, not a blocker. |
| `tesseract.js@^5.1.1` | Offline (after initial WASM + language data cached by browser) | First use requires network for ~4MB language data download. Graceful degradation needed for offline-first constraint. |

---

## Stack Patterns by Variant

**If check holder name is always in Arabic script:**
- Load `tesseract.js` with `['ara']` only — smaller language data download
- Because Arabic blocks are more distinct and easier to isolate in a check image

**If the project later moves to Capacitor (mobile wrapper):**
- `camera capture` stays the same — Capacitor exposes the same `File` API through `@capacitor/camera`
- `tesseract.js` stays the same — WASM runs in the WebView
- No stack changes needed for this milestone's features

**If OCR accuracy proves insufficient after testing:**
- Add a backend `/api/checks/ocr` endpoint using `pytesseract` + `Pillow` as a server-side fallback
- `Pillow` is not currently in requirements.txt — would need `pip install Pillow pytesseract`
- Only pursue this if browser OCR consistently fails on real check photos

---

## Sources

- [tesseract.js GitHub — v7.0.0 release notes](https://github.com/naptha/tesseract.js/releases) — version confirmed HIGH confidence
- [tesseract.js v5 changelog (Issue #820)](https://github.com/naptha/tesseract.js/issues/820) — bundle size and language data reductions verified
- [npmjs.com/package/cmdk](https://www.npmjs.com/package/cmdk) — v1.1.1 confirmed current stable
- [shadcn/ui Combobox docs](https://ui.shadcn.com/docs/components/combobox) — Popover + Command composition pattern
- [MDN: HTML capture attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture) — `capture="environment"` behavior documented
- [EasyOCR Docker issue #618](https://github.com/JaidedAI/EasyOCR/issues/618) — 2.77GB image size confirmed, reason to avoid backend OCR
- [cmdk shadcn bug #2963](https://github.com/shadcn-ui/ui/issues/2963) — Dialog z-index conflict noted, mitigation documented

---
*Stack research for: Alofok v1.1 Check Enhancement milestone*
*Researched: 2026-03-04*
