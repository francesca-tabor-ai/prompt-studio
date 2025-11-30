/*
  # API Optimization Infrastructure

  ## Overview
  Infrastructure for API response optimization including webhooks, monitoring, and async processing.

  ## New Tables
  1. **api_response_metrics** - Track response times and sizes
  2. **webhook_subscriptions** - Webhook registrations
  3. **webhook_deliveries** - Webhook delivery logs
  4. **async_jobs** - Long-running operations
*/

-- =============================================================================
-- 1. API RESPONSE METRICS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS api_response_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  endpoint text NOT NULL,
  method text NOT NULL,
  
  response_time_ms numeric NOT NULL,
  payload_size_bytes integer NOT NULL,
  
  status_code integer NOT NULL,
  
  user_id uuid,
  
  timestamp timestamptz DEFAULT now(),
  
  compressed boolean DEFAULT false,
  compression_ratio numeric,
  
  pagination_used boolean DEFAULT false,
  fields_selected boolean DEFAULT false,
  
  metadata jsonb DEFAULT '{}'
);

-- =============================================================================
-- 2. WEBHOOK SUBSCRIPTIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id uuid NOT NULL,
  
  event_type text NOT NULL,
  
  callback_url text NOT NULL,
  
  secret_key text NOT NULL,
  
  active boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  metadata jsonb DEFAULT '{}',
  
  filters jsonb DEFAULT '{}',
  
  retry_policy jsonb DEFAULT '{"max_retries": 3, "backoff": "exponential"}'
);

-- =============================================================================
-- 3. WEBHOOK DELIVERIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  subscription_id uuid REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  
  event_type text NOT NULL,
  
  payload jsonb NOT NULL,
  
  status text DEFAULT 'pending',
  
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
  
  response_status integer,
  response_body text,
  
  delivered_at timestamptz,
  failed_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_delivery_status CHECK (status IN (
    'pending', 'delivered', 'failed', 'retrying'
  ))
);

-- =============================================================================
-- 4. ASYNC JOBS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS async_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  job_type text NOT NULL,
  
  payload jsonb NOT NULL,
  
  status text DEFAULT 'pending',
  
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  
  result jsonb,
  error_message text,
  
  progress integer DEFAULT 0,
  
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  
  webhook_url text,
  
  CONSTRAINT valid_job_status CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'cancelled'
  ))
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_api_metrics_endpoint ON api_response_metrics(endpoint, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_metrics_time ON api_response_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_metrics_slow ON api_response_metrics(response_time_ms DESC) 
  WHERE response_time_ms > 1000;

CREATE INDEX IF NOT EXISTS idx_webhook_subs_user ON webhook_subscriptions(user_id, active);
CREATE INDEX IF NOT EXISTS idx_webhook_subs_event ON webhook_subscriptions(event_type) 
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_sub ON webhook_deliveries(subscription_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending ON webhook_deliveries(next_retry_at) 
  WHERE status = 'pending' OR status = 'retrying';
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_async_jobs_status ON async_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_async_jobs_type ON async_jobs(job_type, status);
CREATE INDEX IF NOT EXISTS idx_async_jobs_user ON async_jobs(created_by, created_at DESC);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE api_response_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE async_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read api metrics" ON api_response_metrics FOR SELECT USING (true);
CREATE POLICY "Users manage own webhooks" ON webhook_subscriptions FOR ALL USING (true);
CREATE POLICY "Users view own deliveries" ON webhook_deliveries FOR SELECT USING (true);
CREATE POLICY "Users manage own jobs" ON async_jobs FOR ALL USING (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION log_api_response(
  p_endpoint text,
  p_method text,
  p_response_time_ms numeric,
  p_payload_size_bytes integer,
  p_status_code integer,
  p_compressed boolean DEFAULT false,
  p_pagination_used boolean DEFAULT false,
  p_fields_selected boolean DEFAULT false
)
RETURNS uuid AS $$
DECLARE
  v_metric_id uuid;
BEGIN
  INSERT INTO api_response_metrics (
    endpoint,
    method,
    response_time_ms,
    payload_size_bytes,
    status_code,
    compressed,
    pagination_used,
    fields_selected
  ) VALUES (
    p_endpoint,
    p_method,
    p_response_time_ms,
    p_payload_size_bytes,
    p_status_code,
    p_compressed,
    p_pagination_used,
    p_fields_selected
  )
  RETURNING id INTO v_metric_id;
  
  RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_slow_endpoints(
  p_threshold_ms numeric DEFAULT 1000,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  endpoint text,
  method text,
  avg_response_time numeric,
  max_response_time numeric,
  total_requests bigint,
  avg_payload_size numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    arm.endpoint,
    arm.method,
    AVG(arm.response_time_ms) as avg_response_time,
    MAX(arm.response_time_ms) as max_response_time,
    COUNT(*) as total_requests,
    AVG(arm.payload_size_bytes) as avg_payload_size
  FROM api_response_metrics arm
  WHERE arm.timestamp > now() - interval '24 hours'
  GROUP BY arm.endpoint, arm.method
  HAVING AVG(arm.response_time_ms) > p_threshold_ms
  ORDER BY avg_response_time DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_webhook(
  p_event_type text,
  p_payload jsonb
)
RETURNS integer AS $$
DECLARE
  v_subscription record;
  v_count integer := 0;
BEGIN
  FOR v_subscription IN
    SELECT * FROM webhook_subscriptions
    WHERE event_type = p_event_type
      AND active = true
  LOOP
    INSERT INTO webhook_deliveries (
      subscription_id,
      event_type,
      payload,
      status,
      next_retry_at
    ) VALUES (
      v_subscription.id,
      p_event_type,
      p_payload,
      'pending',
      now()
    );
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_pending_webhook_deliveries(
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  delivery_id uuid,
  subscription_id uuid,
  callback_url text,
  secret_key text,
  event_type text,
  payload jsonb,
  attempts integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wd.id as delivery_id,
    wd.subscription_id,
    ws.callback_url,
    ws.secret_key,
    wd.event_type,
    wd.payload,
    wd.attempts
  FROM webhook_deliveries wd
  JOIN webhook_subscriptions ws ON wd.subscription_id = ws.id
  WHERE (wd.status = 'pending' OR wd.status = 'retrying')
    AND wd.next_retry_at <= now()
    AND wd.attempts < wd.max_attempts
  ORDER BY wd.next_retry_at
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_async_job(
  p_job_type text,
  p_payload jsonb,
  p_created_by uuid DEFAULT NULL,
  p_webhook_url text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_job_id uuid;
BEGIN
  INSERT INTO async_jobs (
    job_type,
    payload,
    status,
    created_by,
    webhook_url
  ) VALUES (
    p_job_type,
    p_payload,
    'pending',
    p_created_by,
    p_webhook_url
  )
  RETURNING id INTO v_job_id;
  
  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_job_progress(
  p_job_id uuid,
  p_progress integer,
  p_status text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE async_jobs
  SET 
    progress = p_progress,
    status = COALESCE(p_status, status),
    started_at = CASE 
      WHEN started_at IS NULL AND p_status = 'processing' 
      THEN now() 
      ELSE started_at 
    END
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;
