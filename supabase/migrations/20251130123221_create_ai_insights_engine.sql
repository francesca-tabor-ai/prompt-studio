/*
  # AI-Powered Insights Engine

  ## Overview
  Intelligent analysis and recommendations system:
  - Pattern and anomaly detection
  - Performance-based prompt flagging
  - Gap analysis by workflow/role
  - New prompt recommendations
  - Duplicate detection
  - Optimization suggestions
  - Adoption and engagement insights

  ## New Tables
  1. **ai_insights** - Generated insights and recommendations
  2. **prompt_health_scores** - Calculated health metrics
  3. **library_gaps** - Identified gaps by dimension
  4. **duplicate_candidates** - Potential duplicate prompts
  5. **optimization_opportunities** - Improvement suggestions
  6. **insight_feedback** - User feedback on insights
*/

-- =============================================================================
-- 1. AI INSIGHTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  insight_type text NOT NULL,
  insight_category text NOT NULL,
  
  title text NOT NULL,
  description text NOT NULL,
  
  severity text NOT NULL,
  priority integer DEFAULT 0,
  
  data_points jsonb NOT NULL,
  
  affected_prompts uuid[],
  affected_departments text[],
  affected_workflows text[],
  
  recommended_action text,
  action_steps text[],
  
  impact_score numeric(5, 2) DEFAULT 0,
  confidence_score numeric(5, 2) DEFAULT 0,
  
  status text DEFAULT 'active',
  
  viewed_count integer DEFAULT 0,
  dismissed_count integer DEFAULT 0,
  acted_on_count integer DEFAULT 0,
  
  expires_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_insight_type CHECK (insight_type IN (
    'anomaly', 'pattern', 'performance_alert', 'gap_analysis', 
    'recommendation', 'duplicate', 'optimization', 'adoption'
  )),
  CONSTRAINT valid_insight_category CHECK (insight_category IN (
    'quality', 'performance', 'usage', 'coverage', 'efficiency', 'engagement'
  )),
  CONSTRAINT valid_severity CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed'))
);

-- =============================================================================
-- 2. PROMPT HEALTH SCORES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_health_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  prompt_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE NOT NULL,
  
  overall_score numeric(5, 2) NOT NULL,
  
  quality_score numeric(5, 2) DEFAULT 0,
  performance_score numeric(5, 2) DEFAULT 0,
  adoption_score numeric(5, 2) DEFAULT 0,
  satisfaction_score numeric(5, 2) DEFAULT 0,
  
  usage_count integer DEFAULT 0,
  success_rate numeric(5, 2) DEFAULT 0,
  avg_rating numeric(3, 2) DEFAULT 0,
  
  red_flags text[],
  strengths text[],
  
  needs_attention boolean DEFAULT false,
  needs_refinement boolean DEFAULT false,
  
  last_calculated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_prompt_health UNIQUE (prompt_id),
  CONSTRAINT valid_scores CHECK (
    overall_score >= 0 AND overall_score <= 100 AND
    quality_score >= 0 AND quality_score <= 100 AND
    performance_score >= 0 AND performance_score <= 100
  )
);

-- =============================================================================
-- 3. LIBRARY GAPS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS library_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  gap_type text NOT NULL,
  
  dimension_type text NOT NULL,
  dimension_value text NOT NULL,
  
  gap_description text NOT NULL,
  
  current_coverage integer DEFAULT 0,
  expected_coverage integer DEFAULT 0,
  gap_size integer DEFAULT 0,
  
  suggested_prompts jsonb,
  
  priority_score numeric(5, 2) DEFAULT 0,
  
  user_demand_signals integer DEFAULT 0,
  
  status text DEFAULT 'identified',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_gap_type CHECK (gap_type IN (
    'workflow_missing', 'role_underserved', 'use_case_gap', 'category_sparse'
  )),
  CONSTRAINT valid_dimension_type CHECK (dimension_type IN (
    'workflow', 'role', 'department', 'category', 'use_case'
  )),
  CONSTRAINT valid_gap_status CHECK (status IN (
    'identified', 'acknowledged', 'in_progress', 'filled', 'dismissed'
  ))
);

-- =============================================================================
-- 4. DUPLICATE CANDIDATES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS duplicate_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  prompt_a_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE NOT NULL,
  prompt_b_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE NOT NULL,
  
  similarity_score numeric(5, 2) NOT NULL,
  
  similarity_factors jsonb,
  
  recommendation text NOT NULL,
  
  status text DEFAULT 'pending_review',
  
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_decision text,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_similarity_score CHECK (similarity_score >= 0 AND similarity_score <= 100),
  CONSTRAINT valid_duplicate_status CHECK (status IN (
    'pending_review', 'confirmed_duplicate', 'not_duplicate', 'merged', 'dismissed'
  )),
  CONSTRAINT different_prompts CHECK (prompt_a_id != prompt_b_id),
  CONSTRAINT unique_pair UNIQUE (prompt_a_id, prompt_b_id)
);

-- =============================================================================
-- 5. OPTIMIZATION OPPORTUNITIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS optimization_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  prompt_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE NOT NULL,
  
  opportunity_type text NOT NULL,
  
  title text NOT NULL,
  description text NOT NULL,
  
  current_metrics jsonb,
  potential_improvement jsonb,
  
  specific_recommendations text[],
  
  effort_level text DEFAULT 'medium',
  impact_level text DEFAULT 'medium',
  
  priority_score numeric(5, 2) DEFAULT 0,
  
  status text DEFAULT 'identified',
  
  implemented_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_opportunity_type CHECK (opportunity_type IN (
    'performance_boost', 'clarity_improvement', 'usage_expansion', 
    'cost_reduction', 'quality_enhancement', 'speed_optimization'
  )),
  CONSTRAINT valid_effort_level CHECK (effort_level IN ('low', 'medium', 'high')),
  CONSTRAINT valid_impact_level CHECK (impact_level IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT valid_optimization_status CHECK (status IN (
    'identified', 'planned', 'in_progress', 'implemented', 'dismissed'
  ))
);

-- =============================================================================
-- 6. INSIGHT FEEDBACK TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS insight_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  insight_id uuid REFERENCES ai_insights(id) ON DELETE CASCADE NOT NULL,
  
  user_id uuid NOT NULL,
  
  feedback_type text NOT NULL,
  
  is_helpful boolean,
  was_acted_on boolean DEFAULT false,
  
  comment text,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_feedback_type CHECK (feedback_type IN (
    'helpful', 'not_helpful', 'acted_on', 'dismissed', 'needs_more_info'
  ))
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_insights(insight_type, severity);
CREATE INDEX IF NOT EXISTS idx_ai_insights_category ON ai_insights(insight_category, status);
CREATE INDEX IF NOT EXISTS idx_ai_insights_status ON ai_insights(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_priority ON ai_insights(priority DESC, impact_score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_expires ON ai_insights(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prompt_health_prompt ON prompt_health_scores(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_health_score ON prompt_health_scores(overall_score);
CREATE INDEX IF NOT EXISTS idx_prompt_health_flags ON prompt_health_scores(needs_attention) WHERE needs_attention = true;

CREATE INDEX IF NOT EXISTS idx_library_gaps_dimension ON library_gaps(dimension_type, dimension_value);
CREATE INDEX IF NOT EXISTS idx_library_gaps_priority ON library_gaps(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_library_gaps_status ON library_gaps(status);

CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_prompt_a ON duplicate_candidates(prompt_a_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_prompt_b ON duplicate_candidates(prompt_b_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_similarity ON duplicate_candidates(similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_status ON duplicate_candidates(status);

CREATE INDEX IF NOT EXISTS idx_optimization_prompt ON optimization_opportunities(prompt_id);
CREATE INDEX IF NOT EXISTS idx_optimization_type ON optimization_opportunities(opportunity_type);
CREATE INDEX IF NOT EXISTS idx_optimization_priority ON optimization_opportunities(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_optimization_status ON optimization_opportunities(status);

CREATE INDEX IF NOT EXISTS idx_insight_feedback_insight ON insight_feedback(insight_id);
CREATE INDEX IF NOT EXISTS idx_insight_feedback_user ON insight_feedback(user_id);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE duplicate_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read insights" ON ai_insights FOR SELECT USING (true);
CREATE POLICY "Public read health scores" ON prompt_health_scores FOR SELECT USING (true);
CREATE POLICY "Public read gaps" ON library_gaps FOR SELECT USING (true);
CREATE POLICY "Public read duplicates" ON duplicate_candidates FOR SELECT USING (true);
CREATE POLICY "Public read optimizations" ON optimization_opportunities FOR SELECT USING (true);
CREATE POLICY "Public read feedback" ON insight_feedback FOR SELECT USING (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_prompt_health_score(p_prompt_id uuid)
RETURNS numeric AS $$
DECLARE
  v_quality_score numeric;
  v_performance_score numeric;
  v_adoption_score numeric;
  v_satisfaction_score numeric;
  v_overall_score numeric;
BEGIN
  SELECT AVG(accuracy_score) * 20
  INTO v_quality_score
  FROM ai_accuracy_metrics
  WHERE prompt_id = p_prompt_id;
  
  SELECT (COUNT(*) FILTER (WHERE test_status = 'passed')::numeric / NULLIF(COUNT(*), 0)) * 100
  INTO v_performance_score
  FROM sandbox_test_results
  WHERE prompt_id = p_prompt_id;
  
  SELECT LEAST(COUNT(DISTINCT user_id)::numeric / 10 * 100, 100)
  INTO v_adoption_score
  FROM analytics_events
  WHERE prompt_id = p_prompt_id AND event_name = 'prompt_use';
  
  SELECT AVG(rating) * 20
  INTO v_satisfaction_score
  FROM satisfaction_ratings
  WHERE prompt_id = p_prompt_id;
  
  v_overall_score := (
    COALESCE(v_quality_score, 0) * 0.3 +
    COALESCE(v_performance_score, 0) * 0.3 +
    COALESCE(v_adoption_score, 0) * 0.2 +
    COALESCE(v_satisfaction_score, 0) * 0.2
  );
  
  RETURN ROUND(v_overall_score, 2);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION detect_prompt_anomalies(p_lookback_days integer DEFAULT 7)
RETURNS TABLE(
  prompt_id uuid,
  anomaly_type text,
  severity text,
  description text
) AS $$
BEGIN
  RETURN QUERY
  WITH recent_metrics AS (
    SELECT
      ps.id,
      ps.title,
      COUNT(DISTINCT ae.user_id) as unique_users,
      AVG(sr.rating) as avg_rating,
      COUNT(str.id) FILTER (WHERE str.test_status = 'failed') as failed_tests
    FROM prompt_submissions ps
    LEFT JOIN analytics_events ae ON ae.prompt_id = ps.id 
      AND ae.created_at > (now() - (p_lookback_days || ' days')::interval)
    LEFT JOIN satisfaction_ratings sr ON sr.prompt_id = ps.id
      AND sr.created_at > (now() - (p_lookback_days || ' days')::interval)
    LEFT JOIN sandbox_test_results str ON str.prompt_id = ps.id
      AND str.created_at > (now() - (p_lookback_days || ' days')::interval)
    WHERE ps.status = 'published'
    GROUP BY ps.id, ps.title
  )
  SELECT
    rm.id,
    'low_rating' as anomaly_type,
    'high' as severity,
    format('Prompt has low satisfaction rating: %.2f/5', rm.avg_rating) as description
  FROM recent_metrics rm
  WHERE rm.avg_rating < 3.0
  
  UNION ALL
  
  SELECT
    rm.id,
    'high_failure_rate' as anomaly_type,
    'critical' as severity,
    format('Prompt has %s failed tests', rm.failed_tests) as description
  FROM recent_metrics rm
  WHERE rm.failed_tests > 5;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION identify_library_gaps()
RETURNS void AS $$
DECLARE
  v_workflow record;
BEGIN
  FOR v_workflow IN 
    SELECT DISTINCT workflow
    FROM prompt_submissions
    WHERE workflow IS NOT NULL
  LOOP
    INSERT INTO library_gaps (
      gap_type,
      dimension_type,
      dimension_value,
      gap_description,
      current_coverage,
      expected_coverage,
      gap_size,
      priority_score
    )
    SELECT
      'workflow_missing',
      'workflow',
      v_workflow.workflow,
      format('Limited prompt coverage for %s workflow', v_workflow.workflow),
      COUNT(*),
      20,
      GREATEST(20 - COUNT(*), 0),
      GREATEST(20 - COUNT(*), 0)::numeric * 5
    FROM prompt_submissions
    WHERE workflow = v_workflow.workflow
    HAVING COUNT(*) < 20
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_similarity_score(
  p_title_a text,
  p_title_b text,
  p_content_a text,
  p_content_b text
)
RETURNS numeric AS $$
DECLARE
  v_title_similarity numeric;
  v_content_similarity numeric;
  v_overall_similarity numeric;
BEGIN
  v_title_similarity := CASE
    WHEN lower(p_title_a) = lower(p_title_b) THEN 100
    WHEN lower(p_title_a) LIKE '%' || lower(p_title_b) || '%' 
      OR lower(p_title_b) LIKE '%' || lower(p_title_a) || '%' THEN 75
    ELSE 0
  END;
  
  v_content_similarity := CASE
    WHEN length(p_content_a) > 0 AND length(p_content_b) > 0 THEN
      LEAST(
        100,
        (length(p_content_a) + length(p_content_b) - 
         abs(length(p_content_a) - length(p_content_b)))::numeric / 
         GREATEST(length(p_content_a), length(p_content_b)) * 100
      )
    ELSE 0
  END;
  
  v_overall_similarity := (v_title_similarity * 0.6) + (v_content_similarity * 0.4);
  
  RETURN ROUND(v_overall_similarity, 2);
END;
$$ LANGUAGE plpgsql;
