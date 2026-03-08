# Phase 15: Statement Enhancements - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can filter a customer statement by any custom date range and download that statement as a properly rendered Arabic PDF. Applies to both the Sales rep StatementView and the Customer portal StatementView.

</domain>

<decisions>
## Implementation Decisions

### Date Range Picker UX
- Add "Custom" as a 5th tab alongside existing presets (Since Zero, Week, Month, Year)
- Selecting "Custom" reveals a DatePicker with `mode="range"` (component already exists with two-month calendar)
- Statement updates live as soon as both from and to dates are selected — no "Apply" button
- Selected custom range persists in component state within the session — switching to another tab and back restores the range
- Both Sales rep and Customer portal StatementView get the Custom tab

### PDF Layout & Content
- Full branded header: "Alofok - Tools" and "شركة الأفق" as text (no logo image), customer name, date range, opening balance
- Table layout for transactions: Date | Type | Amount | Running Balance columns
- Orders show product sub-rows: indented lines with product name, qty, unit price (e.g., "بوية أبيض x3 @50")
- Purchases also show product sub-rows, same format as orders
- Payments and Check_Return show total only (no sub-rows)
- Closing summary section at bottom: total orders, total payments, total purchases, and closing balance
- PDF language is always Arabic regardless of app language setting

### Arabic RTL in PDF
- Primary approach: @react-pdf/renderer with Cairo font embedded
- Fallback: window.print() with CSS @media print styles if Arabic glyphs fail in @react-pdf
- Flow: try @react-pdf first → if Arabic breaks → fall back to browser print-to-PDF
- Cairo font for visual consistency with the app (already loaded in frontend)

### Download Trigger & Scope
- Download button in TopBar (top-right), icon-based (download/PDF icon)
- PDF exports the current filter — WYSIWYG: whatever tab is active (preset or custom range) determines PDF content
- Available in both Sales rep StatementView and Customer portal StatementView
- Filename format: `كشف_[customer_name]_[from_date]_[to_date].pdf` (Arabic customer name in filename)

### Claude's Discretion
- Exact TopBar download button icon choice (Download, FileDown, etc.)
- Loading state while PDF generates
- Error handling if PDF generation fails
- Print fallback CSS styling details
- How to detect @react-pdf Arabic failure (manual test vs runtime check)

</decisions>

<specifics>
## Specific Ideas

- Order/purchase sub-rows in PDF table are critical — customers need to see what they ordered and what each product cost
- Text branding: "Alofok - Tools" (English) + "شركة الأفق" (Arabic) — no logo image needed
- Statement is a financial document customers keep — table layout is familiar and professional

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DatePicker` component (`ui/date-picker.tsx`): Already supports `mode="range"` with two-month calendar, presets sidebar, and Radix popover
- `StatementView` (Sales): Existing preset tabs pattern (Tabs + TabsList + TabsTrigger), query params with start_date/end_date
- `CustomerStatementView` (Customer portal): Nearly identical structure — both need the same changes
- `TopBar` component: Supports action buttons in the top-right area
- `Timeline` + `TimelineItem`: Current statement rendering (will stay for on-screen view)
- `toLocalDateStr` utility: Date formatting helper for API params

### Established Patterns
- Tabs with pill variant for filter selection — extend with 5th "Custom" tab
- React Query with queryKey including filter params — add custom range to key
- salesApi/customerApi service pattern for API calls
- i18next localization with ar.json/en.json — add new PDF-related keys

### Integration Points
- Backend `/customers/{id}/statement` already accepts `start_date` and `end_date` query params — no backend changes needed for date range
- Customer portal `/customer-portal/statement` also accepts same params
- Transaction.data JSONB stores order/purchase line items — read for PDF sub-rows
- TopBar component for download button placement

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-statement-enhancements*
*Context gathered: 2026-03-08*
