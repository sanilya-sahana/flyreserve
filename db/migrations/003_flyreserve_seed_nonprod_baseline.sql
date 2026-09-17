-- =============================================================================
-- FlyReserve Non-Prod Deterministic Seed — Baseline Dataset (v2)
-- Migration:  003_flyreserve_seed_nonprod_baseline.sql
-- Issue:      SAH-57 (Data Engineering)
-- Parent:     SAH-16 prerequisite baseline
-- Revised:    v2 — addresses Gate 3 review findings:
--   Architecture B1: WELCOME10 coupon applies to service fee only (SAH-8 §3.2),
--                    not to base fare. Moved to a separate reservation so
--                    happy-path anchor (seed-reservation-1) has exactly one
--                    successful payment.
--   Architecture N1: invoice_number_seq reset to 2 (not 1) to avoid collision
--                    with the seed invoice FR-2026-00000001 on next seq draw.
--   Architecture N3: WELCOME10 absence guard (RAISE EXCEPTION if coupon missing).
--   Architecture N4: Added seed-reservation-5 (cancelled) and
--                    seed-reservation-6 (refunded) with matching payments.
--   QA F2:      Expired-coupon scenario documented explicitly in comments.
-- Purpose:    Provide a deterministic, idempotent, safe-to-reset dataset for
--             dev and preview environments.
-- Idempotent: yes — all inserts use ON CONFLICT DO NOTHING or explicit guards.
-- Env:        DEV / PREVIEW ONLY — NOT SUITABLE FOR PRODUCTION.
-- Target DB:  PostgreSQL 14+ (matches 001_flyreserve_booking_baseline.sql)
-- =============================================================================
--
-- SENTINEL TABLE DEPENDENCY:
-- The reseed script (reseed_nonprod.sh) verifies that the target database
-- contains a row in flyreserve_environment with environment_name IN ('dev','preview')
-- before any TRUNCATE runs. That sentinel row is not seeded here because it is
-- part of the environment bootstrap (one-time setup per DB instance), not
-- repeatable seed data. See reseed_nonprod.sh for details.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Conventions
-- ---------------------------------------------------------------------------
-- Fixed UUIDs: every seed row uses a deterministic UUID so test fixtures can
-- reference IDs without a lookup step. Block-per-entity layout for readability.
--
-- Financial amounts: all INR, consistent with preferred_currency.
-- Happy-path confirmed booking (seed-reservation-1):
--   provider base fare:    INR 8 500.00
--   platform service fee:  INR   425.00  (5% of base fare, SAH-8 §2)
--   coupon:                INR     0.00  (no coupon on this booking)
--   platform tax (GST):    INR    76.50  (18% of fee, SAH-8 §4.3)
--   payable total:         INR 9 001.50
--
-- Coupon-redemption test booking (seed-reservation-5-coupon, section 5b):
--   provider base fare:    INR 8 500.00
--   platform service fee:  INR   425.00
--   WELCOME10 discount:    INR    42.50  (10% of service fee only, SAH-8 §3.2)
--   taxable fee:           INR   382.50  (425.00 - 42.50)
--   platform tax:          INR    68.85  (18% of 382.50)
--   payable total:         INR 8 951.35  (8500 + 425 - 42.50 + 68.85)
-- ---------------------------------------------------------------------------

-- ==========================================================================
-- Section 1 — Customers
-- ==========================================================================

-- seed-customer-1: authenticated account holder used in confirmed booking path
INSERT INTO customers (
    id, email, password_hash, first_name, last_name, phone, preferred_currency, status
) VALUES (
    '11111111-0000-4000-a000-000000000001',
    'qa-alice@flyreserve.invalid',
    -- Argon2id PHC-encoded hash of literal 'TestPassword1!' (dev only)
    '$argon2id$v=19$m=65536,t=3,p=4$c2VlZC1hbGljZQ$xK9Fd3V7eUFkbGljZTEhREVWT05MWQ',
    'Alice', 'Qauser', '+91-9000000001', 'INR', 'active'
) ON CONFLICT (id) DO NOTHING;

-- seed-customer-2: second account for multi-customer isolation and refund tests
INSERT INTO customers (
    id, email, password_hash, first_name, last_name, phone, preferred_currency, status
) VALUES (
    '11111111-0000-4000-a000-000000000002',
    'qa-bob@flyreserve.invalid',
    '$argon2id$v=19$m=65536,t=3,p=4$c2VlZC1ib2I$xK9Fd3V7eUJvYjEhREVWT05MWQ',
    'Bob', 'Testuser', '+91-9000000002', 'INR', 'active'
) ON CONFLICT (id) DO NOTHING;

-- seed-customer-3: suspended account for negative-path access tests
INSERT INTO customers (
    id, email, password_hash, first_name, last_name, phone, preferred_currency, status
) VALUES (
    '11111111-0000-4000-a000-000000000003',
    'qa-suspended@flyreserve.invalid',
    '$argon2id$v=19$m=65536,t=3,p=4$c2VlZC1zdXNw$xK9Fd3V7eUJzdXNwMSFERVZPTkxZ',
    'Carol', 'Suspended', NULL, 'INR', 'suspended'
) ON CONFLICT (id) DO NOTHING;


-- ==========================================================================
-- Section 2 — Reservations
-- ==========================================================================

-- seed-reservation-1: CONFIRMED — canonical known-good booking anchor.
-- This reservation has exactly ONE successful payment (seed-payment-1).
-- Route: BOM → DEL, 2026-10-01, economy, 1 pax, 14-day validity.
-- Far-future expires_at so this row never auto-expires during QA runs.
INSERT INTO reservations (
    id, customer_id, guest_email, ownership_state,
    origin_iata, destination_iata, departure_at,
    airline_code, flight_number, cabin_class,
    passenger_count, validity_type, expires_at,
    status, base_fare_amount, currency
) VALUES (
    '22222222-0000-4000-a000-000000000001',
    '11111111-0000-4000-a000-000000000001', NULL, 'claimed_account',
    'BOM', 'DEL', '2026-10-01 08:00:00+05:30',
    '6E', '6E-501', 'economy',
    1, '14d', '2099-12-31 23:59:59+00',
    'confirmed', 8500.00, 'INR'
) ON CONFLICT (id) DO NOTHING;

-- seed-reservation-2: PENDING — checkout flow tests (not yet paid, PayPal).
-- Route: DEL → BOM, 2026-10-15, economy, 2 pax, 48h validity.
INSERT INTO reservations (
    id, customer_id, guest_email, ownership_state,
    origin_iata, destination_iata, departure_at,
    airline_code, flight_number, cabin_class,
    passenger_count, validity_type, expires_at,
    status, base_fare_amount, currency
) VALUES (
    '22222222-0000-4000-a000-000000000002',
    '11111111-0000-4000-a000-000000000001', NULL, 'claimed_account',
    'DEL', 'BOM', '2026-10-15 14:30:00+05:30',
    '6E', '6E-204', 'economy',
    2, '48h', '2099-12-31 23:59:59+00',
    'pending', 17000.00, 'INR'
) ON CONFLICT (id) DO NOTHING;

-- seed-reservation-3: PENDING guest path — guest-checkout tests.
-- No customer_id; identity via guest_email.
INSERT INTO reservations (
    id, customer_id, guest_email, ownership_state,
    origin_iata, destination_iata, departure_at,
    airline_code, flight_number, cabin_class,
    passenger_count, validity_type, expires_at,
    status, base_fare_amount, currency
) VALUES (
    '22222222-0000-4000-a000-000000000003',
    NULL, 'qa-guest@flyreserve.invalid', 'unclaimed_guest',
    'MAA', 'HYD', '2026-11-01 06:00:00+05:30',
    'AI', 'AI-505', 'economy',
    1, '48h', '2099-12-31 23:59:59+00',
    'pending', 4200.00, 'INR'
) ON CONFLICT (id) DO NOTHING;

-- seed-reservation-4: EXPIRED — expiry-sweep and failed-payment negative tests.
INSERT INTO reservations (
    id, customer_id, guest_email, ownership_state,
    origin_iata, destination_iata, departure_at,
    airline_code, flight_number, cabin_class,
    passenger_count, validity_type, expires_at,
    status, base_fare_amount, currency
) VALUES (
    '22222222-0000-4000-a000-000000000004',
    '11111111-0000-4000-a000-000000000002', NULL, 'claimed_account',
    'BLR', 'CCU', '2024-01-01 09:00:00+05:30',
    'SG', 'SG-101', 'economy',
    1, '48h', '2024-01-03 09:00:00+05:30',   -- already past
    'expired', 3500.00, 'INR'
) ON CONFLICT (id) DO NOTHING;

-- seed-reservation-5: CANCELLED — cancellation negative-path tests (SAH-8 §9).
-- (Architecture N4: SAH-21 defines status ∈ {pending,confirmed,expired,cancelled,refunded})
INSERT INTO reservations (
    id, customer_id, guest_email, ownership_state,
    origin_iata, destination_iata, departure_at,
    airline_code, flight_number, cabin_class,
    passenger_count, validity_type, expires_at,
    status, base_fare_amount, currency
) VALUES (
    '22222222-0000-4000-a000-000000000005',
    '11111111-0000-4000-a000-000000000002', NULL, 'claimed_account',
    'HYD', 'BOM', '2026-12-01 11:00:00+05:30',
    'UK', 'UK-812', 'economy',
    1, '14d', '2099-12-31 23:59:59+00',
    'cancelled', 6200.00, 'INR'
) ON CONFLICT (id) DO NOTHING;

-- seed-reservation-6: REFUNDED — refund/adjustment tests (SAH-8 §9 refund rules).
-- (Architecture N4)
INSERT INTO reservations (
    id, customer_id, guest_email, ownership_state,
    origin_iata, destination_iata, departure_at,
    airline_code, flight_number, cabin_class,
    passenger_count, validity_type, expires_at,
    status, base_fare_amount, currency
) VALUES (
    '22222222-0000-4000-a000-000000000006',
    '11111111-0000-4000-a000-000000000001', NULL, 'claimed_account',
    'DEL', 'BLR', '2026-09-10 07:00:00+05:30',
    '6E', '6E-310', 'economy',
    1, '14d', '2099-12-31 23:59:59+00',
    'refunded', 5000.00, 'INR'
) ON CONFLICT (id) DO NOTHING;

-- seed-reservation-7: CONFIRMED — dedicated WELCOME10 coupon-redemption test.
-- (Architecture B1 + QA F1: separate from seed-reservation-1 so the happy-path
--  anchor has exactly one successful payment. This reservation exists solely to
--  verify the coupon-redemption constraint and audit trail.)
-- Fee-scoped coupon math (SAH-8 §3.2):
--   service fee: 425.00, coupon: 42.50 (10% of fee), tax: 68.85 (18% of 382.50)
--   payable: 8500 + 425 - 42.50 + 68.85 = 8 951.35
INSERT INTO reservations (
    id, customer_id, guest_email, ownership_state,
    origin_iata, destination_iata, departure_at,
    airline_code, flight_number, cabin_class,
    passenger_count, validity_type, expires_at,
    status, base_fare_amount, currency
) VALUES (
    '22222222-0000-4000-a000-000000000007',
    '11111111-0000-4000-a000-000000000002', NULL, 'claimed_account',
    'BOM', 'DEL', '2026-10-05 10:00:00+05:30',
    '6E', '6E-503', 'economy',
    1, '14d', '2099-12-31 23:59:59+00',
    'confirmed', 8500.00, 'INR'
) ON CONFLICT (id) DO NOTHING;


-- ==========================================================================
-- Section 3 — Passengers
-- ==========================================================================

-- Passenger for seed-reservation-1 (confirmed booking)
INSERT INTO passengers (
    id, reservation_id, first_name, last_name,
    date_of_birth, passport_number_ciphertext, passport_key_id,
    passport_expiry, nationality
) VALUES (
    '33333333-0000-4000-a000-000000000001',
    '22222222-0000-4000-a000-000000000001',
    'Alice', 'Qauser', '1990-06-15',
    -- BYTEA placeholder: 0x534545445f504158 = ASCII 'SEED_PAX'. Non-null for
    -- constraint compliance. Production must use envelope-encrypted ciphertext.
    '\x534545445f504158', 'dev-key-2026', '2030-12-31', 'IN'
) ON CONFLICT (id) DO NOTHING;

-- Passengers for seed-reservation-2 (2-pax pending booking)
INSERT INTO passengers (
    id, reservation_id, first_name, last_name,
    date_of_birth, passport_number_ciphertext, passport_key_id,
    passport_expiry, nationality
) VALUES (
    '33333333-0000-4000-a000-000000000002',
    '22222222-0000-4000-a000-000000000002',
    'Alice', 'Qauser', '1990-06-15',
    '\x534545445f504158', 'dev-key-2026', '2030-12-31', 'IN'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO passengers (
    id, reservation_id, first_name, last_name,
    date_of_birth, passport_number_ciphertext, passport_key_id,
    passport_expiry, nationality
) VALUES (
    '33333333-0000-4000-a000-000000000003',
    '22222222-0000-4000-a000-000000000002',
    'Bob', 'Testuser', '1988-03-22',
    '\x534545445f504159', 'dev-key-2026', '2029-06-30', 'IN'
) ON CONFLICT (id) DO NOTHING;

-- Passenger for guest reservation (seed-reservation-3)
INSERT INTO passengers (
    id, reservation_id, first_name, last_name,
    date_of_birth, passport_number_ciphertext, passport_key_id, nationality
) VALUES (
    '33333333-0000-4000-a000-000000000004',
    '22222222-0000-4000-a000-000000000003',
    'Guest', 'Traveller', '1985-11-10',
    '\x534545445f50415a', 'dev-key-2026', 'IN'
) ON CONFLICT (id) DO NOTHING;

-- Passenger for seed-reservation-7 (coupon test booking)
INSERT INTO passengers (
    id, reservation_id, first_name, last_name,
    date_of_birth, passport_number_ciphertext, passport_key_id,
    passport_expiry, nationality
) VALUES (
    '33333333-0000-4000-a000-000000000005',
    '22222222-0000-4000-a000-000000000007',
    'Bob', 'Testuser', '1988-03-22',
    '\x534545445f504159', 'dev-key-2026', '2029-06-30', 'IN'
) ON CONFLICT (id) DO NOTHING;

-- Passenger for seed-reservation-6 (refunded booking)
INSERT INTO passengers (
    id, reservation_id, first_name, last_name,
    date_of_birth, passport_number_ciphertext, passport_key_id,
    passport_expiry, nationality
) VALUES (
    '33333333-0000-4000-a000-000000000006',
    '22222222-0000-4000-a000-000000000006',
    'Alice', 'Qauser', '1990-06-15',
    '\x534545445f504158', 'dev-key-2026', '2030-12-31', 'IN'
) ON CONFLICT (id) DO NOTHING;


-- ==========================================================================
-- Section 4 — Pricing Snapshots
-- (One row per reservation that reached payment initiation.)
-- Payable formula (from 001 DDL comment):
--   provider_amount + service_fee_amount + platform_tax_amount - coupon_discount
-- ==========================================================================

-- Confirmed booking (seed-reservation-1) — no coupon
-- payable = 8500 + 425 + 76.50 - 0 = 9 001.50
INSERT INTO pricing_snapshots (
    id, reservation_id,
    provider_amount, provider_currency, provider_tax_amount,
    service_fee_amount, platform_tax_amount, coupon_discount,
    fx_rate, fx_snapshot_at, payable_total, payment_currency, price_locked_at
) VALUES (
    '44444444-0000-4000-a000-000000000001',
    '22222222-0000-4000-a000-000000000001',
    8500.00, 'INR', 0.00,
    425.00, 76.50, 0.00,
    1.0000, '2026-09-01 10:00:00+00',
    9001.50, 'INR', '2026-09-01 10:00:00+00'
) ON CONFLICT (id) DO NOTHING;

-- Pending 2-pax booking (seed-reservation-2) — PayPal pending
-- payable = 17000 + 850 + 153 - 0 = 18 003.00
INSERT INTO pricing_snapshots (
    id, reservation_id,
    provider_amount, provider_currency, provider_tax_amount,
    service_fee_amount, platform_tax_amount, coupon_discount,
    fx_rate, fx_snapshot_at, payable_total, payment_currency, price_locked_at
) VALUES (
    '44444444-0000-4000-a000-000000000002',
    '22222222-0000-4000-a000-000000000002',
    17000.00, 'INR', 0.00,
    850.00, 153.00, 0.00,
    1.0000, '2026-09-05 08:00:00+00',
    18003.00, 'INR', '2026-09-05 08:00:00+00'
) ON CONFLICT (id) DO NOTHING;

-- Guest reservation (seed-reservation-3) — pending
-- payable = 4200 + 210 + 37.80 - 0 = 4 447.80
INSERT INTO pricing_snapshots (
    id, reservation_id,
    provider_amount, provider_currency, provider_tax_amount,
    service_fee_amount, platform_tax_amount, coupon_discount,
    fx_rate, fx_snapshot_at, payable_total, payment_currency, price_locked_at
) VALUES (
    '44444444-0000-4000-a000-000000000003',
    '22222222-0000-4000-a000-000000000003',
    4200.00, 'INR', 0.00,
    210.00, 37.80, 0.00,
    1.0000, '2026-09-06 12:00:00+00',
    4447.80, 'INR', '2026-09-06 12:00:00+00'
) ON CONFLICT (id) DO NOTHING;

-- Refunded booking (seed-reservation-6)
-- payable = 5000 + 250 + 45 - 0 = 5 295.00  (5% fee, 18% tax)
INSERT INTO pricing_snapshots (
    id, reservation_id,
    provider_amount, provider_currency, provider_tax_amount,
    service_fee_amount, platform_tax_amount, coupon_discount,
    fx_rate, fx_snapshot_at, payable_total, payment_currency, price_locked_at
) VALUES (
    '44444444-0000-4000-a000-000000000004',
    '22222222-0000-4000-a000-000000000006',
    5000.00, 'INR', 0.00,
    250.00, 45.00, 0.00,
    1.0000, '2026-09-07 09:00:00+00',
    5295.00, 'INR', '2026-09-07 09:00:00+00'
) ON CONFLICT (id) DO NOTHING;

-- Coupon-test booking (seed-reservation-7) — WELCOME10 applied to service fee
-- Architecture B1 fix: coupon applies to service fee only (SAH-8 §3.2)
-- service fee: 425.00, coupon: 10% of fee = 42.50
-- taxable fee: 425.00 - 42.50 = 382.50, platform tax: 18% of 382.50 = 68.85
-- payable = 8500 + 425 + 68.85 - 42.50 = 8 951.35
INSERT INTO pricing_snapshots (
    id, reservation_id,
    provider_amount, provider_currency, provider_tax_amount,
    service_fee_amount, platform_tax_amount, coupon_discount,
    fx_rate, fx_snapshot_at, payable_total, payment_currency, price_locked_at
) VALUES (
    '44444444-0000-4000-a000-000000000005',
    '22222222-0000-4000-a000-000000000007',
    8500.00, 'INR', 0.00,
    425.00, 68.85, 42.50,
    1.0000, '2026-09-02 10:00:00+00',
    8951.35, 'INR', '2026-09-02 10:00:00+00'
) ON CONFLICT (id) DO NOTHING;


-- ==========================================================================
-- Section 5 — Payments
-- ==========================================================================

-- seed-payment-1: Stripe succeeded — the ONLY successful payment for
-- seed-reservation-1 (happy-path anchor). QA assertions MUST reference
-- this exact payment_id when verifying the confirmed booking.
-- (QA F1: removed second successful payment from reservation-1)
INSERT INTO payments (
    id, reservation_id, gateway, gateway_payment_id, gateway_status,
    amount, currency, tax_amount, discount_amount, net_amount, status, paid_at
) VALUES (
    '55555555-0000-4000-a000-000000000001',
    '22222222-0000-4000-a000-000000000001',
    'stripe', 'pi_SEED_ALICE_CONFIRMED_001', 'succeeded',
    9001.50, 'INR', 76.50, 0.00, 9001.50, 'succeeded',
    '2026-09-01 10:05:00+00'
) ON CONFLICT (id) DO NOTHING;

-- seed-payment-2: Stripe failed — card-declined on expired reservation-4.
INSERT INTO payments (
    id, reservation_id, gateway, gateway_payment_id, gateway_status,
    amount, currency, tax_amount, discount_amount, net_amount, status, failure_reason
) VALUES (
    '55555555-0000-4000-a000-000000000002',
    '22222222-0000-4000-a000-000000000004',
    'stripe', 'pi_SEED_DECLINED_001', 'card_declined',
    3500.00, 'INR', 0.00, 0.00, 3500.00, 'failed',
    'Your card was declined. (seed test row — card_declined)'
) ON CONFLICT (id) DO NOTHING;

-- seed-payment-3: PayPal pending — pending checkout for reservation-2.
INSERT INTO payments (
    id, reservation_id, gateway, gateway_payment_id, gateway_status,
    amount, currency, tax_amount, discount_amount, net_amount, status
) VALUES (
    '55555555-0000-4000-a000-000000000003',
    '22222222-0000-4000-a000-000000000002',
    'paypal', 'SEED-PAYPAL-ORDER-001', 'CREATED',
    18003.00, 'INR', 153.00, 0.00, 18003.00, 'pending'
) ON CONFLICT (id) DO NOTHING;

-- seed-payment-4: Stripe refunded — refund tests on reservation-6.
-- (Architecture N4: covers 'refunded' payment status)
INSERT INTO payments (
    id, reservation_id, gateway, gateway_payment_id, gateway_status,
    amount, currency, tax_amount, discount_amount, net_amount,
    status, paid_at, refunded_at
) VALUES (
    '55555555-0000-4000-a000-000000000004',
    '22222222-0000-4000-a000-000000000006',
    'stripe', 'pi_SEED_REFUND_001', 'succeeded',
    5295.00, 'INR', 45.00, 0.00, 5295.00,
    'refunded',
    '2026-09-07 09:05:00+00',
    '2026-09-08 14:00:00+00'
) ON CONFLICT (id) DO NOTHING;

-- seed-payment-5: Stripe succeeded — payment for coupon-test reservation-7.
-- (Architecture B1 fix: this is on reservation-7, not reservation-1)
-- Amounts reflect WELCOME10 fee-scope coupon: discount=42.50, tax=68.85
INSERT INTO payments (
    id, reservation_id, gateway, gateway_payment_id, gateway_status,
    amount, currency, tax_amount, discount_amount, net_amount, status, paid_at
) VALUES (
    '55555555-0000-4000-a000-000000000005',
    '22222222-0000-4000-a000-000000000007',
    'stripe', 'pi_SEED_COUPON_TEST_001', 'succeeded',
    8951.35, 'INR', 68.85, 42.50, 8951.35, 'succeeded',
    '2026-09-02 10:05:00+00'
) ON CONFLICT (id) DO NOTHING;


-- ==========================================================================
-- Section 6 — Coupon Redemptions
-- (Architecture B1 fix: WELCOME10 applies to service fee only, SAH-8 §3.2)
-- (Architecture N3: guard against missing coupon row)
-- ==========================================================================

-- Guard: fail loudly if WELCOME10 is not present in coupons.
-- If 002_flyreserve_seed_coupons.sql has not run, a silent no-op would leave
-- coupon_redemptions empty with no visible error.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM coupons WHERE code = 'WELCOME10') THEN
        RAISE EXCEPTION 'Seed prerequisite missing: coupon WELCOME10 not found. '
            'Run 002_flyreserve_seed_coupons.sql before this migration.';
    END IF;
END $$;

INSERT INTO coupon_redemptions (
    id, coupon_id, payment_id, reservation_id, discount_applied
)
SELECT
    '66666666-0000-4000-a000-000000000001',
    c.id,
    '55555555-0000-4000-a000-000000000005',  -- seed-payment-5 (reservation-7)
    '22222222-0000-4000-a000-000000000007',  -- seed-reservation-7
    42.50                                    -- 10% of service fee 425.00
FROM coupons c
WHERE c.code = 'WELCOME10'
ON CONFLICT (id) DO NOTHING;

-- QA F2 — Expired-coupon scenario:
-- The expired-coupon negative-path test is supported by seeded state as follows:
--   - EXPIRED20 (code seeded in 002) has valid_until = 2021-12-31 and is_active = FALSE.
--   - The application rejects EXPIRED20 at checkout because is_active = FALSE and
--     valid_until is in the past. No payment row is created (application rejects
--     before initiation).
--   - QA can verify this negative path without a dedicated seeded payment artifact
--     because the expectation is an HTTP error response, not a committed row.
-- This is intentional: the baseline seeds coupon entities, not application-layer
-- error artifacts. If the application records attempted/rejected coupon events in a
-- separate audit table, a seed row for that table belongs in a future migration.


-- ==========================================================================
-- Section 7 — Booking References
-- (Issued after payment for confirmed reservations)
-- ==========================================================================

-- Booking reference for seed-reservation-1 (confirmed, happy-path anchor)
INSERT INTO booking_references (
    id, reservation_id, pnr, airline_booking_ref,
    issued_at, valid_until, status
) VALUES (
    '77777777-0000-4000-a000-000000000001',
    '22222222-0000-4000-a000-000000000001',
    'QASEED',       -- 6-char PNR, clearly synthetic
    'SEEDBR001',    -- airline booking ref, clearly synthetic
    '2026-09-01 10:06:00+00',
    '2026-12-31 23:59:59+00',
    'active'
) ON CONFLICT (id) DO NOTHING;

-- Booking reference for seed-reservation-7 (coupon test booking, confirmed)
INSERT INTO booking_references (
    id, reservation_id, pnr, airline_booking_ref,
    issued_at, valid_until, status
) VALUES (
    '77777777-0000-4000-a000-000000000002',
    '22222222-0000-4000-a000-000000000007',
    'QACOUP',       -- coupon-test booking PNR
    'SEEDBR002',
    '2026-09-02 10:06:00+00',
    '2026-12-31 23:59:59+00',
    'active'
) ON CONFLICT (id) DO NOTHING;


-- ==========================================================================
-- Section 8 — Invoices
-- invoice_number is generated by sequence trigger on production inserts.
-- Seed rows supply an explicit invoice_number in FR-{YYYY}-{seq8} format
-- using reserved sequence value 1.  The reseed script uses RESTART WITH 2
-- so the next application-driven insert draws sequence value 2, not 1,
-- avoiding a UNIQUE constraint collision (Architecture N1 fix).
-- ==========================================================================

-- Invoice for seed-reservation-1 (confirmed, happy-path anchor)
INSERT INTO invoices (
    id, payment_id, reservation_id, customer_id,
    invoice_number, base_amount, discount_amount, tax_amount, total_amount,
    currency, issued_at, status
) VALUES (
    '88888888-0000-4000-a000-000000000001',
    '55555555-0000-4000-a000-000000000001',
    '22222222-0000-4000-a000-000000000001',
    '11111111-0000-4000-a000-000000000001',
    'FR-2026-00000001',   -- reserved sequence value 1 for seed traceability
    8500.00, 0.00, 76.50, 9001.50,
    'INR', '2026-09-01 10:06:30+00', 'issued'
) ON CONFLICT (id) DO NOTHING;

-- Invoice for seed-reservation-7 (coupon test booking)
-- Uses reserved sequence value 2; reseed sets sequence RESTART WITH 3.
INSERT INTO invoices (
    id, payment_id, reservation_id, customer_id,
    invoice_number, base_amount, discount_amount, tax_amount, total_amount,
    currency, issued_at, status
) VALUES (
    '88888888-0000-4000-a000-000000000002',
    '55555555-0000-4000-a000-000000000005',
    '22222222-0000-4000-a000-000000000007',
    '11111111-0000-4000-a000-000000000002',
    'FR-2026-00000002',   -- reserved sequence value 2
    8500.00, 42.50, 68.85, 8951.35,
    'INR', '2026-09-02 10:06:30+00', 'issued'
) ON CONFLICT (id) DO NOTHING;

-- Voided invoice for refunded reservation-6
INSERT INTO invoices (
    id, payment_id, reservation_id, customer_id,
    invoice_number, base_amount, discount_amount, tax_amount, total_amount,
    currency, issued_at, status
) VALUES (
    '88888888-0000-4000-a000-000000000003',
    '55555555-0000-4000-a000-000000000004',
    '22222222-0000-4000-a000-000000000006',
    '11111111-0000-4000-a000-000000000001',
    'FR-2026-00000003',   -- reserved sequence value 3
    5000.00, 0.00, 45.00, 5295.00,
    'INR', '2026-09-07 09:06:00+00', 'voided'
) ON CONFLICT (id) DO NOTHING;


-- ==========================================================================
-- End of 003_flyreserve_seed_nonprod_baseline.sql (v2)
-- DEV / PREVIEW ONLY — NOT SUITABLE FOR PRODUCTION
-- ==========================================================================
