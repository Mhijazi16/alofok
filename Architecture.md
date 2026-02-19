# Architecture & Technical Design — Alofok (Horizon)

## 1. High-Level Architecture

| Layer | Technology |
|---|---|
| Frontend | ReactJS + Vite, Bun, shadcn/ui + Tailwind CSS |
| Mobile | Capacitor (Android/iOS) — added after web is stable |
| Backend | Python FastAPI (async) |
| Database | PostgreSQL 15 |
| ORM / Migrations | SQLAlchemy (async) + Alembic |
| Caching | Redis |
| File Storage | Local filesystem, served via FastAPI `/static` mount |
| Monitoring | Slack Webhook (critical errors only) |

---

## 2. Backend Design

### 2.1 Middleware Pipeline (execution order)

1. **GZipMiddleware** — compresses all responses (Gzip/Brotli).
2. **GlobalErrorHandler** — wraps every request:
   - `HorizonException` → log warning, return structured 4xx JSON. No Slack alert.
   - Unhandled `Exception` → log full stack trace, **send Slack webhook**, return generic 500 JSON.
3. **AuthMiddleware** — decodes JWT, attaches `current_user` and `roles` to request state.

### 2.2 Caching (Redis)

- **Abstract interface:** `CacheBackend` with `get`, `set`, `delete`, `invalidate_prefix`.
- **Implementation:** `RedisCache` — connects via `REDIS_URL` env var, uses key prefixes per resource type (e.g. `catalog:`, `route:`).
- **Injection:** `CacheBackend` is a FastAPI dependency. Never instantiate it directly inside endpoints.
- **TTL policy:**
  - Product catalog: 10 minutes. Invalidated on any Designer write.
  - Customer route: 5 minutes.
  - Customer insights: 2 minutes.

### 2.3 Error Taxonomy

| Class | HTTP | Behaviour |
|---|---|---|
| `HorizonException` | 4xx | Logged as warning; structured JSON response. |
| Unhandled `Exception` | 500 | Logged + Slack alert; generic JSON response. |

---

## 3. Database Schema

### Base Mixin (all models)
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK, auto-generated |
| `created_at` | DateTime (UTC) | Auto-set on insert |
| `updated_at` | DateTime (UTC) | Auto-updated |
| `is_deleted` | Boolean | Soft delete flag, default `False` |

Hard deletes are not used anywhere in the system.

### Users
| Field | Type | Notes |
|---|---|---|
| `username` | String | Unique |
| `role` | Enum | `Admin`, `Designer`, `Sales` |
| `password_hash` | String | bcrypt |
| `is_active` | Boolean | Default `True` |

### Products
| Field | Type | Notes |
|---|---|---|
| `name_ar` | String | Arabic display name |
| `name_en` | String | English display name |
| `sku` | String | Unique |
| `price` | Decimal | |
| `image_url` | String | |
| `is_discounted` | Boolean | |
| `is_bestseller` | Boolean | |
| `created_by` | FK → User | Designer who created it |

### Customers
| Field | Type | Notes |
|---|---|---|
| `name` | String | |
| `city` | String | |
| `assigned_day` | Enum | `Sun`, `Mon`, `Tue`, `Wed`, `Thu` |
| `balance` | Decimal | Positive = owes Alofok; Negative = Alofok owes customer (credit) |

### Transactions
| Field | Type | Notes |
|---|---|---|
| `type` | Enum | `Order`, `Payment_Cash`, `Payment_Check`, `Check_Return` |
| `currency` | Enum | `ILS`, `USD`, `JOD` |
| `amount` | Decimal | **Signed:** positive = order/returned check; negative = payment |
| `status` | Enum | `Pending`, `Deposited`, `Returned`, `Cleared` — relevant for checks only |
| `related_transaction_id` | FK → Transaction | Links a `Check_Return` to its original `Payment_Check` |
| `data` | JSONB | Check details (bank, due date, image URL), exchange rates |
| `customer_id` | FK → Customer | |
| `created_by` | FK → User | Sales rep who recorded it |

**Returned Check flow:** Mark the check `Transaction.status = Returned`, create a new `Check_Return` transaction with a positive amount to re-debit the customer, and link both via `related_transaction_id`.

---

## 4. API Endpoints

### Auth
| Method | Path | Access |
|---|---|---|
| `POST` | `/auth/login` | Public |

### Catalog
| Method | Path | Access | Notes |
|---|---|---|---|
| `GET` | `/products` | All | Redis-cached |
| `POST` | `/products` | Designer, Admin | Invalidates cache |
| `PUT` | `/products/{id}` | Designer, Admin | Invalidates cache |

### Sales & Operations
| Method | Path | Access | Notes |
|---|---|---|---|
| `GET` | `/my-route` | Sales | Customers assigned to today's day |
| `GET` | `/customers/{id}/insights` | Sales, Admin | Debt, last payment, frequency, risk score |
| `GET` | `/customers/{id}/statement` | Sales, Admin | Params: `start_date`, `end_date`, `since_zero_balance` |
| `POST` | `/orders` | Sales | |
| `POST` | `/payments` | Sales | |
| `PUT` | `/checks/{id}/status` | Sales, Admin | Mark as Returned |

### Admin
| Method | Path | Access |
|---|---|---|
| `GET` | `/admin/stats/sales` | Admin |
| `GET` | `/admin/stats/debt` | Admin |
| `POST` | `/admin/customers/import` | Admin — bulk CSV upload |

---

## 5. Frontend Architecture

### Localization
- **Library:** `i18next`
- **Default locale:** Arabic (`ar`) — RTL layout enabled globally.
- **Fallback:** English (`en`).
- All UI strings must exist in both `src/locales/ar.json` and `src/locales/en.json`.
- Use CSS logical properties throughout (`margin-inline-start` not `margin-left`).

### State Management
- **Server state:** React Query — handles caching, background sync, and offline queue.
- **Client/UI state:** Redux Toolkit — auth session, role, UI preferences.

### Offline Strategy
Sales Reps operate in areas with poor connectivity. The app must function fully offline for the critical path:
- Catalog and customer list are cached via React Query with a long `staleTime`.
- Orders and payments created offline are stored in a persistent sync queue (IndexedDB) and flushed when connectivity is restored.

### Component Structure
```
src/
├── locales/
│   ├── ar.json
│   └── en.json
├── components/
│   ├── Admin/
│   ├── Designer/
│   └── Sales/
└── App.tsx
```
Role-specific components live under their own directory. Shared UI primitives (buttons, inputs, modals) live in `src/components/ui/`.

---

## 6. Directory Structure

```
/
├── backend/
│   ├── alembic/
│   │   └── versions/
│   ├── app/
│   │   ├── api/
│   │   │   ├── endpoints/      # auth.py, products.py, orders.py, etc.
│   │   │   └── deps.py         # JWT auth dependencies, role guards
│   │   ├── core/
│   │   │   ├── config.py       # Settings loaded from env vars
│   │   │   ├── errors.py       # HorizonException definition
│   │   │   └── security.py     # JWT encode/decode, password hashing
│   │   ├── middleware/
│   │   │   ├── error_handler.py
│   │   │   └── cache.py        # CacheBackend ABC + RedisCache
│   │   ├── models/             # SQLAlchemy models
│   │   ├── schemas/            # Pydantic request/response models
│   │   ├── services/           # Business logic layer
│   │   └── main.py
│   ├── Dockerfile
│   └── alembic.ini
│
└── frontend/
    ├── src/
    │   ├── locales/
    │   ├── components/
    │   ├── hooks/
    │   ├── store/              # Redux slices
    │   ├── services/           # API client, sync queue
    │   └── App.tsx
    ├── capacitor.config.ts
    └── package.json
```

---

## 7. Infrastructure (Local Dev)

`docker-compose.yml` starts two services:
- `db` — PostgreSQL 15 on port `5432`
- `backend` — FastAPI on port `8000` with hot reload

A `redis` service should be added to `docker-compose.yml`:
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
```

**Environment variables (backend):**
```
DATABASE_URL=postgresql+asyncpg://postgres:password@db/alofok
REDIS_URL=redis://redis:6379
JWT_SECRET=<secret>
SLACK_WEBHOOK_URL=<url>
```
