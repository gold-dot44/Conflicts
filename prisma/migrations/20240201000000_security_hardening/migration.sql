-- Security hardening migration
-- Addresses findings #2, #7, #11, #12 from security audit

-- #11: Create oauth_tokens table (was referenced in code but not in migration)
CREATE TABLE IF NOT EXISTS oauth_tokens (
    provider TEXT PRIMARY KEY,
    access_token BYTEA NOT NULL,    -- encrypted via pgp_sym_encrypt
    refresh_token BYTEA NOT NULL,   -- encrypted via pgp_sym_encrypt
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- #12: Add parent_search_id to audit_log for append-only disposition tracking
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS parent_search_id UUID REFERENCES audit_log(id);
CREATE INDEX IF NOT EXISTS idx_audit_parent_search ON audit_log (parent_search_id);

-- #7: Add unique constraint on entity_matter_roles to prevent duplicate links
-- Required for ON CONFLICT DO NOTHING to work correctly in Clio sync
CREATE UNIQUE INDEX IF NOT EXISTS idx_emr_unique
    ON entity_matter_roles (entity_id, matter_id, role);

-- #2: Database-level audit log append-only enforcement
-- Create a restricted application role that CANNOT update or delete audit records

DO $$
BEGIN
    -- Create role if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'conflicts_app') THEN
        CREATE ROLE conflicts_app WITH LOGIN PASSWORD 'CHANGE_ME_IN_PRODUCTION';
    END IF;
END
$$;

-- Grant normal access to all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO conflicts_app;

-- Revoke mutable operations on audit_log specifically
REVOKE UPDATE, DELETE ON audit_log FROM conflicts_app;

-- Allow sequences (for serial columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO conflicts_app;

-- Future tables should also be accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO conflicts_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO conflicts_app;
