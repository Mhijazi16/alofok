# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Alofok (Horizon)** is a wholesale trading app for a painting tools business. It targets three roles — Sales Representatives (field agents), Designers (catalog managers), and Admins — each with a distinct scoped UI and API access.

## Stack

- **Frontend:** ReactJS + Vite, **Bun** as package manager, **shadcn/ui + Tailwind CSS**
- **Mobile:** Capacitor (Android/iOS) — added after web is stable
- **Backend:** Python FastAPI, PostgreSQL, SQLAlchemy (Async), Alembic migrations, Black for Formatting
- **File Storage:** Local filesystem; uploads live in the `static_files` volume, served directly by Caddy at `/static/*` (with immutable cache headers); URL stored in DB
- **Localization:** Arabic primary (RTL layout), English fallback via `i18next`
- **State/Cache:** In-process TTL cache (backend, single worker — see Caching below), React Query (client-side cache + offline sync), Redux Toolkit (UI/auth state)
- **Infra:** Docker Compose (Caddy + Postgres + FastAPI). Caddy builds & serves the SPA and proxies `/api`. No separate frontend container.

## Commands

### Backend (Docker)
```bash
docker compose up              # Start Postgres + FastAPI
docker compose up db           # Start only the database
docker compose build           # Rebuild backend image
```

### Backend (manual, from /backend)
```bash
uvicorn app.main:app --reload --port 8000
alembic upgrade head           # Run migrations
alembic revision --autogenerate -m "description"  # Generate migration
black .
```

### Frontend (from /frontend)
```bash
bun install
bun dev
bun build
bun lint
```

## Architecture & Key Design Decisions

### Backend Middleware Pipeline (order matters)
1. **GZipMiddleware** — compresses all responses
2. **GlobalErrorHandler** — wraps every request in try/except:
   - `HorizonException` → log warning, return structured 4xx JSON (no Slack alert)
   - Generic `Exception` → log stack trace, **send Slack webhook**, return 500 JSON
3. **Auth Middleware** — decodes JWT, attaches `current_user` and `roles` to request state

### Caching
`CacheBackend` is an abstract base class with `get`/`set`/`delete`/`invalidate_prefix`. The current implementation is `InMemoryCache` (per-process TTL dict) — **there is no Redis service**, despite earlier docs. Because the cache lives in-process, the backend runs with `uvicorn --workers 1` so invalidations stay consistent; **do not raise the worker count without first adding a shared cache.** A `RedisCache` can be dropped in behind the same `CacheBackend` interface (and wired via a `REDIS_URL` setting + a compose `redis` service) when the app needs to scale beyond one worker/instance. Inject `CacheBackend` as a FastAPI dependency — never instantiate it directly in endpoints. TTLs: catalog 10 min, route 5 min, insights 2 min.

### Database Base Mixin
All models inherit a `BaseMixin` providing: `id` (UUID), `created_at`, `updated_at`, `is_deleted` (soft delete boolean, default False). Hard deletes should not be used.

### Transaction Signing Convention
`Transaction.amount` is **signed**: positive for orders/returned checks, negative for payments. The `data` JSONB column stores check details and exchange rates. `related_transaction_id` links a returned check back to its original payment transaction.

### RBAC
Three roles: `Admin`, `Designer`, `Sales`. Enforced at middleware and endpoint dependency level. Key scope rules:
- Only Designers (and Admins) can create/edit products
- Only Sales (and Admins) can create orders and payments
- Product list endpoint is publicly cached; writes invalidate the cache

### Frontend Role-Scoped Components
Components live under `src/components/Admin/`, `src/components/Designer/`, and `src/components/Sales/`. Each role has its own navigation/flow — don't share route logic across roles.

### Offline-First (Sales Rep critical path)
Catalog and customer data must be cached locally. Orders and payments created while offline go into a sync queue and are flushed when connectivity resumes. This is the highest-priority non-functional requirement.

### Localization
`i18next` with Arabic as default (`ar.json`) and English fallback (`en.json`), stored under `src/locales/`. All new UI strings must have both locale entries. RTL is enabled globally — do not use `margin-left`/`margin-right` directly; use logical CSS properties (`margin-inline-start`, etc.).

## Feature Tracking

`Feature.json` in the root tracks feature status. Update the `status` field (`todo` → `in_progress` → `done`) when beginning or completing a feature.
