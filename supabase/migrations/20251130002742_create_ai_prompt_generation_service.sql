/*
  # AI-Powered Prompt Generation Service

  ## Overview
  Complete infrastructure for AI-powered prompt generation with:
  - LLM integration (OpenAI, Claude, etc.)
  - Generation history tracking
  - Quality scoring and ranking
  - User feedback collection
  - Request caching
  - Rate limiting and cost tracking
  - Refinement capabilities

  ## New Tables
  1. **ai_generation_requests** - User generation requests
  2. **ai_generated_candidates** - Generated prompt variations
  3. **ai_generation_feedback** - User feedback on generations
  4. **ai_request_cache** - Cached generation results
  5. **ai_usage_metrics** - API usage and cost tracking
  6. **ai_rate_limits** - User rate limiting
  7. **ai_model_configs** - LLM configuration

  ## Features
  - Multiple candidate generation
  - Quality scoring
  - Caching for cost optimization
  - Rate limiting per user
  - Cost tracking
  - Feedback loop for improvement
*/

-- =============================================================================
-- 1. AI MODEL CONFIGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_model_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model_name text NOT NULL,
  api_endpoint text,
  is_active boolean DEFAULT true,
  max_tokens integer DEFAULT 2000,
  temperature numeric(3, 2) DEFAULT 0.7,
  cost_per_1k_tokens numeric(10, 6),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_provider CHECK (provider IN ('openai', 'anthropic', 'custom')),
  CONSTRAINT unique_provider_model UNIQUE (provider, model_name)
);

-- =============================================================================
-- 2. AI GENERATION REQUESTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_generation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  workflow_description text NOT NULL,
  output_requirements jsonb DEFAULT '{}',
  tone text,
  style text,
  length text,
  constraints jsonb DEFAULT '[]',
  model_config_id uuid REFERENCES ai_model_configs(id) ON DELETE SET NULL,
  status text DEFAULT 'pending',
  error_message text,
  total_candidates integer DEFAULT 0,
  processing_time_ms integer,
  total_cost numeric(10, 6) DEFAULT 0,
  cache_hit boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cached')),
  CONSTRAINT valid_tone CHECK (tone IN ('professional', 'casual', 'formal', 'friendly', 'technical', 'creative')),
  CONSTRAINT valid_style CHECK (style IN ('concise', 'detailed', 'structured', 'conversational', 'instructional')),
  CONSTRAINT valid_length CHECK (length IN ('short', 'medium', 'long', 'very_long'))
);

-- =============================================================================
-- 3. AI GENERATED CANDIDATES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_generated_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES ai_generation_requests(id) ON DELETE CASCADE NOT NULL,
  candidate_number integer NOT NULL,
  generated_prompt text NOT NULL,
  quality_score numeric(4, 2),
  diversity_score numeric(4, 2),
  reasoning text,
  metadata jsonb DEFAULT '{}',
  tokens_used integer,
  generation_cost numeric(10, 6),
  is_selected boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_quality_score CHECK (quality_score >= 0 AND quality_score <= 100),
  CONSTRAINT valid_diversity_score CHECK (diversity_score >= 0 AND diversity_score <= 100)
);

-- =============================================================================
-- 4. AI GENERATION FEEDBACK TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_generation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES ai_generated_candidates(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  rating integer,
  feedback_type text,
  feedback_text text,
  improvements_suggested jsonb DEFAULT '[]',
  was_used boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_rating CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT valid_feedback_type CHECK (feedback_type IN ('positive', 'negative', 'neutral', 'suggestion'))
);

-- =============================================================================
-- 5. AI REQUEST CACHE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_request_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  request_params jsonb NOT NULL,
  cached_response jsonb NOT NULL,
  hit_count integer DEFAULT 0,
  last_accessed_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 6. AI USAGE METRICS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  metric_date date NOT NULL,
  requests_count integer DEFAULT 0,
  tokens_used integer DEFAULT 0,
  total_cost numeric(10, 6) DEFAULT 0,
  cache_hits integer DEFAULT 0,
  cache_misses integer DEFAULT 0,
  avg_quality_score numeric(4, 2),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_date UNIQUE (user_id, metric_date)
);

-- =============================================================================
-- 7. AI RATE LIMITS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  requests_per_hour integer DEFAULT 10,
  requests_per_day integer DEFAULT 50,
  max_tokens_per_request integer DEFAULT 4000,
  current_hour_count integer DEFAULT 0,
  current_day_count integer DEFAULT 0,
  hour_reset_at timestamptz DEFAULT now(),
  day_reset_at timestamptz DEFAULT now(),
  is_unlimited boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_ai_gen_requests_user ON ai_generation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_gen_requests_status ON ai_generation_requests(status);
CREATE INDEX IF NOT EXISTS idx_ai_gen_requests_created ON ai_generation_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_gen_requests_cache ON ai_generation_requests(cache_hit);

CREATE INDEX IF NOT EXISTS idx_ai_candidates_request ON ai_generated_candidates(request_id);
CREATE INDEX IF NOT EXISTS idx_ai_candidates_quality ON ai_generated_candidates(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_candidates_selected ON ai_generated_candidates(is_selected);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_candidate ON ai_generation_feedback(candidate_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user ON ai_generation_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_rating ON ai_generation_feedback(rating);

CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON ai_request_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_request_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_cache_hits ON ai_request_cache(hit_count DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage_metrics(metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_user ON ai_rate_limits(user_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE ai_model_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generated_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_request_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- Model configs policies
CREATE POLICY "Anyone can view active model configs"
  ON ai_model_configs FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Service role full access model configs"
  ON ai_model_configs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Generation requests policies
CREATE POLICY "Users can view own requests"
  ON ai_generation_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create requests"
  ON ai_generation_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access requests"
  ON ai_generation_requests FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Candidates policies
CREATE POLICY "Users can view candidates for own requests"
  ON ai_generated_candidates FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ai_generation_requests
      WHERE ai_generation_requests.id = ai_generated_candidates.request_id
      AND ai_generation_requests.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access candidates"
  ON ai_generated_candidates FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Feedback policies
CREATE POLICY "Users can view own feedback"
  ON ai_generation_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create feedback"
  ON ai_generation_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access feedback"
  ON ai_generation_feedback FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Cache policies
CREATE POLICY "Anyone can read cache"
  ON ai_request_cache FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role full access cache"
  ON ai_request_cache FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Usage metrics policies
CREATE POLICY "Users can view own metrics"
  ON ai_usage_metrics FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access metrics"
  ON ai_usage_metrics FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Rate limits policies
CREATE POLICY "Users can view own rate limits"
  ON ai_rate_limits FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access rate limits"
  ON ai_rate_limits FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_limits RECORD;
  v_allowed boolean := false;
  v_reason text := '';
BEGIN
  SELECT * INTO v_limits
  FROM ai_rate_limits
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO ai_rate_limits (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_limits;
  END IF;
  
  IF v_limits.is_unlimited THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'unlimited');
  END IF;
  
  IF v_limits.hour_reset_at < now() THEN
    UPDATE ai_rate_limits
    SET current_hour_count = 0, hour_reset_at = now() + interval '1 hour'
    WHERE user_id = p_user_id;
    v_limits.current_hour_count := 0;
  END IF;
  
  IF v_limits.day_reset_at < now() THEN
    UPDATE ai_rate_limits
    SET current_day_count = 0, day_reset_at = (CURRENT_DATE + interval '1 day')::timestamptz
    WHERE user_id = p_user_id;
    v_limits.current_day_count := 0;
  END IF;
  
  IF v_limits.current_hour_count >= v_limits.requests_per_hour THEN
    v_reason := 'Hourly limit exceeded';
  ELSIF v_limits.current_day_count >= v_limits.requests_per_day THEN
    v_reason := 'Daily limit exceeded';
  ELSE
    v_allowed := true;
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'reason', v_reason,
    'hourly_remaining', v_limits.requests_per_hour - v_limits.current_hour_count,
    'daily_remaining', v_limits.requests_per_day - v_limits.current_day_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment rate limit counter
CREATE OR REPLACE FUNCTION increment_rate_limit(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE ai_rate_limits
  SET 
    current_hour_count = current_hour_count + 1,
    current_day_count = current_day_count + 1,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update usage metrics
CREATE OR REPLACE FUNCTION update_ai_usage_metrics(
  p_user_id uuid,
  p_tokens integer,
  p_cost numeric,
  p_cache_hit boolean,
  p_quality_score numeric DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO ai_usage_metrics (
    user_id,
    metric_date,
    requests_count,
    tokens_used,
    total_cost,
    cache_hits,
    cache_misses,
    avg_quality_score
  ) VALUES (
    p_user_id,
    CURRENT_DATE,
    1,
    p_tokens,
    p_cost,
    CASE WHEN p_cache_hit THEN 1 ELSE 0 END,
    CASE WHEN p_cache_hit THEN 0 ELSE 1 END,
    p_quality_score
  )
  ON CONFLICT (user_id, metric_date)
  DO UPDATE SET
    requests_count = ai_usage_metrics.requests_count + 1,
    tokens_used = ai_usage_metrics.tokens_used + p_tokens,
    total_cost = ai_usage_metrics.total_cost + p_cost,
    cache_hits = ai_usage_metrics.cache_hits + CASE WHEN p_cache_hit THEN 1 ELSE 0 END,
    cache_misses = ai_usage_metrics.cache_misses + CASE WHEN p_cache_hit THEN 0 ELSE 1 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean expired cache
CREATE OR REPLACE FUNCTION clean_expired_ai_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_request_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- SEED DEFAULT MODEL CONFIGS
-- =============================================================================

INSERT INTO ai_model_configs (provider, model_name, api_endpoint, max_tokens, temperature, cost_per_1k_tokens, is_active)
VALUES
  ('openai', 'gpt-4-turbo', 'https://api.openai.com/v1/chat/completions', 4000, 0.7, 0.01, true),
  ('openai', 'gpt-3.5-turbo', 'https://api.openai.com/v1/chat/completions', 4000, 0.7, 0.002, true),
  ('anthropic', 'claude-3-opus', 'https://api.anthropic.com/v1/messages', 4000, 0.7, 0.015, true),
  ('anthropic', 'claude-3-sonnet', 'https://api.anthropic.com/v1/messages', 4000, 0.7, 0.003, true)
ON CONFLICT (provider, model_name) DO NOTHING;
