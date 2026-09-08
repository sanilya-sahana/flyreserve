-- =============================================================================
-- 002_flyreserve_seed_coupons.sql
-- DEV / TEST SEED DATA — NOT SUITABLE FOR PRODUCTION
-- =============================================================================
-- Purpose  : Insert representative coupon rows for local dev and staging.
-- Depends  : 001_flyreserve_booking_baseline.sql (coupons table must exist).
-- Safe to  : Re-run; INSERT … ON CONFLICT DO NOTHING is idempotent.
-- =============================================================================

-- 1. WELCOME10 — 10% percent-off coupon, no minimum, limited to 500 uses,
--    currently active, valid for a broad window.
INSERT INTO coupons (
    id,
    code,
    description,
    discount_type,
    discount_value,
    currency,
    min_order_amount,
    max_uses,
    uses_count,
    valid_from,
    valid_until,
    is_active,
    created_at
)
VALUES (
    'a1000000-0000-4000-8000-000000000001',
    'WELCOME10',
    '[DEV/TEST] 10% welcome discount — percent coupon, no minimum order',
    'percent',
    10.00,
    NULL,          -- currency irrelevant for percent type
    NULL,          -- no minimum order amount
    500,
    0,
    '2020-01-01 00:00:00+00',
    '2099-12-31 23:59:59+00',
    TRUE,
    NOW()
)
ON CONFLICT (code) DO NOTHING;

-- 2. FLAT500 — ₹500 fixed discount, minimum order ₹2000, unlimited uses,
--    currently active.
INSERT INTO coupons (
    id,
    code,
    description,
    discount_type,
    discount_value,
    currency,
    min_order_amount,
    max_uses,
    uses_count,
    valid_from,
    valid_until,
    is_active,
    created_at
)
VALUES (
    'a1000000-0000-4000-8000-000000000002',
    'FLAT500',
    '[DEV/TEST] ₹500 flat discount on orders above ₹2000 — fixed coupon',
    'fixed',
    500.00,
    'INR',
    2000.00,
    NULL,          -- unlimited uses
    0,
    '2020-01-01 00:00:00+00',
    '2099-12-31 23:59:59+00',
    TRUE,
    NOW()
)
ON CONFLICT (code) DO NOTHING;

-- 3. EXPIRED20 — 20% percent-off coupon that is already past its valid_until
--    date. Intended for negative-path / expiry-validation testing.
--    is_active = FALSE in addition to the expired date so it fails both checks.
INSERT INTO coupons (
    id,
    code,
    description,
    discount_type,
    discount_value,
    currency,
    min_order_amount,
    max_uses,
    uses_count,
    valid_from,
    valid_until,
    is_active,
    created_at
)
VALUES (
    'a1000000-0000-4000-8000-000000000003',
    'EXPIRED20',
    '[DEV/TEST] Expired 20% coupon — for negative-path testing only',
    'percent',
    20.00,
    NULL,
    NULL,
    100,
    0,
    '2020-01-01 00:00:00+00',
    '2021-12-31 23:59:59+00',  -- safely in the past
    FALSE,
    NOW()
)
ON CONFLICT (code) DO NOTHING;
