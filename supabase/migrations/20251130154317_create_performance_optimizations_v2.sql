/*
  # Database Performance Optimizations

  ## Overview
  Performance indexes, query monitoring, and optimization utilities.
*/

-- =============================================================================
-- QUERY STATISTICS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS query_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_name text NOT NULL,
  query_text text,
  execution_time_ms numeric,
  rows_returned integer,
  timestamp timestamptz DEFAULT now(),
  user_id uuid,
  cache_hit boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_query_stats_name ON query_statistics(query_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_query_stats_slow ON query_statistics(execution_time_ms DESC) 
  WHERE execution_time_ms > 1000;

-- =============================================================================
-- QUERY CACHE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS query_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  query_result jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  hit_count integer DEFAULT 0,
  last_accessed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_query_cache_key ON query_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_query_cache_expires ON query_cache(expires_at);

-- =============================================================================
-- CONNECTION POOL STATISTICS
-- =============================================================================

CREATE TABLE IF NOT EXISTS connection_pool_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz DEFAULT now(),
  total_connections integer,
  active_connections integer,
  idle_connections integer,
  waiting_connections integer
);

CREATE INDEX IF NOT EXISTS idx_conn_pool_stats_time ON connection_pool_stats(timestamp DESC);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION log_query_performance(
  p_query_name text,
  p_query_text text,
  p_execution_time_ms numeric,
  p_rows_returned integer,
  p_user_id uuid DEFAULT NULL,
  p_cache_hit boolean DEFAULT false
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO query_statistics (
    query_name,
    query_text,
    execution_time_ms,
    rows_returned,
    user_id,
    cache_hit
  ) VALUES (
    p_query_name,
    p_query_text,
    p_execution_time_ms,
    p_rows_returned,
    p_user_id,
    p_cache_hit
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_slow_queries(
  p_threshold_ms numeric DEFAULT 1000,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  query_name text,
  avg_execution_time numeric,
  max_execution_time numeric,
  total_executions bigint,
  cache_hit_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qs.query_name,
    AVG(qs.execution_time_ms) as avg_execution_time,
    MAX(qs.execution_time_ms) as max_execution_time,
    COUNT(*) as total_executions,
    (COUNT(*) FILTER (WHERE qs.cache_hit = true)::numeric / NULLIF(COUNT(*)::numeric, 0) * 100) as cache_hit_rate
  FROM query_statistics qs
  WHERE qs.execution_time_ms > p_threshold_ms
    AND qs.timestamp > now() - interval '7 days'
  GROUP BY qs.query_name
  ORDER BY avg_execution_time DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS integer AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM query_cache
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE query_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_pool_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read stats" ON query_statistics FOR SELECT USING (true);
CREATE POLICY "Public read cache" ON query_cache FOR SELECT USING (true);
CREATE POLICY "Public read pool stats" ON connection_pool_stats FOR SELECT USING (true);
