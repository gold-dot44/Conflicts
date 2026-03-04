-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
CREATE TYPE "EntityType" AS ENUM ('person', 'company');
CREATE TYPE "MatterStatus" AS ENUM ('open', 'closed', 'pending');
CREATE TYPE "EntityMatterRole" AS ENUM ('client', 'adverse_party', 'co_party', 'witness', 'expert', 'insurer', 'opposing_counsel', 'judge', 'other');
CREATE TYPE "CorporateLinkType" AS ENUM ('parent', 'subsidiary', 'affiliate', 'division');
CREATE TYPE "ConflictDisposition" AS ENUM ('no_conflict', 'potential_conflict', 'conflict_confirmed', 'waiver_obtained');

-- Entities table
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clio_contact_id INTEGER UNIQUE,
    full_legal_name TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    entity_type "EntityType" NOT NULL,
    aliases TEXT[] DEFAULT '{}',
    tax_id_hash TEXT,
    date_of_birth DATE,
    email TEXT,
    phone TEXT,
    source_system TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigram indexes for fuzzy search
CREATE INDEX idx_entities_full_name_trgm ON entities USING gin (full_legal_name gin_trgm_ops);
CREATE INDEX idx_entities_first_name_trgm ON entities USING gin (first_name gin_trgm_ops);
CREATE INDEX idx_entities_last_name_trgm ON entities USING gin (last_name gin_trgm_ops);
CREATE INDEX idx_entities_aliases_trgm ON entities USING gin (array_to_string(aliases, ' ') gin_trgm_ops);

-- Full-text search index
CREATE INDEX idx_entities_full_name_fts ON entities USING gin (to_tsvector('english', full_legal_name));

-- Standard indexes
CREATE INDEX idx_entities_entity_type ON entities (entity_type);
CREATE INDEX idx_entities_source_system ON entities (source_system);
CREATE INDEX idx_entities_email ON entities (email);

-- Matters table
CREATE TABLE matters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clio_matter_id INTEGER UNIQUE,
    matter_name TEXT NOT NULL,
    matter_number TEXT,
    status "MatterStatus" NOT NULL DEFAULT 'open',
    responsible_attorney TEXT,
    practice_area TEXT,
    open_date DATE,
    close_date DATE,
    source_system TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_matters_status ON matters (status);
CREATE INDEX idx_matters_matter_name_fts ON matters USING gin (to_tsvector('english', matter_name));

-- Entity-Matter roles junction table
CREATE TABLE entity_matter_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id),
    matter_id UUID NOT NULL REFERENCES matters(id),
    role "EntityMatterRole" NOT NULL,
    notes TEXT,
    source_system TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_emr_entity_id ON entity_matter_roles (entity_id);
CREATE INDEX idx_emr_matter_id ON entity_matter_roles (matter_id);
CREATE INDEX idx_emr_role ON entity_matter_roles (role);

-- Corporate links table
CREATE TABLE corporate_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_entity_id UUID NOT NULL REFERENCES entities(id),
    child_entity_id UUID NOT NULL REFERENCES entities(id),
    relationship_type "CorporateLinkType" NOT NULL,
    ownership_pct DECIMAL,
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cl_parent ON corporate_links (parent_entity_id);
CREATE INDEX idx_cl_child ON corporate_links (child_entity_id);

-- Audit log table (append-only)
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    searched_by TEXT NOT NULL,
    search_terms TEXT NOT NULL,
    search_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    algorithms_applied JSONB NOT NULL,
    results_snapshot JSONB NOT NULL,
    disposition "ConflictDisposition",
    disposition_by TEXT,
    disposition_rationale TEXT,
    disposition_timestamp TIMESTAMPTZ,
    related_documents TEXT[] DEFAULT '{}',
    matter_id UUID,
    entity_id UUID
);

CREATE INDEX idx_audit_searched_by ON audit_log (searched_by);
CREATE INDEX idx_audit_search_timestamp ON audit_log (search_timestamp);
CREATE INDEX idx_audit_matter_id ON audit_log (matter_id);

-- Ethical walls table
CREATE TABLE ethical_walls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    screened_attorney TEXT NOT NULL,
    screened_attorney_upn TEXT NOT NULL,
    matter_id UUID NOT NULL REFERENCES matters(id),
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    memo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_ew_matter ON ethical_walls (matter_id);
CREATE INDEX idx_ew_attorney ON ethical_walls (screened_attorney_upn);

-- Append-only enforcement: create a restricted role for the application
-- The application connects as 'conflicts_app' which can only INSERT into audit_log
-- DO NOT GRANT UPDATE OR DELETE ON audit_log TO conflicts_app;

-- Row-Level Security for ethical walls
ALTER TABLE entity_matter_roles ENABLE ROW LEVEL SECURITY;

-- Clio sync tracking table
CREATE TABLE clio_sync_state (
    id SERIAL PRIMARY KEY,
    resource_type TEXT NOT NULL UNIQUE,
    last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_cursor TEXT,
    status TEXT NOT NULL DEFAULT 'idle'
);

INSERT INTO clio_sync_state (resource_type) VALUES ('contacts'), ('matters');

-- Application configuration table
CREATE TABLE app_config (
    config_key TEXT PRIMARY KEY,
    config_value JSONB NOT NULL,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default fuzzy weights
INSERT INTO app_config (config_key, config_value) VALUES
  ('fuzzy_weights', '{"levenshtein": 0.30, "trigram": 0.30, "soundex": 0.10, "metaphone": 0.15, "fullText": 0.15}'),
  ('common_name_suppressions', '[]');
