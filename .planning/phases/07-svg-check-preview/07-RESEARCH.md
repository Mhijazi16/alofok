# Phase 7: SVG Check Preview - Research

**Researched:** 2026-03-04
**Domain:** React inline SVG, amount-to-words conversion, MICR typography, RTL isolation
**Confidence:** HIGH (core patterns), MEDIUM (MICR font strategy)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Realistic paper check style — light background, printed-style fonts, subtle border/shadow (contrasts against dark app theme)
- MICR strip uses realistic E-13B style font or SVG paths mimicking magnetic ink characters
- Check is LTR always, even when app language is Arabic (PRV-04)
- Check preview positioned above the check detail fields (between currency selector and BankAutocomplete/form inputs)
- Always visible when check payment type is selected — not collapsible
- Full width with proportional height based on real check dimensions (~2.75:6 ratio, approximately 150-170px tall on mobile)
- Light gray placeholder labels shown for all fields when empty (e.g., "Bank Name", "0.00" for amount)
- All check areas visible immediately — including optional fields (holder name, due date) — with placeholders regardless of required status
- Subtle highlight on the check area corresponding to the currently focused form field
- Amount always in English words regardless of app language setting
- Full currency name in words: e.g., "One Thousand Two Hundred and Fifty Israeli Shekels and 00/100"
- Written amount appears below the numeric amount on the check (like a real check's pay line)
- Three currencies supported: ILS (Israeli Shekels), USD (US Dollars), JOD (Jordanian Dinars)

### Claude's Discretion
- Color accent for check (neutral vs brand-tinted border)
- Decorative elements (watermark, geometric pattern, or clean)
- Entry animation style when switching to check tab
- Text update transitions (instant vs subtle fade) — must prioritize performance per PRV-05
- Amount overflow handling (auto-shrink vs wrap) for long written amounts
- Exact typography choices for check fields
- MICR font loading strategy (web font vs SVG paths)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PRV-01 | User sees a realistic LTR bank check SVG that updates live as they type | React.memo + useMemo on CheckPreview component; pure props-driven SVG renders only when props change |
| PRV-02 | Check SVG shows bank name (top left), holder name (top right), date + amount + currency (center), MICR strip `#check# #branch#extra# #account#` (bottom) | SVG layout with absolute `<text>` positioning; MICR strip built from props with monospace/MICR font |
| PRV-03 | Amount is displayed both as digits and written-out words (English) | `to-words` library with custom currency config for ILS/USD/JOD |
| PRV-04 | Check SVG renders correctly when app language is Arabic (no RTL mirroring) | Wrapper `<div dir="ltr">` isolates SVG from document RTL; `unicode-bidi: isolate` fallback |
| PRV-05 | Check SVG input updates are performant on mid-range Android (no input lag) | Pure SVG (no canvas), React.memo on component, useMemo for expensive word conversion; no CSS animations on text nodes |
</phase_requirements>

---

## Summary

Phase 7 is a pure frontend feature: a read-only SVG component that receives check form state as props and renders a paper-check facsimile. No new API calls, no new DB fields. The primary technical challenges are: (1) RTL isolation so the LTR check renders correctly when the app is in Arabic mode; (2) efficient amount-to-words conversion that does not cause input lag; (3) a convincing MICR strip without requiring a licensed commercial font; and (4) long written-amount overflow handling within a fixed-height SVG.

The recommended approach is an inline SVG React component (`CheckPreview`) wrapped in `React.memo`, inserted into `PaymentFlow.tsx` between the currency selector and the check-specific form fields. The SVG uses absolute `<text>` and `<foreignObject>` elements for layout. Amount conversion uses the `to-words` package (zero-dependency, TypeScript, custom currency support). The MICR strip uses a self-hosted free MICR font loaded via `@font-face`, with SVG paths as fallback if bundling proves problematic.

**Primary recommendation:** Build `CheckPreview` as a pure, memoized inline SVG React component with `dir="ltr"` isolation. Use `to-words` for amount-in-words with manually configured ILS/USD/JOD currency objects. Load MICR E13B as a self-hosted web font (`@font-face`) for the MICR strip.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (inline SVG) | 18.x (already installed) | SVG rendered as JSX in component | Zero additional dependency; SVG is a first-class DOM citizen in React; direct prop-driven updates without VDOM diffing overhead |
| `to-words` | ^3.x (latest stable) | Number → English currency words | Zero dependencies; TypeScript native; custom `currencyOptions` supports ILS/JOD; ESM-compatible; tree-shakeable |
| React.memo | built-in | Prevent re-render when props unchanged | SVG re-render is cheap but memo ensures parent re-renders (e.g. unrelated state) don't propagate to preview |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| MICR E13B web font (self-hosted) | OFL/GPL licensed | Authentic MICR strip rendering | Use when bundling a woff2 is acceptable (~10-20 KB); falls back to monospace if font fails to load |
| useMemo (built-in hook) | built-in | Cache expensive `toWords()` result | Wrap `convertAmountToWords()` call; only recomputes when `amount` or `currency` changes |
| Tailwind `animate-fade-in` | already in project | Entry animation on check appearance | Use for tab-switch animation; existing class, zero cost |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `to-words` | Hand-rolled number-to-words | Hand-rolling covers 95% of cases but fails on edge cases: 11/12 (eleven/twelve vs teen rule), 1000000 boundary, negative numbers, zero cents. `to-words` handles all of these correctly. |
| `to-words` | `number-to-words` (npm) | `number-to-words` has no TypeScript types and is not currency-aware. Would require custom wrapping to produce "One Thousand Israeli Shekels and 00/100" format. |
| Self-hosted MICR font | SVG path glyphs (hardcoded) | SVG paths for 14 MICR glyphs (0-9 + 4 symbols) would be ~3-4 KB inline and guaranteed to render. Viable fallback. Lower fidelity than real font but always works. |
| Inline SVG JSX | `<img src="data:image/svg+xml...">` | Data-URI approach prevents React prop-driven updates; would require string templating and `encodeURIComponent` on every keystroke. Much more complex. |
| Inline SVG JSX | `<canvas>` | Canvas requires imperative drawing API; loses accessibility, harder to maintain, no benefit for static check layout. |

**Installation:**
```bash
bun add to-words
```
No other new packages required. MICR font is a static file added to `public/fonts/`.

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── components/
│   ├── Sales/
│   │   ├── PaymentFlow.tsx          # existing — insert <CheckPreview> here
│   │   └── CheckPreview.tsx         # NEW — pure memoized SVG component
│   └── ui/
│       └── bank-autocomplete.tsx    # existing, unchanged
├── lib/
│   └── amountToWords.ts             # NEW — to-words wrapper with ILS/USD/JOD configs
public/
└── fonts/
    └── MicrE13b.woff2               # NEW — self-hosted MICR font file
```

### Pattern 1: Pure Memoized SVG Component

**What:** `CheckPreview` receives all check fields as props, computes display strings, renders a single `<svg>` element. Wrapped in `React.memo` so it only re-renders when its own props change.

**When to use:** Any time a complex visual component is derived purely from parent state — props-in, render-out, no internal state.

**Example:**
```typescript
// frontend/src/components/Sales/CheckPreview.tsx
import React, { useMemo } from "react";
import { convertAmountToWords } from "@/lib/amountToWords";

interface CheckPreviewProps {
  amount: string;
  currency: "ILS" | "USD" | "JOD";
  bankName: string;
  bankNumber: string;
  branchNumber: string;
  accountNumber: string;
  holderName: string;
  dueDate: string;
  focusedField?: string | null; // for highlight feature
}

export const CheckPreview = React.memo(function CheckPreview({
  amount, currency, bankName, bankNumber, branchNumber, accountNumber,
  holderName, dueDate, focusedField,
}: CheckPreviewProps) {
  const parsedAmount = parseFloat(amount) || 0;

  // Expensive conversion memoized — only recomputes when amount/currency changes
  const amountInWords = useMemo(
    () => convertAmountToWords(parsedAmount, currency),
    [parsedAmount, currency]
  );

  const micrLine = [
    bankNumber ? `⑆${bankNumber}⑆` : "⑆        ⑆",
    branchNumber ? `${branchNumber}⑉` : "        ⑉",
    accountNumber ? `⑈${accountNumber}⑈` : "⑈        ⑈",
  ].join(" ");

  return (
    <div dir="ltr" className="w-full">
      <svg
        viewBox="0 0 600 165"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto rounded-lg shadow-md"
        aria-label="Check preview"
        role="img"
      >
        {/* Paper background */}
        <rect width="600" height="165" rx="6" fill="#f5f0e8" />
        {/* ... layout elements ... */}
      </svg>
    </div>
  );
});
```

### Pattern 2: `dir="ltr"` Isolation Wrapper (PRV-04)

**What:** The SVG is wrapped in `<div dir="ltr">`. This creates a new Unicode bidirectional context, preventing the document-level `dir="rtl"` (set by `i18next` on `<html>`) from reversing the SVG layout.

**When to use:** Any component that must always render LTR regardless of app language.

**Why it works:** The SVG `<text>` elements inherit `direction` from the DOM. Setting `dir="ltr"` on the wrapper resets the inherited direction for the subtree. This is a browser-standard mechanism — no special React handling needed.

```tsx
// In PaymentFlow.tsx, wrapping the check section:
{paymentType === "Payment_Check" && (
  <div className="animate-fade-in space-y-4">
    {/* SVG preview — must be LTR even in Arabic mode */}
    <div dir="ltr">
      <CheckPreview
        amount={amount}
        currency={currency}
        bankName={bankName}
        bankNumber={bankNumber}
        branchNumber={branchNumber}
        accountNumber={accountNumber}
        holderName={holderName}
        dueDate={dueDate}
        focusedField={focusedField}
      />
    </div>
    {/* Form fields follow (these stay RTL in Arabic mode) */}
    <Separator label={t("payment.check")} />
    ...
  </div>
)}
```

### Pattern 3: `to-words` Custom Currency Wrapper

**What:** A thin `amountToWords.ts` module that configures three `ToWords` instances (one per currency) and exposes a single `convertAmountToWords(amount, currency)` function.

**Why separate module:** Keeps `CheckPreview.tsx` clean; allows lazy initialization of `ToWords` instances; easy to unit-test in isolation.

```typescript
// frontend/src/lib/amountToWords.ts
import { ToWords } from "to-words";

// ILS: Israeli Shekel — not built into to-words, configure manually
const toWordsILS = new ToWords({
  localeCode: "en-US",
  converterOptions: {
    currency: true,
    ignoreDecimal: false,
    ignoreZeroCurrency: false,
    doNotAddOnly: true,
    currencyOptions: {
      name: "Israeli Shekel",
      plural: "Israeli Shekels",
      symbol: "₪",
      fractionalUnit: { name: "Agora", plural: "Agorot", symbol: "" },
    },
  },
});

const toWordsUSD = new ToWords({
  localeCode: "en-US",
  converterOptions: {
    currency: true,
    ignoreDecimal: false,
    ignoreZeroCurrency: false,
    doNotAddOnly: true,
    currencyOptions: {
      name: "US Dollar",
      plural: "US Dollars",
      symbol: "$",
      fractionalUnit: { name: "Cent", plural: "Cents", symbol: "" },
    },
  },
});

const toWordsJOD = new ToWords({
  localeCode: "en-US",
  converterOptions: {
    currency: true,
    ignoreDecimal: false,
    ignoreZeroCurrency: false,
    doNotAddOnly: true,
    currencyOptions: {
      name: "Jordanian Dinar",
      plural: "Jordanian Dinars",
      symbol: "د.أ",
      fractionalUnit: { name: "Fils", plural: "Fils", symbol: "" },
    },
  },
});

const converters = { ILS: toWordsILS, USD: toWordsUSD, JOD: toWordsJOD };

export function convertAmountToWords(
  amount: number,
  currency: "ILS" | "USD" | "JOD"
): string {
  if (!amount || amount <= 0) return "";
  try {
    return converters[currency].convert(amount);
  } catch {
    return "";
  }
}
```

### Pattern 4: SVG Layout — Fixed viewBox with Proportional Height

**What:** Use a fixed `viewBox="0 0 600 165"` (matching ~2.75:6 aspect ratio). All positioning uses absolute x/y coordinates. The SVG fills container width via `width="100%"` and scales proportionally via `height="auto"`.

**Why:** Avoids layout thrash, responsive across screen widths, predictable text positioning.

**Check zone mapping (viewBox units):**
- Paper: rect(0,0,600,165) fill=#f5f0e8 (cream/paper)
- Top-left zone (bank name): text at x=20, y=26 — bold, dark
- Top-right zone (holder name): text at x=580, y=26, text-anchor=end
- Date zone: text at x=490, y=52 (right side, labelled "DATE")
- Amount box: rect(420,60,160,28) stroke with text inside (digit amount)
- Pay line (written amount): text at x=20, y=75 (spanning full width)
- MICR strip: rect(0,140,600,25) fill=#e8e0d0; text at x=20, y=158 with MICR font
- Separator line above MICR: line(0,138,600,138) stroke=#aaa

### Pattern 5: Field Focus Highlight

**What:** A subtle rect highlight in the SVG area corresponding to the currently focused field. The PaymentFlow parent tracks `focusedField` with `onFocus`/`onBlur` handlers and passes it as a prop.

**Implementation:** Each zone in the SVG has a conditional `<rect>` with low-opacity primary color fill:

```tsx
{focusedField === "bankName" && (
  <rect x="8" y="14" width="200" height="20" rx="3"
    fill="#dc2626" fillOpacity="0.08" />
)}
```

### Anti-Patterns to Avoid

- **Calling `toWords()` on every render without `useMemo`:** The conversion is synchronous but not trivial for large numbers. Without memoization it runs on every parent state change (including unrelated fields like `notes`). Wrap in `useMemo([parsedAmount, currency])`.
- **Using CSS `transform: scaleX(-1)` on the SVG for RTL:** This mirrors the entire check visually — all text becomes mirrored. Use `dir="ltr"` wrapper instead.
- **Animating SVG text on every keystroke:** CSS `transition` on SVG `<text>` elements can trigger compositing on mobile. Keep text updates instant (no transition). Apply entry animation only on initial mount via `animate-fade-in` on the wrapper div.
- **Using `<foreignObject>` for text that needs to wrap:** `<foreignObject>` causes layout recalculation on every update and has inconsistent SVG support across Android WebView versions. For the written-amount line, use SVG `<text>` with `textLength` attribute or `auto-shrink` logic instead.
- **Storing font as base64 data URI in JS:** Adds ~15-20 KB to JS bundle. Use `public/fonts/` + `@font-face` in `index.css` so it loads independently.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Number to English currency words | Custom `numberToWords()` function | `to-words` npm package | Edge cases: eleven/twelve (not "oneteen/twoteen"), 1,000,000 boundary, negative numbers, 0.01 cents display, localization. Dozens of well-known bugs in hand-rolled solutions. |
| RTL isolation | `i18n.language === "ar" ? props : reverseProps` | `dir="ltr"` on wrapper div | DOM-level isolation is authoritative; prop-level workarounds break with CSS logical properties and inherited text-align. |
| MICR character encoding | Unicode box-drawing chars or Courier New | MICR E13B web font or pre-drawn SVG paths | MICR symbols (⑆⑇⑈⑉) are not in standard Unicode. Must use dedicated font or path glyphs. |

**Key insight:** The most dangerous hand-roll in this phase is number-to-words. It looks trivially simple (1→"One", 10→"Ten") but fails on 11-19 (teen irregulars), 100 (hundred vs hundreds), 1000000, and the cents line ("and 00/100" convention). Use `to-words`.

---

## Common Pitfalls

### Pitfall 1: MICR Symbols Not Rendering
**What goes wrong:** The MICR symbols ⑆ (transit), ⑈ (on-us), ⑉ (dash), ⑇ (amount) are in Unicode block U+2460–U+24FF (Enclosed Alphanumerics) but the MICR E13B font maps them to proprietary codepoints. If the font fails to load, you get standard Unicode circles or question marks.

**Why it happens:** Web font loading is async. The font may not be loaded when SVG first renders on a cold page load.

**How to avoid:** Two strategies:
1. Use `font-display: block` in `@font-face` — text invisible until font loads (acceptable for check preview, not critical path).
2. Pre-draw the 4 MICR symbol glyphs as inline SVG `<path>` elements and only use the MICR font for the digits 0-9 (which fall back to monospace acceptably). This is the more robust approach.

**Warning signs:** SVG MICR line shows circles or rectangles in browser devtools inspector.

### Pitfall 2: RTL Mirroring Despite `dir="ltr"` Wrapper
**What goes wrong:** SVG `<text>` elements that use `textAnchor="end"` (right-aligned) may still flow RTL if the inherited direction is not reset at the SVG element level.

**Why it happens:** The `direction` CSS property cascades into SVG. The `dir="ltr"` attribute on the wrapper div resets it, but some Android WebView versions (API 28-) do not honour inherited direction in SVG text the same way as desktop Chrome.

**How to avoid:** Set `direction="ltr"` as an SVG attribute directly on the `<svg>` element AND on each `<text>` element that uses `textAnchor="end"`. Belt-and-suspenders approach:
```tsx
<svg direction="ltr" ...>
  <text direction="ltr" textAnchor="end" x={580} y={26}>
    {holderName || "Holder Name"}
  </text>
</svg>
```

**Warning signs:** Test in Chrome Android with `<html dir="rtl">` — if the name appears left-aligned or the check flips layout, add `direction="ltr"` to individual `<text>` nodes.

### Pitfall 3: Long Written Amounts Overflow SVG Bounds
**What goes wrong:** "Nine Hundred Ninety Nine Thousand Nine Hundred Ninety Nine Israeli Shekels and 99/100" is ~80 characters and overflows the pay line at standard font size (12px × 80 chars > 600px SVG width).

**Why it happens:** SVG `<text>` does not wrap by default. `textLength` attribute only compresses; it does not wrap.

**How to avoid:** Two options (discretion area — pick one):
1. **Auto-shrink:** Use `textLength` with `lengthAdjust="spacingAndGlyphs"` to compress text into the available width. Minimum font-size floor: 7px (below which it becomes unreadable). This works for this use case — the written amount line is decorative, not primary.
2. **Truncate with ellipsis:** Cap at ~90 chars, add `...` if overflow. Simpler but loses fidelity for very large amounts.

Recommended: auto-shrink. Calculate text pixel width via a hidden SVG ruler element or use a fixed compression ratio based on character count.

**Warning signs:** MICR strip becomes partially covered or text runs off the right edge of the SVG.

### Pitfall 4: Input Lag from Synchronous `toWords()` on Every Keystroke
**What goes wrong:** Without `useMemo`, every character typed in any field (bank number, branch number, notes...) causes `toWords(parsedAmount, currency)` to run synchronously in the render cycle.

**Why it happens:** `to-words` is synchronous and runs in the main thread. On mid-range Android (Snapdragon 450 class), this can add 2-5ms per render, which combined with SVG re-rendering may breach the 16ms frame budget.

**How to avoid:**
- Wrap `convertAmountToWords` in `useMemo([parsedAmount, currency])` inside `CheckPreview`
- Since `CheckPreview` is `React.memo`, it only re-renders when its props change
- Only `amount` and `currency` props trigger word recomputation
- Other field changes (bankName, accountNumber, etc.) update the SVG text nodes cheaply without triggering `toWords()`

**Warning signs:** React DevTools Profiler shows `CheckPreview` rendering on every parent state update when `amount` hasn't changed.

### Pitfall 5: SVG Height Calculation on Mobile
**What goes wrong:** `height="auto"` on an SVG may not work in all Android WebView versions — the SVG can collapse to zero height.

**Why it happens:** The `auto` keyword for SVG height was not universally supported before Chrome 88 (Android). Older WebViews (API 28-) may not recognize it.

**How to avoid:** Use `viewBox` + CSS `aspect-ratio` instead of `height="auto"`:
```tsx
<svg
  viewBox="0 0 600 165"
  style={{ width: "100%", aspectRatio: "600/165" }}
  ...
>
```
`aspect-ratio` is supported in Chrome 88+. For the target (mid-range Android), this is safe since Capacitor targets API 29+ by default.

---

## Code Examples

Verified patterns from official sources and project conventions:

### CheckPreview Integration Point in PaymentFlow.tsx
```tsx
// In PaymentFlow.tsx — add focusedField state:
const [focusedField, setFocusedField] = useState<string | null>(null);

// Inside the check-specific fields section (line ~200 in current file):
{paymentType === "Payment_Check" && (
  <div className="space-y-4 animate-fade-in">
    {/* Check SVG Preview — always LTR */}
    <div dir="ltr">
      <CheckPreview
        amount={amount}
        currency={currency}
        bankName={bankName}
        bankNumber={bankNumber}
        branchNumber={branchNumber}
        accountNumber={accountNumber}
        holderName={holderName}
        dueDate={dueDate}
        focusedField={focusedField}
      />
    </div>

    <Separator label={t("payment.check")} />

    <FormField label={t("payment.bank")} required>
      <BankAutocomplete
        value={bankName}
        onChange={setBankName}
        userId={userId}
        placeholder={t("payment.bank")}
        onFocus={() => setFocusedField("bankName")}
        onBlur={() => setFocusedField(null)}
      />
    </FormField>
    {/* ... rest of check fields with onFocus/onBlur ... */}
  </div>
)}
```

### `to-words` Custom Currency Config (verified against GitHub docs)
```typescript
// The to-words package supports currencyOptions override:
const toWords = new ToWords({
  localeCode: "en-US",
  converterOptions: {
    currency: true,
    doNotAddOnly: true,  // omits "Only" suffix common in Indian usage
    currencyOptions: {
      name: "Israeli Shekel",
      plural: "Israeli Shekels",
      symbol: "₪",
      fractionalUnit: {
        name: "Agora",
        plural: "Agorot",
        symbol: "",
      },
    },
  },
});

toWords.convert(1250.50);
// → "One Thousand Two Hundred Fifty Israeli Shekels And Fifty Agorot"
```

### MICR Font `@font-face` Declaration
```css
/* In frontend/src/index.css */
@font-face {
  font-family: "MICR";
  src: url("/fonts/MicrE13b.woff2") format("woff2");
  font-display: block;  /* block until font loads — acceptable for decorative strip */
  font-weight: normal;
  font-style: normal;
}
```

```tsx
// In SVG MICR strip:
<text
  x={20}
  y={158}
  fontFamily="MICR, 'Courier New', monospace"
  fontSize="11"
  fill="#1a1a1a"
  letterSpacing="2"
  direction="ltr"
>
  {micrLine}
</text>
```

### Field Focus Highlight Pattern
```tsx
// Focusable fields pass onFocus/onBlur up to PaymentFlow:
<Input
  value={bankName}
  onChange={(e) => setBankName(e.target.value)}
  onFocus={() => setFocusedField("bankName")}
  onBlur={() => setFocusedField(null)}
  // ...
/>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Canvas-based check rendering | Inline SVG JSX | 2020+ | SVG is declarative, prop-driven, and accessible. Canvas requires imperative drawing. |
| Custom number-to-words JS | `to-words` npm package | 2022+ | Zero-dependency, TypeScript, currency-aware, handles all edge cases. |
| `height="auto"` on SVG | `style={{ aspectRatio: "W/H" }}` | Chrome 88+ (2021) | `aspect-ratio` CSS property more reliable in WebView than `height="auto"`. |
| Separate .svg file imports | Inline SVG in JSX component | 2019+ (React patterns) | Dynamic prop interpolation requires inline SVG; external files are static. |

**Deprecated/outdated:**
- `react-inlinesvg`: Loads SVG from URL/string — overkill and adds async loading when the check SVG is fully dynamic and must be inline JSX.
- `svgr` at build time: For static icon files; not useful for dynamic data-driven SVGs.

---

## Open Questions

1. **MICR Font Licensing**
   - What we know: A SIL OFL licensed MICR E13B font exists (found on OnlineWebFonts.com), and GNU GPL version also exists. The Barcodesoft and IDAutomation versions are commercial (paid developer license).
   - What's unclear: Whether the specific OFL-licensed file is trustworthy, correctly encodes all 14 glyphs, and produces an authentic E-13B appearance.
   - Recommendation: During Wave 0, download and test the SIL OFL MICR font locally. If glyph fidelity is poor, fall back to hardcoded SVG paths for the 4 special symbols (⑆⑇⑈⑉) and use monospace for digits. The MICR strip is decorative in this phase — it does not need to be magnetically scannable.

2. **`to-words` `doNotAddOnly` flag**
   - What we know: Indian locale `to-words` output typically appends "Only" at the end (common in Indian check writing). The `doNotAddOnly` flag suppresses this.
   - What's unclear: Whether `doNotAddOnly` is available in the version current at install time (the GitHub README references it but version pinning should be checked on install).
   - Recommendation: Install `to-words`, run `console.log(toWords.convert(100, { currency: true }))` and verify output format. Adjust flag if needed.

3. **BankAutocomplete `onFocus`/`onBlur` Props**
   - What we know: The current `BankAutocomplete` component uses a Radix Popover + cmdk command input. It may not directly expose `onFocus`/`onBlur` props.
   - What's unclear: Whether adding `onFocus`/`onBlur` to `BankAutocomplete` requires modifying its interface (likely yes).
   - Recommendation: Check `BankAutocomplete` interface and add `onFocus`/`onBlur?: () => void` props if not present. This is a small change (low risk).

---

## Sources

### Primary (HIGH confidence)
- React official docs (`react.dev/reference/react/memo`, `react.dev/reference/react/useMemo`) — memoization patterns, when to use
- GitHub: `mastermunj/to-words` — custom `currencyOptions` configuration, `doNotAddOnly` flag
- MDN Web Docs — `dir` attribute, bidirectional text, SVG `direction` property inheritance
- Project codebase: `PaymentFlow.tsx` (410 lines), `spinner.tsx`, `tailwind.config.ts`, `index.css` — established patterns (inline SVG, CVA, animation classes, font-face)

### Secondary (MEDIUM confidence)
- WebSearch results for MICR E13B font (multiple commercial and OFL sources confirm SIL OFL license availability for a MICR E13B variant)
- WebSearch: LeanCode RTL in React guide — `dir="ltr"` wrapper technique for RTL isolation verified against MDN
- WebSearch: `to-words` GitHub README — custom currency structure example verified

### Tertiary (LOW confidence)
- WebSearch claim that `@amirsanni/number-to-words` has built-in ILS/JOD support — single source, not verified with official docs. Do NOT use this library; use `to-words` with manual config instead (verified approach).
- WebSearch claim that Android WebView API 28- has SVG height issues — from 2018 GitHub issue; may be resolved in current Capacitor. Test empirically.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — React inline SVG + to-words are both well-documented, confirmed in official sources, zero-dependency
- Architecture: HIGH — patterns are extensions of existing project patterns (CVA, React.memo, inline SVG as in spinner.tsx)
- RTL isolation: HIGH — `dir="ltr"` wrapper is the standard DOM-level approach, confirmed by MDN and RTL implementation guides
- MICR font strategy: MEDIUM — SIL OFL font existence confirmed, but glyph fidelity and exact file quality require empirical validation during Wave 0
- Performance: HIGH — React.memo + useMemo strategy well-documented; SVG for this use case has negligible rendering cost vs canvas

**Research date:** 2026-03-04
**Valid until:** 2026-06-04 (stable libraries; to-words API unlikely to change)
