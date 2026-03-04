# Milestones: Alofok

## v1.0 — Core Trading Platform

**Shipped:** 2026-03-04
**Phases:** 1–5 (pre-GSD, tracked via Feature.json)

### What Shipped
- Full backend: auth, RBAC, catalog, orders, payments, returned checks, statements, admin stats, EOD reports
- Full frontend: Sales (route, dashboard, catalog, orders, payments, statements, offline sync), Designer (product management), Admin (insights dashboard)
- Design system: dark theme, red primary, 36+ UI components, RTL-first
- Customer portal: separate auth, catalog browsing, order drafts, statements
- Delivery date routing, bonus orders, multi-select order cards
- Admin: customer reassignment, order delete/undeliver

### Validated Decisions
- Dark theme + red primary branding
- Separate customer auth
- Signed transaction amounts
- Server-authoritative offline sync
- delivery_date on Transaction model

---
*Last phase number: 5*
