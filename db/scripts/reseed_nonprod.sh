#!/usr/bin/env bash
# =============================================================================
# FlyReserve Non-Prod Reset & Reseed Script (v2)
# Script:  db/scripts/reseed_nonprod.sh
# Issue:   SAH-57 (Data Engineering)
# Revised: v2 — addresses Gate 3 review findings:
#   Security (blocking):  Replaced mutable deny-list with positive non-prod
#                         DB identity check: verifies flyreserve_environment
#                         sentinel table contains env_name IN ('dev','preview').
#                         PROD_HOSTNAME_PATTERN='' no longer overrides the
#                         entire safety gate — it only skips the hostname check;
#                         the sentinel check always runs.
#   Architecture N1:      invoice_number_seq RESTART WITH 3 (seed uses 1,2,3).
#   Architecture N2:      All TRUNCATE + seed executions wrapped in a single
#                         psql transaction (-1 flag) so a mid-run failure
#                         leaves the DB in a clean state (fully rolled back).
#   Architecture N6:      Empty PROD_HOSTNAME_PATTERN skips the hostname check
#                         (instead of matching everything). Hostname extracted
#                         from DATABASE_URL and matched as a full token.
#   QA F3:                Added deterministic content-check query after reseed
#                         that verifies QASEED PNR, FR-2026-00000001 invoice,
#                         and payable total 9001.50 for the anchor booking.
#
# PURPOSE:
#   Truncate all FlyReserve seed tables in dependency order and re-apply
#   migrations 002–003 so each QA or dev run starts from a known-good,
#   deterministic state.
#
# SAFETY GATES (in order, all must pass):
#   1. FLYRESERVE_ENV must be "dev" or "preview".
#   2. DATABASE_URL hostname check against PROD_HOSTNAME_PATTERN (skipped if
#      pattern is empty — use only if the sentinel check below is sufficient).
#   3. Positive non-prod DB identity: the target database must contain a row
#      in flyreserve_environment where env_name IN ('dev','preview').
#      This table is created once per environment during bootstrap; it is NOT
#      re-seeded by this script.
#
# Usage:
#   FLYRESERVE_ENV=dev DATABASE_URL=postgres://... ./db/scripts/reseed_nonprod.sh
#
# Options (env vars):
#   FLYRESERVE_ENV            Required: "dev" or "preview".
#   DATABASE_URL              PostgreSQL connection string.
#   DRY_RUN                   Set to "1" to print SQL without executing.
#   MIGRATIONS_DIR            Path to db/migrations/ (default: relative to script).
#   PROD_HOSTNAME_PATTERN     Regex matched against extracted hostname only (not
#                             full DATABASE_URL). Default: flyreserve\.com
#                             Set to "" to skip the hostname check entirely (the
#                             sentinel check always runs regardless).
#
# BOOTSTRAP DEPENDENCY:
#   The positive non-prod sentinel check requires flyreserve_environment to
#   exist and have a row with env_name IN ('dev','preview'). Create it once
#   per non-prod database:
#
#     CREATE TABLE IF NOT EXISTS flyreserve_environment (
#         env_name TEXT PRIMARY KEY CHECK (env_name IN ('dev','preview','production'))
#     );
#     INSERT INTO flyreserve_environment (env_name) VALUES ('dev');  -- or 'preview'
#
#   This bootstrap step is intentionally manual and not part of the repeatable
#   seed so it cannot be accidentally overwritten.
#
# DEV / PREVIEW ONLY — NOT SUITABLE FOR PRODUCTION
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-${SCRIPT_DIR}/../migrations}"
DRY_RUN="${DRY_RUN:-0}"
# Default: match 'flyreserve.com' as a hostname fragment. Empty = skip hostname check.
PROD_HOSTNAME_PATTERN="${PROD_HOSTNAME_PATTERN:-flyreserve\\.com}"

# ---------------------------------------------------------------------------
# Safety gate 1 — require explicit non-prod environment flag
# ---------------------------------------------------------------------------
if [[ -z "${FLYRESERVE_ENV:-}" ]]; then
    echo "ERROR: FLYRESERVE_ENV is not set. Set it to 'dev' or 'preview' to proceed." >&2
    exit 1
fi

if [[ "${FLYRESERVE_ENV}" != "dev" && "${FLYRESERVE_ENV}" != "preview" ]]; then
    echo "ERROR: FLYRESERVE_ENV='${FLYRESERVE_ENV}' is not a recognised non-prod value." >&2
    echo "       Accepted values: dev, preview" >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# Check DATABASE_URL is set
# ---------------------------------------------------------------------------
if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "ERROR: DATABASE_URL is not set." >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# Safety gate 2 — hostname deny-list (skipped when pattern is empty)
# (Architecture N6: extract hostname component; match only that token)
# ---------------------------------------------------------------------------
if [[ -n "${PROD_HOSTNAME_PATTERN}" ]]; then
    # Extract hostname from postgres://[user:pass@]host[:port]/db
    # Strip scheme, strip credentials, take host:port part, drop port.
    EXTRACTED_HOST=$(echo "${DATABASE_URL}" | \
        sed 's|^[^:]*://||' | \
        sed 's|.*@||' | \
        sed 's|/.*||' | \
        sed 's|:.*||')
    if echo "${EXTRACTED_HOST}" | grep -qE "${PROD_HOSTNAME_PATTERN}"; then
        echo "ERROR: Database hostname '${EXTRACTED_HOST}' matches production pattern." >&2
        echo "       Pattern: ${PROD_HOSTNAME_PATTERN}" >&2
        echo "       Refusing to truncate. Verify you are targeting a non-prod database." >&2
        exit 1
    fi
fi

# ---------------------------------------------------------------------------
# Check psql is available
# ---------------------------------------------------------------------------
if ! command -v psql &>/dev/null; then
    echo "ERROR: psql not found in PATH. Install postgresql-client." >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# Safety gate 3 — positive non-prod DB identity sentinel check
# (Security blocking finding fix: fail closed on positive identity, not
#  mutable deny-list. This check always runs regardless of PROD_HOSTNAME_PATTERN.)
# ---------------------------------------------------------------------------
echo ""
echo "Safety gate 3: verifying positive non-prod DB identity..."

if [[ "${DRY_RUN}" == "1" ]]; then
    echo "  [DRY RUN] Skipping sentinel check — would query flyreserve_environment."
else
    SENTINEL_RESULT=$(psql "${DATABASE_URL}" -t -A -c \
        "SELECT env_name FROM flyreserve_environment WHERE env_name IN ('dev','preview') LIMIT 1;" \
        2>&1 || true)

    if [[ -z "${SENTINEL_RESULT}" || "${SENTINEL_RESULT}" =~ "ERROR" || "${SENTINEL_RESULT}" =~ "does not exist" ]]; then
        echo "ERROR: Database does not identify as a non-prod environment." >&2
        echo "  Expected: flyreserve_environment table with env_name IN ('dev','preview')." >&2
        echo "  Got: ${SENTINEL_RESULT}" >&2
        echo "" >&2
        echo "  Bootstrap the sentinel for this database:" >&2
        echo "    CREATE TABLE IF NOT EXISTS flyreserve_environment (" >&2
        echo "        env_name TEXT PRIMARY KEY CHECK (env_name IN ('dev','preview','production'))" >&2
        echo "    );" >&2
        echo "    INSERT INTO flyreserve_environment (env_name) VALUES ('dev'); -- or 'preview'" >&2
        exit 1
    fi

    DB_ENV="${SENTINEL_RESULT}"
    echo "  Sentinel confirmed: database env_name = '${DB_ENV}'"

    if [[ "${DB_ENV}" != "${FLYRESERVE_ENV}" ]]; then
        echo "WARNING: FLYRESERVE_ENV='${FLYRESERVE_ENV}' but DB sentinel='${DB_ENV}'." >&2
        echo "         Mismatch suggests wrong DATABASE_URL. Refusing to proceed." >&2
        exit 1
    fi
fi

# ---------------------------------------------------------------------------
# Migration file existence checks
# ---------------------------------------------------------------------------
COUPON_SEED="${MIGRATIONS_DIR}/002_flyreserve_seed_coupons.sql"
BASELINE_SEED="${MIGRATIONS_DIR}/003_flyreserve_seed_nonprod_baseline.sql"

if [[ ! -f "${COUPON_SEED}" ]]; then
    echo "ERROR: Coupon seed not found at ${COUPON_SEED}" >&2
    exit 1
fi
if [[ ! -f "${BASELINE_SEED}" ]]; then
    echo "ERROR: Baseline seed not found at ${BASELINE_SEED}" >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# Summary banner
# ---------------------------------------------------------------------------
echo ""
echo "============================================================"
echo "FlyReserve Non-Prod Reset & Reseed (v2)"
echo "Environment : ${FLYRESERVE_ENV}"
echo "Database    : ${DATABASE_URL%%@*}@…  (credentials redacted)"
echo "Dry run     : ${DRY_RUN}"
echo "Migrations  : ${MIGRATIONS_DIR}"
echo "============================================================"
echo ""
echo "Tables that will be TRUNCATED (in FK-safe dependency order):"
echo "  coupon_redemptions, invoices, booking_references, payments"
echo "  pricing_snapshots, passengers, reservations, coupons, customers"
echo ""

if [[ "${DRY_RUN}" != "1" ]]; then
    echo "Proceeding in 3 seconds… (Ctrl-C to abort)"
    sleep 3
fi

# ---------------------------------------------------------------------------
# Build the transactional reseed SQL
# (Architecture N2: single psql -1 -f so a mid-run failure aborts cleanly)
# (Architecture N1: RESTART WITH 3 — seed occupies values 1, 2, 3)
# ---------------------------------------------------------------------------
TRANSACTIONAL_SQL=$(cat <<'ENDSQL'
BEGIN;

-- Step 1: Truncate all seed tables in FK-safe dependency order.
-- No CASCADE — cross-table surprises surface as errors rather than silent deletes.
TRUNCATE TABLE coupon_redemptions;
TRUNCATE TABLE invoices;
TRUNCATE TABLE booking_references;
TRUNCATE TABLE payments;
TRUNCATE TABLE pricing_snapshots;
TRUNCATE TABLE passengers;
TRUNCATE TABLE reservations;
TRUNCATE TABLE coupons;
TRUNCATE TABLE customers;

-- Step 2: Reset invoice_number_seq.
-- Seed rows occupy sequence values 1, 2, 3 (FR-2026-00000001..3).
-- RESTART WITH 4 ensures the next application-driven invoice draws value 4,
-- avoiding a UNIQUE constraint collision on invoice_number (Architecture N1 fix).
ALTER SEQUENCE invoice_number_seq RESTART WITH 4;

COMMIT;
ENDSQL
)

# ---------------------------------------------------------------------------
# Execute or print
# ---------------------------------------------------------------------------
if [[ "${DRY_RUN}" == "1" ]]; then
    echo "Step 1+2: [DRY RUN] Transactional truncate + sequence reset SQL:"
    echo "${TRANSACTIONAL_SQL}"
    echo ""
    echo "Step 3: [DRY RUN] Would apply: ${COUPON_SEED}"
    echo "Step 3: [DRY RUN] Would apply: ${BASELINE_SEED}"
else
    echo ""
    echo "Step 1+2: Truncating tables and resetting sequence (transactional)..."
    echo "${TRANSACTIONAL_SQL}" | psql "${DATABASE_URL}" -1 -f -
    echo "  Truncation and sequence reset complete."

    echo ""
    echo "Step 3: Applying seed migrations..."
    psql "${DATABASE_URL}" -f "${COUPON_SEED}"
    echo "  002 applied."
    psql "${DATABASE_URL}" -f "${BASELINE_SEED}"
    echo "  003 applied."
fi

# ---------------------------------------------------------------------------
# Step 4 — Row-count verification
# (QA F3: also verify key content: anchor booking PNR, invoice number, payable)
# ---------------------------------------------------------------------------
echo ""
echo "Step 4: Verification"

if [[ "${DRY_RUN}" != "1" ]]; then
    echo ""
    echo "-- Row counts (expected: customers=3, coupons=3, reservations=7,"
    echo "--   passengers=6, pricing_snapshots=5, payments=5,"
    echo "--   booking_references=2, coupon_redemptions=1, invoices=3)"
    psql "${DATABASE_URL}" -c "
SELECT
    'customers'          AS tbl, COUNT(*) AS rows FROM customers
UNION ALL SELECT 'coupons',              COUNT(*) FROM coupons
UNION ALL SELECT 'reservations',         COUNT(*) FROM reservations
UNION ALL SELECT 'passengers',           COUNT(*) FROM passengers
UNION ALL SELECT 'pricing_snapshots',    COUNT(*) FROM pricing_snapshots
UNION ALL SELECT 'payments',             COUNT(*) FROM payments
UNION ALL SELECT 'booking_references',   COUNT(*) FROM booking_references
UNION ALL SELECT 'coupon_redemptions',   COUNT(*) FROM coupon_redemptions
UNION ALL SELECT 'invoices',             COUNT(*) FROM invoices
ORDER BY tbl;
"

    echo ""
    echo "-- Content checks for happy-path anchor booking (seed-reservation-1)"
    CONTENT_CHECK=$(psql "${DATABASE_URL}" -t -A -c "
SELECT
    (SELECT pnr FROM booking_references WHERE reservation_id = '22222222-0000-4000-a000-000000000001' LIMIT 1)
        AS pnr_check,
    (SELECT invoice_number FROM invoices WHERE reservation_id = '22222222-0000-4000-a000-000000000001' LIMIT 1)
        AS invoice_check,
    (SELECT payable_total FROM pricing_snapshots WHERE reservation_id = '22222222-0000-4000-a000-000000000001' LIMIT 1)
        AS payable_check;
" 2>&1)
    echo "${CONTENT_CHECK}"

    # Parse and assert content check values
    PNR_VAL=$(echo "${CONTENT_CHECK}" | grep -oP 'QASEED' | head -1 || true)
    INV_VAL=$(echo "${CONTENT_CHECK}" | grep -oP 'FR-2026-00000001' | head -1 || true)
    PAY_VAL=$(echo "${CONTENT_CHECK}" | grep -oP '9001\.50' | head -1 || true)

    CONTENT_PASS=1
    if [[ "${PNR_VAL}" != "QASEED" ]]; then
        echo "CONTENT CHECK FAILED: expected PNR=QASEED, got: ${PNR_VAL}" >&2
        CONTENT_PASS=0
    fi
    if [[ "${INV_VAL}" != "FR-2026-00000001" ]]; then
        echo "CONTENT CHECK FAILED: expected invoice=FR-2026-00000001, got: ${INV_VAL}" >&2
        CONTENT_PASS=0
    fi
    if [[ "${PAY_VAL}" != "9001.50" ]]; then
        echo "CONTENT CHECK FAILED: expected payable=9001.50, got: ${PAY_VAL}" >&2
        CONTENT_PASS=0
    fi

    if [[ "${CONTENT_PASS}" == "1" ]]; then
        echo "  Content checks: PASS (PNR=QASEED, invoice=FR-2026-00000001, payable=9001.50)"
    else
        echo "ERROR: Content checks failed. Seed data may be inconsistent." >&2
        exit 1
    fi
else
    echo "  (dry run — skipping verification queries)"
fi

echo ""
echo "============================================================"
echo "Reseed complete.  Environment: ${FLYRESERVE_ENV}"
echo "============================================================"
