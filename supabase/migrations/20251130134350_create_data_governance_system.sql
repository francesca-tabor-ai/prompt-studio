/*
  # Data Governance System

  ## Overview
  Comprehensive data governance and lifecycle management:
  - Retention periods for different data types
  - Automatic archival
  - Privacy regulation compliance (GDPR, CCPA)
  - Data lineage tracking
  - Data classification system
  - Data masking
  - Admin controls
  - Compliance reporting

  ## New Tables
  1. **data_retention_policies** - Retention rules by data type
  2. **data_classification** - Data sensitivity levels
  3. **data_lineage** - Data dependencies and relationships
  4. **data_lifecycle_events** - Archive/delete operations
  5. **privacy_requests** - GDPR/CCPA requests
  6. **data_masking_rules** - Sensitive data masking
  7. **governance_reports** - Compliance reports
*/

-- =============================================================================
-- 1. DATA RETENTION POLICIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS data_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  policy_name text NOT NULL UNIQUE,
  
  data_type text NOT NULL,
  table_name text NOT NULL,
  
  retention_days integer NOT NULL,
  
  soft_delete boolean DEFAULT true,
  archive_before_delete boolean DEFAULT true,
  
  archive_storage_location text,
  
  legal_basis text,
  regulatory_framework text[],
  
  applies_to_classification text[],
  
  auto_execute boolean DEFAULT true,
  
  last_executed_at timestamptz,
  next_execution_at timestamptz,
  
  execution_schedule text DEFAULT 'daily',
  
  is_active boolean DEFAULT true,
  
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_data_type CHECK (data_type IN (
    'prompts', 'test_results', 'user_data', 'reviews', 'comments',
    'analytics', 'audit_logs', 'reports', 'sessions', 'notifications'
  )),
  CONSTRAINT valid_retention_days CHECK (retention_days > 0),
  CONSTRAINT valid_execution_schedule CHECK (execution_schedule IN (
    'hourly', 'daily', 'weekly', 'monthly'
  ))
);

-- =============================================================================
-- 2. DATA CLASSIFICATION TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS data_classification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  
  classification_level text NOT NULL,
  
  sensitivity_score integer DEFAULT 1,
  
  contains_pii boolean DEFAULT false,
  contains_phi boolean DEFAULT false,
  contains_pci boolean DEFAULT false,
  
  data_categories text[],
  
  regulatory_requirements text[],
  
  access_restrictions jsonb,
  
  retention_override integer,
  
  classified_by uuid NOT NULL,
  classified_at timestamptz DEFAULT now(),
  
  reviewed_at timestamptz,
  review_due_at timestamptz,
  
  metadata jsonb DEFAULT '{}',
  
  CONSTRAINT valid_classification_level CHECK (classification_level IN (
    'public', 'internal', 'confidential', 'restricted', 'highly_restricted'
  )),
  CONSTRAINT valid_sensitivity_score CHECK (sensitivity_score >= 1 AND sensitivity_score <= 10),
  CONSTRAINT unique_resource_classification UNIQUE (resource_type, resource_id)
);

-- =============================================================================
-- 3. DATA LINEAGE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS data_lineage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  
  relationship_type text NOT NULL,
  
  lineage_path text[],
  
  dependency_strength text DEFAULT 'weak',
  
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  
  metadata jsonb DEFAULT '{}',
  
  CONSTRAINT valid_relationship_type CHECK (relationship_type IN (
    'derived_from', 'references', 'contains', 'created_by', 'modified_by',
    'tested_with', 'reviewed_in', 'approved_as', 'exported_to'
  )),
  CONSTRAINT valid_dependency_strength CHECK (dependency_strength IN (
    'weak', 'medium', 'strong', 'critical'
  )),
  CONSTRAINT no_self_reference CHECK (
    NOT (source_type = target_type AND source_id = target_id)
  )
);

-- =============================================================================
-- 4. DATA LIFECYCLE EVENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS data_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  event_type text NOT NULL,
  
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  
  policy_id uuid REFERENCES data_retention_policies(id) ON DELETE SET NULL,
  
  action_taken text NOT NULL,
  
  records_affected integer DEFAULT 0,
  
  archive_location text,
  archive_size_bytes bigint,
  
  reason text,
  
  executed_by uuid,
  executed_at timestamptz DEFAULT now(),
  
  success boolean DEFAULT true,
  error_message text,
  
  reversible boolean DEFAULT false,
  reversal_deadline timestamptz,
  
  metadata jsonb DEFAULT '{}',
  
  CONSTRAINT valid_lifecycle_event_type CHECK (event_type IN (
    'archived', 'deleted', 'purged', 'anonymized', 'masked', 'restored'
  )),
  CONSTRAINT valid_action_taken CHECK (action_taken IN (
    'soft_delete', 'hard_delete', 'archive', 'anonymize', 'mask', 'restore'
  ))
);

-- =============================================================================
-- 5. PRIVACY REQUESTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  request_type text NOT NULL,
  
  request_number text NOT NULL UNIQUE,
  
  subject_user_id uuid NOT NULL,
  subject_email text NOT NULL,
  
  requested_by uuid,
  requested_at timestamptz DEFAULT now(),
  
  request_details jsonb,
  
  status text DEFAULT 'pending',
  
  assigned_to uuid,
  assigned_at timestamptz,
  
  data_categories text[],
  
  records_found integer DEFAULT 0,
  records_processed integer DEFAULT 0,
  
  processing_started_at timestamptz,
  completed_at timestamptz,
  
  completion_deadline timestamptz NOT NULL,
  
  export_url text,
  
  verification_code text,
  verified_at timestamptz,
  
  notes text,
  
  CONSTRAINT valid_privacy_request_type CHECK (request_type IN (
    'access', 'portability', 'deletion', 'rectification', 'restriction',
    'objection', 'opt_out', 'do_not_sell'
  )),
  CONSTRAINT valid_privacy_request_status CHECK (status IN (
    'pending', 'verified', 'in_progress', 'completed', 'rejected', 'cancelled'
  ))
);

-- =============================================================================
-- 6. DATA MASKING RULES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS data_masking_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  rule_name text NOT NULL UNIQUE,
  
  table_name text NOT NULL,
  column_name text NOT NULL,
  
  masking_method text NOT NULL,
  
  pattern_to_match text,
  
  replacement_value text,
  
  preserve_length boolean DEFAULT true,
  preserve_format boolean DEFAULT false,
  
  applies_to_roles text[],
  applies_to_contexts text[],
  
  is_active boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_masking_method CHECK (masking_method IN (
    'redact', 'hash', 'tokenize', 'partial', 'random', 'null', 'static'
  ))
);

-- =============================================================================
-- 7. GOVERNANCE REPORTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS governance_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  report_type text NOT NULL,
  report_name text NOT NULL,
  
  report_period_start timestamptz NOT NULL,
  report_period_end timestamptz NOT NULL,
  
  generated_by uuid NOT NULL,
  generated_at timestamptz DEFAULT now(),
  
  total_records_reviewed integer DEFAULT 0,
  records_archived integer DEFAULT 0,
  records_deleted integer DEFAULT 0,
  records_anonymized integer DEFAULT 0,
  
  storage_used_bytes bigint DEFAULT 0,
  storage_freed_bytes bigint DEFAULT 0,
  
  compliance_score numeric(5,2),
  
  findings jsonb,
  recommendations text[],
  
  summary text,
  
  report_data jsonb,
  
  export_url text,
  
  CONSTRAINT valid_governance_report_type CHECK (report_type IN (
    'retention_compliance', 'data_inventory', 'privacy_requests',
    'classification_summary', 'lifecycle_activities', 'storage_analysis'
  ))
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_retention_policies_data_type ON data_retention_policies(data_type, is_active);
CREATE INDEX IF NOT EXISTS idx_retention_policies_next_exec ON data_retention_policies(next_execution_at) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_data_classification_resource ON data_classification(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_data_classification_level ON data_classification(classification_level);
CREATE INDEX IF NOT EXISTS idx_data_classification_pii ON data_classification(contains_pii) WHERE contains_pii = true;
CREATE INDEX IF NOT EXISTS idx_data_classification_review ON data_classification(review_due_at) WHERE review_due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_lineage_source ON data_lineage(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_data_lineage_target ON data_lineage(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_data_lineage_relationship ON data_lineage(relationship_type);

CREATE INDEX IF NOT EXISTS idx_lifecycle_events_resource ON data_lifecycle_events(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_type ON data_lifecycle_events(event_type, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_policy ON data_lifecycle_events(policy_id);

CREATE INDEX IF NOT EXISTS idx_privacy_requests_status ON privacy_requests(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_subject ON privacy_requests(subject_user_id);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_deadline ON privacy_requests(completion_deadline);

CREATE INDEX IF NOT EXISTS idx_masking_rules_table ON data_masking_rules(table_name, column_name) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_governance_reports_type ON governance_reports(report_type, generated_at DESC);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_classification ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_lineage ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_masking_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read retention policies" ON data_retention_policies FOR SELECT USING (true);
CREATE POLICY "Public read classification" ON data_classification FOR SELECT USING (true);
CREATE POLICY "Public read lineage" ON data_lineage FOR SELECT USING (true);
CREATE POLICY "Public read lifecycle events" ON data_lifecycle_events FOR SELECT USING (true);
CREATE POLICY "Public read privacy requests" ON privacy_requests FOR SELECT USING (true);
CREATE POLICY "Public read masking rules" ON data_masking_rules FOR SELECT USING (true);
CREATE POLICY "Public read governance reports" ON governance_reports FOR SELECT USING (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION apply_retention_policy(p_policy_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_policy record;
  v_cutoff_date timestamptz;
  v_records_affected integer := 0;
  v_result jsonb;
BEGIN
  SELECT * INTO v_policy
  FROM data_retention_policies
  WHERE id = p_policy_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Policy not found or inactive');
  END IF;
  
  v_cutoff_date := now() - (v_policy.retention_days || ' days')::interval;
  
  INSERT INTO data_lifecycle_events (
    event_type,
    resource_type,
    resource_id,
    policy_id,
    action_taken,
    reason
  )
  SELECT
    'archived',
    v_policy.data_type,
    id,
    p_policy_id,
    CASE WHEN v_policy.soft_delete THEN 'soft_delete' ELSE 'hard_delete' END,
    'Automatic retention policy execution'
  FROM prompt_submissions
  WHERE created_at < v_cutoff_date
  LIMIT 1000;
  
  GET DIAGNOSTICS v_records_affected = ROW_COUNT;
  
  UPDATE data_retention_policies
  SET last_executed_at = now(),
      next_execution_at = now() + 
        CASE execution_schedule
          WHEN 'hourly' THEN interval '1 hour'
          WHEN 'daily' THEN interval '1 day'
          WHEN 'weekly' THEN interval '7 days'
          WHEN 'monthly' THEN interval '30 days'
        END
  WHERE id = p_policy_id;
  
  v_result := jsonb_build_object(
    'success', true,
    'policy_name', v_policy.policy_name,
    'records_affected', v_records_affected,
    'cutoff_date', v_cutoff_date
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION classify_data(
  p_resource_type text,
  p_resource_id uuid,
  p_classification_level text,
  p_contains_pii boolean DEFAULT false,
  p_classified_by uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_classification_id uuid;
  v_sensitivity_score integer;
BEGIN
  v_sensitivity_score := CASE p_classification_level
    WHEN 'public' THEN 1
    WHEN 'internal' THEN 3
    WHEN 'confidential' THEN 5
    WHEN 'restricted' THEN 7
    WHEN 'highly_restricted' THEN 10
    ELSE 1
  END;
  
  IF p_contains_pii THEN
    v_sensitivity_score := GREATEST(v_sensitivity_score, 7);
  END IF;
  
  INSERT INTO data_classification (
    resource_type,
    resource_id,
    classification_level,
    sensitivity_score,
    contains_pii,
    classified_by,
    review_due_at
  ) VALUES (
    p_resource_type,
    p_resource_id,
    p_classification_level,
    v_sensitivity_score,
    p_contains_pii,
    COALESCE(p_classified_by, (SELECT auth.uid())),
    now() + interval '1 year'
  )
  ON CONFLICT (resource_type, resource_id)
  DO UPDATE SET
    classification_level = EXCLUDED.classification_level,
    sensitivity_score = EXCLUDED.sensitivity_score,
    contains_pii = EXCLUDED.contains_pii,
    classified_by = EXCLUDED.classified_by,
    classified_at = now(),
    review_due_at = now() + interval '1 year'
  RETURNING id INTO v_classification_id;
  
  RETURN v_classification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION track_lineage(
  p_source_type text,
  p_source_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_relationship_type text
)
RETURNS uuid AS $$
DECLARE
  v_lineage_id uuid;
BEGIN
  INSERT INTO data_lineage (
    source_type,
    source_id,
    target_type,
    target_id,
    relationship_type
  ) VALUES (
    p_source_type,
    p_source_id,
    p_target_type,
    p_target_id,
    p_relationship_type
  )
  RETURNING id INTO v_lineage_id;
  
  RETURN v_lineage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mask_sensitive_data(
  p_value text,
  p_masking_method text,
  p_preserve_length boolean DEFAULT true
)
RETURNS text AS $$
BEGIN
  CASE p_masking_method
    WHEN 'redact' THEN
      IF p_preserve_length THEN
        RETURN repeat('*', length(p_value));
      ELSE
        RETURN '***REDACTED***';
      END IF;
    
    WHEN 'partial' THEN
      IF length(p_value) <= 4 THEN
        RETURN repeat('*', length(p_value));
      ELSE
        RETURN substring(p_value, 1, 2) || repeat('*', length(p_value) - 4) || substring(p_value, length(p_value) - 1);
      END IF;
    
    WHEN 'hash' THEN
      RETURN encode(digest(p_value, 'sha256'), 'hex');
    
    WHEN 'null' THEN
      RETURN NULL;
    
    WHEN 'static' THEN
      RETURN '[MASKED]';
    
    ELSE
      RETURN p_value;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION process_privacy_request(p_request_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_request record;
  v_records_found integer := 0;
  v_result jsonb;
BEGIN
  SELECT * INTO v_request
  FROM privacy_requests
  WHERE id = p_request_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;
  
  UPDATE privacy_requests
  SET status = 'in_progress',
      processing_started_at = now()
  WHERE id = p_request_id;
  
  CASE v_request.request_type
    WHEN 'deletion' THEN
      INSERT INTO data_lifecycle_events (
        event_type,
        resource_type,
        resource_id,
        action_taken,
        reason
      )
      SELECT
        'deleted',
        'user_data',
        id,
        'hard_delete',
        'Privacy request: ' || v_request.request_number
      FROM prompt_submissions
      WHERE submitter = v_request.subject_user_id;
      
      GET DIAGNOSTICS v_records_found = ROW_COUNT;
    
    WHEN 'access', 'portability' THEN
      SELECT COUNT(*) INTO v_records_found
      FROM prompt_submissions
      WHERE submitter = v_request.subject_user_id;
    
    ELSE
      v_records_found := 0;
  END CASE;
  
  UPDATE privacy_requests
  SET status = 'completed',
      records_found = v_records_found,
      records_processed = v_records_found,
      completed_at = now()
  WHERE id = p_request_id;
  
  v_result := jsonb_build_object(
    'success', true,
    'request_number', v_request.request_number,
    'records_processed', v_records_found
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- SEED DATA - RETENTION POLICIES
-- =============================================================================

INSERT INTO data_retention_policies (
  policy_name,
  data_type,
  table_name,
  retention_days,
  legal_basis,
  regulatory_framework,
  created_by
)
SELECT
  'Prompt Retention',
  'prompts',
  'prompt_submissions',
  730,
  'Business necessity',
  ARRAY['Internal Policy'],
  (SELECT id FROM auth.users LIMIT 1)
WHERE EXISTS (SELECT 1 FROM auth.users LIMIT 1)
ON CONFLICT (policy_name) DO NOTHING;

INSERT INTO data_retention_policies (
  policy_name,
  data_type,
  table_name,
  retention_days,
  legal_basis,
  regulatory_framework,
  created_by
)
SELECT
  'Test Results Retention',
  'test_results',
  'sandbox_executions',
  365,
  'Quality assurance',
  ARRAY['Internal Policy'],
  (SELECT id FROM auth.users LIMIT 1)
WHERE EXISTS (SELECT 1 FROM auth.users LIMIT 1)
ON CONFLICT (policy_name) DO NOTHING;

INSERT INTO data_retention_policies (
  policy_name,
  data_type,
  table_name,
  retention_days,
  legal_basis,
  regulatory_framework,
  created_by
)
SELECT
  'User Activity Logs',
  'analytics',
  'audit_events',
  2555,
  'Legal requirement',
  ARRAY['GDPR', 'SOX'],
  (SELECT id FROM auth.users LIMIT 1)
WHERE EXISTS (SELECT 1 FROM auth.users LIMIT 1)
ON CONFLICT (policy_name) DO NOTHING;

-- =============================================================================
-- SEED DATA - MASKING RULES
-- =============================================================================

INSERT INTO data_masking_rules (
  rule_name,
  table_name,
  column_name,
  masking_method
)
VALUES
  ('Mask User Emails', 'users', 'email', 'partial'),
  ('Mask IP Addresses', 'audit_events', 'ip_address', 'hash'),
  ('Redact API Keys', 'system_config', 'api_key', 'redact')
ON CONFLICT (rule_name) DO NOTHING;
