# Phase 7: SVG Check Preview - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Live, realistic bank check SVG preview inside the check payment form that updates as the user types. Shows bank name, holder name, date, amount (digits + written words), and MICR strip. The check renders LTR regardless of app language. No new data fields or payment logic — purely visual preview of existing CheckData.

</domain>

<decisions>
## Implementation Decisions

### Check Appearance
- Realistic paper check style — light background, printed-style fonts, subtle border/shadow (contrasts against dark app theme)
- MICR strip uses realistic E-13B style font or SVG paths mimicking magnetic ink characters
- Check is LTR always, even when app language is Arabic (PRV-04)

### Form Integration
- Check preview positioned above the check detail fields (between currency selector and BankAutocomplete/form inputs)
- Always visible when check payment type is selected — not collapsible
- Full width with proportional height based on real check dimensions (~2.75:6 ratio, approximately 150-170px tall on mobile)

### Empty Field Handling
- Light gray placeholder labels shown for all fields when empty (e.g., "Bank Name", "0.00" for amount)
- All check areas visible immediately — including optional fields (holder name, due date) — with placeholders regardless of required status
- Subtle highlight on the check area corresponding to the currently focused form field, connecting the form to the preview

### Amount in Words
- Always English words regardless of app language setting
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

</decisions>

<specifics>
## Specific Ideas

- Check layout from requirements: bank name top-left, holder name top-right, date + amount + currency center, MICR strip `#check# #branch#extra# #account#` bottom
- Amount displays as both digits (in amount box) and written-out English words (on line below)
- Must be performant on mid-range Android — no perceptible input lag (PRV-05)
- Existing `formatCurrency` helper in PaymentFlow can be reused for digit formatting

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PaymentFlow.tsx` (410 lines): All check state vars available (amount, currency, bankName, bankNumber, branchNumber, accountNumber, holderName, dueDate)
- `CheckData` interface in `salesApi.ts`: TypeScript type for check payload fields
- `BankAutocomplete` component: Bank name input with history
- `formatCurrency()` helper: Locale-aware number formatting (ar-SA / en-US)
- `spinner.tsx`: Existing inline SVG pattern with React.forwardRef and CVA variants

### Established Patterns
- Inline SVG in React components (not separate .svg files)
- CVA (class-variance-authority) for component variants
- Tailwind CSS for styling, logical CSS properties for RTL
- Glass effects (`glass`, `glass-strong`) and animation classes (`animate-fade-in`, `animate-slide-up`)

### Integration Points
- SVG component inserts into PaymentFlow.tsx between currency selector and check fields section
- Receives check form state as props from PaymentFlow parent
- Needs `dir="ltr"` wrapper to prevent RTL mirroring in Arabic mode
- `i18n.language` available for detecting current app language

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-svg-check-preview*
*Context gathered: 2026-03-04*
