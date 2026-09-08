# FlyReserve

Flight booking and temporary reservation platform. Customers can search flights, select airlines, enter passenger details, and create time-limited reservations with PNR and booking references. Supports checkout with coupons, tax calculation, and INR/USD payments through Stripe and PayPal.

## Repository layout

```
.
├── src/                    # Node/Express + TypeScript API (apps/api target)
│   ├── index.ts            # Entrypoint — starts HTTP server on $PORT (default 4000)
│   ├── app.ts              # Express application factory (importable in tests)
│   ├── controllers/        # Route handlers
│   ├── domain/             # Core domain types (flight, reservation, passenger, etc.)
│   ├── middleware/         # auth, errorHandler
│   ├── providers/          # Flight data providers (mock + provider interface)
│   └── services/           # Business logic (search, reservation, checkout, pricing)
├── apps/
│   └── web/                # React 19 + Vite + TypeScript customer booking SPA
│       └── src/
│           ├── booking/    # Search → SelectFlight → Passengers → Checkout → Confirmation
│           ├── design-system/ # Button, Field, shared Radix UI primitives
│           ├── routes/     # React Router tree + NotFoundScreen
│           └── lib/        # cn() utility
├── db/
│   └── migrations/
│       ├── 001_flyreserve_booking_baseline.sql  # Initial schema (PostgreSQL 14+)
│       └── 002_flyreserve_seed_coupons.sql      # Dev coupon seed data
├── tests/                  # Backend unit + integration tests (Vitest)
├── .env.example            # Copy to .env and fill in before running locally
└── sonar-project.properties
```

## Stack

| Layer | Tech |
|-------|------|
| API server | Node 20+, Express 4, TypeScript 5 |
| Frontend | React 19, Vite, React Router 7, TanStack Query, Tailwind CSS, Radix UI |
| Database | PostgreSQL 14+ |
| Tests (backend) | Vitest + Supertest |
| Tests (frontend) | Vitest + React Testing Library |
| E2E | Playwright (QA-owned, not in this repo yet) |
| Linting | ESLint + typescript-eslint |
| Coverage | vitest v8, Jacoco-compatible LCOV |
| CI quality | SonarQube (sonar-project.properties) |

## Prerequisites

- Node 20+ and pnpm 9+
- PostgreSQL 14+ (for production/staging; not required for unit tests)
- Copy `.env.example` to `.env` and fill in values

**Open prerequisite items** (tracked under [SAH-16](https://github.com/sanilya-sahana/flyreserve/issues)):
- Stripe and PayPal credentials not yet provisioned
- External flight-data provider not yet selected; `MockFlightProvider` is used in development
- JWT/JWKS auth stack not yet wired (stub in `src/middleware/auth.ts`); use `AUTH_BYPASS=true` locally

## Quick start

```bash
# Install dependencies
pnpm install

# Run backend in watch mode (port 4000)
pnpm dev

# Run frontend dev server (apps/web)
cd apps/web && pnpm dev

# Run backend tests
pnpm test

# Run frontend tests
cd apps/web && pnpm test

# Run backend tests with coverage
pnpm test:coverage
```

## Database setup

Apply migrations in order against a PostgreSQL 14+ database:

```bash
psql $DATABASE_URL -f db/migrations/001_flyreserve_booking_baseline.sql
psql $DATABASE_URL -f db/migrations/002_flyreserve_seed_coupons.sql  # dev seed
```

Both migrations are idempotent (`CREATE TABLE IF NOT EXISTS` / `DO $$ ... $$ guards`).

## API surface (v0.1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness probe |
| GET | `/api/v1/flights/search` | Search available flights |
| POST | `/api/v1/reservations` | Create a temporary reservation |
| GET | `/api/v1/reservations/:id` | Get reservation status |
| POST | `/api/v1/checkout/initiate` | Begin checkout for a reservation |
| POST | `/api/v1/bookings/confirm` | Confirm booking after payment |

Auth: `Authorization: Bearer <token>` required on all endpoints except `/health`.  
In development, set `AUTH_BYPASS=true` to skip token checks.

## Open assumptions (SAH-63)

The following items are stubs in this skeleton and require follow-up before production:

1. **Auth/JWT** — `src/middleware/auth.ts` stubs bearer-token checking. Full JWT verification (JWKS, audience, expiry) is blocked on Cybersecurity delivering the token contract (SAH-16).
2. **Payment providers** — Stripe/PayPal keys not yet in `.env.example` values. Integration callbacks are defined in the domain but not yet wired to real provider SDKs (SAH-58).
3. **Flight data provider** — `MockFlightProvider` is the only concrete provider. A real provider selection is an open item (SAH-16).
4. **Database migrations** — `001_flyreserve_booking_baseline.sql` is the baseline schema. A migration runner (Flyway, Liquibase, or custom) has not been selected yet.
5. **Monorepo workspace root** — `apps/web` is scaffolded but the full pnpm workspace root (`pnpm-workspace.yaml` pointing at `apps/*`) is not yet wired. Run `apps/web` independently with its own `pnpm install` until that lands (tracked: Engineering Manager SAH-38 F2).
6. **Docker / deploy manifests** — Dockerfile and docker-compose are not yet created (DevOps, SAH-15).

## Contributing

See `AGENTS.md` for agent-role routing rules. Gate 2 (lint + typecheck + unit tests) must pass before committing.
