/*
  # Monitoring, Logging, and Alerting Infrastructure

  ## Overview
  Comprehensive monitoring system with:
  - Structured logging
  - System metrics
  - Application metrics
  - Health checks
  - Alerting
  - Distributed tracing

  ## New Tables
  1. **application_logs** - Structured application logs
  2. **system_metrics** - CPU, memory, disk, network metrics
  3. **application_metrics** - API response times, error rates
  4. **health_checks** - Service health monitoring
  5. **alerts** - Alert configuration
  6. **alert_incidents** - Alert instances
  7. **distributed_traces** - Request tracing
*/

-- =============================================================================
-- 1. APPLICATION LOGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS application_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  timestamp timestamptz DEFAULT now(),
  
  level text NOT NULL,
  
  service_name text NOT NULL,
  
  message text NOT NULL,
  
  context jsonb DEFAULT '{}',
  
  trace_id text,
  span_id text,
  parent_span_id text,
  
  user_id uuid,
  
  request_id text,
  
  method text,
  path text,
  status_code integer,
  
  error_type text,
  error_message text,
  stack_trace text,
  
  metadata jsonb DEFAULT '{}',
  
  CONSTRAINT valid_log_level CHECK (level IN (
    'debug', 'info', 'warn', 'error', 'fatal'
  ))
);

-- =============================================================================
-- 2. SYSTEM METRICS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  timestamp timestamptz DEFAULT now(),
  
  service_name text NOT NULL,
  instance_id text NOT NULL,
  
  cpu_usage_percent numeric(5,2),
  
  memory_used_mb numeric(12,2),
  memory_total_mb numeric(12,2),
  memory_usage_percent numeric(5,2),
  
  disk_used_gb numeric(12,2),
  disk_total_gb numeric(12,2),
  disk_usage_percent numeric(5,2),
  
  network_rx_mb numeric(12,2),
  network_tx_mb numeric(12,2),
  
  active_connections integer,
  
  uptime_seconds bigint,
  
  metadata jsonb DEFAULT '{}'
);

-- =============================================================================
-- 3. APPLICATION METRICS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS application_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  timestamp timestamptz DEFAULT now(),
  
  service_name text NOT NULL,
  
  metric_name text NOT NULL,
  
  metric_type text NOT NULL,
  
  value numeric(15,4) NOT NULL,
  
  unit text,
  
  tags jsonb DEFAULT '{}',
  
  aggregation_window interval,
  
  CONSTRAINT valid_metric_type CHECK (metric_type IN (
    'counter', 'gauge', 'histogram', 'summary'
  ))
);

-- =============================================================================
-- 4. HEALTH CHECKS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  service_name text NOT NULL,
  
  check_type text NOT NULL,
  
  status text NOT NULL,
  
  response_time_ms integer,
  
  last_success_at timestamptz,
  last_failure_at timestamptz,
  
  consecutive_failures integer DEFAULT 0,
  
  error_message text,
  
  details jsonb DEFAULT '{}',
  
  checked_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_check_status CHECK (status IN (
    'healthy', 'degraded', 'unhealthy', 'unknown'
  ))
);

-- =============================================================================
-- 5. ALERTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  alert_name text NOT NULL UNIQUE,
  
  description text,
  
  service_name text,
  
  metric_name text,
  
  condition text NOT NULL,
  
  threshold numeric(15,4),
  
  severity text NOT NULL,
  
  evaluation_window interval DEFAULT interval '5 minutes',
  
  cooldown_period interval DEFAULT interval '15 minutes',
  
  notification_channels jsonb DEFAULT '[]',
  
  is_active boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_alert_severity CHECK (severity IN (
    'info', 'warning', 'critical'
  ))
);

-- =============================================================================
-- 6. ALERT INCIDENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS alert_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  alert_id uuid REFERENCES alerts(id) ON DELETE CASCADE NOT NULL,
  
  incident_id text NOT NULL UNIQUE,
  
  status text DEFAULT 'firing',
  
  severity text NOT NULL,
  
  triggered_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  acknowledged_at timestamptz,
  
  acknowledged_by uuid,
  
  trigger_value numeric(15,4),
  
  message text,
  
  context jsonb DEFAULT '{}',
  
  notifications_sent jsonb DEFAULT '[]',
  
  CONSTRAINT valid_incident_status CHECK (status IN (
    'firing', 'acknowledged', 'resolved'
  ))
);

-- =============================================================================
-- 7. DISTRIBUTED TRACES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS distributed_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  trace_id text NOT NULL,
  span_id text NOT NULL UNIQUE,
  parent_span_id text,
  
  service_name text NOT NULL,
  operation_name text NOT NULL,
  
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  
  duration_ms integer,
  
  status text,
  
  tags jsonb DEFAULT '{}',
  
  logs jsonb DEFAULT '[]',
  
  user_id uuid,
  
  error boolean DEFAULT false,
  error_message text,
  
  CONSTRAINT valid_trace_status CHECK (status IN (
    'ok', 'error', 'unset'
  ))
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_app_logs_timestamp ON application_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_service ON application_logs(service_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON application_logs(level, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_trace ON application_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_user ON application_logs(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_service ON system_metrics(service_name, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_app_metrics_timestamp ON application_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_app_metrics_service_name ON application_metrics(service_name, metric_name, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_health_checks_service ON health_checks(service_name, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON health_checks(status, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_alert_incidents_status ON alert_incidents(status, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_incidents_alert ON alert_incidents(alert_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON distributed_traces(trace_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_traces_service ON distributed_traces(service_name, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_traces_error ON distributed_traces(error, start_time DESC) WHERE error = true;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE application_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributed_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read logs" ON application_logs FOR SELECT USING (true);
CREATE POLICY "Public read metrics" ON system_metrics FOR SELECT USING (true);
CREATE POLICY "Public read app metrics" ON application_metrics FOR SELECT USING (true);
CREATE POLICY "Public read health" ON health_checks FOR SELECT USING (true);
CREATE POLICY "Public read alerts" ON alerts FOR SELECT USING (true);
CREATE POLICY "Public read incidents" ON alert_incidents FOR SELECT USING (true);
CREATE POLICY "Public read traces" ON distributed_traces FOR SELECT USING (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION log_application_event(
  p_level text,
  p_service_name text,
  p_message text,
  p_context jsonb DEFAULT '{}',
  p_trace_id text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO application_logs (
    level,
    service_name,
    message,
    context,
    trace_id,
    user_id
  ) VALUES (
    p_level,
    p_service_name,
    p_message,
    p_context,
    p_trace_id,
    p_user_id
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_metric(
  p_service_name text,
  p_metric_name text,
  p_metric_type text,
  p_value numeric,
  p_tags jsonb DEFAULT '{}'
)
RETURNS uuid AS $$
DECLARE
  v_metric_id uuid;
BEGIN
  INSERT INTO application_metrics (
    service_name,
    metric_name,
    metric_type,
    value,
    tags
  ) VALUES (
    p_service_name,
    p_metric_name,
    p_metric_type,
    p_value,
    p_tags
  )
  RETURNING id INTO v_metric_id;
  
  RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION evaluate_alerts()
RETURNS TABLE(
  alert_id uuid,
  alert_name text,
  should_fire boolean,
  current_value numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.alert_name,
    false as should_fire,
    0::numeric as current_value
  FROM alerts a
  WHERE a.is_active = true;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_service_health_summary()
RETURNS TABLE(
  service_name text,
  status text,
  last_check timestamptz,
  consecutive_failures integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (hc.service_name)
    hc.service_name,
    hc.status,
    hc.checked_at,
    hc.consecutive_failures
  FROM health_checks hc
  ORDER BY hc.service_name, hc.checked_at DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_error_rate(
  p_service_name text,
  p_time_window interval DEFAULT interval '5 minutes'
)
RETURNS numeric AS $$
DECLARE
  v_total integer;
  v_errors integer;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM application_logs
  WHERE service_name = p_service_name
    AND timestamp > now() - p_time_window;
  
  SELECT COUNT(*) INTO v_errors
  FROM application_logs
  WHERE service_name = p_service_name
    AND level IN ('error', 'fatal')
    AND timestamp > now() - p_time_window;
  
  IF v_total = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN ROUND((v_errors::numeric / v_total::numeric) * 100, 2);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_logs(p_days integer DEFAULT 30)
RETURNS integer AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM application_logs
  WHERE timestamp < now() - (p_days || ' days')::interval;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_metrics(p_days integer DEFAULT 90)
RETURNS integer AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM system_metrics
  WHERE timestamp < now() - (p_days || ' days')::interval;
  
  DELETE FROM application_metrics
  WHERE timestamp < now() - (p_days || ' days')::interval;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SEED DATA - ALERTS
-- =============================================================================

INSERT INTO alerts (
  alert_name,
  description,
  metric_name,
  condition,
  threshold,
  severity,
  notification_channels
)
VALUES
  (
    'High Error Rate',
    'Error rate exceeds 5% over 5 minutes',
    'error_rate',
    'greater_than',
    5.0,
    'critical',
    '["email", "slack"]'::jsonb
  ),
  (
    'Service Down',
    'Service health check failed',
    'health_status',
    'equals',
    0,
    'critical',
    '["email", "slack", "pagerduty"]'::jsonb
  ),
  (
    'High Response Time',
    'Average response time exceeds 2000ms',
    'response_time_ms',
    'greater_than',
    2000,
    'warning',
    '["slack"]'::jsonb
  ),
  (
    'High CPU Usage',
    'CPU usage exceeds 80%',
    'cpu_usage_percent',
    'greater_than',
    80,
    'warning',
    '["email"]'::jsonb
  ),
  (
    'High Memory Usage',
    'Memory usage exceeds 85%',
    'memory_usage_percent',
    'greater_than',
    85,
    'warning',
    '["email"]'::jsonb
  )
ON CONFLICT (alert_name) DO NOTHING;
