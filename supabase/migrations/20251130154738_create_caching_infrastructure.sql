/*
  # Multi-Layer Caching Infrastructure

  ## Overview
  Comprehensive caching system with in-memory, distributed, and monitoring capabilities.

  ## New Tables
  1. **cache_entries** - Cache data storage
  2. **cache_statistics** - Cache performance metrics
  3. **cache_invalidation_log** - Invalidation tracking
  4. **cache_warming_config** - Pre-warming configuration
*/

-- =============================================================================
-- 1. CACHE ENTRIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS cache_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  cache_key text NOT NULL UNIQUE,
  
  cache_value jsonb NOT NULL,
  
  cache_layer text DEFAULT 'memory',
  
  version integer DEFAULT 1,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  expires_at timestamptz NOT NULL,
  
  hit_count integer DEFAULT 0,
  last_accessed_at timestamptz DEFAULT now(),
  
  tags jsonb DEFAULT '[]',
  
  metadata jsonb DEFAULT '{}',
  
  CONSTRAINT valid_cache_layer CHECK (cache_layer IN (
    'memory', 'distributed', 'database'
  ))
);

-- =============================================================================
-- 2. CACHE STATISTICS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS cache_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  timestamp timestamptz DEFAULT now(),
  
  cache_layer text NOT NULL,
  
  total_keys integer DEFAULT 0,
  
  hit_count bigint DEFAULT 0,
  miss_count bigint DEFAULT 0,
  
  hit_rate numeric,
  
  avg_response_time_ms numeric,
  
  memory_usage_bytes bigint,
  
  eviction_count integer DEFAULT 0,
  
  CONSTRAINT valid_stats_layer CHECK (cache_layer IN (
    'memory', 'distributed', 'database', 'overall'
  ))
);

-- =============================================================================
-- 3. CACHE INVALIDATION LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS cache_invalidation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  invalidated_at timestamptz DEFAULT now(),
  
  cache_key text,
  key_pattern text,
  
  invalidation_reason text NOT NULL,
  
  invalidation_type text NOT NULL,
  
  affected_keys integer DEFAULT 0,
  
  triggered_by uuid,
  
  metadata jsonb DEFAULT '{}',
  
  CONSTRAINT valid_invalidation_type CHECK (invalidation_type IN (
    'ttl', 'manual', 'event', 'version', 'pattern', 'tag'
  ))
);

-- =============================================================================
-- 4. CACHE WARMING CONFIG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS cache_warming_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  config_name text NOT NULL UNIQUE,
  
  cache_key_pattern text NOT NULL,
  
  query_function text NOT NULL,
  
  query_params jsonb DEFAULT '{}',
  
  warm_on_startup boolean DEFAULT true,
  warm_on_schedule boolean DEFAULT false,
  schedule_interval interval DEFAULT interval '1 hour',
  
  last_warmed_at timestamptz,
  
  priority integer DEFAULT 0,
  
  enabled boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 5. CACHE TAGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS cache_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  tag_name text NOT NULL,
  
  cache_key text NOT NULL,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_tag_key UNIQUE (tag_name, cache_key)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_cache_entries_key ON cache_entries(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_entries_expires ON cache_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_entries_version ON cache_entries(cache_key, version DESC);
CREATE INDEX IF NOT EXISTS idx_cache_entries_tags ON cache_entries USING gin(tags);

CREATE INDEX IF NOT EXISTS idx_cache_stats_time ON cache_statistics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cache_stats_layer ON cache_statistics(cache_layer, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_cache_invalidation_time ON cache_invalidation_log(invalidated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_key ON cache_invalidation_log(cache_key);

CREATE INDEX IF NOT EXISTS idx_cache_warming_enabled ON cache_warming_config(enabled, priority DESC) 
  WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_cache_tags_name ON cache_tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_cache_tags_key ON cache_tags(cache_key);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE cache_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_invalidation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_warming_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read cache entries" ON cache_entries FOR SELECT USING (true);
CREATE POLICY "Public read cache stats" ON cache_statistics FOR SELECT USING (true);
CREATE POLICY "Public read invalidation log" ON cache_invalidation_log FOR SELECT USING (true);
CREATE POLICY "Public read warming config" ON cache_warming_config FOR SELECT USING (true);
CREATE POLICY "Public read tags" ON cache_tags FOR SELECT USING (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS integer AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM cache_entries
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  INSERT INTO cache_invalidation_log (
    invalidation_reason,
    invalidation_type,
    affected_keys
  ) VALUES (
    'Automatic TTL expiration',
    'ttl',
    v_deleted
  );
  
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION invalidate_cache_by_pattern(
  p_pattern text,
  p_reason text DEFAULT 'Pattern-based invalidation'
)
RETURNS integer AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM cache_entries
  WHERE cache_key LIKE p_pattern;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  INSERT INTO cache_invalidation_log (
    key_pattern,
    invalidation_reason,
    invalidation_type,
    affected_keys
  ) VALUES (
    p_pattern,
    p_reason,
    'pattern',
    v_deleted
  );
  
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION invalidate_cache_by_tag(
  p_tag text,
  p_reason text DEFAULT 'Tag-based invalidation'
)
RETURNS integer AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM cache_entries
  WHERE id IN (
    SELECT DISTINCT ce.id
    FROM cache_entries ce
    WHERE ce.tags @> to_jsonb(ARRAY[p_tag])
  );
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  DELETE FROM cache_tags WHERE tag_name = p_tag;
  
  INSERT INTO cache_invalidation_log (
    key_pattern,
    invalidation_reason,
    invalidation_type,
    affected_keys
  ) VALUES (
    'tag:' || p_tag,
    p_reason,
    'tag',
    v_deleted
  );
  
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION record_cache_access(
  p_cache_key text,
  p_hit boolean
)
RETURNS void AS $$
BEGIN
  IF p_hit THEN
    UPDATE cache_entries
    SET hit_count = hit_count + 1,
        last_accessed_at = now()
    WHERE cache_key = p_cache_key;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_cache_statistics(
  p_layer text DEFAULT 'overall'
)
RETURNS TABLE(
  total_keys bigint,
  hit_count bigint,
  miss_count bigint,
  hit_rate numeric,
  avg_response_time numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT cs.id)::bigint as total_keys,
    SUM(cs.hit_count) as hit_count,
    SUM(cs.miss_count) as miss_count,
    CASE 
      WHEN SUM(cs.hit_count + cs.miss_count) > 0 
      THEN (SUM(cs.hit_count)::numeric / SUM(cs.hit_count + cs.miss_count)::numeric * 100)
      ELSE 0
    END as hit_rate,
    AVG(cs.avg_response_time_ms) as avg_response_time
  FROM cache_statistics cs
  WHERE cs.cache_layer = p_layer OR p_layer = 'overall'
    AND cs.timestamp > now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_cache_warming_jobs()
RETURNS TABLE(
  config_name text,
  cache_key_pattern text,
  last_warmed_at timestamptz,
  priority integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cwc.config_name,
    cwc.cache_key_pattern,
    cwc.last_warmed_at,
    cwc.priority
  FROM cache_warming_config cwc
  WHERE cwc.enabled = true
    AND (
      cwc.warm_on_startup = true
      OR (
        cwc.warm_on_schedule = true
        AND (
          cwc.last_warmed_at IS NULL
          OR cwc.last_warmed_at + cwc.schedule_interval < now()
        )
      )
    )
  ORDER BY cwc.priority DESC;
END;
$$ LANGUAGE plpgsql;
