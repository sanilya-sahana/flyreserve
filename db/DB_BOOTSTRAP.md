# FlyReserve Database Bootstrap Guide

**Scope:** dev and preview environments.
**Issues:** [SAH-89](/SAH/issues/SAH-89) (Data Engineering) — child of [SAH-15](/SAH/issues/SAH-15).

---

## Prerequisites: which files exist where

This guide covers the full bootstrap procedure. Some steps require files that
ship in separate branches:

| File | Branch / PR | Status |
|---|---|---|
| `db/migrations/001_flyreserve_booking_baseline.sql` | `main` | **Available now** |
| `db/migrations/002_flyreserve_seed_coupons.sql` | `main` | **Available now** |
| `db/migrations/004_flyreserve_sentinel_bootstrap.sql` | `feat/sah-89-db-baseline` (this PR) | **Available now** |
| `db/migrations/003_flyreserve_seed_nonprod_baseline.sql` | `feat/sah-57-nonprod-seed-baseline` | Pending SAH-57 merge |
| `db/scripts/reseed_nonprod.sh` | `feat/sah-57-nonprod-seed-baseline` | Pending SAH-57 merge |
| `docker-compose.yml` | `feat/sah-57-nonprod-seed-baseline` | Pending SAH-57 merge |

**Bootstrap steps that depend on SAH-57 files are marked with `[Requires SAH-57]`.**

---

## 1. Target PostgreSQL version

All FlyReserve migrations target **PostgreSQL 14+**.
Migration 001 pinned this version; `gen_random_uuid()` is built-in on PG 14+
with no extension required. Do not apply migrations to PG 13 or earlier.

---

## 2. Who owns what

| Activity | Owner | Notes |
|---|---|---|
| Run migrations 001–004 on a new DB | **DevOps & Infrastructure** | First time only |
| Insert sentinel row (`flyreserve_environment`) | **DevOps & Infrastructure** | One-time per DB instance; see §3 |
| Run `reseed_nonprod.sh` for QA resets | **DevOps & Infrastructure** (automated) or **developer** (local) | After SAH-57 lands; sentinel must already exist |
| Author new migrations (`00N_…sql`) | **Data Engineering** | All schema changes; owner ensures backfill plan for non-additive changes |
| Review migrations for security/RBAC | **Cybersecurity** | Gate 3 review required before merge |
| CI migration runner selection | **DevOps & Infrastructure** | Open item — see §6 |

---

## 3. One-time bootstrap per non-prod database

### 3a. Run all migrations in order

Apply the migrations that currently exist on `main` plus this PR (004):

```bash
# Available on main + this PR (feat/sah-89-db-baseline)
psql "$DATABASE_URL" -f db/migrations/001_flyreserve_booking_baseline.sql
psql "$DATABASE_URL" -f db/migrations/002_flyreserve_seed_coupons.sql
psql "$DATABASE_URL" -f db/migrations/004_flyreserve_sentinel_bootstrap.sql
```

**[Requires SAH-57]** After `feat/sah-57-nonprod-seed-baseline` merges, also
apply migration 003 in its correct numeric position (after 002, before 004):

```bash
# Run this between 002 and 004 once SAH-57 is on main
psql "$DATABASE_URL" -f db/migrations/003_flyreserve_seed_nonprod_baseline.sql
```

> Migration 003 seeds non-prod baseline data and checks that WELCOME10 coupon
> from migration 002 exists. Apply all four migrations in numeric order:
> 001 → 002 → 003 → 004.

### 3b. Insert the sentinel row (one-time, not re-applied by reseed)

After running migration 004, insert the sentinel row that identifies this
database as a non-prod instance. **This is intentionally not part of any
migration file** — see rationale in `004_flyreserve_sentinel_bootstrap.sql`.

For a **dev** database:
```bash
psql "$DATABASE_URL" -c "INSERT INTO flyreserve_environment (env_name) VALUES ('dev');"
```

For a **preview** database:
```bash
psql "$DATABASE_URL" -c "INSERT INTO flyreserve_environment (env_name) VALUES ('preview');"
```

Verify the sentinel was inserted:
```bash
psql "$DATABASE_URL" -c "SELECT env_name FROM flyreserve_environment;"
```

> **Why is the INSERT manual?** If it were in a migration file, a production
> database that accidentally ran the migration runner would acquire a `'dev'`
> or `'preview'` sentinel, making it appear safe to reseed. Keeping the INSERT
> separate ensures production databases remain empty (no sentinel row) and any
> attempt to run the reseed script fails gate-3 immediately.

---

## 4. Reseed for QA / repeated test runs

**[Requires SAH-57]** — `db/scripts/reseed_nonprod.sh` ships with that branch.

After SAH-57 merges and the initial bootstrap is complete (§3), reset seed
data at any time with:

```bash
FLYRESERVE_ENV=dev \
DATABASE_URL=postgres://flyreserve:changeme@localhost:5432/flyreserve \
bash db/scripts/reseed_nonprod.sh
```

`reseed_nonprod.sh` safety gates (in order):

1. `FLYRESERVE_ENV` must be `dev` or `preview`.
2. `DATABASE_URL` hostname must not match the production pattern (`flyreserve.com` by default).
3. **Positive sentinel check:** queries `flyreserve_environment.env_name` IN (`'dev'`, `'preview'`). Requires migration 004 table + the sentinel INSERT from §3b.

If gate-3 fails, the script prints the bootstrap SQL to stderr and exits
non-zero. Run the one-time bootstrap (§3) first.

---

## 5. Docker Compose (local dev)

**[Requires SAH-57]** — `docker-compose.yml` ships with that branch.

After SAH-57 merges, the `docker-compose.yml` in the repo root brings up a
PostgreSQL 14 container. Local dev full bootstrap after that merge:

```bash
docker compose up -d db     # starts postgres:14-alpine on localhost:5432
# Wait for the health check, then:
export DATABASE_URL=postgres://flyreserve:changeme@localhost:5432/flyreserve
psql "$DATABASE_URL" -f db/migrations/001_flyreserve_booking_baseline.sql
psql "$DATABASE_URL" -f db/migrations/002_flyreserve_seed_coupons.sql
psql "$DATABASE_URL" -f db/migrations/003_flyreserve_seed_nonprod_baseline.sql
psql "$DATABASE_URL" -f db/migrations/004_flyreserve_sentinel_bootstrap.sql
psql "$DATABASE_URL" -c "INSERT INTO flyreserve_environment (env_name) VALUES ('dev');"
```

**Before SAH-57 merges:** bring up your own PostgreSQL 14+ instance (for
example: `docker run -e POSTGRES_USER=flyreserve -e POSTGRES_PASSWORD=changeme
-e POSTGRES_DB=flyreserve -p 5432:5432 postgres:14-alpine`) and apply the
migrations manually following §3a (skipping migration 003 until SAH-57 lands).

---

## 6. Migration runner selection (open item)

The migration runner for preview/CI has not been selected. Plain `psql` scripts
are the current reference approach. DevOps & Infrastructure must confirm whether
to adopt Flyway, Liquibase, or raw psql CI step before the preview pipeline
ships. This decision is owned by DevOps / [SAH-90](/SAH/issues/SAH-90) (Create
FlyReserve initial CI baseline).

Until that decision lands, numeric-order `psql -f` invocations are the
authoritative way to apply migrations, and the runbook order (§3a) is the
operator contract.

---

## 7. PostgreSQL version contract summary

| Environment | PostgreSQL version | Source |
|---|---|---|
| Local dev (docker-compose, post SAH-57) | 14-alpine | `docker-compose.yml` on SAH-57 |
| Preview | 14+ (minimum) | SAH-16 baseline / SAH-89 |
| Production | 14+ (minimum; must match preview) | SAH-16 baseline |

`gen_random_uuid()` is a built-in `pg_catalog` function on PG 14+. No
extension install required. `citext` is optional (see migration 001 header).
