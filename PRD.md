# Product Requirements Document — Alofok (Horizon)

## 1. Overview

**Alofok** is a mobile-first wholesale trading app for a painting tools business. It replaces fully manual operations — paper catalogs, handwritten receipts, and verbal debt tracking — with a role-scoped digital system that works reliably in the field, including offline.

**Language:** Arabic (primary, RTL), English (secondary).

---

## 2. User Roles

### Sales Representative
A field agent who visits customers daily by city/route.
- Views today's customer list (filtered by day/city).
- Browses the product catalog and creates orders.
- Collects payments (cash or check, multi-currency).
- Handles returned checks.
- Generates customer statements to resolve balance disputes.
- Must work **fully offline** — orders and payments are queued and synced later.

### Designer
A content manager responsible for the product catalog.
- Uploads and edits products (images, descriptions, pricing).
- Flags products as Discounted or Best Seller.
- No access to financial or customer data.

### Administrator
Management with full visibility.
- Views real-time sales and debt dashboards.
- Manages users (create, activate/deactivate Sales and Designer accounts).
- Approves returned check resolutions and special discounts.
- Imports customers in bulk via CSV.

---

## 3. Features

### 3.1 Route & Customer Management

**Daily Route View (Sales)**
- On login, the Sales Rep sees a list of customers assigned to today's day of the week.
- Routing is deterministic: each customer has a fixed `assigned_day` (e.g. Sunday = Hebron, Monday = Bethlehem).
- Tapping a customer opens their **Customer Dashboard**.

**Customer Dashboard**
The central hub for all actions on a customer. Displays immediately on selection:

| Metric | Description |
|---|---|
| Total Debt | Current outstanding balance in ILS (base currency) |
| Last Collection | Date and amount of the most recent payment |
| Collection Frequency | Average days between payments (e.g. "Pays every ~14 days") |
| Risk Indicator | Color-coded: Green / Yellow / Red based on debt age and amount |

From here the Sales Rep can: create an order, record a payment, view the statement, or handle a returned check.

---

### 3.2 Product Catalog

- **Sections:** All Products, Best Sellers, Discounted.
- **Search:** Supports Arabic and English queries simultaneously.
- **Media:** High-resolution images managed by Designers.
- **Caching:** Catalog is cached in Redis (10-minute TTL) and in the app (React Query). Invalidated on any write.
- **Offline:** Catalog is available offline via React Query cache.

---

### 3.3 Financials

#### Multi-Currency Support
Base currency is ILS. Transactions can also be recorded in USD or JOD. Exchange rates are stored in `Transaction.data` (JSONB) at the time of recording.

#### Payment Types
| Type | Description |
|---|---|
| Cash | Immediate settlement in ILS, USD, or JOD |
| Check | Deferred payment — bank, due date, and check image captured |

#### Returned Check Workflow
1. Sales Rep or Admin marks a check as **Returned**.
2. System creates a `Check_Return` transaction that re-debits the customer for the original amount.
3. The returned check appears explicitly in the customer's statement as "Returned Check #X".
4. Outstanding debt can be resolved via a new cash payment or left as-is.

#### Balance Rules
- **Positive balance** → customer owes Alofok.
- **Negative balance** → Alofok owes the customer (credit). Can be applied toward new orders or settled via cash payout.

---

### 3.4 Customer Statement

Designed specifically to resolve balance disputes — a common pain point.

**Filter options:**
- Custom date range (From → To)
- Presets: Last Week, Last Month, Last Year
- **"Since Zero"** — all transactions since the customer's balance was last at zero or in credit. This is the most-used filter in disputes.

**Output:** Chronological list of all transactions (orders, payments, returned checks) with running balance shown after each entry.

---

### 3.5 Offline Sync

Critical for Sales Reps visiting remote areas with poor connectivity.

| Data | Offline behaviour |
|---|---|
| Product catalog | Cached locally; stale cache used when offline |
| Customer list & route | Cached locally |
| Orders & payments | Stored in local queue (IndexedDB); synced when online |
| Conflict resolution | Server is authoritative; client queues are append-only |

---

### 3.6 Reporting

**End-of-Day (EOD) Report**
- Auto-generated at end of day per Sales Rep.
- Summarises: total cash collected (by currency), total check value, new orders placed.
- Sent to Accounting automatically.

**Admin Dashboards**
- Sales performance by rep, by period.
- Debt overview: total outstanding, broken down by city/route.
- Overdue checks list.

---

## 4. Non-Functional Requirements

| Requirement | Detail |
|---|---|
| **Offline-first** | Critical path (orders, payments) must work with no connectivity |
| **RTL layout** | All UI is right-to-left by default; Arabic is the primary locale |
| **Performance** | API responses compressed (Gzip). Catalog served from Redis cache |
| **Reliability** | 500 errors trigger a Slack alert. 4xx `HorizonException` errors are logged only |
| **Security** | JWT auth, RBAC enforced at middleware, role-scoped API endpoints |
| **Audit trail** | All transactions use soft deletes and immutable records — nothing is hard-deleted |
