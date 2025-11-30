/*
  # Report Generation Engine

  ## Overview
  Comprehensive report generation with scheduling and distribution:
  - Customizable report templates
  - Scheduled recurring reports
  - PDF and CSV exports
  - Executive summaries
  - Department/role/workflow breakdowns
  - Trend analysis and YoY comparisons
  - Email distribution
  - Report history and archival

  ## New Tables
  1. **report_templates** - Reusable report configurations
  2. **report_schedules** - Recurring report automation
  3. **report_executions** - Generated report instances
  4. **report_sections** - Report content sections
  5. **report_distributions** - Email distribution tracking
  6. **report_exports** - Export file tracking
*/

-- =============================================================================
-- 1. REPORT TEMPLATES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  template_name text NOT NULL,
  template_slug text NOT NULL UNIQUE,
  
  description text,
  category text NOT NULL,
  
  report_type text NOT NULL,
  
  metrics jsonb NOT NULL,
  visualizations jsonb DEFAULT '[]',
  
  filters jsonb DEFAULT '{}',
  
  include_executive_summary boolean DEFAULT true,
  include_trends boolean DEFAULT true,
  include_comparisons boolean DEFAULT true,
  
  breakdown_dimensions text[] DEFAULT '{}',
  
  date_range_type text DEFAULT 'last_30_days',
  
  created_by uuid,
  is_public boolean DEFAULT false,
  is_active boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_report_category CHECK (category IN (
    'performance', 'usage', 'quality', 'cost', 'satisfaction', 'productivity', 'custom'
  )),
  CONSTRAINT valid_report_type CHECK (report_type IN (
    'dashboard', 'detailed', 'executive', 'operational', 'analytical'
  )),
  CONSTRAINT valid_date_range CHECK (date_range_type IN (
    'last_7_days', 'last_30_days', 'last_90_days', 'last_quarter', 'last_year',
    'month_to_date', 'quarter_to_date', 'year_to_date', 'custom'
  ))
);

-- =============================================================================
-- 2. REPORT SCHEDULES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  schedule_name text NOT NULL,
  template_id uuid REFERENCES report_templates(id) ON DELETE CASCADE NOT NULL,
  
  frequency text NOT NULL,
  
  schedule_time time,
  schedule_day_of_week integer,
  schedule_day_of_month integer,
  
  timezone text DEFAULT 'UTC',
  
  recipients text[] NOT NULL,
  cc_recipients text[] DEFAULT '{}',
  
  export_formats text[] DEFAULT '{"pdf"}',
  
  next_run_at timestamptz,
  last_run_at timestamptz,
  
  is_active boolean DEFAULT true,
  
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_frequency CHECK (frequency IN (
    'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually'
  )),
  CONSTRAINT valid_export_formats CHECK (export_formats <@ ARRAY['pdf', 'csv', 'json', 'excel'])
);

-- =============================================================================
-- 3. REPORT EXECUTIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS report_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  template_id uuid REFERENCES report_templates(id) ON DELETE SET NULL,
  schedule_id uuid REFERENCES report_schedules(id) ON DELETE SET NULL,
  
  report_title text NOT NULL,
  report_subtitle text,
  
  execution_type text NOT NULL,
  
  date_range_start date NOT NULL,
  date_range_end date NOT NULL,
  
  status text DEFAULT 'pending',
  
  executive_summary jsonb,
  key_insights text[],
  
  data_snapshot jsonb,
  
  metrics_calculated jsonb,
  
  generated_by uuid,
  generated_at timestamptz DEFAULT now(),
  
  processing_time_seconds integer,
  
  error_message text,
  
  view_count integer DEFAULT 0,
  last_viewed_at timestamptz,
  
  archived boolean DEFAULT false,
  archived_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_execution_type CHECK (execution_type IN (
    'manual', 'scheduled', 'api'
  )),
  CONSTRAINT valid_status CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'cancelled'
  ))
);

-- =============================================================================
-- 4. REPORT SECTIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS report_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  execution_id uuid REFERENCES report_executions(id) ON DELETE CASCADE NOT NULL,
  
  section_order integer NOT NULL,
  section_type text NOT NULL,
  section_title text NOT NULL,
  
  content jsonb NOT NULL,
  
  visualization_type text,
  visualization_data jsonb,
  
  breakdown_dimension text,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_section_type CHECK (section_type IN (
    'summary', 'metrics', 'chart', 'table', 'breakdown', 'trend', 'comparison', 'insight', 'recommendation'
  )),
  CONSTRAINT valid_visualization CHECK (visualization_type IS NULL OR visualization_type IN (
    'bar_chart', 'line_chart', 'pie_chart', 'area_chart', 'table', 'scorecard', 'heatmap'
  ))
);

-- =============================================================================
-- 5. REPORT DISTRIBUTIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS report_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  execution_id uuid REFERENCES report_executions(id) ON DELETE CASCADE NOT NULL,
  
  recipient_email text NOT NULL,
  recipient_type text NOT NULL,
  
  distribution_method text DEFAULT 'email',
  
  export_format text NOT NULL,
  export_file_url text,
  
  status text DEFAULT 'pending',
  
  sent_at timestamptz,
  opened_at timestamptz,
  downloaded_at timestamptz,
  
  error_message text,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_recipient_type CHECK (recipient_type IN ('to', 'cc', 'bcc')),
  CONSTRAINT valid_distribution_method CHECK (distribution_method IN ('email', 'webhook', 'download')),
  CONSTRAINT valid_export_format CHECK (export_format IN ('pdf', 'csv', 'json', 'excel')),
  CONSTRAINT valid_distribution_status CHECK (status IN (
    'pending', 'sent', 'delivered', 'opened', 'failed', 'bounced'
  ))
);

-- =============================================================================
-- 6. REPORT EXPORTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS report_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  execution_id uuid REFERENCES report_executions(id) ON DELETE CASCADE NOT NULL,
  
  export_format text NOT NULL,
  
  file_name text NOT NULL,
  file_size_bytes bigint,
  file_url text,
  
  storage_path text,
  
  expires_at timestamptz,
  
  download_count integer DEFAULT 0,
  last_downloaded_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_export_format CHECK (export_format IN ('pdf', 'csv', 'json', 'excel'))
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_report_templates_slug ON report_templates(template_slug);
CREATE INDEX IF NOT EXISTS idx_report_templates_category ON report_templates(category, is_active);
CREATE INDEX IF NOT EXISTS idx_report_templates_created_by ON report_templates(created_by);

CREATE INDEX IF NOT EXISTS idx_report_schedules_template ON report_schedules(template_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run ON report_schedules(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_report_schedules_active ON report_schedules(is_active);

CREATE INDEX IF NOT EXISTS idx_report_executions_template ON report_executions(template_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_executions_schedule ON report_executions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_status ON report_executions(status);
CREATE INDEX IF NOT EXISTS idx_report_executions_date_range ON report_executions(date_range_start, date_range_end);
CREATE INDEX IF NOT EXISTS idx_report_executions_generated_by ON report_executions(generated_by);
CREATE INDEX IF NOT EXISTS idx_report_executions_archived ON report_executions(archived, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_sections_execution ON report_sections(execution_id, section_order);

CREATE INDEX IF NOT EXISTS idx_report_distributions_execution ON report_distributions(execution_id);
CREATE INDEX IF NOT EXISTS idx_report_distributions_recipient ON report_distributions(recipient_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_distributions_status ON report_distributions(status);

CREATE INDEX IF NOT EXISTS idx_report_exports_execution ON report_exports(execution_id);
CREATE INDEX IF NOT EXISTS idx_report_exports_expires ON report_exports(expires_at);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read templates" ON report_templates FOR SELECT USING (is_public = true OR is_active = true);
CREATE POLICY "Public read schedules" ON report_schedules FOR SELECT USING (true);
CREATE POLICY "Public read executions" ON report_executions FOR SELECT USING (true);
CREATE POLICY "Public read sections" ON report_sections FOR SELECT USING (true);
CREATE POLICY "Public read distributions" ON report_distributions FOR SELECT USING (true);
CREATE POLICY "Public read exports" ON report_exports FOR SELECT USING (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_next_run_time(
  p_frequency text,
  p_schedule_time time,
  p_day_of_week integer,
  p_day_of_month integer,
  p_current_time timestamptz DEFAULT now()
)
RETURNS timestamptz AS $$
DECLARE
  v_next_run timestamptz;
  v_base_date date;
BEGIN
  v_base_date := p_current_time::date;
  
  CASE p_frequency
    WHEN 'daily' THEN
      v_next_run := v_base_date + p_schedule_time;
      IF v_next_run <= p_current_time THEN
        v_next_run := v_next_run + INTERVAL '1 day';
      END IF;
      
    WHEN 'weekly' THEN
      v_base_date := v_base_date + ((p_day_of_week - EXTRACT(DOW FROM v_base_date)::integer + 7) % 7);
      v_next_run := v_base_date + p_schedule_time;
      IF v_next_run <= p_current_time THEN
        v_next_run := v_next_run + INTERVAL '7 days';
      END IF;
      
    WHEN 'monthly' THEN
      v_base_date := date_trunc('month', v_base_date)::date + (p_day_of_month - 1);
      v_next_run := v_base_date + p_schedule_time;
      IF v_next_run <= p_current_time THEN
        v_next_run := (date_trunc('month', v_next_run) + INTERVAL '1 month')::date + (p_day_of_month - 1) + p_schedule_time;
      END IF;
      
    ELSE
      v_next_run := p_current_time + INTERVAL '1 day';
  END CASE;
  
  RETURN v_next_run;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_executive_summary(
  p_metrics jsonb,
  p_date_range_start date,
  p_date_range_end date
)
RETURNS jsonb AS $$
DECLARE
  v_summary jsonb;
  v_highlights text[];
BEGIN
  v_highlights := ARRAY[
    format('Report period: %s to %s', p_date_range_start, p_date_range_end),
    format('Total metrics analyzed: %s', jsonb_array_length(p_metrics))
  ];
  
  v_summary := jsonb_build_object(
    'period_start', p_date_range_start,
    'period_end', p_date_range_end,
    'key_highlights', v_highlights,
    'generated_at', now()
  );
  
  RETURN v_summary;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION archive_old_reports(p_days_old integer DEFAULT 90)
RETURNS integer AS $$
DECLARE
  v_archived_count integer;
BEGIN
  UPDATE report_executions
  SET archived = true,
      archived_at = now()
  WHERE created_at < (now() - (p_days_old || ' days')::interval)
    AND archived = false
    AND status = 'completed';
  
  GET DIAGNOSTICS v_archived_count = ROW_COUNT;
  
  RETURN v_archived_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SEED DATA
-- =============================================================================

INSERT INTO report_templates (
  template_name,
  template_slug,
  description,
  category,
  report_type,
  metrics,
  breakdown_dimensions,
  date_range_type
)
VALUES
  (
    'Performance Overview',
    'performance_overview',
    'Comprehensive performance metrics across all prompts and departments',
    'performance',
    'executive',
    '["avg_accuracy", "satisfaction_rating", "sandbox_success_rate", "approval_time"]',
    ARRAY['department', 'workflow'],
    'last_30_days'
  ),
  (
    'Usage Analytics Report',
    'usage_analytics',
    'Detailed usage statistics and adoption metrics',
    'usage',
    'analytical',
    '["total_events", "unique_users", "prompt_views", "prompt_uses"]',
    ARRAY['department', 'role'],
    'last_30_days'
  ),
  (
    'Cost Analysis Report',
    'cost_analysis',
    'API usage costs and token consumption analysis',
    'cost',
    'operational',
    '["total_cost", "total_tokens", "cost_by_department", "cost_by_model"]',
    ARRAY['department'],
    'month_to_date'
  ),
  (
    'Quality Metrics Report',
    'quality_metrics',
    'Quality scores, revisions, and improvement tracking',
    'quality',
    'operational',
    '["quality_score", "revision_frequency", "flags_count", "improvement_rate"]',
    ARRAY['department', 'workflow'],
    'last_30_days'
  ),
  (
    'Executive Summary',
    'executive_summary',
    'High-level KPIs and business insights',
    'productivity',
    'executive',
    '["key_metrics", "trends", "highlights", "recommendations"]',
    ARRAY['department'],
    'last_quarter'
  )
ON CONFLICT (template_slug) DO NOTHING;
