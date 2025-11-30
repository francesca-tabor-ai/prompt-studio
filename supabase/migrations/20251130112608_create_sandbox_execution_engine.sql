/*
  # Sandbox Execution Engine

  ## Overview
  Testing and execution environment with:
  - Pre-configured test scenarios
  - Multiple input formats (text, JSON, forms)
  - LLM execution with multiple providers
  - Output capture with metadata
  - Error handling and debugging
  - Resource limits and timeouts
  - Comprehensive execution logging

  ## New Tables
  1. **test_scenarios** - Pre-configured test cases
  2. **sandbox_executions** - Execution records
  3. **execution_outputs** - Generated outputs
  4. **execution_errors** - Error tracking
  5. **llm_providers** - Provider configurations
  6. **resource_usage** - Usage tracking
*/

-- =============================================================================
-- 1. TEST SCENARIOS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS test_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_name text NOT NULL UNIQUE,
  scenario_category text NOT NULL,
  description text,
  sample_input_text text,
  sample_input_json jsonb,
  sample_input_form jsonb,
  expected_output_format text,
  validation_rules jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_category CHECK (scenario_category IN ('customer_support', 'marketing', 'hr', 'sales', 'technical', 'creative', 'general'))
);

-- =============================================================================
-- 2. SANDBOX EXECUTIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS sandbox_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  prompt_id uuid REFERENCES prompts(id) ON DELETE SET NULL,
  test_scenario_id uuid REFERENCES test_scenarios(id) ON DELETE SET NULL,
  execution_type text DEFAULT 'manual',
  input_data jsonb NOT NULL,
  input_format text NOT NULL,
  llm_provider text NOT NULL,
  llm_model text NOT NULL,
  llm_parameters jsonb DEFAULT '{}',
  status text DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  execution_time_ms integer,
  timeout_seconds integer DEFAULT 30,
  is_timeout boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_execution_type CHECK (execution_type IN ('manual', 'automated', 'batch', 'scheduled')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timeout', 'cancelled')),
  CONSTRAINT valid_input_format CHECK (input_format IN ('text', 'json', 'form', 'csv'))
);

-- =============================================================================
-- 3. EXECUTION OUTPUTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS execution_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid REFERENCES sandbox_executions(id) ON DELETE CASCADE NOT NULL,
  output_text text,
  output_json jsonb,
  output_metadata jsonb DEFAULT '{}',
  tokens_used integer,
  prompt_tokens integer,
  completion_tokens integer,
  model_version text,
  finish_reason text,
  quality_score numeric(3, 2),
  validation_passed boolean,
  validation_errors jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 4. EXECUTION ERRORS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS execution_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid REFERENCES sandbox_executions(id) ON DELETE CASCADE NOT NULL,
  error_type text NOT NULL,
  error_code text,
  error_message text NOT NULL,
  error_details jsonb DEFAULT '{}',
  stack_trace text,
  occurred_at timestamptz DEFAULT now(),
  is_retryable boolean DEFAULT false,
  retry_count integer DEFAULT 0,
  CONSTRAINT valid_error_type CHECK (error_type IN ('validation', 'provider', 'timeout', 'rate_limit', 'network', 'authentication', 'configuration', 'internal'))
);

-- =============================================================================
-- 5. LLM PROVIDERS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS llm_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name text NOT NULL UNIQUE,
  provider_type text NOT NULL,
  api_endpoint text,
  available_models text[] DEFAULT '{}',
  default_model text,
  configuration jsonb DEFAULT '{}',
  rate_limits jsonb DEFAULT '{}',
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_provider_type CHECK (provider_type IN ('openai', 'anthropic', 'google', 'azure', 'local', 'custom'))
);

-- =============================================================================
-- 6. RESOURCE USAGE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS resource_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid REFERENCES sandbox_executions(id) ON DELETE CASCADE NOT NULL,
  tokens_used integer DEFAULT 0,
  tokens_limit integer DEFAULT 10000,
  execution_time_ms integer DEFAULT 0,
  execution_time_limit_ms integer DEFAULT 30000,
  memory_used_mb numeric(10, 2),
  api_calls integer DEFAULT 1,
  cost_estimate numeric(10, 4),
  exceeded_limits boolean DEFAULT false,
  limit_details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_test_scenarios_category ON test_scenarios(scenario_category);
CREATE INDEX idx_test_scenarios_active ON test_scenarios(is_active);

CREATE INDEX idx_sandbox_executions_user ON sandbox_executions(user_id);
CREATE INDEX idx_sandbox_executions_prompt ON sandbox_executions(prompt_id);
CREATE INDEX idx_sandbox_executions_scenario ON sandbox_executions(test_scenario_id);
CREATE INDEX idx_sandbox_executions_status ON sandbox_executions(status);
CREATE INDEX idx_sandbox_executions_provider ON sandbox_executions(llm_provider);
CREATE INDEX idx_sandbox_executions_created ON sandbox_executions(created_at DESC);

CREATE INDEX idx_execution_outputs_execution ON execution_outputs(execution_id);
CREATE INDEX idx_execution_outputs_quality ON execution_outputs(quality_score DESC);
CREATE INDEX idx_execution_outputs_validation ON execution_outputs(validation_passed);

CREATE INDEX idx_execution_errors_execution ON execution_errors(execution_id);
CREATE INDEX idx_execution_errors_type ON execution_errors(error_type);
CREATE INDEX idx_execution_errors_retryable ON execution_errors(is_retryable);

CREATE INDEX idx_llm_providers_enabled ON llm_providers(is_enabled);

CREATE INDEX idx_resource_usage_execution ON resource_usage(execution_id);
CREATE INDEX idx_resource_usage_exceeded ON resource_usage(exceeded_limits);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE test_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View scenarios" ON test_scenarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full scenarios" ON test_scenarios FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "View own executions" ON sandbox_executions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Create executions" ON sandbox_executions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own executions" ON sandbox_executions FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service full executions" ON sandbox_executions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "View own outputs" ON execution_outputs FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM sandbox_executions WHERE sandbox_executions.id = execution_outputs.execution_id AND sandbox_executions.user_id = auth.uid()));
CREATE POLICY "Service full outputs" ON execution_outputs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "View own errors" ON execution_errors FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM sandbox_executions WHERE sandbox_executions.id = execution_errors.execution_id AND sandbox_executions.user_id = auth.uid()));
CREATE POLICY "Service full errors" ON execution_errors FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "View providers" ON llm_providers FOR SELECT TO authenticated USING (is_enabled = true);
CREATE POLICY "Service full providers" ON llm_providers FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "View own usage" ON resource_usage FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM sandbox_executions WHERE sandbox_executions.id = resource_usage.execution_id AND sandbox_executions.user_id = auth.uid()));
CREATE POLICY "Service full usage" ON resource_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_execution_cost(
  p_tokens integer,
  p_model text
)
RETURNS numeric AS $$
DECLARE
  v_cost_per_1k_tokens numeric;
BEGIN
  CASE
    WHEN p_model ILIKE '%gpt-4%' THEN
      v_cost_per_1k_tokens := 0.03;
    WHEN p_model ILIKE '%gpt-3.5%' THEN
      v_cost_per_1k_tokens := 0.002;
    WHEN p_model ILIKE '%claude-3-opus%' THEN
      v_cost_per_1k_tokens := 0.015;
    WHEN p_model ILIKE '%claude-3-sonnet%' THEN
      v_cost_per_1k_tokens := 0.003;
    ELSE
      v_cost_per_1k_tokens := 0.001;
  END CASE;
  
  RETURN ROUND((p_tokens::numeric / 1000) * v_cost_per_1k_tokens, 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_execution_summary(p_execution_id uuid)
RETURNS TABLE(
  execution_id uuid,
  status text,
  execution_time_ms integer,
  tokens_used integer,
  output_text text,
  has_errors boolean,
  error_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.id,
    se.status,
    se.execution_time_ms,
    eo.tokens_used,
    eo.output_text,
    EXISTS(SELECT 1 FROM execution_errors WHERE execution_errors.execution_id = se.id) as has_errors,
    COUNT(ee.id) as error_count
  FROM sandbox_executions se
  LEFT JOIN execution_outputs eo ON eo.execution_id = se.id
  LEFT JOIN execution_errors ee ON ee.execution_id = se.id
  WHERE se.id = p_execution_id
  GROUP BY se.id, se.status, se.execution_time_ms, eo.tokens_used, eo.output_text;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SEED DATA
-- =============================================================================

INSERT INTO llm_providers (provider_name, provider_type, available_models, default_model, is_enabled)
VALUES
  ('OpenAI', 'openai', ARRAY['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'], 'gpt-4-turbo', true),
  ('Anthropic', 'anthropic', ARRAY['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'], 'claude-3-sonnet', true),
  ('Mock Provider', 'custom', ARRAY['mock-model-1'], 'mock-model-1', true)
ON CONFLICT (provider_name) DO NOTHING;

INSERT INTO test_scenarios (scenario_name, scenario_category, description, sample_input_text, sample_input_json, expected_output_format)
VALUES
  ('Customer Support - Product Issue', 'customer_support', 
   'Handle a customer reporting a product issue',
   'My product stopped working after the recent update. Order #12345',
   '{"order_id": "12345", "issue_type": "product_malfunction", "product": "Widget Pro", "customer_tier": "premium"}',
   'Empathetic response with troubleshooting steps'),
   
  ('Marketing Copy - Email Campaign', 'marketing',
   'Generate marketing email for new product launch',
   'New product: SmartWidget 2.0, Features: AI-powered, 50% faster, eco-friendly',
   '{"product_name": "SmartWidget 2.0", "features": ["AI-powered", "50% faster", "eco-friendly"], "target_audience": "tech enthusiasts", "tone": "exciting"}',
   'Compelling email copy with subject line'),
   
  ('HR Communication - Policy Update', 'hr',
   'Communicate a new company policy to employees',
   'New remote work policy: 3 days in office, 2 days remote, effective next month',
   '{"policy_type": "remote_work", "in_office_days": 3, "remote_days": 2, "effective_date": "next_month"}',
   'Clear, professional policy announcement'),
   
  ('Sales Outreach - Cold Email', 'sales',
   'Create personalized cold outreach email',
   'Prospect: TechCorp, Industry: SaaS, Pain point: Manual data entry',
   '{"company": "TechCorp", "industry": "SaaS", "pain_point": "manual_data_entry", "contact_name": "Sarah", "role": "CTO"}',
   'Personalized, value-focused email'),
   
  ('Technical Documentation', 'technical',
   'Generate API documentation',
   'API endpoint: POST /api/users, Creates new user account',
   '{"method": "POST", "endpoint": "/api/users", "description": "Creates new user", "params": {"email": "string", "name": "string"}}',
   'Structured API documentation')
ON CONFLICT (scenario_name) DO NOTHING;
