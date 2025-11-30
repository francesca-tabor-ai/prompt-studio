/*
  # Secrets Management Vault

  ## Overview
  Comprehensive secrets management system with vault storage, rotation, and auditing.

  ## New Tables
  1. **secrets** - Encrypted secret storage
  2. **secret_versions** - Version history of secrets
  3. **secret_access_log** - Audit trail of all access
  4. **secret_rotation_schedule** - Automated rotation
  5. **secret_policies** - Access control policies
*/

-- =============================================================================
-- 1. SECRETS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name text NOT NULL UNIQUE,
  
  secret_type text NOT NULL,
  
  encrypted_value text NOT NULL,
  
  current_version integer DEFAULT 1,
  
  metadata jsonb DEFAULT '{}',
  
  rotation_enabled boolean DEFAULT false,
  rotation_interval interval DEFAULT interval '90 days',
  last_rotated_at timestamptz DEFAULT now(),
  next_rotation_at timestamptz,
  
  status text DEFAULT 'active',
  
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  expires_at timestamptz,
  
  tags jsonb DEFAULT '[]',
  
  CONSTRAINT valid_secret_type CHECK (secret_type IN (
    'password', 'api_key', 'certificate', 'encryption_key', 
    'database_password', 'oauth_token', 'ssh_key', 'generic'
  )),
  
  CONSTRAINT valid_secret_status CHECK (status IN (
    'active', 'rotating', 'revoked', 'expired', 'deprecated'
  ))
);

-- =============================================================================
-- 2. SECRET VERSIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS secret_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  secret_id uuid REFERENCES secrets(id) ON DELETE CASCADE NOT NULL,
  
  version_number integer NOT NULL,
  
  encrypted_value text NOT NULL,
  
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  
  deprecated_at timestamptz,
  
  change_reason text,
  
  is_current boolean DEFAULT false,
  
  CONSTRAINT unique_secret_version UNIQUE (secret_id, version_number)
);

-- =============================================================================
-- 3. SECRET ACCESS LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS secret_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  secret_id uuid REFERENCES secrets(id) ON DELETE CASCADE NOT NULL,
  
  accessed_by uuid,
  
  access_type text NOT NULL,
  
  accessed_at timestamptz DEFAULT now(),
  
  ip_address text,
  user_agent text,
  
  access_granted boolean DEFAULT false,
  denial_reason text,
  
  service_name text,
  
  metadata jsonb DEFAULT '{}',
  
  CONSTRAINT valid_access_type CHECK (access_type IN (
    'read', 'create', 'update', 'delete', 'rotate', 'revoke'
  ))
);

-- =============================================================================
-- 4. SECRET ROTATION SCHEDULE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS secret_rotation_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  secret_id uuid REFERENCES secrets(id) ON DELETE CASCADE NOT NULL,
  
  scheduled_at timestamptz NOT NULL,
  
  rotation_type text DEFAULT 'automatic',
  
  completed boolean DEFAULT false,
  completed_at timestamptz,
  
  failed boolean DEFAULT false,
  failure_reason text,
  
  CONSTRAINT valid_rotation_type CHECK (rotation_type IN (
    'automatic', 'manual', 'emergency'
  ))
);

-- =============================================================================
-- 5. SECRET POLICIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS secret_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  policy_name text NOT NULL UNIQUE,
  
  secret_pattern text NOT NULL,
  
  allowed_users jsonb DEFAULT '[]',
  allowed_roles jsonb DEFAULT '[]',
  allowed_services jsonb DEFAULT '[]',
  
  allowed_operations jsonb DEFAULT '["read"]',
  
  conditions jsonb DEFAULT '{}',
  
  priority integer DEFAULT 0,
  
  enabled boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 6. SECRET METADATA TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS secret_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  secret_id uuid REFERENCES secrets(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  owner_id uuid,
  team_id uuid,
  
  environment text DEFAULT 'production',
  
  compliance_framework jsonb DEFAULT '[]',
  
  last_accessed_at timestamptz,
  access_count integer DEFAULT 0,
  
  risk_level text DEFAULT 'medium',
  
  CONSTRAINT valid_risk_level CHECK (risk_level IN (
    'low', 'medium', 'high', 'critical'
  ))
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_secrets_name ON secrets(name);
CREATE INDEX IF NOT EXISTS idx_secrets_type ON secrets(secret_type);
CREATE INDEX IF NOT EXISTS idx_secrets_status ON secrets(status);
CREATE INDEX IF NOT EXISTS idx_secrets_next_rotation ON secrets(next_rotation_at) 
  WHERE rotation_enabled = true AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_secret_versions_secret ON secret_versions(secret_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_secret_versions_current ON secret_versions(secret_id) 
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_access_log_secret ON secret_access_log(secret_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_log_user ON secret_access_log(accessed_by, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_log_denied ON secret_access_log(accessed_at DESC) 
  WHERE access_granted = false;

CREATE INDEX IF NOT EXISTS idx_rotation_schedule_pending ON secret_rotation_schedule(scheduled_at) 
  WHERE completed = false AND failed = false;

CREATE INDEX IF NOT EXISTS idx_secret_policies_enabled ON secret_policies(priority DESC) 
  WHERE enabled = true;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_rotation_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage secrets" ON secrets FOR ALL USING (true);
CREATE POLICY "Public read access log" ON secret_access_log FOR SELECT USING (true);
CREATE POLICY "Public read policies" ON secret_policies FOR SELECT USING (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION log_secret_access(
  p_secret_id uuid,
  p_accessed_by uuid,
  p_access_type text,
  p_granted boolean,
  p_ip_address text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO secret_access_log (
    secret_id,
    accessed_by,
    access_type,
    access_granted,
    ip_address,
    accessed_at
  ) VALUES (
    p_secret_id,
    p_accessed_by,
    p_access_type,
    p_granted,
    p_ip_address,
    now()
  );
  
  IF p_granted THEN
    UPDATE secret_metadata
    SET last_accessed_at = now(),
        access_count = access_count + 1
    WHERE secret_id = p_secret_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION schedule_secret_rotation(
  p_secret_id uuid,
  p_rotation_date timestamptz DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_schedule_id uuid;
  v_rotation_interval interval;
BEGIN
  SELECT rotation_interval INTO v_rotation_interval
  FROM secrets
  WHERE id = p_secret_id;
  
  IF p_rotation_date IS NULL THEN
    p_rotation_date := now() + v_rotation_interval;
  END IF;
  
  INSERT INTO secret_rotation_schedule (
    secret_id,
    scheduled_at,
    rotation_type
  ) VALUES (
    p_secret_id,
    p_rotation_date,
    'automatic'
  )
  RETURNING id INTO v_schedule_id;
  
  UPDATE secrets
  SET next_rotation_at = p_rotation_date
  WHERE id = p_secret_id;
  
  RETURN v_schedule_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_secret_access(
  p_secret_name text,
  p_user_id uuid,
  p_operation text
)
RETURNS boolean AS $$
DECLARE
  v_allowed boolean := false;
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT * FROM secret_policies
    WHERE enabled = true
      AND p_secret_name LIKE secret_pattern
    ORDER BY priority DESC
  LOOP
    IF p_user_id::text = ANY(
      SELECT jsonb_array_elements_text(v_policy.allowed_users)
    ) THEN
      IF p_operation = ANY(
        SELECT jsonb_array_elements_text(v_policy.allowed_operations)
      ) THEN
        v_allowed := true;
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  RETURN v_allowed;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_secrets_requiring_rotation()
RETURNS TABLE(
  secret_id uuid,
  secret_name text,
  last_rotated timestamptz,
  next_rotation timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    id,
    name,
    last_rotated_at,
    next_rotation_at
  FROM secrets
  WHERE rotation_enabled = true
    AND status = 'active'
    AND next_rotation_at < now()
  ORDER BY next_rotation_at;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_secret_version(
  p_secret_id uuid,
  p_version_number integer DEFAULT NULL
)
RETURNS text AS $$
DECLARE
  v_encrypted_value text;
BEGIN
  IF p_version_number IS NULL THEN
    SELECT encrypted_value INTO v_encrypted_value
    FROM secret_versions
    WHERE secret_id = p_secret_id
      AND is_current = true;
  ELSE
    SELECT encrypted_value INTO v_encrypted_value
    FROM secret_versions
    WHERE secret_id = p_secret_id
      AND version_number = p_version_number;
  END IF;
  
  RETURN v_encrypted_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- SEED DATA - DEFAULT POLICIES
-- =============================================================================

INSERT INTO secret_policies (
  policy_name,
  secret_pattern,
  allowed_operations,
  priority
)
VALUES
  (
    'admin_full_access',
    '*',
    '["read", "create", "update", "delete", "rotate", "revoke"]'::jsonb,
    100
  ),
  (
    'service_read_only',
    'service/*',
    '["read"]'::jsonb,
    50
  ),
  (
    'prod_secrets_restricted',
    'prod/*',
    '["read"]'::jsonb,
    75
  )
ON CONFLICT (policy_name) DO NOTHING;
