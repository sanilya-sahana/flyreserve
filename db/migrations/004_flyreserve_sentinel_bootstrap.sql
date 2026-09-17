-- =============================================================================
-- FlyReserve Sentinel Bootstrap — Non-Prod DB Identity Table
-- Migration:  004_flyreserve_sentinel_bootstrap.sql
-- Issue:      SAH-89 (Data Engineering)
-- Parent:     SAH-15 infrastructure baseline
-- Purpose:    Create the flyreserve_environment sentinel table that
--             reseed_nonprod.sh (gate 3) and 003_flyreserve_seed_nonprod_baseline.sql
--             depend upon.
--
-- IMPORTANT:  This migration creates the table and CHECK constraint but does NOT
--             insert the sentinel row.  The sentinel row itself is a one-time,
--             per-instance bootstrap step that must be applied by the environment
--             owner (DevOps for preview, developer for local dev) AFTER running
--             this migration.  See DB_BOOTSTRAP.md for the exact command.
--
--             Rationale: the sentinel row identifies which environment this
--             database IS.  Including it in the migration would silently apply
--             it to every environment (including production) if the migration
--             runner applies it there by mistake.  Keeping the INSERT separate
--             means a production database that accidentally runs this migration
--             is still safe: it gets the table but no sentinel row, so
--             reseed_nonprod.sh immediately fails its gate-3 check.
--
-- Idempotent: yes — uses CREATE TABLE IF NOT EXISTS.
-- Target DB:  PostgreSQL 14+ (consistent with 001_flyreserve_booking_baseline.sql)
-- Env guard:  This table must exist before running 003 or reseed_nonprod.sh.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Sentinel table
-- ---------------------------------------------------------------------------
-- One row per database instance.  env_name is the environment identity.
-- The CHECK constraint prevents accidents: only 'dev', 'preview', and
-- 'production' are valid values.  The PRIMARY KEY ensures at most one row.
--
-- Schema note: 'production' is deliberately allowed by the CHECK constraint
-- so production databases can also be labelled clearly.  reseed_nonprod.sh
-- gate-3 explicitly requires env_name IN ('dev','preview') and will refuse
-- to run if the sentinel row says 'production'.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flyreserve_environment (
    env_name TEXT PRIMARY KEY
        CHECK (env_name IN ('dev', 'preview', 'production'))
);

COMMENT ON TABLE flyreserve_environment IS
    'One-row sentinel identifying this database instance environment. '
    'Created by migration 004. Populated manually during environment bootstrap. '
    'See DB_BOOTSTRAP.md for the required INSERT after running this migration.';

COMMENT ON COLUMN flyreserve_environment.env_name IS
    'Environment identity. Allowed values: dev, preview, production. '
    'reseed_nonprod.sh gate-3 will only proceed when env_name IN (''dev'',''preview'').';

-- ---------------------------------------------------------------------------
-- End of 004_flyreserve_sentinel_bootstrap.sql
-- DEV / PREVIEW / PRODUCTION — safe to apply to all environments.
-- The sentinel INSERT is intentionally absent; see DB_BOOTSTRAP.md.
-- ---------------------------------------------------------------------------
