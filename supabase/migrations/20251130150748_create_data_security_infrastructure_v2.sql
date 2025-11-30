/*
  # Data Security Infrastructure

  ## Overview
  Comprehensive data security system with encryption, key management, and compliance.
*/

-- =============================================================================
-- 1. ENCRYPTION KEYS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS encryption_keys (
  id text PRIMARY KEY,
  version integer NOT NULL,
  algorithm text NOT NULL,
  status text NOT NULL,
  created_at timestamptz DEFAULT now(),
  rotated_at timestamptz,
  expires_at timestamptz,
  
  CONSTRAINT valid_key_status CHECK (status IN (
    'active', 'rotating', 'deprecated', 'destroyed'
  ))
);

CREATE INDEX IF NOT EXISTS idx_encryption_keys_status ON encryption_keys(status);

-- =============================================================================
-- 2. KEY ACCESS AUDIT TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS key_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id text NOT NULL,
  action text NOT NULL,
  user_id uuid,
  timestamp timestamptz DEFAULT now(),
  ip_address text
);

CREATE INDEX IF NOT EXISTS idx_key_audit_key_id ON key_access_audit(key_id, timestamp DESC);

-- =============================================================================
-- 3. COMPLIANCE AUDIT LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS compliance_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz DEFAULT now(),
  event_type text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  user_id uuid,
  action text NOT NULL,
  details jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_timestamp ON compliance_audit_log(timestamp DESC);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_access_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read keys" ON encryption_keys FOR SELECT USING (true);
CREATE POLICY "Public read audit" ON compliance_audit_log FOR SELECT USING (true);
