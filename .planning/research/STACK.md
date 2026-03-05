# Stack Research

**Domain:** Alofok v1.2 — Business Operations (expense tracking, cash reconciliation, offline caching, purchase from customer, date range picker, PDF export)
**Researched:** 2026-03-05
**Confidence:** HIGH (versions verified via bun info + npm registry; RTL PDF limitations confirmed via official GitHub issues)

---

## Existing Stack (Do Not Re-Research)

These are shipped and validated in v1.0/v1.1. Listed only to show integration points for new features.

| Layer | Tech | Version | Relevant to v1.2 |
|-------|------|---------|-------------------|
| Frontend | React + Vite + Bun | 18.3.1 / 6.0.5 | Entry point for all new components |
| UI | shadcn/ui + Tailwind + Radix UI | tailwind ^3.4.17 | Design system — extend, don't replace |
| State | React Query + Redux Toolkit | ^5.62.7 / ^2.4.0 | Cache layer for offline; already persists mutation queue |
| Offline | IndexedDB (custom queue) | — | Extends to catalog + route data |
| Date util | date-fns | ^3.6.0 | Already installed — use for date arithmetic in statements |
| Calendar | react-day-picker | ^8.10.1 (v8 installed) | Needs upgrade to v9 for range mode |
| Backend | FastAPI + SQLAlchemy async + Alembic | 0.115.5 / 2.0.47 | New Expense model, Purchase transaction logic |
| Infra | Docker Compose (python:3.12-slim base) | — | PDF backend adds system deps — weasyprint is NOT viable here |

---

## New Stack Additions

### Frontend — New Dependencies Required

| Library | Version | Purpose | Why This, Not Something Else |
|---------|---------|---------|------------------------------|
| `react-day-picker` | ^9.14.0 (upgrade from v8) | Custom date range picker for statements | v9 adds first-class `mode="range"` with correct keyboard nav and RTL calendar support. v8 (currently installed) supports range but has a less clean API. The upgrade is in-place — shadcn Calendar component wraps react-day-picker and simply needs the v9 import. date-fns is now bundled with v9, removing the peer dependency friction. |
| `@react-pdf/renderer` | ^4.3.2 | Client-side PDF generation for customer statements | React component model matches the project's frontend-rendering approach. v4.3.2 is the current stable. Arabic support requires registering a Cairo/Noto Arabic font via `Font.register()` — see integration notes. Runs entirely in the browser, no backend change needed. |
| `idb-keyval` | ^6.2.2 | IndexedDB persistence for React Query catalog/route cache | 573 bytes (brotli). Provides `get`/`set`/`del` primitives used to build a React Query v5 persister. The project already uses IndexedDB for the mutation queue — this adds the query cache layer. Zero system dependencies. |
| `@tanstack/react-query-persist-client` | ^5.90.24 | React Query v5 persistence plugin | Official TanStack package. Pairs with `idb-keyval` to persist catalog + route query results across sessions. Must match `@tanstack/react-query` major version (both v5). |
| `vite-plugin-pwa` | ^1.2.0 | Service worker + Workbox for offline asset and API caching | Vite 6-compatible (v1.x series added Vite 6 support after the 0.21.0 compatibility break). Generates a Workbox service worker that pre-caches the app shell and supports runtime caching strategies for API routes. Needed to cache catalog images and static assets offline, not just query data. |

**Total new frontend deps: 5 (1 upgrade + 4 additions).**

### Frontend — Zero New Deps (Built With What's Already There)

| Feature | Approach | Why No Library |
|---------|----------|----------------|
| Expense form | Existing form pattern with Input, Select, DatePicker components | New model, same form pattern already established |
| Cash report table | Existing `table` + `badge` + `stat-card` components | Admin dashboard pattern already present |
| Payment confirmation UI | Existing Dialog + Button pattern | Toggle state, no new primitives needed |
| Weighted-average costing display | Computed in backend, displayed in existing product detail | Pure data, no new UI primitive |

### Backend — New Dependencies Required

| Library | Version | Purpose | Why This, Not Something Else |
|---------|---------|---------|------------------------------|
| `weasyprint` | 68.1 | — | **DO NOT USE** — see "What NOT to Use" below |
| `jinja2` | ^3.1.4 (already a FastAPI transitive dep) | HTML template for PDF — if server-side chosen | Jinja2 is already in the FastAPI dependency tree. Verify with `pip show jinja2` in the container. |

**Backend verdict: No new Python packages required for PDF.** PDF generation is handled client-side by `@react-pdf/renderer`. The backend serves the statement data via the existing `/customers/{id}/statement` endpoint. This avoids adding GTK/Pango/Cairo system libraries to the `python:3.12-slim` Docker image (which would add ~80-150MB and complex apt-get install steps).

For expense tracking and purchase-from-customer: pure SQLAlchemy model additions + Alembic migrations. No new Python libraries needed.

---

## Installation

```bash
# From /frontend — run with bun

# Upgrade react-day-picker from v8 to v9
bun add react-day-picker@^9.14.0

# PDF generation (client-side)
bun add @react-pdf/renderer@^4.3.2

# Offline catalog/route caching
bun add idb-keyval@^6.2.2
bun add @tanstack/react-query-persist-client@^5.90.24

# Service worker / PWA
bun add -d vite-plugin-pwa@^1.2.0
```

No changes to `backend/requirements.txt`.

---

## Feature-by-Feature Integration Notes

### 1. Custom Date Range Picker (statements)

**Upgrade path:** react-day-picker v9 is a major version bump but the change in this codebase is minimal — shadcn's `Calendar` component wraps it. Follow the [upgrade guide](https://daypicker.dev/upgrading): remove explicit `date-fns` peer dep pin (now bundled in v9), update `mode` prop usage.

**Range mode pattern:**
```tsx
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';

const [range, setRange] = useState<DateRange | undefined>();

<Calendar
  mode="range"
  selected={range}
  onSelect={setRange}
  numberOfMonths={2}
/>
```

**Presets:** Build a `DateRangePresets` component with buttons for "Last 7 days," "Last 30 days," "This month," "Since zero balance." These call `setRange()` with computed date-fns values — no library needed for preset logic.

**RTL:** react-day-picker v9 respects `dir="rtl"` on the parent container — inherited from the global RTL setup in the project. No extra configuration.

### 2. PDF Export — Customer Statement

**Architecture:** Client-side rendering via `@react-pdf/renderer`. The Sales Rep taps "Export PDF" → the statement data already in React Query cache → rendered to a PDF blob → downloaded via `URL.createObjectURL()`.

**Arabic font requirement:** `@react-pdf/renderer` uses its own PDF layout engine, not the browser's — CSS RTL does not apply. You must register an Arabic font:

```ts
import { Font } from '@react-pdf/renderer';

Font.register({
  family: 'Cairo',
  fonts: [
    { src: '/fonts/Cairo-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/Cairo-Bold.ttf', fontWeight: 700 },
  ],
});
```

Place Cairo TTF files in `frontend/public/fonts/`. Cairo is already loaded via Google Fonts in the CSS — download the TTF for PDF use separately. The PDF renderer cannot use Google Fonts CSS declarations.

**RTL direction:**
```tsx
<View style={{ direction: 'rtl', textAlign: 'right', fontFamily: 'Cairo' }}>
  {/* statement rows */}
</View>
```

**Known issue:** `@react-pdf/renderer` has documented glyph errors with certain Arabic characters after bidi support was added (issue #2638). Mitigation: test with actual statement content early; avoid complex bidi mixing (Arabic + numerals in same text node) — split into separate `<Text>` components.

**Offline:** The PDF renders from data already in the React Query cache. The library WASM runs client-side. PDF export works fully offline.

### 3. Offline Catalog + Route Caching

**Two layers needed:**

Layer 1 — **React Query persister** (query data): Persist catalog product list and route customer list to IndexedDB so they survive page reloads and offline sessions.

```ts
// src/lib/queryPersister.ts
import { createSyncStoragePersister } from '@tanstack/react-query-persist-client';
// Use async idb-keyval variant:
import { get, set, del } from 'idb-keyval';
import { experimental_createQueryPersister } from '@tanstack/react-query-persist-client';

const persister = experimental_createQueryPersister({
  storage: { getItem: get, setItem: set, removeItem: del },
});
```

Apply `persister` only to catalog and route queries — not all queries (would bloat IndexedDB with transient data):

```ts
useQuery({
  queryKey: ['catalog'],
  queryFn: fetchCatalog,
  meta: { persist: true },
  staleTime: 10 * 60 * 1000,
  gcTime: 24 * 60 * 60 * 1000, // keep 24h for offline
});
```

Layer 2 — **Service worker** (static assets + product images): `vite-plugin-pwa` generates a Workbox service worker that caches the app shell (HTML/JS/CSS) at build time, and can cache-first product images at runtime.

```ts
// vite.config.ts addition
import { VitePWA } from 'vite-plugin-pwa';

VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https?:\/\/.*\/static\/uploads\/.*/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'product-images',
          expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
        },
      },
      {
        urlPattern: /^https?:\/\/.*\/api\/v1\/catalog/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'catalog-api',
          expiration: { maxEntries: 1, maxAgeSeconds: 10 * 60 },
        },
      },
    ],
  },
})
```

**Combined effect:** User visits once with connectivity → catalog data in IndexedDB, product images in Cache Storage, app shell pre-cached → next day in field with no signal → full catalog browsable, route data visible.

### 4. Expense Tracking

**Backend:** New `Expense` SQLAlchemy model (BaseMixin: UUID, soft delete, timestamps). Fields: `amount` (Numeric), `currency` (enum: ILS/USD/JOD), `category` (enum: field/business), `description` (Text), `expense_date` (Date), `created_by` (UUID FK to users), `approved_by` (UUID FK, nullable), `receipt_image_url` (Text, nullable).

No new Python packages. Image upload uses the existing `python-multipart` + `aiofiles` + `/static` mount pipeline.

**Frontend:** New `ExpenseForm` component under `src/components/Sales/` (field expenses) and `src/components/Admin/` (business expenses). Uses existing form primitives.

### 5. Daily Cash Report + Payment Confirmation

**Backend:** New endpoint `GET /admin/cash-report?date=YYYY-MM-DD` — aggregates payments by rep for the given date. Returns per-rep totals (cash/check/by-currency) and transaction list. Confirmation = new `confirmed_by` / `confirmed_at` nullable columns on Transaction, or a separate `CashConfirmation` model (prefer separate model to keep Transaction schema clean).

**No new packages.** Pure SQLAlchemy query aggregation.

### 6. Purchase from Customer (Reverse Order + Weighted-Average Costing)

**Backend logic:** A "purchase" is a negative-quantity order (stock comes in, not out). Create a new `TransactionType.PURCHASE` enum value. The weighted-average cost formula:

```
new_avg_cost = (current_stock * current_avg_cost + qty_purchased * purchase_price) / (current_stock + qty_purchased)
```

Store `avg_cost` on the `Product` model (new column, Numeric). Update atomically in the same database transaction as the purchase record. No external library — pure Python arithmetic + SQLAlchemy.

**No new Python packages.**

---

## Alternatives Considered

| Feature | Recommended | Alternative | Why Not |
|---------|-------------|-------------|---------|
| PDF generation | `@react-pdf/renderer` (client-side) | `weasyprint` (server-side) | WeasyPrint requires GTK/Pango/Cairo system libraries not in `python:3.12-slim`. Adding them blooms the Docker image by ~80-150MB and complicates the Dockerfile with apt-get system deps. Client-side PDF avoids all backend changes for a feature that only displays existing data. |
| PDF generation | `@react-pdf/renderer` | `jsPDF` + `jspdf-autotable` | jsPDF has documented, unresolved Arabic autoTable rendering bugs (disconnected chars, reversed mixed-direction text in tables). Not suitable for an Arabic-primary statement. |
| PDF generation | `@react-pdf/renderer` | Server-side HTML → PDF via wkhtmltopdf/puppeteer | Both require heavy system dependencies in Docker (wkhtmltopdf is deprecated; Puppeteer needs Chromium). Overkill for a tabular statement. |
| Offline caching | `idb-keyval` + React Query persister | localForage | localForage is 8.5KB (larger than idb-keyval's 0.6KB) and adds an abstraction layer that's unnecessary when you only need key-value IndexedDB. idb-keyval is the recommended choice in TanStack Query v5 official docs. |
| Offline caching | `vite-plugin-pwa` | Manual service worker | Manual SW requires significant boilerplate and is hard to keep in sync with Vite's asset hashing. vite-plugin-pwa wraps Workbox 7, handles precache manifest injection automatically at build time. |
| Date range picker | react-day-picker v9 upgrade | New library (react-datepicker, flatpickr) | shadcn/ui Calendar is already built on react-day-picker. Swapping the underlying lib would require replacing the Calendar component. Upgrading v8→v9 is the minimal-diff path. |
| Offline query persist | `@tanstack/react-query-persist-client` | Custom IndexedDB sync | Official TanStack package, maintained alongside React Query v5. Custom sync would duplicate what this package already handles (hydration, dehydration, TTL). |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `weasyprint` (Python) | Requires GTK + Pango + Cairo system libraries in Docker. The current `python:3.12-slim` base image doesn't include them. Adding them requires ~80-150MB of apt-get packages and complicates the Dockerfile. Not worth it for a feature that only needs to render data already available client-side. | `@react-pdf/renderer` in the browser |
| `jsPDF` | Arabic text rendering in autoTable is broken for mixed-direction content (Arabic + numbers). Multiple open GitHub issues (2021-2025) with no fix. Produces garbled output in RTL tables. | `@react-pdf/renderer` with Cairo font |
| `puppeteer` / `playwright` (backend) | Requires a full Chromium install in the Docker container (~200MB). Way too heavy for a statement PDF. | `@react-pdf/renderer` in the browser |
| `react-datepicker` | Separate design system, requires CSS import that conflicts with Tailwind. Would need custom styling to match the dark theme. The project already has react-day-picker installed. | react-day-picker v9 upgrade |
| `@tanstack/react-query` v5 with `localForage` persister | localForage wraps IndexedDB/WebSQL/localStorage with a fallback chain — the fallback complexity is unnecessary in 2026 where IndexedDB is universal. | `idb-keyval` (IndexedDB only, 0.6KB) |
| `workbox` directly (no vite-plugin-pwa) | Workbox requires manual integration with Vite's build pipeline and asset hashing. vite-plugin-pwa handles this automatically and is the officially recommended Vite integration. | `vite-plugin-pwa@^1.2.0` |
| `arabic-reshaper` + `python-bidi` (Python backend) | Only needed if doing server-side PDF with WeasyPrint. Since PDF is client-side, these preprocessing packages are irrelevant. | Not needed |

---

## Stack Patterns by Variant

**If PDF Arabic rendering proves problematic with `@react-pdf/renderer` (glyph errors on real statement data):**
- Fall back to generating an HTML page with `window.print()` — the browser's print engine handles Arabic/RTL perfectly since the project already has proper RTL CSS
- Use `@media print` CSS to hide navigation and format the statement for print
- No library needed; achieves PDF via browser's native "Save as PDF"
- This is a zero-dependency escape hatch — implement as parallel option in Phase 9

**If offline catalog images need finer cache control (e.g., evict on product update):**
- Use Cache Storage API directly in a service worker message handler
- Send a `INVALIDATE_PRODUCT_IMAGE` message from the app when a product is updated
- No additional library; the Workbox service worker already exposes message handlers

**If the project adopts Capacitor for mobile (future milestone):**
- `vite-plugin-pwa` service worker conflicts with Capacitor's WKWebView (which doesn't support service workers on iOS)
- At that point, replace `vite-plugin-pwa` with `@capacitor/filesystem` + `@capacitor/preferences` for offline storage
- `@react-pdf/renderer` works unchanged in Capacitor's WebView
- `idb-keyval` works unchanged in Capacitor's WebView

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `react-day-picker@^9.14.0` | `date-fns@^3.6.0` (installed), React 18 | v9 bundles its own date-fns — the project's installed date-fns@^3.x is still used for other date arithmetic. No conflict. Remove explicit react-day-picker date-fns peer dep pin if any exists in package.json. |
| `@react-pdf/renderer@^4.3.2` | React 18, Vite 6, modern browsers | Uses its own layout engine (yoga-layout-wasm). Runs in browser. No Vite plugin required. First render is slow (~1s) due to WASM init — lazy-load behind user action. |
| `idb-keyval@^6.2.2` | `@tanstack/react-query-persist-client@^5.90.24` | Both stable. The React Query persist plugin uses the `storage` interface that idb-keyval's `get/set/del` satisfy directly. |
| `@tanstack/react-query-persist-client@^5.90.24` | `@tanstack/react-query@^5.62.7` (installed) | Must share the same major version (both v5). Minor version mismatch is fine within v5. |
| `vite-plugin-pwa@^1.2.0` | Vite 6.0.5 (installed), Workbox 7.4.0 | v1.x series fully supports Vite 6 (the v0.21.0 compatibility break was fixed; v1.x is the current stable). |

---

## Sources

- [react-day-picker v9.14.0 — npm registry, bun info verified] — version and date-fns bundling confirmed HIGH confidence
- [react-day-picker Range Mode docs](https://daypicker.dev/selections/range-mode) — `mode="range"` API verified
- [@react-pdf/renderer v4.3.2 — npm registry, bun info verified] — version confirmed HIGH confidence
- [@react-pdf/renderer Arabic issue #2638](https://github.com/diegomura/react-pdf/issues/2638) — glyph errors after bidi support confirmed MEDIUM confidence
- [@react-pdf/renderer fonts API](https://react-pdf.org/fonts) — Font.register() pattern verified
- [idb-keyval 6.2.2 — bun info + npm registry confirmed] — version HIGH confidence
- [@tanstack/react-query-persist-client 5.90.24 — bun info confirmed] — version HIGH confidence
- [TanStack Query v5 createPersister docs](https://tanstack.com/query/latest/docs/framework/react/plugins/createPersister) — IndexedDB persister pattern verified HIGH confidence
- [vite-plugin-pwa 1.2.0 — bun info confirmed] — version HIGH confidence, Vite 6 compatibility confirmed
- [vite-plugin-pwa GitHub issue #800](https://github.com/vite-pwa/vite-plugin-pwa/issues/800) — Vite 6 compat break in 0.21.0, fixed in 0.21.1/v1.x confirmed
- [jsPDF-AutoTable Arabic issues #614, #824, #940](https://github.com/simonbengtsson/jsPDF-AutoTable/issues) — unresolved Arabic rendering bugs confirmed MEDIUM confidence
- [WeasyPrint PyPI 68.1] — current version confirmed; GTK/Pango deps confirmed via Kozea docs
- [WeasyPrint Docker installation](https://github.com/Kozea/WeasyPrint/issues/699) — system dependency weight confirmed
- [Workbox 7.4.0 — bun info confirmed] — bundled by vite-plugin-pwa

---
*Stack research for: Alofok v1.2 Business Operations milestone*
*Researched: 2026-03-05*
