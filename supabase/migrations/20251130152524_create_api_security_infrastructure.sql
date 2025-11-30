/*
  # API Security Infrastructure

  ## Overview
  Comprehensive API security system with rate limiting, threat detection, and protection.

  ## New Tables
  1. **rate_limits** - Rate limit tracking per user/IP
  2. **api_keys** - API key authentication
  3. **request_signatures** - Signed request verification
  4. **suspicious_activity** - Threat detection logs
  5. **blocked_ips** - IP blocklist
  6. **cors_policies** - CORS configuration
*/

-- =============================================================================
-- 1. RATE LIMITS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  identifier text NOT NULL,
  identifier_type text NOT NULL,
  
  endpoint text NOT NULL,
  
  request_count integer DEFAULT 0,
  
  window_start timestamptz DEFAULT now(),
  window_duration interval DEFAULT interval '1 minute',
  
  limit_exceeded boolean DEFAULT false,
  exceeded_at timestamptz,
  
  reset_at timestamptz,
  
  CONSTRAINT valid_identifier_type CHECK (identifier_type IN (
    'user_id', 'ip_address', 'api_key'
  ))
);

-- =============================================================================
-- 2. API KEYS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id uuid NOT NULL,
  
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  
  name text,
  description text,
  
  scopes jsonb DEFAULT '[]',
  
  rate_limit_override integer,
  
  status text DEFAULT 'active',
  
  last_used_at timestamptz,
  last_used_ip text,
  
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  
  CONSTRAINT valid_api_key_status CHECK (status IN (
    'active', 'suspended', 'revoked', 'expired'
  ))
);

-- =============================================================================
-- 3. REQUEST SIGNATURES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS request_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  request_id text NOT NULL UNIQUE,
  
  signature text NOT NULL,
  
  user_id uuid,
  api_key_id uuid REFERENCES api_keys(id) ON DELETE CASCADE,
  
  endpoint text NOT NULL,
  method text NOT NULL,
  
  timestamp timestamptz DEFAULT now(),
  
  verified boolean DEFAULT false,
  verified_at timestamptz,
  
  expires_at timestamptz DEFAULT now() + interval '5 minutes'
);

-- =============================================================================
-- 4. SUSPICIOUS ACTIVITY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS suspicious_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  detected_at timestamptz DEFAULT now(),
  
  activity_type text NOT NULL,
  
  severity text NOT NULL,
  
  identifier text NOT NULL,
  identifier_type text NOT NULL,
  
  endpoint text,
  method text,
  
  user_agent text,
  
  details jsonb DEFAULT '{}',
  
  action_taken text,
  
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  
  CONSTRAINT valid_activity_severity CHECK (severity IN (
    'low', 'medium', 'high', 'critical'
  ))
);

-- =============================================================================
-- 5. BLOCKED IPS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS blocked_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  ip_address text NOT NULL UNIQUE,
  
  reason text NOT NULL,
  
  blocked_at timestamptz DEFAULT now(),
  blocked_by uuid,
  
  expires_at timestamptz,
  
  permanent boolean DEFAULT false,
  
  blocked_requests integer DEFAULT 0,
  
  status text DEFAULT 'active',
  
  CONSTRAINT valid_block_status CHECK (status IN (
    'active', 'expired', 'removed'
  ))
);

-- =============================================================================
-- 6. CORS POLICIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS cors_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name text NOT NULL UNIQUE,
  
  allowed_origins jsonb DEFAULT '[]',
  
  allowed_methods jsonb DEFAULT '["GET", "POST"]',
  
  allowed_headers jsonb DEFAULT '["Content-Type", "Authorization"]',
  
  allow_credentials boolean DEFAULT false,
  
  max_age integer DEFAULT 86400,
  
  status text DEFAULT 'active',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier, identifier_type, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint ON rate_limits(endpoint, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(reset_at) WHERE limit_exceeded = true;

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_request_sigs_request_id ON request_signatures(request_id);
CREATE INDEX IF NOT EXISTS idx_request_sigs_expires ON request_signatures(expires_at);

CREATE INDEX IF NOT EXISTS idx_suspicious_activity_detected ON suspicious_activity(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_suspicious_activity_identifier ON suspicious_activity(identifier, identifier_type);
CREATE INDEX IF NOT EXISTS idx_suspicious_activity_severity ON suspicious_activity(severity) WHERE resolved = false;

CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_expires ON blocked_ips(expires_at) WHERE expires_at IS NOT NULL;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspicious_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE cors_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read rate limits" ON rate_limits FOR SELECT USING (true);
CREATE POLICY "Users read own API keys" ON api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Public read suspicious activity" ON suspicious_activity FOR SELECT USING (true);
CREATE POLICY "Public read blocked IPs" ON blocked_ips FOR SELECT USING (true);
CREATE POLICY "Public read CORS policies" ON cors_policies FOR SELECT USING (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier text,
  p_identifier_type text,
  p_endpoint text,
  p_limit integer DEFAULT 100
)
RETURNS boolean AS $$
DECLARE
  v_count integer;
  v_window_start timestamptz;
BEGIN
  v_window_start := now() - interval '1 minute';
  
  SELECT request_count INTO v_count
  FROM rate_limits
  WHERE identifier = p_identifier
    AND identifier_type = p_identifier_type
    AND endpoint = p_endpoint
    AND window_start > v_window_start;
  
  IF v_count IS NULL THEN
    INSERT INTO rate_limits (identifier, identifier_type, endpoint, request_count)
    VALUES (p_identifier, p_identifier_type, p_endpoint, 1);
    RETURN true;
  END IF;
  
  IF v_count >= p_limit THEN
    UPDATE rate_limits
    SET limit_exceeded = true,
        exceeded_at = now()
    WHERE identifier = p_identifier
      AND identifier_type = p_identifier_type
      AND endpoint = p_endpoint;
    RETURN false;
  END IF;
  
  UPDATE rate_limits
  SET request_count = request_count + 1
  WHERE identifier = p_identifier
    AND identifier_type = p_identifier_type
    AND endpoint = p_endpoint;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_ip_blocked(p_ip_address text)
RETURNS boolean AS $$
DECLARE
  v_blocked boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM blocked_ips
    WHERE ip_address = p_ip_address
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_blocked;
  
  IF v_blocked THEN
    UPDATE blocked_ips
    SET blocked_requests = blocked_requests + 1
    WHERE ip_address = p_ip_address
      AND status = 'active';
  END IF;
  
  RETURN v_blocked;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION verify_api_key(p_key_hash text)
RETURNS TABLE(
  valid boolean,
  user_id uuid,
  key_id uuid,
  scopes jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    true,
    api_keys.user_id,
    api_keys.id,
    api_keys.scopes
  FROM api_keys
  WHERE key_hash = p_key_hash
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now());
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::jsonb;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_suspicious_activity(
  p_activity_type text,
  p_severity text,
  p_identifier text,
  p_identifier_type text,
  p_details jsonb DEFAULT '{}'
)
RETURNS uuid AS $$
DECLARE
  v_activity_id uuid;
BEGIN
  INSERT INTO suspicious_activity (
    activity_type,
    severity,
    identifier,
    identifier_type,
    details
  ) VALUES (
    p_activity_type,
    p_severity,
    p_identifier,
    p_identifier_type,
    p_details
  )
  RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS integer AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM rate_limits
  WHERE reset_at < now() - interval '1 hour';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_signatures()
RETURNS integer AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM request_signatures
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SEED DATA - CORS POLICIES
-- =============================================================================

INSERT INTO cors_policies (
  name,
  allowed_origins,
  allowed_methods,
  allowed_headers,
  allow_credentials
)
VALUES
  (
    'default',
    '["https://app.promptlibrary.com", "https://staging.promptlibrary.com"]'::jsonb,
    '["GET", "POST", "PUT", "DELETE", "OPTIONS"]'::jsonb,
    '["Content-Type", "Authorization", "X-API-Key", "X-Request-ID"]'::jsonb,
    true
  ),
  (
    'public_api',
    '["*"]'::jsonb,
    '["GET", "OPTIONS"]'::jsonb,
    '["Content-Type", "Authorization"]'::jsonb,
    false
  )
ON CONFLICT (name) DO NOTHING;
