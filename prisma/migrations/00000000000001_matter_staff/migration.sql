CREATE TABLE matter_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id UUID NOT NULL REFERENCES matters(id),
    user_upn TEXT NOT NULL,
    user_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'other',
    start_date DATE,
    end_date DATE,
    source_system TEXT NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(matter_id, user_upn, role)
);

CREATE INDEX idx_ms_user ON matter_staff (user_upn);
CREATE INDEX idx_ms_matter ON matter_staff (matter_id);
