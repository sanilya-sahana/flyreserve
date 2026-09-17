# FlyReserve Database Bootstrap Guide

**Scope:** dev and preview environments.
**Issues:** [SAH-89](/SAH/issues/SAH-89) (Data Engineering) — child of [SAH-15](/SAH/issues/SAH-15).

---

## 1. Target PostgreSQL version

All FlyReserve migrations target **PostgreSQL 14+**.
This is the version pinned in `docker-compose.yml` (`postgres:14-alpine`) and
documented in every migration header. Do not apply migrations to PG 13 or
earlier; `gen_random_uuid()` requires the `pgcrypto` extension on PG 13, which
is not installed by this project.

---

## 2. Who owns what

| Activity | Owner | Notes |
|---|---|---|
| Run `001`–`004` migrations on a new DB | **DevOps & Infrastructure** | First time only; plain `psql -f` or a migration runner is fine |
| Insert sentinel row (`flyreserve_environment`) | **DevOps & Infrastructure** | One-time per DB instance; see §3 below |
| Run `db/scripts/reseed_nonprod.sh` for QA resets | **DevOps & Infrastructure** (automated) or **developer** (local) | After bootstrap; safe to re-run; sentinel must already exist |
| Author new migrations (`00N_…sql`) | **Data Engineering** | All schema changes; owner ensures backfill plan for non-additive changes |
| Review migrations for security/RBAC | **Cybersecurity** | Gate 3 review required before merge |

---

## 3. One-time bootstrap per non-prod database

After creating a new dev or preview database and running the standard
migrations, apply the sentinel INSERT once:

### 3a. Run all migrations in order

```bash
psql "$DATABASE_URL" -f db/migrations/001_flyreserve_booking_baseline.sql
psql "$DATABASE_URL" -f db/migrations/002_flyreserve_seed_coupons.sql
psql "$DATABASE_URL" -f db/migrations/003_flyreserve_seed_nonprod_baseline.sql
psql "$DATABASE_URL" -f db/migrations/004_flyreserve_sentinel_bootstrap.sql
```

> If you use a migration runner (Flyway, Liquibase, raw psql CI step), add
> migration `004` to the same ordered list. The runner must apply them in
> numeric order.

### 3b. Insert the sentinel row (one-time, not re-applied by reseed)

For a **dev** database:
```sql
INSERT INTO flyreserve_environment (env_name) VALUES ('dev');
```

For a **preview** database:
```sql
INSERT INTO flyreserve_environment (env_name) VALUES ('preview');
```

Run via psql:
```bash
# Dev
psql "$DATABASE_URL" -c "INSERT INTO flyreserve_environment (env_name) VALUES ('dev');"

# Preview
psql "$DATABASE_URL" -c "INSERT INTO flyreserve_environment (env_name) VALUES ('preview');"
```

> **Do not add this INSERT to any migration file.** It is intentionally manual
> so a production database that accidentally receives the migration does not
> get a non-prod sentinel row (which would allow reseed to run against it).
> The table schema allows a `'production'` sentinel for labelling purposes,
> but `reseed_nonprod.sh` gate-3 explicitly rejects `'production'`.

---

## 4. Docker Compose (local dev)

The `docker-compose.yml` in the repo root brings up a PostgreSQL 14 container.
After `docker compose up -d db` is healthy, run the migrations and sentinel INSERT:

```bash
# One-liner for local dev bootstrap
docker compose up -d db
docker compose exec db psql -U flyreserve -d flyreserve \
  -f /dev/stdin < db/migrations/001_flyreserve_booking_baseline.sql
# ... repeat for 002, 003, 004 ...
docker compose exec db psql -U flyreserve -d flyreserve \
  -c "INSERT INTO flyreserve_environment (env_name) VALUES ('dev');"
```

Or connect via `DATABASE_URL=postgres://flyreserve:changeme@localhost:5432/flyreserve`
and run `psql "$DATABASE_URL" -f db/migrations/00N_...sql` from the repo root.

---

## 5. Reseed for QA / repeated test runs

After the initial bootstrap, reset the seed data at any time with:

```bash
FLYRESERVE_ENV=dev \
DATABASE_URL=postgres://flyreserve:changeme@localhost:5432/flyreserve \
bash db/scripts/reseed_nonprod.sh
```

`reseed_nonprod.sh` safety gates (in order):

1. `FLYRESERVE_ENV` must be `dev` or `preview`.
2. `DATABASE_URL` hostname must not match the production pattern (`flyreserve.com` by default).
3. **Positive sentinel check:** `flyreserve_environment.env_name` IN (`'dev'`, `'preview'`) — the migration-004 table must exist and the sentinel row must be present.

If gate-3 fails (table missing or no row), the script prints the bootstrap
SQL to stderr and exits non-zero. Run the one-time bootstrap (§3) first.

---

## 6. Migration runner selection (open item)

The migration runner for preview/CI has not been selected.  Plain `psql`
scripts are currently the reference approach.  DevOps & Infrastructure must
confirm whether to use Flyway, Liquibase, or raw psql CI step before the
preview pipeline ships. See [SAH-15](/SAH/issues/SAH-15) — the CI baseline
issue ([SAH-90](/SAH/issues/SAH-90)) owns this decision.

---

## 7. PostgreSQL version contract summary

| Env | PostgreSQL version | Source |
|---|---|---|
| Local dev (docker-compose) | 14-alpine (pinned in `docker-compose.yml`) | `docker-compose.yml` |
| Preview | 14+ (minimum) | SAH-16 baseline / SAH-89 |
| Production | 14+ (minimum; must match preview) | SAH-16 baseline |

`gen_random_uuid()` is a built-in `pg_catalog` function on PG 14+. No
extension install required. `citext` is optional (see migration 001 header).
