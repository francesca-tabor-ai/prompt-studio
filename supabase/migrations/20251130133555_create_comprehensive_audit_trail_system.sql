/*
  # Comprehensive Compliance and Audit Trail System

  ## Overview
  Enterprise-grade audit and compliance tracking:
  - Immutable audit logs for all significant actions
  - User identity, timestamp, and action details
  - Before/after state capture
  - Compliance reporting
  - Advanced search and filtering
  - Retention policies
  - Tamper-proof design
  - External system integration

  ## New Tables
  1. **audit_events** - Core immutable audit log
  2. **audit_event_details** - Extended event information
  3. **audit_retention_policies** - Log retention rules
  4. **compliance_reports** - Generated compliance reports
  5. **audit_snapshots** - Point-in-time data snapshots
  6. **audit_integrity_checks** - Tamper detection
  7. **external_audit_sync** - External system integration
*/

-- =============================================================================
-- 1. AUDIT EVENTS TABLE (Immutable)
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  event_id text NOT NULL UNIQUE,
  
  event_type text NOT NULL,
  event_category text NOT NULL,
  event_severity text DEFAULT 'info',
  
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  
  actor_id uuid NOT NULL,
  actor_email text,
  actor_role text,
  
  target_user_id uuid,
  target_resource_id uuid,
  
  before_state jsonb,
  after_state jsonb,
  
  changes_summary text,
  
  ip_address inet,
  user_agent text,
  session_id text,
  
  request_id text,
  api_endpoint text,
  http_method text,
  
  success boolean DEFAULT true,
  error_message text,
  
  metadata jsonb DEFAULT '{}',
  
  created_at timestamptz DEFAULT now() NOT NULL,
  
  compliance_flags text[],
  retention_category text DEFAULT 'standard',
  
  hash_signature text,
  previous_event_hash text,
  
  CONSTRAINT valid_event_type CHECK (event_type IN (
    'prompt_create', 'prompt_update', 'prompt_delete', 'prompt_publish',
    'approval_submit', 'approval_approve', 'approval_reject', 'approval_revision',
    'user_create', 'user_update', 'user_delete', 'user_login', 'user_logout',
    'role_assign', 'role_revoke', 'permission_grant', 'permission_revoke',
    'data_export', 'data_import', 'data_delete',
    'system_config', 'security_change', 'compliance_report',
    'access_granted', 'access_denied'
  )),
  CONSTRAINT valid_event_category CHECK (event_category IN (
    'content', 'workflow', 'user_management', 'security', 'data', 'system', 'compliance'
  )),
  CONSTRAINT valid_event_severity CHECK (event_severity IN (
    'info', 'warning', 'high', 'critical'
  )),
  CONSTRAINT valid_retention_category CHECK (retention_category IN (
    'standard', 'extended', 'permanent', 'regulated'
  ))
);

-- =============================================================================
-- 2. AUDIT EVENT DETAILS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_event_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  event_id uuid REFERENCES audit_events(id) ON DELETE RESTRICT NOT NULL,
  
  detail_type text NOT NULL,
  
  field_name text,
  old_value text,
  new_value text,
  
  validation_errors jsonb,
  
  related_events uuid[],
  
  business_context jsonb,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_detail_type CHECK (detail_type IN (
    'field_change', 'validation', 'relationship', 'business_rule', 'compliance_note'
  ))
);

-- =============================================================================
-- 3. AUDIT RETENTION POLICIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  policy_name text NOT NULL UNIQUE,
  
  event_category text NOT NULL,
  event_types text[],
  
  retention_days integer NOT NULL,
  
  archive_after_days integer,
  
  compliance_requirement text,
  regulatory_framework text,
  
  auto_archive boolean DEFAULT true,
  auto_delete boolean DEFAULT false,
  
  is_active boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_retention_days CHECK (retention_days > 0)
);

-- =============================================================================
-- 4. COMPLIANCE REPORTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS compliance_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  report_type text NOT NULL,
  report_name text NOT NULL,
  
  time_period_start timestamptz NOT NULL,
  time_period_end timestamptz NOT NULL,
  
  generated_by uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  
  report_format text DEFAULT 'json',
  
  filters jsonb,
  
  event_count integer DEFAULT 0,
  user_count integer DEFAULT 0,
  
  findings jsonb,
  summary text,
  
  report_data jsonb,
  
  export_url text,
  
  status text DEFAULT 'generated',
  
  compliance_framework text,
  
  metadata jsonb DEFAULT '{}',
  
  CONSTRAINT valid_report_type CHECK (report_type IN (
    'activity_summary', 'user_activity', 'access_log', 'change_log',
    'security_audit', 'compliance_check', 'data_access', 'regulatory'
  )),
  CONSTRAINT valid_report_format CHECK (report_format IN (
    'json', 'csv', 'pdf', 'excel'
  )),
  CONSTRAINT valid_report_status CHECK (status IN (
    'generating', 'generated', 'exported', 'archived'
  ))
);

-- =============================================================================
-- 5. AUDIT SNAPSHOTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  snapshot_type text NOT NULL,
  
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  
  snapshot_data jsonb NOT NULL,
  
  snapshot_hash text NOT NULL,
  
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  
  event_id uuid REFERENCES audit_events(id) ON DELETE RESTRICT,
  
  metadata jsonb DEFAULT '{}',
  
  CONSTRAINT valid_snapshot_type CHECK (snapshot_type IN (
    'pre_change', 'post_change', 'scheduled', 'manual', 'compliance'
  ))
);

-- =============================================================================
-- 6. AUDIT INTEGRITY CHECKS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_integrity_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  check_type text NOT NULL,
  
  start_event_id uuid REFERENCES audit_events(id) ON DELETE RESTRICT,
  end_event_id uuid REFERENCES audit_events(id) ON DELETE RESTRICT,
  
  events_checked integer NOT NULL,
  
  integrity_status text NOT NULL,
  
  hash_chain_valid boolean,
  timestamp_sequence_valid boolean,
  signature_valid boolean,
  
  anomalies_detected jsonb,
  
  checked_by uuid NOT NULL,
  checked_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_check_type CHECK (check_type IN (
    'hash_chain', 'timestamp', 'signature', 'comprehensive'
  )),
  CONSTRAINT valid_integrity_status CHECK (integrity_status IN (
    'valid', 'warning', 'compromised'
  ))
);

-- =============================================================================
-- 7. EXTERNAL AUDIT SYNC TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS external_audit_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  external_system text NOT NULL,
  
  sync_type text NOT NULL,
  
  event_id uuid REFERENCES audit_events(id) ON DELETE RESTRICT,
  
  external_reference_id text,
  
  sync_status text DEFAULT 'pending',
  
  sync_payload jsonb,
  sync_response jsonb,
  
  attempted_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  
  error_message text,
  
  CONSTRAINT valid_sync_type CHECK (sync_type IN (
    'real_time', 'batch', 'scheduled', 'manual'
  )),
  CONSTRAINT valid_sync_status CHECK (sync_status IN (
    'pending', 'in_progress', 'completed', 'failed', 'skipped'
  ))
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_category ON audit_events(event_category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_severity ON audit_events(event_severity) WHERE event_severity IN ('high', 'critical');
CREATE INDEX IF NOT EXISTS idx_audit_events_retention ON audit_events(retention_category, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_compliance ON audit_events USING GIN (compliance_flags);
CREATE INDEX IF NOT EXISTS idx_audit_events_hash ON audit_events(hash_signature);

CREATE INDEX IF NOT EXISTS idx_audit_event_details_event ON audit_event_details(event_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_details_field ON audit_event_details(field_name);

CREATE INDEX IF NOT EXISTS idx_audit_snapshots_resource ON audit_snapshots(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_snapshots_created ON audit_snapshots(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_reports_generated ON compliance_reports(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_type ON compliance_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_period ON compliance_reports(time_period_start, time_period_end);

CREATE INDEX IF NOT EXISTS idx_external_sync_status ON external_audit_sync(sync_status) WHERE sync_status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_external_sync_system ON external_audit_sync(external_system, attempted_at DESC);

-- =============================================================================
-- RLS POLICIES (Read-only for audit events)
-- =============================================================================

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_event_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_integrity_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_audit_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit events are read-only" ON audit_events FOR SELECT USING (true);
CREATE POLICY "Audit details are read-only" ON audit_event_details FOR SELECT USING (true);
CREATE POLICY "Retention policies readable" ON audit_retention_policies FOR SELECT USING (true);
CREATE POLICY "Compliance reports readable" ON compliance_reports FOR SELECT USING (true);
CREATE POLICY "Audit snapshots readable" ON audit_snapshots FOR SELECT USING (true);
CREATE POLICY "Integrity checks readable" ON audit_integrity_checks FOR SELECT USING (true);
CREATE POLICY "External sync readable" ON external_audit_sync FOR SELECT USING (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_event_hash(
  p_event_id text,
  p_actor_id uuid,
  p_action text,
  p_created_at timestamptz,
  p_previous_hash text
)
RETURNS text AS $$
BEGIN
  RETURN encode(
    digest(
      p_event_id || '|' || 
      COALESCE(p_actor_id::text, '') || '|' || 
      p_action || '|' || 
      p_created_at::text || '|' || 
      COALESCE(p_previous_hash, ''),
      'sha256'
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION log_audit_event(
  p_event_type text,
  p_event_category text,
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_actor_id uuid,
  p_before_state jsonb DEFAULT NULL,
  p_after_state jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid AS $$
DECLARE
  v_event_id text;
  v_previous_hash text;
  v_hash_signature text;
  v_audit_id uuid;
BEGIN
  v_event_id := 'evt_' || encode(gen_random_bytes(16), 'hex');
  
  SELECT hash_signature INTO v_previous_hash
  FROM audit_events
  ORDER BY created_at DESC
  LIMIT 1;
  
  v_hash_signature := generate_event_hash(
    v_event_id,
    p_actor_id,
    p_action,
    now(),
    v_previous_hash
  );
  
  INSERT INTO audit_events (
    event_id,
    event_type,
    event_category,
    action,
    resource_type,
    resource_id,
    actor_id,
    before_state,
    after_state,
    metadata,
    hash_signature,
    previous_event_hash
  ) VALUES (
    v_event_id,
    p_event_type,
    p_event_category,
    p_action,
    p_resource_type,
    p_resource_id,
    p_actor_id,
    p_before_state,
    p_after_state,
    p_metadata,
    v_hash_signature,
    v_previous_hash
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION verify_audit_chain(
  p_start_event_id uuid,
  p_end_event_id uuid
)
RETURNS boolean AS $$
DECLARE
  v_event record;
  v_expected_hash text;
  v_previous_hash text;
BEGIN
  v_previous_hash := NULL;
  
  FOR v_event IN
    SELECT *
    FROM audit_events
    WHERE id >= p_start_event_id
      AND id <= p_end_event_id
    ORDER BY created_at
  LOOP
    v_expected_hash := generate_event_hash(
      v_event.event_id,
      v_event.actor_id,
      v_event.action,
      v_event.created_at,
      v_previous_hash
    );
    
    IF v_expected_hash != v_event.hash_signature THEN
      RETURN false;
    END IF;
    
    v_previous_hash := v_event.hash_signature;
  END LOOP;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION apply_retention_policies()
RETURNS void AS $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT * FROM audit_retention_policies WHERE is_active = true
  LOOP
    IF v_policy.auto_delete THEN
      DELETE FROM audit_events
      WHERE event_category = v_policy.event_category
        AND created_at < (now() - (v_policy.retention_days || ' days')::interval)
        AND retention_category = 'standard';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION search_audit_events(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_event_type text DEFAULT NULL,
  p_resource_type text DEFAULT NULL,
  p_resource_id uuid DEFAULT NULL
)
RETURNS TABLE(
  event_id text,
  event_type text,
  action text,
  actor_id uuid,
  resource_type text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.event_id,
    ae.event_type,
    ae.action,
    ae.actor_id,
    ae.resource_type,
    ae.created_at
  FROM audit_events ae
  WHERE (p_start_date IS NULL OR ae.created_at >= p_start_date)
    AND (p_end_date IS NULL OR ae.created_at <= p_end_date)
    AND (p_actor_id IS NULL OR ae.actor_id = p_actor_id)
    AND (p_event_type IS NULL OR ae.event_type = p_event_type)
    AND (p_resource_type IS NULL OR ae.resource_type = p_resource_type)
    AND (p_resource_id IS NULL OR ae.resource_id = p_resource_id)
  ORDER BY ae.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SEED DATA - RETENTION POLICIES
-- =============================================================================

INSERT INTO audit_retention_policies (
  policy_name,
  event_category,
  retention_days,
  archive_after_days,
  compliance_requirement,
  auto_archive
)
VALUES
  ('Standard Content Changes', 'content', 365, 180, 'Internal policy', true),
  ('Workflow Actions', 'workflow', 730, 365, 'SOX compliance', true),
  ('User Management', 'user_management', 2555, 730, 'GDPR Article 30', true),
  ('Security Events', 'security', 2555, 730, 'SOC 2 Type II', true),
  ('Data Operations', 'data', 1825, 730, 'CCPA', true),
  ('System Changes', 'system', 1095, 365, 'Internal policy', true),
  ('Compliance Reports', 'compliance', 3650, 1825, 'Multiple frameworks', false)
ON CONFLICT (policy_name) DO NOTHING;
