/*
  # AI-Powered Content Analysis Service

  ## Overview
  Intelligent prompt quality evaluation with:
  - Clarity and specificity analysis
  - Tone consistency checking
  - Completeness assessment
  - Bias detection
  - Quality scoring (1-10)
  - Improvement recommendations
  - Integration with peer review

  ## New Tables
  1. **prompt_analyses** - Analysis results
  2. **quality_scores** - Detailed scoring metrics
  3. **analysis_recommendations** - Improvement suggestions
  4. **bias_detections** - Flagged issues
  5. **tone_assessments** - Tone evaluation
  6. **analysis_templates** - Scoring criteria
*/

-- =============================================================================
-- 1. PROMPT ANALYSES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE NOT NULL,
  analysis_version integer DEFAULT 1,
  overall_score numeric(3, 1) NOT NULL,
  clarity_score numeric(3, 1),
  specificity_score numeric(3, 1),
  tone_score numeric(3, 1),
  completeness_score numeric(3, 1),
  quality_grade text,
  needs_review boolean DEFAULT false,
  flagged_for_issues boolean DEFAULT false,
  analysis_summary text,
  strengths jsonb DEFAULT '[]',
  weaknesses jsonb DEFAULT '[]',
  analyzed_by text DEFAULT 'ai_service',
  analyzed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_overall_score CHECK (overall_score >= 1.0 AND overall_score <= 10.0),
  CONSTRAINT valid_grade CHECK (quality_grade IN ('Excellent', 'Good', 'Fair', 'Poor', 'Needs Improvement'))
);

-- =============================================================================
-- 2. QUALITY SCORES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS quality_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES prompt_analyses(id) ON DELETE CASCADE NOT NULL,
  metric_name text NOT NULL,
  metric_category text NOT NULL,
  score numeric(3, 1) NOT NULL,
  max_score numeric(3, 1) DEFAULT 10.0,
  weight numeric(3, 2) DEFAULT 1.0,
  explanation text,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_metric_category CHECK (metric_category IN ('clarity', 'specificity', 'tone', 'completeness', 'structure', 'effectiveness'))
);

-- =============================================================================
-- 3. ANALYSIS RECOMMENDATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS analysis_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES prompt_analyses(id) ON DELETE CASCADE NOT NULL,
  recommendation_type text NOT NULL,
  priority text DEFAULT 'medium',
  title text NOT NULL,
  description text NOT NULL,
  example_before text,
  example_after text,
  impact_score numeric(3, 1),
  is_addressed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_rec_type CHECK (recommendation_type IN ('clarity', 'specificity', 'tone', 'completeness', 'structure', 'bias', 'language')),
  CONSTRAINT valid_priority CHECK (priority IN ('critical', 'high', 'medium', 'low'))
);

-- =============================================================================
-- 4. BIAS DETECTIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS bias_detections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES prompt_analyses(id) ON DELETE CASCADE NOT NULL,
  bias_type text NOT NULL,
  severity text DEFAULT 'medium',
  detected_text text,
  context text,
  explanation text,
  suggested_replacement text,
  is_confirmed boolean DEFAULT false,
  is_resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_bias_type CHECK (bias_type IN ('gender', 'racial', 'cultural', 'age', 'ability', 'socioeconomic', 'language', 'other')),
  CONSTRAINT valid_severity CHECK (severity IN ('critical', 'high', 'medium', 'low'))
);

-- =============================================================================
-- 5. TONE ASSESSMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS tone_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES prompt_analyses(id) ON DELETE CASCADE NOT NULL,
  intended_tone text,
  detected_tone text,
  consistency_score numeric(3, 1),
  appropriateness_score numeric(3, 1),
  tone_elements jsonb DEFAULT '{}',
  inconsistencies jsonb DEFAULT '[]',
  recommendations text,
  created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 6. ANALYSIS TEMPLATES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS analysis_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL UNIQUE,
  template_category text NOT NULL,
  criteria jsonb NOT NULL,
  scoring_rules jsonb NOT NULL,
  thresholds jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_prompt_analyses_prompt ON prompt_analyses(prompt_id);
CREATE INDEX idx_prompt_analyses_score ON prompt_analyses(overall_score DESC);
CREATE INDEX idx_prompt_analyses_grade ON prompt_analyses(quality_grade);
CREATE INDEX idx_prompt_analyses_flagged ON prompt_analyses(flagged_for_issues);
CREATE INDEX idx_prompt_analyses_needs_review ON prompt_analyses(needs_review);

CREATE INDEX idx_quality_scores_analysis ON quality_scores(analysis_id);
CREATE INDEX idx_quality_scores_category ON quality_scores(metric_category);
CREATE INDEX idx_quality_scores_score ON quality_scores(score DESC);

CREATE INDEX idx_recommendations_analysis ON analysis_recommendations(analysis_id);
CREATE INDEX idx_recommendations_priority ON analysis_recommendations(priority);
CREATE INDEX idx_recommendations_type ON analysis_recommendations(recommendation_type);

CREATE INDEX idx_bias_detections_analysis ON bias_detections(analysis_id);
CREATE INDEX idx_bias_detections_type ON bias_detections(bias_type);
CREATE INDEX idx_bias_detections_severity ON bias_detections(severity);
CREATE INDEX idx_bias_detections_resolved ON bias_detections(is_resolved);

CREATE INDEX idx_tone_assessments_analysis ON tone_assessments(analysis_id);
CREATE INDEX idx_tone_assessments_consistency ON tone_assessments(consistency_score);

CREATE INDEX idx_analysis_templates_category ON analysis_templates(template_category);
CREATE INDEX idx_analysis_templates_active ON analysis_templates(is_active);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE prompt_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bias_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE tone_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View analyses" ON prompt_analyses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full analyses" ON prompt_analyses FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "View scores" ON quality_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full scores" ON quality_scores FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "View recommendations" ON analysis_recommendations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full recommendations" ON analysis_recommendations FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "View bias detections" ON bias_detections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full bias" ON bias_detections FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "View tone assessments" ON tone_assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full tone" ON tone_assessments FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "View templates" ON analysis_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full templates" ON analysis_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_quality_grade(p_score numeric)
RETURNS text AS $$
BEGIN
  IF p_score >= 9.0 THEN
    RETURN 'Excellent';
  ELSIF p_score >= 7.0 THEN
    RETURN 'Good';
  ELSIF p_score >= 5.0 THEN
    RETURN 'Fair';
  ELSIF p_score >= 3.0 THEN
    RETURN 'Poor';
  ELSE
    RETURN 'Needs Improvement';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_prompt_analysis_summary(p_prompt_id uuid)
RETURNS TABLE(
  analysis_id uuid,
  overall_score numeric,
  quality_grade text,
  needs_review boolean,
  recommendation_count bigint,
  critical_issues bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pa.id,
    pa.overall_score,
    pa.quality_grade,
    pa.needs_review,
    COUNT(DISTINCT ar.id) as recommendation_count,
    COUNT(DISTINCT bd.id) FILTER (WHERE bd.severity IN ('critical', 'high')) as critical_issues
  FROM prompt_analyses pa
  LEFT JOIN analysis_recommendations ar ON ar.analysis_id = pa.id
  LEFT JOIN bias_detections bd ON bd.analysis_id = pa.id
  WHERE pa.prompt_id = p_prompt_id
  GROUP BY pa.id, pa.overall_score, pa.quality_grade, pa.needs_review
  ORDER BY pa.analyzed_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SEED TEMPLATES
-- =============================================================================

INSERT INTO analysis_templates (template_name, template_category, criteria, scoring_rules, thresholds)
VALUES
  ('Standard Prompt Analysis', 'general', 
   '{"clarity": ["clear_instructions", "specific_language", "no_ambiguity"], "tone": ["consistent", "appropriate", "professional"], "completeness": ["all_sections", "examples", "constraints"]}',
   '{"clarity": {"weight": 0.25}, "specificity": {"weight": 0.2}, "tone": {"weight": 0.2}, "completeness": {"weight": 0.25}, "structure": {"weight": 0.1}}',
   '{"excellent": 9.0, "good": 7.0, "fair": 5.0, "poor": 3.0}'),
  ('Technical Prompt Analysis', 'technical',
   '{"clarity": ["technical_accuracy", "precise_terminology"], "completeness": ["technical_details", "edge_cases"], "structure": ["logical_flow", "proper_format"]}',
   '{"clarity": {"weight": 0.3}, "specificity": {"weight": 0.3}, "completeness": {"weight": 0.3}, "structure": {"weight": 0.1}}',
   '{"excellent": 9.0, "good": 7.0, "fair": 5.0, "poor": 3.0}')
ON CONFLICT (template_name) DO NOTHING;
