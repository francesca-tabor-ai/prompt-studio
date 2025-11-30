/*
  # Performance Metrics System

  ## Overview
  Real-time performance tracking and metrics calculation:
  - AI accuracy scores by prompt and department
  - User satisfaction ratings and feedback trends
  - Sandbox success rates and test metrics
  - Time-to-approval tracking
  - Prompt utilization rates
  - Cost metrics (API usage, tokens)
  - Quality metrics (revisions, flags)

  ## New Tables
  1. **performance_metrics** - Real-time aggregated metrics
  2. **ai_accuracy_metrics** - AI performance tracking
  3. **satisfaction_ratings** - User feedback and ratings
  4. **sandbox_test_results** - Test execution metrics
  5. **approval_time_metrics** - Review process timing
  6. **cost_metrics** - API and token usage
  7. **quality_metrics** - Revision and quality tracking
  8. **metric_snapshots** - Historical comparison data
*/

-- =============================================================================
-- 1. PERFORMANCE METRICS TABLE (Real-time aggregates)
-- =============================================================================

CREATE TABLE IF NOT EXISTS performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  metric_date date NOT NULL,
  metric_period text NOT NULL,
  
  dimension_type text NOT NULL,
  dimension_id text NOT NULL,
  dimension_name text,
  
  avg_ai_accuracy numeric(5, 2) DEFAULT 0,
  avg_clarity_score numeric(5, 2) DEFAULT 0,
  avg_usefulness_score numeric(5, 2) DEFAULT 0,
  
  avg_satisfaction_rating numeric(3, 2) DEFAULT 0,
  total_ratings integer DEFAULT 0,
  
  sandbox_success_rate numeric(5, 2) DEFAULT 0,
  total_tests integer DEFAULT 0,
  tests_passed integer DEFAULT 0,
  tests_failed integer DEFAULT 0,
  
  avg_time_to_approval_hours numeric(10, 2) DEFAULT 0,
  total_submissions integer DEFAULT 0,
  approved_submissions integer DEFAULT 0,
  
  utilization_rate numeric(5, 2) DEFAULT 0,
  total_prompts integer DEFAULT 0,
  used_prompts integer DEFAULT 0,
  unused_prompts integer DEFAULT 0,
  
  total_api_calls integer DEFAULT 0,
  total_tokens_consumed bigint DEFAULT 0,
  estimated_cost_usd numeric(10, 2) DEFAULT 0,
  
  prompts_flagged integer DEFAULT 0,
  revision_frequency numeric(5, 2) DEFAULT 0,
  avg_revisions_per_prompt numeric(5, 2) DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_metric_period CHECK (metric_period IN ('daily', 'weekly', 'monthly', 'quarterly', 'annual')),
  CONSTRAINT valid_dimension_type CHECK (dimension_type IN ('global', 'department', 'prompt', 'user', 'workflow')),
  CONSTRAINT unique_performance_metric UNIQUE (metric_date, metric_period, dimension_type, dimension_id)
);

-- =============================================================================
-- 2. AI ACCURACY METRICS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_accuracy_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  prompt_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE NOT NULL,
  test_execution_id uuid,
  
  user_id uuid,
  department text,
  
  accuracy_score numeric(5, 2) NOT NULL,
  clarity_score numeric(5, 2),
  relevance_score numeric(5, 2),
  usefulness_score numeric(5, 2),
  
  context text,
  test_type text,
  
  feedback_text text,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_accuracy_score CHECK (accuracy_score >= 0 AND accuracy_score <= 5),
  CONSTRAINT valid_test_type CHECK (test_type IN ('automated', 'manual', 'peer_review', 'production'))
);

-- =============================================================================
-- 3. SATISFACTION RATINGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS satisfaction_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id uuid NOT NULL,
  user_email text,
  department text,
  
  prompt_id uuid REFERENCES prompt_submissions(id) ON DELETE SET NULL,
  
  rating integer NOT NULL,
  
  feedback_category text,
  feedback_text text,
  
  would_recommend boolean,
  ease_of_use integer,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_rating CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT valid_ease_of_use CHECK (ease_of_use IS NULL OR (ease_of_use >= 1 AND ease_of_use <= 5)),
  CONSTRAINT valid_feedback_category CHECK (feedback_category IN (
    'accuracy', 'clarity', 'usefulness', 'speed', 'reliability', 'other'
  ))
);

-- =============================================================================
-- 4. SANDBOX TEST RESULTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS sandbox_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  prompt_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE NOT NULL,
  session_id uuid NOT NULL,
  
  user_id uuid,
  
  test_type text NOT NULL,
  test_status text NOT NULL,
  
  execution_time_ms integer,
  
  passed_checks integer DEFAULT 0,
  failed_checks integer DEFAULT 0,
  total_checks integer DEFAULT 0,
  
  error_message text,
  error_type text,
  
  input_data jsonb,
  output_data jsonb,
  expected_output jsonb,
  
  ai_model text,
  tokens_used integer,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_test_type CHECK (test_type IN (
    'unit', 'integration', 'regression', 'performance', 'user_acceptance'
  )),
  CONSTRAINT valid_test_status CHECK (test_status IN ('passed', 'failed', 'error', 'skipped', 'timeout'))
);

-- =============================================================================
-- 5. APPROVAL TIME METRICS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS approval_time_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  submission_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE NOT NULL,
  
  submitted_at timestamptz NOT NULL,
  first_review_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  
  time_to_first_review_hours numeric(10, 2),
  time_to_approval_hours numeric(10, 2),
  time_to_publish_hours numeric(10, 2),
  
  total_reviewers integer DEFAULT 0,
  reviews_completed integer DEFAULT 0,
  
  revision_rounds integer DEFAULT 0,
  
  department text,
  workflow text,
  
  created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 6. COST METRICS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS cost_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  metric_date date NOT NULL,
  
  prompt_id uuid REFERENCES prompt_submissions(id) ON DELETE SET NULL,
  user_id uuid,
  department text,
  
  api_provider text NOT NULL,
  api_endpoint text,
  model_name text,
  
  total_calls integer DEFAULT 0,
  successful_calls integer DEFAULT 0,
  failed_calls integer DEFAULT 0,
  
  total_tokens bigint DEFAULT 0,
  input_tokens bigint DEFAULT 0,
  output_tokens bigint DEFAULT 0,
  
  cost_per_1k_input_tokens numeric(10, 6),
  cost_per_1k_output_tokens numeric(10, 6),
  
  total_cost_usd numeric(10, 2) DEFAULT 0,
  
  avg_latency_ms integer,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_api_provider CHECK (api_provider IN ('openai', 'anthropic', 'google', 'azure', 'aws', 'other'))
);

-- =============================================================================
-- 7. QUALITY METRICS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS quality_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  prompt_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE NOT NULL,
  
  flagged_at timestamptz,
  flag_reason text,
  flag_severity text,
  
  revision_count integer DEFAULT 0,
  last_revision_at timestamptz,
  
  total_reviews integer DEFAULT 0,
  changes_requested_count integer DEFAULT 0,
  
  quality_score numeric(5, 2),
  
  issues_found text[],
  improvements_suggested text[],
  
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_flag_severity CHECK (flag_severity IN ('low', 'medium', 'high', 'critical'))
);

-- =============================================================================
-- 8. METRIC SNAPSHOTS TABLE (For time comparisons)
-- =============================================================================

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  snapshot_date date NOT NULL,
  snapshot_type text NOT NULL,
  
  metrics jsonb NOT NULL,
  
  comparison_period text,
  comparison_metrics jsonb,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_snapshot_type CHECK (snapshot_type IN (
    'daily', 'weekly', 'monthly', 'quarterly', 'annual', 'custom'
  ))
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_performance_metrics_date ON performance_metrics(metric_date DESC, metric_period);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_dimension ON performance_metrics(dimension_type, dimension_id);

CREATE INDEX IF NOT EXISTS idx_ai_accuracy_prompt ON ai_accuracy_metrics(prompt_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_accuracy_dept ON ai_accuracy_metrics(department, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_accuracy_score ON ai_accuracy_metrics(accuracy_score);

CREATE INDEX IF NOT EXISTS idx_satisfaction_ratings_prompt ON satisfaction_ratings(prompt_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_satisfaction_ratings_user ON satisfaction_ratings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_satisfaction_ratings_rating ON satisfaction_ratings(rating);

CREATE INDEX IF NOT EXISTS idx_sandbox_results_prompt ON sandbox_test_results(prompt_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sandbox_results_status ON sandbox_test_results(test_status);
CREATE INDEX IF NOT EXISTS idx_sandbox_results_session ON sandbox_test_results(session_id);

CREATE INDEX IF NOT EXISTS idx_approval_time_submission ON approval_time_metrics(submission_id);
CREATE INDEX IF NOT EXISTS idx_approval_time_dept ON approval_time_metrics(department, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_cost_metrics_date ON cost_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_cost_metrics_prompt ON cost_metrics(prompt_id);
CREATE INDEX IF NOT EXISTS idx_cost_metrics_dept ON cost_metrics(department, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_quality_metrics_prompt ON quality_metrics(prompt_id);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_flagged ON quality_metrics(flagged_at DESC) WHERE flagged_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_metric_snapshots_date ON metric_snapshots(snapshot_date DESC, snapshot_type);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_accuracy_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE satisfaction_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_time_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read performance metrics" ON performance_metrics FOR SELECT USING (true);
CREATE POLICY "Public read ai accuracy" ON ai_accuracy_metrics FOR SELECT USING (true);
CREATE POLICY "Public read satisfaction" ON satisfaction_ratings FOR SELECT USING (true);
CREATE POLICY "Public read sandbox results" ON sandbox_test_results FOR SELECT USING (true);
CREATE POLICY "Public read approval times" ON approval_time_metrics FOR SELECT USING (true);
CREATE POLICY "Public read cost metrics" ON cost_metrics FOR SELECT USING (true);
CREATE POLICY "Public read quality metrics" ON quality_metrics FOR SELECT USING (true);
CREATE POLICY "Public read snapshots" ON metric_snapshots FOR SELECT USING (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_performance_metrics(
  p_start_date date,
  p_end_date date,
  p_dimension_type text,
  p_dimension_id text
)
RETURNS jsonb AS $$
DECLARE
  v_metrics jsonb;
  v_accuracy numeric;
  v_satisfaction numeric;
  v_sandbox_rate numeric;
  v_approval_time numeric;
  v_utilization numeric;
BEGIN
  SELECT AVG(accuracy_score)
  INTO v_accuracy
  FROM ai_accuracy_metrics
  WHERE created_at::date BETWEEN p_start_date AND p_end_date;
  
  SELECT AVG(rating)
  INTO v_satisfaction
  FROM satisfaction_ratings
  WHERE created_at::date BETWEEN p_start_date AND p_end_date;
  
  SELECT 
    CASE 
      WHEN COUNT(*) > 0 
      THEN (COUNT(*) FILTER (WHERE test_status = 'passed')::numeric / COUNT(*)) * 100
      ELSE 0
    END
  INTO v_sandbox_rate
  FROM sandbox_test_results
  WHERE created_at::date BETWEEN p_start_date AND p_end_date;
  
  SELECT AVG(time_to_approval_hours)
  INTO v_approval_time
  FROM approval_time_metrics
  WHERE submitted_at::date BETWEEN p_start_date AND p_end_date;
  
  v_metrics := jsonb_build_object(
    'avg_accuracy', COALESCE(ROUND(v_accuracy, 2), 0),
    'avg_satisfaction', COALESCE(ROUND(v_satisfaction, 2), 0),
    'sandbox_success_rate', COALESCE(ROUND(v_sandbox_rate, 2), 0),
    'avg_approval_time_hours', COALESCE(ROUND(v_approval_time, 2), 0)
  );
  
  RETURN v_metrics;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_daily_performance_metrics(p_date date)
RETURNS void AS $$
BEGIN
  INSERT INTO performance_metrics (
    metric_date,
    metric_period,
    dimension_type,
    dimension_id,
    dimension_name,
    avg_ai_accuracy,
    avg_satisfaction_rating,
    sandbox_success_rate,
    total_tests,
    tests_passed,
    tests_failed
  )
  SELECT
    p_date,
    'daily',
    'global',
    'all',
    'All',
    COALESCE(AVG(aam.accuracy_score), 0),
    COALESCE(AVG(sr.rating), 0),
    CASE 
      WHEN COUNT(str.id) > 0 
      THEN (COUNT(str.id) FILTER (WHERE str.test_status = 'passed')::numeric / COUNT(str.id)) * 100
      ELSE 0
    END,
    COUNT(str.id),
    COUNT(str.id) FILTER (WHERE str.test_status = 'passed'),
    COUNT(str.id) FILTER (WHERE str.test_status = 'failed')
  FROM ai_accuracy_metrics aam
  FULL OUTER JOIN satisfaction_ratings sr ON sr.created_at::date = p_date
  FULL OUTER JOIN sandbox_test_results str ON str.created_at::date = p_date
  WHERE aam.created_at::date = p_date
  ON CONFLICT (metric_date, metric_period, dimension_type, dimension_id)
  DO UPDATE SET
    avg_ai_accuracy = EXCLUDED.avg_ai_accuracy,
    avg_satisfaction_rating = EXCLUDED.avg_satisfaction_rating,
    sandbox_success_rate = EXCLUDED.sandbox_success_rate,
    total_tests = EXCLUDED.total_tests,
    tests_passed = EXCLUDED.tests_passed,
    tests_failed = EXCLUDED.tests_failed,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;
