# Architecture & Technical Design - Alofok (Horizon)

## 1. High-Level Architecture
*   **Frontend:** ReactJS + Capacitor (Ionic optional). **RTL (Right-to-Left)** layout enabled.
*   **Backend:** Python FastAPI.
*   **Database:** PostgreSQL.
*   **ORM/Migration:** SQLAlchemy + Alembic.
*   **Caching:** Custom In-Memory TTL Dictionary (Python).
*   **Monitoring:** Slack Webhook for Critical Errors.

## 2. Tech Stack Details

### Frontend (Mobile/Web)
*   **Framework:** ReactJS (Vite).
*   **Runtime:** Capacitor (Android/iOS).
*   **Localization:** `i18next` (Arabic Default, English Fallback).
*   **State:** Redux Toolkit or React Query (for caching/offline sync).

### Backend (API)
*   **Framework:** FastAPI.
*   **Database:** PostgreSQL.
*   **ORM:** SQLAlchemy (Async).
*   **Migrations:** Alembic.
*   **Middleware:**
    *   `GZipMiddleware` (Compression).
    *   `GlobalErrorHandler` (Custom).
    *   `TTLCacheMiddleware` (Custom implementation).

## 3. Backend Design Patterns & Components

### 3.1. Middleware Pipeline
1.  **Compression:** Gzip/Brotli to reduce payload size.
2.  **Global Error Handler:**
    *   `try/except` block wrapping requests.
    *   `if type(e) == HorizonException`: Log warning, return structured 400/4xx JSON.
    *   `if type(e) == Exception (500)`: Log error stack trace, **Send Slack Alert**, return generic 500 JSON.
3.  **Auth Middleware:** Decodes JWT, attaches `current_user` and `roles` to request state.

### 3.2. Caching Strategy
*   **Abstract Base Class:** `CacheBackend` (interface with `get`, `set`, `delete`).
*   **Implementations:**
    *   `InMemoryCache`: Singleton dictionary (Current implementation).
    *   `RedisCache`: Redis-based implementation (Future-proof).
*   **Dependency Injection:** Inject `CacheBackend` into services/middleware, configured via env vars.

### 3.3. Database Models (ER Schema)

**Base Model Mixin:**
*   `created_at`: DateTime (UTC, Auto-set)
*   `updated_at`: DateTime (UTC, Auto-update)
*   `is_deleted`: Boolean (Default False, for Soft Delete)

#### Users (RBAC)
*   *Base Model Fields*
*   `id`: UUID
*   `username`: String
*   `role`: Enum (**Admin**, **Designer**, **Sales**)
*   `password_hash`: String
*   `is_active`: Boolean

#### Products (Catalog)
*   *Base Model Fields*
*   `id`: UUID
*   `name_ar`: String (Arabic)
*   `name_en`: String (English)
*   `sku`: String
*   `is_discounted`: Boolean
*   `is_bestseller`: Boolean
*   `price`: Decimal
*   `image_url`: String
*   `created_by`: FK -> User (Designer)

#### Customers & Routes
*   *Base Model Fields*
*   `id`: UUID
*   `name`: String
*   `city`: String
*   `assigned_day`: Enum (Sun, Mon...)
*   `balance`: Decimal

#### Transactions (Sales & Debt)
*   *Base Model Fields*
*   `id`: UUID
*   `type`: Enum (Order, Payment_Cash, Payment_Check, **Check_Return**)
*   `currency`: Enum (ILS, USD, JOD)
*   `amount`: Decimal (Signed: Negative for payments, Positive for Orders/Returns)
*   `related_transaction_id`: FK -> Transaction (For Check Returns, links to original payment)
*   `data`: JSONB (Stores check details, exchange rates)
*   `status`: Enum (Pending, Deposited, **Returned**, Cleared) (Specifically for Checks)

## 4. API Endpoints Structure

### Auth
*   `POST /auth/login`

### Catalog (Read: All, Write: Designer/Admin)
*   `GET /products` (Cached)
*   `POST /products` (Designer only, invalidates cache)
*   `PUT /products/{id}` (Designer only)

### Sales & Operations (Sales Rep)
*   `GET /my-route` (Returns customers for today)
*   `GET /customers/{id}/insights`
    *   Returns: `{ total_debt, last_payment_date, last_payment_amount, avg_payment_interval_days, risk_score }`
*   `POST /orders`
*   `POST /payments`
*   `PUT /checks/{id}/status` (Admin/Sales: Mark as Returned)
*   `GET /customers/{id}/statement`  
    *   Query Params: `start_date`, `end_date`, `since_zero_balance=true`
    *   Returns: List of transactions (Orders, Payments, Returns) and running balance.

### Admin Insights
*   `GET /admin/stats/sales`
*   `GET /admin/stats/debt`

## 5. Directory Structure
```
/
├── backend/
│   ├── alembic/            # DB Migrations
│   ├── app/
│   │   ├── api/
│   │   │   ├── endpoints/
│   │   │   └── deps.py     # Auth dependencies
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── errors.py   # HorizonException
│   │   │   └── security.py
│   │   ├── middleware/
│   │   │   ├── error_handler.py # Slack integration
│   │   │   └── cache.py    # Custom TTL Dict
│   │   ├── models/         # SQLAlchemy Models
│   │   └── main.py
│   └── alembic.ini
│
├── frontend/
│   ├── src/
│   │   ├── locales/        # ar.json, en.json
│   │   ├── components/
│   │   │   ├── Admin/
│   │   │   ├── Designer/
│   │   │   └── Sales/
│   │   └── App.tsx
│   └── capacitor.config.ts
```
