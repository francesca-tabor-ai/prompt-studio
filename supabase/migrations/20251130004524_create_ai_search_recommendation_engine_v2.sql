/*
  # AI Search and Recommendation Engine
  Semantic search with embeddings and learning
*/

CREATE EXTENSION IF NOT EXISTS vector;

-- Prompt embeddings
CREATE TABLE IF NOT EXISTS prompt_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE NOT NULL UNIQUE,
  embedding vector(384),
  embedding_model text DEFAULT 'all-MiniLM-L6-v2',
  content_hash text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Search queries
CREATE TABLE IF NOT EXISTS search_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  query_text text NOT NULL,
  normalized_query text,
  query_embedding vector(384),
  search_type text DEFAULT 'natural_language',
  filters jsonb DEFAULT '{}',
  results_count integer DEFAULT 0,
  selected_result_id uuid,
  selected_result_rank integer,
  session_id text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_search_type CHECK (search_type IN ('natural_language', 'semantic', 'keyword', 'autocomplete'))
);

-- Search interactions
CREATE TABLE IF NOT EXISTS search_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_query_id uuid REFERENCES search_queries(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE NOT NULL,
  interaction_type text NOT NULL,
  rank_position integer,
  relevance_score numeric(5, 4),
  feedback_rating integer,
  feedback_text text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_interaction CHECK (interaction_type IN ('click', 'view', 'copy', 'save', 'rate', 'feedback')),
  CONSTRAINT valid_rating CHECK (feedback_rating IS NULL OR (feedback_rating >= 1 AND feedback_rating <= 5))
);

-- User recommendations
CREATE TABLE IF NOT EXISTS user_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE NOT NULL,
  recommendation_type text NOT NULL,
  score numeric(5, 4) NOT NULL,
  reasoning jsonb DEFAULT '{}',
  shown_count integer DEFAULT 0,
  clicked boolean DEFAULT false,
  dismissed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  CONSTRAINT valid_rec_type CHECK (recommendation_type IN ('role_based', 'activity_based', 'peer_usage', 'similar_content', 'trending'))
);

-- Autocomplete suggestions
CREATE TABLE IF NOT EXISTS autocomplete_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_text text NOT NULL UNIQUE,
  normalized_text text NOT NULL,
  search_count integer DEFAULT 1,
  click_through_rate numeric(5, 4) DEFAULT 0,
  last_searched_at timestamptz DEFAULT now(),
  is_popular boolean DEFAULT false,
  category text,
  created_at timestamptz DEFAULT now()
);

-- Search analytics
CREATE TABLE IF NOT EXISTS search_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analytics_date date NOT NULL,
  query_text text,
  search_count integer DEFAULT 0,
  unique_users integer DEFAULT 0,
  avg_results_count numeric(8, 2) DEFAULT 0,
  click_through_rate numeric(5, 4) DEFAULT 0,
  zero_results_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_date_query UNIQUE (analytics_date, query_text)
);

-- Similar prompts
CREATE TABLE IF NOT EXISTS similar_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE NOT NULL,
  similar_prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE NOT NULL,
  similarity_score numeric(5, 4) NOT NULL,
  computed_at timestamptz DEFAULT now(),
  CONSTRAINT unique_prompt_pair UNIQUE (prompt_id, similar_prompt_id),
  CONSTRAINT different_prompts CHECK (prompt_id != similar_prompt_id)
);

-- Indexes
CREATE INDEX idx_prompt_embeddings_prompt ON prompt_embeddings(prompt_id);
CREATE INDEX idx_prompt_embeddings_vector ON prompt_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_search_queries_user ON search_queries(user_id);
CREATE INDEX idx_search_queries_normalized ON search_queries(normalized_query);
CREATE INDEX idx_search_interactions_query ON search_interactions(search_query_id);
CREATE INDEX idx_search_interactions_prompt ON search_interactions(prompt_id);
CREATE INDEX idx_user_recommendations_user ON user_recommendations(user_id);
CREATE INDEX idx_autocomplete_normalized ON autocomplete_suggestions(normalized_text);
CREATE INDEX idx_autocomplete_count ON autocomplete_suggestions(search_count DESC);
CREATE INDEX idx_similar_prompts_prompt ON similar_prompts(prompt_id);

-- RLS
ALTER TABLE prompt_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE autocomplete_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE similar_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View embeddings" ON prompt_embeddings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full embeddings" ON prompt_embeddings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View own queries" ON search_queries FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Create queries" ON search_queries FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Service full queries" ON search_queries FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View own interactions" ON search_interactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Create interactions" ON search_interactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service full interactions" ON search_interactions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View own recommendations" ON user_recommendations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service full recommendations" ON user_recommendations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View autocomplete" ON autocomplete_suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full autocomplete" ON autocomplete_suggestions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View analytics" ON search_analytics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full analytics" ON search_analytics FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View similar" ON similar_prompts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full similar" ON similar_prompts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Functions
CREATE OR REPLACE FUNCTION normalize_search_query(p_query text)
RETURNS text AS $$
BEGIN
  RETURN lower(trim(regexp_replace(p_query, '\s+', ' ', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;
