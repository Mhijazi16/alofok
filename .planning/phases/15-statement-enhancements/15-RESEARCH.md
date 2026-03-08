# Phase 15: Statement Enhancements - Research

**Researched:** 2026-03-08
**Domain:** Client-side PDF generation with Arabic RTL, date range filtering
**Confidence:** MEDIUM

## Summary

Phase 15 adds custom date range filtering and Arabic PDF export to the customer statement. The date range filtering is straightforward -- the backend already accepts `start_date` and `end_date` params, the `DatePicker` component supports `mode="range"`, and the existing Tabs pattern just needs a 5th "Custom" tab. No backend changes required.

The PDF generation is the higher-risk area. `@react-pdf/renderer` is the decided primary approach, but it has a known open issue (#2638) where Arabic characters produce "undefined glyph" errors in versions after 3.3.5. The latest version is 4.3.2 and no fix has been released. The Cairo font can be registered via direct TTF URLs from Google Fonts (gstatic.com). The fallback approach is `window.print()` with CSS `@media print` styles, which leverages the browser's native Arabic rendering -- guaranteed to work correctly.

**Primary recommendation:** Install `@react-pdf/renderer` and test Arabic rendering immediately. If glyphs break, pivot to the `window.print()` fallback which is simpler and more reliable for Arabic. Build the PDF document component as a separate, isolated module either way.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Add "Custom" as a 5th tab alongside existing presets (Since Zero, Week, Month, Year)
- Selecting "Custom" reveals a DatePicker with `mode="range"` (component already exists with two-month calendar)
- Statement updates live as soon as both from and to dates are selected -- no "Apply" button
- Selected custom range persists in component state within the session
- Both Sales rep and Customer portal StatementView get the Custom tab
- Full branded header: "Alofok - Tools" and "شركة الأفق" as text (no logo image), customer name, date range, opening balance
- Table layout: Date | Type | Amount | Running Balance columns
- Orders show product sub-rows: indented lines with product name, qty, unit price
- Purchases also show product sub-rows, same format as orders
- Payments and Check_Return show total only (no sub-rows)
- Closing summary section: total orders, total payments, total purchases, closing balance
- PDF language is always Arabic regardless of app language setting
- Primary approach: @react-pdf/renderer with Cairo font embedded
- Fallback: window.print() with CSS @media print styles if Arabic glyphs fail
- Download button in TopBar (top-right), icon-based
- PDF exports the current filter -- WYSIWYG
- Available in both Sales rep StatementView and Customer portal StatementView
- Filename format: `كشف_[customer_name]_[from_date]_[to_date].pdf`

### Claude's Discretion
- Exact TopBar download button icon choice (Download, FileDown, etc.)
- Loading state while PDF generates
- Error handling if PDF generation fails
- Print fallback CSS styling details
- How to detect @react-pdf Arabic failure (manual test vs runtime check)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STMT-01 | User can select a custom date range (from/to) for customer statements | DatePicker with `mode="range"` already exists; Tabs component supports adding 5th tab; backend already accepts start_date/end_date params |
| STMT-02 | User can export the current statement view as a PDF document | @react-pdf/renderer for programmatic PDF generation; window.print() as fallback; `pdf()` + `blob()` API for download trigger |
| STMT-03 | PDF supports Arabic text and RTL layout | Cairo font registered via TTF URLs from gstatic.com; known issue #2638 with Arabic glyphs; window.print() fallback uses browser's native Arabic rendering |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @react-pdf/renderer | 4.3.2 | Programmatic PDF generation from React components | Only React-native PDF generation library; JSX-based document definition |
| react-day-picker | (existing) | Date range selection | Already used by DatePicker component |
| date-fns | (existing) | Date formatting | Already used in DatePicker |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-pdf/font | (bundled) | Font registration for @react-pdf | Required to register Cairo font for Arabic text |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @react-pdf/renderer | window.print() | Browser print dialog UX is worse, but Arabic rendering is guaranteed correct |
| @react-pdf/renderer | jsPDF | Arabic RTL is partial in jsPDF too; explicitly out of scope per REQUIREMENTS.md |

**Installation:**
```bash
bun add @react-pdf/renderer
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── Sales/
│   │   └── StatementView.tsx        # Add Custom tab + download button
│   ├── Customer/
│   │   └── StatementView.tsx        # Add Custom tab + download button
│   └── shared/
│       └── StatementPdf.tsx         # Shared PDF document component (NEW)
│       └── StatementPrintView.tsx   # Print fallback component (NEW, if needed)
├── lib/
│   └── pdf-fonts.ts                 # Cairo font registration (NEW)
└── locales/
    ├── ar.json                      # Add PDF-specific keys
    └── en.json                      # Add PDF-specific keys
```

### Pattern 1: Shared PDF Document Component
**What:** A single `StatementPdf` component used by both Sales and Customer StatementViews
**When to use:** Always -- the PDF layout is identical regardless of who generates it
**Example:**
```typescript
// StatementPdf.tsx -- @react-pdf/renderer approach
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register Cairo font with direct TTF URLs
Font.register({
  family: 'Cairo',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hOA-W1Q.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hD45W1Q.ttf', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hAc5W1Q.ttf', fontWeight: 700 },
  ],
});

interface StatementPdfProps {
  customerName: string;
  dateRange: { from: string; to: string };
  openingBalance: number;
  entries: StatementEntry[];
  closingBalance: number;
  totals: { orders: number; payments: number; purchases: number };
}

const StatementPdf = ({ customerName, dateRange, openingBalance, entries, closingBalance, totals }: StatementPdfProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brandAr}>شركة الأفق</Text>
        <Text style={styles.brandEn}>Alofok - Tools</Text>
        <Text style={styles.customerName}>{customerName}</Text>
        <Text style={styles.dateRange}>{dateRange.from} - {dateRange.to}</Text>
      </View>
      {/* Table rows... */}
    </Page>
  </Document>
);
```

### Pattern 2: PDF Download Trigger
**What:** Generate PDF blob and trigger browser download
**When to use:** When user clicks the download button
**Example:**
```typescript
import { pdf } from '@react-pdf/renderer';

const handleDownload = async () => {
  setGenerating(true);
  try {
    const blob = await pdf(<StatementPdf {...pdfProps} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `كشف_${customerName}_${fromDate}_${toDate}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    // Fallback to window.print()
    handlePrintFallback();
  } finally {
    setGenerating(false);
  }
};
```

### Pattern 3: window.print() Fallback
**What:** Render a hidden print-optimized component and trigger browser print
**When to use:** If @react-pdf/renderer produces broken Arabic glyphs
**Example:**
```typescript
// Hidden print view rendered off-screen
const StatementPrintView = ({ data }: Props) => (
  <div className="hidden print:block" dir="rtl" lang="ar" style={{ fontFamily: 'Cairo' }}>
    {/* Same table layout but with regular HTML/CSS */}
  </div>
);

// Trigger:
const handlePrintFallback = () => {
  // Show print view, call window.print(), hide again
  // Or use a new window with document.write()
};
```

### Pattern 4: Custom Tab with DatePicker Integration
**What:** Extend FilterPreset type and show DatePicker when "custom" is selected
**When to use:** Both StatementView components
**Example:**
```typescript
type FilterPreset = "zero" | "week" | "month" | "year" | "custom";

const [preset, setPreset] = useState<FilterPreset>("zero");
const [customRange, setCustomRange] = useState<DateRange | undefined>();

const queryParams = useMemo(() => {
  if (preset === "custom" && customRange?.from && customRange?.to) {
    return {
      start_date: toLocalDateStr(customRange.from),
      end_date: toLocalDateStr(customRange.to),
    };
  }
  // ... existing preset logic
}, [preset, customRange]);
```

### Anti-Patterns to Avoid
- **Duplicating PDF logic across Sales/Customer views:** Extract shared `StatementPdf` component once, import in both places
- **Bundling font files in the repo:** Use direct gstatic.com URLs -- they are stable CDN links. Font is fetched at PDF generation time only, not on page load
- **Generating PDF server-side:** Explicitly out of scope (REQUIREMENTS.md). Client already has the data; offline-first matters
- **Using @react-pdf/renderer v3.3.5 to dodge Arabic bug:** The v3 to v4 jump includes React 19 support and many fixes. Test v4 first, only downgrade if needed

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date range picker | Custom calendar component | Existing `DatePicker` with `mode="range"` | Already built, supports two-month view, Radix popover |
| PDF document structure | Raw PDF byte manipulation | `@react-pdf/renderer` Document/Page/View/Text | Declarative JSX, handles pagination, font embedding |
| Font subsetting | Manual font file processing | `Font.register()` with TTF URL | @react-pdf handles subsetting internally |
| PDF blob download | Complex blob handling | `pdf().toBlob()` + `URL.createObjectURL` | Standard browser API pattern |

## Common Pitfalls

### Pitfall 1: Arabic Glyph Rendering in @react-pdf/renderer
**What goes wrong:** Arabic characters render as "undefined glyph" boxes or disconnected letters
**Why it happens:** Issue #2638 -- bidi support in PR #2600 broke Arabic glyph mapping. Still open as of v4.3.2
**How to avoid:** Test Arabic rendering immediately after installing the library. Create a minimal test: `<Text style={{fontFamily:'Cairo'}}>شركة الأفق - كشف حساب</Text>`. If it fails, pivot to window.print() fallback
**Warning signs:** Empty rectangles, "tofu" characters, or console errors about undefined glyphs

### Pitfall 2: Font Not Loaded Before PDF Generation
**What goes wrong:** PDF generates with default Helvetica, Arabic characters missing entirely
**Why it happens:** `Font.register()` is async -- font downloads when first referenced. If PDF renders before download completes, fallback font is used
**How to avoid:** Call `Font.register()` at module import time (top of pdf-fonts.ts). The `pdf()` function waits for font loading before rendering
**Warning signs:** First PDF has wrong font, subsequent ones are correct

### Pitfall 3: QueryKey Not Including Custom Range
**What goes wrong:** Switching between preset tabs and custom range shows stale data
**Why it happens:** React Query caches based on queryKey. If custom range dates are not in the key, old cached data is returned
**How to avoid:** Include both `preset` AND `customRange?.from`/`customRange?.to` in the queryKey array
**Warning signs:** Statement data doesn't update when changing custom date range

### Pitfall 4: DatePicker Popover Clipped by Container
**What goes wrong:** Two-month calendar popover gets cut off on mobile screens
**Why it happens:** Parent container has `overflow: hidden` or the popover portal renders inside a scrollable container
**How to avoid:** DatePicker already uses Radix Popover.Portal which renders to document body. Ensure the DatePicker is not nested inside another popover
**Warning signs:** Calendar appears but bottom portion is invisible

### Pitfall 5: PDF Filename with Arabic Characters
**What goes wrong:** Some browsers mangle Arabic characters in download filenames
**Why it happens:** Browser `Content-Disposition` filename encoding varies
**How to avoid:** Test the filename `كشف_[name]_[date].pdf` in Chrome and Firefox. If issues arise, use a simpler ASCII filename with Arabic in the PDF header only
**Warning signs:** Downloaded file has garbled name or `%xx` encoded characters

### Pitfall 6: Running Balance Starts at Zero Instead of Opening Balance
**What goes wrong:** PDF shows running balance starting from 0 instead of the actual opening balance for the filtered period
**Why it happens:** Backend computes running balance as a running sum of filtered transactions. The "opening balance" is derived client-side as `first_entry.running_balance - first_entry.amount`
**How to avoid:** Pass the computed `openingBalance` to the PDF component. In the PDF, show it as the first row before transaction entries
**Warning signs:** Opening balance in PDF header doesn't match the first row's "before" state

## Code Examples

### Existing Statement API (already working, no changes needed)
```typescript
// salesApi.ts -- already accepts start_date and end_date
getStatement: (customerId: string, params: {
  since_zero_balance?: boolean;
  start_date?: string;
  end_date?: string;
}) => api.get(`/customers/${customerId}/statement`, { params }).then(r => r.data),
```

### Transaction Data JSONB Structure (for order/purchase sub-rows)
```typescript
// tx.data for Orders contains items array:
// { items: [{ product_id, name, quantity, unit_price, total }] }
// tx.data for Purchases contains same structure
// tx.data for Payments may contain check details
// This is how sub-rows are extracted in the PDF
```

### TopBar Actions Slot (already supports custom content)
```typescript
// TopBar accepts an `actions` prop for right-side content
<TopBar
  title={t("statement.title")}
  subtitle={customer.name}
  backButton={{ onBack }}
  actions={
    <button onClick={handleDownload} disabled={generating}>
      <FileDown className="h-4 w-4" />
    </button>
  }
/>
```

### StatementOut Response Schema
```typescript
// Backend returns:
interface StatementOut {
  customer_id: string;
  entries: Array<{
    transaction: TransactionOut;  // includes .data JSONB with items
    running_balance: number;
  }>;
  closing_balance: number;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-side PDF (weasyprint) | Client-side @react-pdf/renderer | Project decision v1.2 | Works offline, no server dependency |
| jsPDF for Arabic | @react-pdf/renderer or window.print() | Project decision v1.2 | jsPDF Arabic RTL is worse per REQUIREMENTS.md |
| Separate date picker page | Inline DatePicker in tabs | Existing DatePicker component | Better UX, fewer page transitions |

**Deprecated/outdated:**
- jsPDF for Arabic text: Explicitly excluded in REQUIREMENTS.md "Out of Scope" table
- Server-side PDF: Explicitly excluded -- breaks offline-first requirement

## Open Questions

1. **Does @react-pdf/renderer v4.3.2 actually render Cairo Arabic correctly?**
   - What we know: Issue #2638 is still open. Last confirmed working version was 3.3.5. No fix in v4.x changelog
   - What's unclear: Whether Cairo font specifically triggers the bug (issue was reported with MarkaziText font)
   - Recommendation: Install and test immediately in Wave 0. If broken, use window.print() fallback. The fallback approach is actually simpler and more reliable

2. **Does the transaction.data JSONB consistently contain an `items` array for Orders and Purchases?**
   - What we know: OrderCreate schema sends `items: list[dict]` with `product_id`, `quantity`, `unit_price`. PurchaseCreate has `items: list[PurchaseItem]` with `name` field
   - What's unclear: Whether older orders (pre-purchase feature) have the same data shape; whether `name` is always present
   - Recommendation: Handle missing `data.items` gracefully -- show "No details" for transactions without item data

3. **Font loading time for @react-pdf when offline?**
   - What we know: Font is fetched from gstatic.com CDN at generation time. If offline, font download fails
   - What's unclear: Whether @react-pdf caches fonts after first load
   - Recommendation: Consider bundling Cairo TTF as a static asset in `/public/fonts/` for offline reliability. Or accept PDF generation requires connectivity (acceptable since statement data comes from server anyway)

## Sources

### Primary (HIGH confidence)
- Existing codebase: `StatementView.tsx` (Sales), `CustomerStatementView.tsx` (Customer), `date-picker.tsx`, `top-bar.tsx`
- Existing codebase: `transaction.py` schemas -- StatementOut, TransactionOut, data JSONB structure
- Backend services: `customer_service.py`, `customer_portal_service.py` -- both accept start_date/end_date

### Secondary (MEDIUM confidence)
- [@react-pdf/renderer npm](https://www.npmjs.com/package/@react-pdf/renderer) -- v4.3.2 latest
- [React-pdf fonts documentation](https://react-pdf.org/fonts) -- Font.register() API
- [Google Fonts Cairo TTF URLs](https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700) -- verified via curl

### Tertiary (LOW confidence)
- [Issue #2638 - Arabic characters broken](https://github.com/diegomura/react-pdf/issues/2638) -- still open, no confirmed fix in v4.x
- [Issue #3172 - Non-English text gibberish](https://github.com/diegomura/react-pdf/issues/3172) -- related Arabic rendering issue
- [Discussion #2306 - RTL in react-pdf](https://github.com/diegomura/react-pdf/discussions/2306) -- community workarounds with RTL mark characters

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Libraries are decided by user, existing components verified in codebase
- Architecture: HIGH - Pattern is clear: shared PDF component, extend existing tabs, use existing TopBar actions
- Date range filtering: HIGH - Backend already supports it, DatePicker already has range mode
- PDF Arabic rendering: LOW - Known open issue #2638, no confirmed fix. Fallback approach (window.print) is reliable but different UX
- Pitfalls: MEDIUM - Based on mix of codebase analysis and community reports

**Research date:** 2026-03-08
**Valid until:** 2026-03-22 (14 days -- @react-pdf Arabic issue may get patched)
