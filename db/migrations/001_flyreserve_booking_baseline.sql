-- =============================================================================
-- FlyReserve Booking Baseline – Initial Schema Migration (v3)
-- Migration:  001_flyreserve_booking_baseline.sql
-- Issue:      SAH-23 (Data Engineering)
-- Parent:     SAH-21 data model plan
-- Revised:    v3 — fixes QA SAH-44 finding #2: narrows supported target to
--             PostgreSQL 14+ where gen_random_uuid() is a built-in pg_catalog
--             function requiring no extensions. v2 claimed PG13+ but provided
--             only a silent fallback when pgcrypto was unavailable, which would
--             cause table creation to fail on PG13 without pgcrypto.
-- Idempotent: yes — all DDL uses CREATE TABLE IF NOT EXISTS / CREATE INDEX IF
--             NOT EXISTS / DO $$ ... $$ guards for non-idempotent statements.
-- Target DB:  PostgreSQL 14+ (gen_random_uuid() built-in, no extension required)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
-- gen_random_uuid() is a built-in pg_catalog function on PostgreSQL 14+.
-- No pgcrypto extension is required or installed by this migration.
-- (QA SAH-44 finding #2: do not silently swallow pgcrypto errors on PG13 —
--  target is narrowed to PG14+ instead, where the function is always present.)

-- citext extension is optional; coupons.code uses a functional lower(code) unique
-- index as the primary case-insensitivity mechanism (works without citext).
-- Install citext for ergonomic case-insensitive query support if available.
-- (Architecture F4, QA SAH-32 finding #1, Cybersecurity low finding)
-- Note: citext is NOT required for the migration to apply cleanly — the
-- lower(code) unique index is the enforcement mechanism.
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS citext;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'citext extension not available (optional); lower(code) unique index is the case-insensitivity enforcement.';
END $$;

-- ---------------------------------------------------------------------------
-- ENUM types — replacing closed-set CHECK constraints for extensibility.
-- (Architecture F3: open/closed principle; adding values is ALTER TYPE ... ADD
--  VALUE with no table rewrite on Postgres 10+.)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE reservation_status_t AS ENUM (
        'pending',
        'confirmed',
        'payment_captured_ticketing_failed',  -- SAH-5 §7 explicit requirement
        'provider_disruption',                 -- SAH-9 §1.1
        'restricted_review',                   -- SAH-9 §1.1, §1.3 (fraud hold)
        'expired',
        'cancelled',
        'refunded'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE reservation_ownership_t AS ENUM (
        'unclaimed_guest',   -- guest checkout, no account — SAH-6 §1
        'claimed_account',   -- authenticated customer — SAH-6 §1
        'restricted_review'  -- ownership under review — SAH-6 §1
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE booking_ref_status_t AS ENUM (
        'active',
        'expired',
        'cancelled',
        'reissued'  -- SAH-9 §3 reissue operation
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_t AS ENUM (
        'pending',
        'succeeded',
        'failed',
        'refunded'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_gateway_t AS ENUM (
        'stripe',
        'paypal'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE invoice_status_t AS ENUM (
        'issued',
        'voided'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE discount_type_t AS ENUM (
        'percent',
        'fixed'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE cabin_class_t AS ENUM (
        'economy',
        'business',
        'first'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE validity_type_t AS ENUM (
        '48h',
        '14d'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE customer_status_t AS ENUM (
        'active',
        'suspended'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Sequence for invoice numbers
-- (Architecture F5: immutable financial numbering must use a Postgres sequence
--  to avoid gaps/duplicates under concurrency. Format: FR-{YYYY}-{seq8}
--  generated via BEFORE INSERT trigger below.)
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq
    START WITH 1
    INCREMENT BY 1
    NO CYCLE;

-- ---------------------------------------------------------------------------
-- 1. customers
--    Represents an authenticated FlyReserve account holder.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id                 UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
    email              VARCHAR(255)       UNIQUE NOT NULL,
    -- password_hash stores a PHC-format string (Argon2id, bcrypt, scrypt).
    -- Application MUST produce a PHC-encoded value. (Cybersecurity medium finding)
    password_hash      TEXT               NOT NULL,
    first_name         VARCHAR(100),
    last_name          VARCHAR(100),
    phone              VARCHAR(30),
    preferred_currency CHAR(3)            NOT NULL DEFAULT 'INR'
                           CHECK (preferred_currency ~ '^[A-Z]{3}$'),  -- N1 nit
    status             customer_status_t  NOT NULL DEFAULT 'active',
    created_at         TIMESTAMPTZ        NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ        NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. reservations
--    Core booking entity. Time-limited hold on flight seats.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservations (
    id               UUID                      PRIMARY KEY DEFAULT gen_random_uuid(),
    -- customer_id is nullable for guest checkout path (SAH-6).
    -- ON DELETE RESTRICT: customer deletion is blocked while financial records
    -- reference them; soft-delete via customers.status is the intended path.
    -- (Architecture F1: financial records must not be silently orphaned.)
    customer_id      UUID                      REFERENCES customers(id) ON DELETE RESTRICT,
    -- guest_email captures identity for unclaimed_guest bookings (SAH-6 §1).
    -- Architecture B2: explicit ownership state + guest identity, not null-FK fudge.
    guest_email      VARCHAR(255),
    ownership_state  reservation_ownership_t   NOT NULL DEFAULT 'claimed_account',
    origin_iata      CHAR(3)                   NOT NULL,
    destination_iata CHAR(3)                   NOT NULL,
    departure_at     TIMESTAMPTZ               NOT NULL,
    airline_code     CHAR(2)                   NOT NULL,
    flight_number    VARCHAR(10)               NOT NULL,
    cabin_class      cabin_class_t,
    passenger_count  SMALLINT                  NOT NULL CHECK (passenger_count > 0),
    validity_type    validity_type_t           NOT NULL,
    expires_at       TIMESTAMPTZ               NOT NULL,
    status           reservation_status_t      NOT NULL DEFAULT 'pending',
    base_fare_amount NUMERIC(12,2)             NOT NULL CHECK (base_fare_amount >= 0),
    currency         CHAR(3)                   NOT NULL CHECK (currency IN ('INR', 'USD')),
    created_at       TIMESTAMPTZ               NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ               NOT NULL DEFAULT now(),
    -- expires_at must be in the future relative to creation (B3 invariant)
    CONSTRAINT chk_reservations_expires_after_created
        CHECK (expires_at > created_at),
    -- guest path: either customer or guest_email must be present (SAH-6 §1)
    CONSTRAINT chk_reservations_guest_identity
        CHECK (
            (ownership_state = 'claimed_account' AND customer_id IS NOT NULL) OR
            (ownership_state <> 'claimed_account' AND (customer_id IS NOT NULL OR guest_email IS NOT NULL))
        )
);

-- Composite index for the expiry sweep job: WHERE status = 'pending' AND expires_at < now()
-- (Architecture F4: partial index on pending reservations for sweep performance)
CREATE INDEX IF NOT EXISTS idx_reservations_pending_expires
    ON reservations (expires_at)
    WHERE status = 'pending';

-- Composite for customer dashboard / status filters
CREATE INDEX IF NOT EXISTS idx_reservations_customer_status
    ON reservations (customer_id, status);

-- ---------------------------------------------------------------------------
-- 3. passengers
--    One row per passenger per reservation; captures manifest at booking time.
--    Passengers are write-once (no updated_at); manifest is immutable post-booking.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS passengers (
    id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id              UUID         NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    first_name                  VARCHAR(100) NOT NULL,
    last_name                   VARCHAR(100) NOT NULL,
    date_of_birth               DATE,
    -- passport_number_ciphertext stores application-layer encrypted ciphertext (BYTEA).
    -- The application performs envelope encryption before storing; the DB never holds
    -- plaintext passport numbers. (Architecture F6, Cybersecurity high finding)
    -- passport_key_id identifies the encryption key version used (for key rotation).
    passport_number_ciphertext  BYTEA,
    passport_key_id             TEXT,
    passport_expiry             DATE,
    nationality                 CHAR(2),
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_passengers_reservation_id
    ON passengers (reservation_id);

-- ---------------------------------------------------------------------------
-- 4. booking_references
--    Issued after payment confirmation. Holds PNR and airline booking ref.
--    1-to-1 with reservations (enforced by UNIQUE on reservation_id).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_references (
    id                  UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id      UUID                  NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE RESTRICT,
    pnr                 VARCHAR(10)           NOT NULL,
    airline_booking_ref VARCHAR(20)           NOT NULL,
    issued_at           TIMESTAMPTZ           NOT NULL DEFAULT now(),
    -- valid_until mirrors reservations.expires_at at issue time.
    -- N3 nit: this is a derived value; kept for denormalized reads but
    -- application must keep it consistent with reservations.expires_at.
    valid_until         TIMESTAMPTZ,
    -- pdf_url stores an opaque object storage key (not a signed URL).
    -- Signed URLs are generated at read time. (Cybersecurity low finding)
    pdf_url             TEXT,
    status              booking_ref_status_t  NOT NULL DEFAULT 'active'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_references_pnr
    ON booking_references (pnr);

CREATE INDEX IF NOT EXISTS idx_booking_references_reservation_id
    ON booking_references (reservation_id);

-- ---------------------------------------------------------------------------
-- 5. pricing_snapshots
--    Immutable locked pricing record captured at payment initiation.
--    (Architecture B1: SAH-8 §1/§6/§9 require a locked pricing snapshot.)
--    1:1 with payments; written once when payment is initiated.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pricing_snapshots (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    -- payment_id FK is set after the payments row is created; see note below.
    -- We use reservation_id as the initial anchor (created at price-lock time).
    reservation_id      UUID          NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE RESTRICT,
    -- provider amounts (what the airline charges FlyReserve)
    provider_amount     NUMERIC(12,2) NOT NULL CHECK (provider_amount >= 0),
    provider_currency   CHAR(3)       NOT NULL,
    provider_tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (provider_tax_amount >= 0),
    -- FlyReserve service fee
    service_fee_amount  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (service_fee_amount >= 0),
    -- platform tax (e.g. GST portion on service fee — SAH-8 §4.3)
    platform_tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (platform_tax_amount >= 0),
    -- coupon discount applied (denormalized from coupon_redemptions for snapshot integrity)
    coupon_discount     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (coupon_discount >= 0),
    -- FX rate snapshot (SAH-8 §6.4: must be auditable, timestamped, immutable)
    fx_rate             NUMERIC(18,8),   -- NULL when provider_currency = payment_currency
    fx_snapshot_at      TIMESTAMPTZ,
    -- payable total in payment currency = (provider_amount + service_fee_amount
    --                                     + platform_tax_amount - coupon_discount)
    --                                     * fx_rate (if applicable)
    payable_total       NUMERIC(12,2) NOT NULL CHECK (payable_total >= 0),
    payment_currency    CHAR(3)       NOT NULL,
    -- timestamp when the price was locked (for expiry enforcement)
    price_locked_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_snapshots_reservation_id
    ON pricing_snapshots (reservation_id);

-- ---------------------------------------------------------------------------
-- 6. payments
--    One row per payment attempt. Supports Stripe and PayPal.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id                  UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id      UUID              NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
    pricing_snapshot_id UUID              REFERENCES pricing_snapshots(id) ON DELETE RESTRICT,
    gateway             payment_gateway_t NOT NULL,
    gateway_payment_id  VARCHAR(100),
    gateway_status      VARCHAR(50),
    amount              NUMERIC(12,2)     NOT NULL CHECK (amount >= 0),
    currency            CHAR(3)           NOT NULL,
    tax_amount          NUMERIC(12,2)     NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    discount_amount     NUMERIC(12,2)     NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    net_amount          NUMERIC(12,2)     NOT NULL CHECK (net_amount >= 0),
    status              payment_status_t  NOT NULL DEFAULT 'pending',
    failure_reason      TEXT,
    paid_at             TIMESTAMPTZ,
    refunded_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ       NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ       NOT NULL DEFAULT now(),
    -- B3: net_amount identity invariant (Architecture B3 CHECK requirement)
    CONSTRAINT chk_payments_net_amount
        CHECK (net_amount = amount - discount_amount + tax_amount),
    -- B3: paid_at must be set when succeeded/refunded
    CONSTRAINT chk_payments_paid_at
        CHECK (paid_at IS NOT NULL OR status NOT IN ('succeeded', 'refunded')),
    -- B3: refunded_at must be set when refunded
    CONSTRAINT chk_payments_refunded_at
        CHECK (refunded_at IS NOT NULL OR status <> 'refunded'),
    -- Cybersecurity: negative amounts are a fraud surface; blocked by >= 0 per column
    -- (all NUMERIC cols already have >= 0 CHECK above)
    CONSTRAINT chk_payments_refunded_implies_paid
        CHECK (refunded_at IS NULL OR paid_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_payments_reservation_id
    ON payments (reservation_id);

-- Partial unique index: excludes NULL gateway_payment_id (pending rows)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_gateway_payment_id
    ON payments (gateway, gateway_payment_id)
    WHERE gateway_payment_id IS NOT NULL;

-- Architecture F4: status index for refund sweep and finance reconciliation
CREATE INDEX IF NOT EXISTS idx_payments_status
    ON payments (status);

-- ---------------------------------------------------------------------------
-- 7. coupons
--    Discount codes validated at checkout.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
    id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    -- code stored as-entered; the functional unique index on lower(code) enforces
    -- case-insensitive uniqueness at the DB level, preventing SAVE10/save10 bypass.
    -- (QA SAH-32 finding #1, Architecture F4, Cybersecurity low finding)
    -- If the citext extension is available, the DBA may ALTER COLUMN to CITEXT
    -- for ergonomic query support; the functional index approach is the portable baseline.
    code             VARCHAR(50)      NOT NULL,
    description      TEXT,
    discount_type    discount_type_t  NOT NULL,
    discount_value   NUMERIC(10,2)    NOT NULL CHECK (discount_value > 0),
    -- currency required when discount_type = 'fixed'
    currency         CHAR(3),
    min_order_amount NUMERIC(12,2)    CHECK (min_order_amount >= 0),
    max_uses         INTEGER          CHECK (max_uses > 0),
    uses_count       INTEGER          NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
    valid_from       TIMESTAMPTZ,
    valid_until      TIMESTAMPTZ,
    is_active        BOOLEAN          NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ      NOT NULL DEFAULT now(),
    CONSTRAINT chk_coupon_fixed_requires_currency
        CHECK (discount_type <> 'fixed' OR currency IS NOT NULL),
    -- Architecture F2: enforce uses_count <= max_uses at DB level
    CONSTRAINT chk_coupon_max_uses
        CHECK (max_uses IS NULL OR uses_count <= max_uses)
);

-- Case-insensitive unique index on lower(code): enforces DB-level uniqueness
-- regardless of input case. (QA SAH-32 finding #1)
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_code_lower
    ON coupons (lower(code));

CREATE INDEX IF NOT EXISTS idx_coupons_is_active
    ON coupons (is_active);

-- ---------------------------------------------------------------------------
-- 8. coupon_redemptions
--    Audit trail of coupon use per payment.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id        UUID          NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
    payment_id       UUID          NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    reservation_id   UUID          NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
    discount_applied NUMERIC(12,2) NOT NULL CHECK (discount_applied >= 0),
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    -- One redemption per reservation prevents double-applying a coupon.
    CONSTRAINT uq_coupon_redemptions_coupon_reservation
        UNIQUE (coupon_id, reservation_id)
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_payment_id
    ON coupon_redemptions (payment_id);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_reservation_id
    ON coupon_redemptions (reservation_id);

-- ---------------------------------------------------------------------------
-- 9. invoices
--    Issued post-payment; immutable financial record.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
    id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id      UUID             NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    reservation_id  UUID             NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
    -- customer_id nullable for guest checkout; ON DELETE RESTRICT because invoices
    -- are financial/legal records that must not be silently orphaned.
    -- (Architecture F1: financial records require RESTRICT, not SET NULL.)
    customer_id     UUID             REFERENCES customers(id) ON DELETE RESTRICT,
    -- invoice_number generated via BEFORE INSERT trigger using invoice_number_seq.
    -- (Architecture F5: gap-tolerant sequential invoice numbering via Postgres SEQUENCE.)
    invoice_number  VARCHAR(30)      UNIQUE NOT NULL,
    base_amount     NUMERIC(12,2)    NOT NULL CHECK (base_amount >= 0),
    discount_amount NUMERIC(12,2)    NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_amount      NUMERIC(12,2)    NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount    NUMERIC(12,2)    NOT NULL CHECK (total_amount >= 0),
    currency        CHAR(3)          NOT NULL,
    issued_at       TIMESTAMPTZ      NOT NULL DEFAULT now(),
    -- pdf_url stores opaque object storage key, not a signed URL.
    pdf_url         TEXT,
    status          invoice_status_t NOT NULL DEFAULT 'issued'
);

CREATE INDEX IF NOT EXISTS idx_invoices_payment_id
    ON invoices (payment_id);

CREATE INDEX IF NOT EXISTS idx_invoices_reservation_id
    ON invoices (reservation_id);

CREATE INDEX IF NOT EXISTS idx_invoices_customer_id
    ON invoices (customer_id);

-- ---------------------------------------------------------------------------
-- BEFORE UPDATE triggers for updated_at maintenance
-- (Architecture B3: application-layer ORMs frequently forget to set updated_at;
--  a trigger is the last-line defence for data integrity.)
-- ---------------------------------------------------------------------------

-- updated_at trigger function (shared)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- customers
DO $$ BEGIN
    CREATE TRIGGER trg_customers_updated_at
        BEFORE UPDATE ON customers
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- reservations
DO $$ BEGIN
    CREATE TRIGGER trg_reservations_updated_at
        BEFORE UPDATE ON reservations
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- payments
DO $$ BEGIN
    CREATE TRIGGER trg_payments_updated_at
        BEFORE UPDATE ON payments
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- BEFORE INSERT trigger for invoice_number generation
-- (Architecture F5: generate FR-{YYYY}-{seq8} from invoice_number_seq.)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        NEW.invoice_number := 'FR-' ||
            to_char(now(), 'YYYY') || '-' ||
            lpad(nextval('invoice_number_seq')::TEXT, 8, '0');
    END IF;
    RETURN NEW;
END;
$$;

DO $$ BEGIN
    CREATE TRIGGER trg_invoices_invoice_number
        BEFORE INSERT ON invoices
        FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Row-Level Security stubs
-- (Cybersecurity medium finding: RLS scaffolding for PII-holding tables.
--  Policies are intentionally permissive stubs — final USING clauses depend
--  on the application identity model, which is not yet settled for slice 1.
--  Stubs ensure RLS is enabled and that a future policy change is additive,
--  not a DDL rewrite.)
-- ---------------------------------------------------------------------------

-- Enable RLS on tables containing PII / financial data.
-- The permissive stub policies allow the application superuser role full
-- access; application roles should be restricted via separate policy files
-- once identity mapping is agreed (Cybersecurity review SAH-31 follow-up).

ALTER TABLE customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE passengers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_references ENABLE ROW LEVEL SECURITY;

-- Permissive stub: full-access for the superuser (owner of the table).
-- Named policies to simplify future replacement.
DO $$ BEGIN
    CREATE POLICY rls_customers_superuser_stub     ON customers            USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY rls_passengers_superuser_stub    ON passengers           USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY rls_payments_superuser_stub      ON payments             USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY rls_invoices_superuser_stub      ON invoices             USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY rls_booking_refs_superuser_stub  ON booking_references   USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- End of migration 001_flyreserve_booking_baseline.sql (v2)
-- Tables: customers, reservations, passengers, booking_references,
--         pricing_snapshots, payments, coupons, coupon_redemptions, invoices
-- Review changes: Architecture B1–B3, F1–F6; Cybersecurity H/M; QA M×2
-- =============================================================================
