/*
  # Comprehensive Search and Filter System

  ## Overview
  This migration creates a sophisticated search and filtering system with:
  - Hierarchical taxonomy for roles and departments
  - Multi-select workflow and task filters
  - Faceted search with multiple simultaneous filters
  - Full-text search capabilities
  - Saved search filters
  - Query caching for performance optimization

  ## New Tables
  1. **taxonomy_categories** - Hierarchical taxonomy structure
  2. **taxonomy_terms** - Individual taxonomy terms
  3. **prompt_taxonomy** - Links prompts to taxonomy terms
  4. **saved_searches** - User-saved search configurations
  5. **search_cache** - Query result caching
  6. **search_analytics** - Search usage tracking

  ## Features
  - Hierarchical role/department taxonomy
  - Multi-select filters
  - Full-text search with ranking
  - Faceted search
  - Saved searches
  - Query caching
  - Search analytics
*/

-- =============================================================================
-- 1. TAXONOMY CATEGORIES TABLE (Hierarchical Structure)
-- =============================================================================

CREATE TABLE IF NOT EXISTS taxonomy_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  parent_id uuid REFERENCES taxonomy_categories(id) ON DELETE CASCADE,
  category_type text NOT NULL,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_category_type CHECK (category_type IN ('role', 'department', 'workflow', 'task', 'type', 'status')),
  CONSTRAINT valid_name_length CHECK (char_length(name) >= 2 AND char_length(name) <= 100)
);

-- =============================================================================
-- 2. TAXONOMY TERMS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS taxonomy_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES taxonomy_categories(id) ON DELETE CASCADE NOT NULL,
  parent_term_id uuid REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  level integer DEFAULT 0,
  path text,
  display_order integer DEFAULT 0,
  usage_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_term_name CHECK (char_length(name) >= 2 AND char_length(name) <= 200),
  CONSTRAINT unique_term_per_category UNIQUE (category_id, slug)
);

-- =============================================================================
-- 3. PROMPT TAXONOMY TABLE (Many-to-Many Relationship)
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_taxonomy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE NOT NULL,
  term_id uuid REFERENCES taxonomy_terms(id) ON DELETE CASCADE NOT NULL,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_prompt_term UNIQUE (prompt_id, term_id)
);

-- =============================================================================
-- 4. SAVED SEARCHES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  search_config jsonb NOT NULL,
  is_default boolean DEFAULT false,
  is_shared boolean DEFAULT false,
  usage_count integer DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_search_name CHECK (char_length(name) >= 3 AND char_length(name) <= 200)
);

-- =============================================================================
-- 5. SEARCH CACHE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  search_params jsonb NOT NULL,
  result_data jsonb NOT NULL,
  result_count integer NOT NULL,
  hit_count integer DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 6. SEARCH ANALYTICS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS search_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  search_query text,
  filters_applied jsonb DEFAULT '{}',
  results_count integer DEFAULT 0,
  selected_result_id uuid,
  search_duration_ms integer,
  created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 7. FILTER FACETS TABLE (For faceted search counts)
-- =============================================================================

CREATE TABLE IF NOT EXISTS filter_facets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facet_type text NOT NULL,
  facet_value text NOT NULL,
  prompt_count integer DEFAULT 0,
  last_computed_at timestamptz DEFAULT now(),
  CONSTRAINT unique_facet UNIQUE (facet_type, facet_value)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_taxonomy_categories_type ON taxonomy_categories(category_type);
CREATE INDEX IF NOT EXISTS idx_taxonomy_categories_parent ON taxonomy_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_categories_active ON taxonomy_categories(is_active);

CREATE INDEX IF NOT EXISTS idx_taxonomy_terms_category ON taxonomy_terms(category_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_terms_parent ON taxonomy_terms(parent_term_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_terms_level ON taxonomy_terms(level);
CREATE INDEX IF NOT EXISTS idx_taxonomy_terms_path ON taxonomy_terms(path);
CREATE INDEX IF NOT EXISTS idx_taxonomy_terms_usage ON taxonomy_terms(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_taxonomy_terms_active ON taxonomy_terms(is_active);

CREATE INDEX IF NOT EXISTS idx_prompt_taxonomy_prompt ON prompt_taxonomy(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_taxonomy_term ON prompt_taxonomy(term_id);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_default ON saved_searches(is_default);
CREATE INDEX IF NOT EXISTS idx_saved_searches_usage ON saved_searches(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_search_cache_key ON search_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON search_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_search_cache_hits ON search_cache(hit_count DESC);

CREATE INDEX IF NOT EXISTS idx_search_analytics_user ON search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created ON search_analytics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_filter_facets_type ON filter_facets(facet_type);
CREATE INDEX IF NOT EXISTS idx_filter_facets_count ON filter_facets(prompt_count DESC);

CREATE INDEX IF NOT EXISTS idx_prompts_fulltext ON prompts USING gin(to_tsvector('english', title || ' ' || description || ' ' || content));

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE taxonomy_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_taxonomy ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE filter_facets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active taxonomy categories"
  ON taxonomy_categories FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Service role full access taxonomy categories"
  ON taxonomy_categories FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can view active taxonomy terms"
  ON taxonomy_terms FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Service role full access taxonomy terms"
  ON taxonomy_terms FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view prompt taxonomy for accessible prompts"
  ON prompt_taxonomy FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM prompts
      WHERE prompts.id = prompt_taxonomy.prompt_id
      AND (prompts.visibility = 'public' OR prompts.author_id = auth.uid())
    )
  );

CREATE POLICY "Service role full access prompt taxonomy"
  ON prompt_taxonomy FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own saved searches"
  ON saved_searches FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_shared = true);

CREATE POLICY "Users can create own saved searches"
  ON saved_searches FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own saved searches"
  ON saved_searches FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own saved searches"
  ON saved_searches FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Anyone can read search cache"
  ON search_cache FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role full access search cache"
  ON search_cache FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own search analytics"
  ON search_analytics FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access search analytics"
  ON search_analytics FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can view filter facets"
  ON filter_facets FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role full access filter facets"
  ON filter_facets FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to compute filter facets
CREATE OR REPLACE FUNCTION compute_filter_facets()
RETURNS void AS $$
BEGIN
  TRUNCATE filter_facets;

  INSERT INTO filter_facets (facet_type, facet_value, prompt_count)
  SELECT 'role', p.role, COUNT(*)
  FROM prompts p
  WHERE p.is_archived = false AND p.role IS NOT NULL AND p.role != ''
  GROUP BY p.role;

  INSERT INTO filter_facets (facet_type, facet_value, prompt_count)
  SELECT 'department', p.department, COUNT(*)
  FROM prompts p
  WHERE p.is_archived = false AND p.department IS NOT NULL AND p.department != ''
  GROUP BY p.department;

  INSERT INTO filter_facets (facet_type, facet_value, prompt_count)
  SELECT 'workflow', p.workflow, COUNT(*)
  FROM prompts p
  WHERE p.is_archived = false AND p.workflow IS NOT NULL AND p.workflow != ''
  GROUP BY p.workflow;

  INSERT INTO filter_facets (facet_type, facet_value, prompt_count)
  SELECT 'type', p.prompt_type, COUNT(*)
  FROM prompts p
  WHERE p.is_archived = false AND p.prompt_type IS NOT NULL AND p.prompt_type != ''
  GROUP BY p.prompt_type;

  INSERT INTO filter_facets (facet_type, facet_value, prompt_count)
  SELECT 'status', p.status, COUNT(*)
  FROM prompts p
  WHERE p.is_archived = false AND p.status IS NOT NULL AND p.status != ''
  GROUP BY p.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM search_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update taxonomy term usage count
CREATE OR REPLACE FUNCTION update_taxonomy_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE taxonomy_terms
  SET usage_count = (
    SELECT COUNT(*) FROM prompt_taxonomy WHERE term_id = NEW.term_id
  )
  WHERE id = NEW.term_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_taxonomy_usage_trigger') THEN
    CREATE TRIGGER update_taxonomy_usage_trigger
      AFTER INSERT ON prompt_taxonomy
      FOR EACH ROW EXECUTE FUNCTION update_taxonomy_usage();
  END IF;
END $$;
