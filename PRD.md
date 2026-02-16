# Product Requirements Document (PRD) - Alofok (Horizon) Trading App

## 1. Introduction
**Project Name:** Alofok (Horizon) Trading App  
**Target Audience:** 
1.  **Sales Representatives:** Field agents for Alofok Trading.
2.  **Designers:** Staff responsible for catalog management.
3.  **Admins:** Management needing oversight and insights.
**Purpose:** To streamline the wholesale sales process for painting tools, digitize the product catalog, manage customer orders, and accurately track debt collection with specific role-based capabilities.

## 2. Problem Statement
Currently, operations are manual. Sales reps lack real-time data, Designers have no direct way to update the catalog, and Admins lack visibility.
*   **Sales:** Manual route planning, static catalogs, error-prone debt collection (Cash/Check/Multi-currency).
*   **Designers:** Difficulty in updating product images and details quickly.
*   **Admins:** Delayed reporting and lack of real-time sales insights.

## 3. Solution Overview
A mobile-first application (ReactJS + Capacitor) with a Python FastAPI backend.
*   **Language:** **Arabic (Primary)**, English (Secondary).
*   **Core:** Role-based access ensuring each user sees only what they need.
*   **Sales:** Route management (Hebron/Sun, etc.), offline ordering, debt collection.
*   **Catalog:** Dynamic with "Best Sellers" and "Discounted" sections.

## 4. User Roles & Scope

### 4.1. Sales Representative (The Field Agent)
*   **Dashboard:** View Daily Itinerary (e.g., Sunday = Hebron customers).
*   **Catalog:** Browse/Search products. View "Best Sellers" and "Discounts".
*   **Order:** Create orders for assigned customers.
*   **Debt:** Collect Cash (ILS/USD/JOD) or Checks.
*   **Offline:** Full offline capability for catalog and ordering.

### 4.2. Designer (The Content Manager)
*   **Product Management:** Upload new product images, set descriptions, and pricing.
*   **Promotions:** Flag products as "Discounted" or "Best Seller".
*   **Stock:** (Optional) View basic stock levels to inform catalog updates.

### 4.3. Administrator (The Manager)
*   **Insights:** View real-time sales dashboards, debt collection summaries, and rep performance.
*   **User Management:** Manage Sales Reps and Designers.
*   **Approvals:** (Optional) Approve special discounts or large orders.

## 5. Key Features

### 5.1. Route & Customer Management (Sales)
*   **Schedule Logic:** Automated routing based on day/city (e.g., Mon: Bethlehem, Wed: Ramallah).
*   **Customer Profiles:** Balance, history, and location.

### 5.2. Enhanced Digital Catalog (All)
*   **Sections:** Standard Categories, **Discounted Items**, **Best Sellers**.
*   **Search:** Arabic/English search support.
*   **Media:** High-res images managed by Designers.

### 5.3. Financials (Sales & Admin)
*   **Debt Collection:** Multi-currency support (ILS base).
*   **Checks:** 
    *   Capture check details (Bank, Due Date, Image).
    *   **Returned Checks:** Handle bounced checks. 
        *   Mark check as "Returned".
        *   **Auto-Debit:** Automatically add the check amount back to the customer's debt.
        *   **History:** Explicitly show "Returned Check #123" in the statement.
        *   **Resolution:** Can be settled via new Cash payment or left as outstanding debt.
*   **Reconciliation & Statements:**
    *   **Problem:** Customers often dispute their current balance due to forgotten payments or missing records.
    *   **Solution:** Generate an on-demand "Statement of Account" for the customer.
    *   **Filters:** 
        *   Custom Date Range (From X to Y).
        *   Presets: Last Week, Last Month, Last Year.
        *   **"Since Zero":** Show all transactions since the customer's balance was last zero or negative (credit).
*   **Negative Balance Handling:**
    *   A negative balance indicates **Alofok owes the Customer** (Credit).
    *   Resolution: Can be used to pay for new orders or settled via cash payout.
*   **EOD Reports:** Automated daily summaries sent to Accounting.

### 5.4. Sales Rep Workflow Enhancements
*   **Customer-Centric Navigation:**
    *   **Flow:** Select Customer -> Choose Action (Order, Collect Debt, Statement, Return Check).
    *   **Benefit:** Reduces friction; all actions are context-aware for the selected customer.
*   **Pre-Visit Insights (The "Cheat Sheet"):**
    *   Displayed immediately upon selecting a customer.
    *   **Key Metrics:**
        *   **Total Debt:** Current outstanding balance (in base currency).
        *   **Last Collection:** Date and Amount of last payment.
        *   **Collection Frequency:** Average days between payments (e.g., "Pays every ~14 days").
        *   **Risk Indicator:** Visual cue (Green/Yellow/Red) based on debt age or amount.

## 6. Non-Functional Requirements
*   **Localization:** UI must be Right-to-Left (RTL) for Arabic.
*   **Performance:** 
    *   API responses compressed (Gzip/Brotli).
    *   In-memory caching for frequently accessed data (Catalog).
*   **Reliability:** 
    *   Global Error Handling: 500 Errors -> Slack Notification.
    *   Custom `HorizonException` -> Logged silently.
*   **Offline First:** Critical for Sales Reps in remote villages.
