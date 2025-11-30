/*
  # Reviewer Assignment and Notification System

  ## Overview
  Comprehensive system for:
  - Automatic reviewer assignment with workload balancing
  - Manual assignment by admins
  - Email notifications with review links
  - Reminder notifications for pending reviews
  - Response time and completion tracking
  - Escalation to managers for overdue reviews
  - Workload distribution analytics

  ## New Tables
  1. **reviewer_analytics** - Track performance metrics
  2. **notification_preferences** - User notification settings
  3. **email_queue** - Outgoing email queue
  4. **escalation_rules** - Configurable escalation logic
  5. **workload_snapshots** - Historical workload data

  ## Enhancements
  - Extended reviewer_expertise with availability tracking
  - Enhanced notifications with email delivery
  - Assignment history and analytics
*/

-- =============================================================================
-- 1. REVIEWER ANALYTICS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS reviewer_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reviewer_email text NOT NULL,
  
  total_assignments integer DEFAULT 0,
  completed_reviews integer DEFAULT 0,
  pending_reviews integer DEFAULT 0,
  declined_reviews integer DEFAULT 0,
  
  average_response_time_hours numeric(10, 2),
  average_completion_time_hours numeric(10, 2),
  completion_rate numeric(5, 2),
  
  last_30_days_assignments integer DEFAULT 0,
  last_30_days_completed integer DEFAULT 0,
  
  fastest_completion_hours numeric(10, 2),
  slowest_completion_hours numeric(10, 2),
  
  overdue_count integer DEFAULT 0,
  escalated_count integer DEFAULT 0,
  
  quality_score numeric(3, 2),
  reliability_score numeric(3, 2),
  
  last_assignment_at timestamptz,
  last_completion_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_reviewer_analytics UNIQUE (reviewer_id)
);

-- =============================================================================
-- 2. NOTIFICATION PREFERENCES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email text NOT NULL,
  
  email_enabled boolean DEFAULT true,
  assignment_notifications boolean DEFAULT true,
  reminder_notifications boolean DEFAULT true,
  comment_notifications boolean DEFAULT true,
  status_notifications boolean DEFAULT true,
  
  reminder_frequency_hours integer DEFAULT 24,
  digest_enabled boolean DEFAULT false,
  digest_frequency text DEFAULT 'daily',
  
  quiet_hours_start time,
  quiet_hours_end time,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_digest_frequency CHECK (digest_frequency IN ('daily', 'weekly', 'never')),
  CONSTRAINT unique_user_preferences UNIQUE (user_id)
);

-- =============================================================================
-- 3. EMAIL QUEUE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text NOT NULL,
  
  email_type text NOT NULL,
  priority text DEFAULT 'normal',
  
  related_submission_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE,
  related_review_id uuid REFERENCES prompt_reviews(id) ON DELETE CASCADE,
  related_notification_id uuid REFERENCES submission_notifications(id) ON DELETE CASCADE,
  
  scheduled_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  
  status text DEFAULT 'pending',
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  
  error_message text,
  
  metadata jsonb DEFAULT '{}',
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_email_type CHECK (email_type IN (
    'assignment', 'reminder', 'escalation', 'status_change', 
    'comment_reply', 'digest', 'welcome', 'alert'
  )),
  CONSTRAINT valid_email_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT valid_email_status CHECK (status IN ('pending', 'sending', 'sent', 'delivered', 'failed', 'bounced'))
);

-- =============================================================================
-- 4. ESCALATION RULES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS escalation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL UNIQUE,
  
  trigger_condition text NOT NULL,
  threshold_hours integer NOT NULL,
  
  escalation_level integer NOT NULL,
  escalate_to_role text,
  escalate_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  notification_template text NOT NULL,
  email_template text NOT NULL,
  
  is_active boolean DEFAULT true,
  priority text DEFAULT 'normal',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  CONSTRAINT valid_escalation_condition CHECK (trigger_condition IN (
    'no_response', 'no_completion', 'overdue', 'declined', 'quality_issue'
  )),
  CONSTRAINT valid_escalation_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- =============================================================================
-- 5. ESCALATION LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS escalation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE NOT NULL,
  assignment_id uuid REFERENCES submission_reviewer_assignments(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  rule_id uuid REFERENCES escalation_rules(id) ON DELETE SET NULL,
  escalation_level integer NOT NULL,
  escalated_to_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  escalated_to_email text,
  
  reason text NOT NULL,
  hours_overdue numeric(10, 2),
  
  notification_sent boolean DEFAULT false,
  email_sent boolean DEFAULT false,
  
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes text,
  
  created_at timestamptz DEFAULT now(),
  
  metadata jsonb DEFAULT '{}'
);

-- =============================================================================
-- 6. WORKLOAD SNAPSHOTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS workload_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reviewer_email text NOT NULL,
  
  active_assignments integer DEFAULT 0,
  pending_reviews integer DEFAULT 0,
  overdue_reviews integer DEFAULT 0,
  
  assignments_this_week integer DEFAULT 0,
  completed_this_week integer DEFAULT 0,
  
  average_age_hours numeric(10, 2),
  oldest_assignment_hours numeric(10, 2),
  
  utilization_percentage numeric(5, 2),
  capacity_remaining integer DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_reviewer_snapshot UNIQUE (reviewer_id, snapshot_date)
);

-- =============================================================================
-- 7. ASSIGNMENT HISTORY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE NOT NULL,
  assignment_id uuid REFERENCES submission_reviewer_assignments(id) ON DELETE CASCADE,
  
  action text NOT NULL,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  assignment_method text NOT NULL,
  match_score integer,
  workload_at_assignment integer,
  
  reason text,
  metadata jsonb DEFAULT '{}',
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_assignment_action CHECK (action IN (
    'auto_assigned', 'manually_assigned', 'reassigned', 'removed', 'declined', 'accepted'
  )),
  CONSTRAINT valid_assignment_method CHECK (assignment_method IN (
    'automatic', 'manual', 'round_robin', 'load_balanced', 'expertise_match'
  ))
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_reviewer_analytics_reviewer ON reviewer_analytics(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviewer_analytics_completion_rate ON reviewer_analytics(completion_rate DESC);
CREATE INDEX IF NOT EXISTS idx_reviewer_analytics_overdue ON reviewer_analytics(overdue_count DESC);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_email_enabled ON notification_preferences(email_enabled);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_recipient ON email_queue(recipient_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_type ON email_queue(email_type);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_escalation_rules_active ON escalation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_condition ON escalation_rules(trigger_condition);

CREATE INDEX IF NOT EXISTS idx_escalation_log_submission ON escalation_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_escalation_log_reviewer ON escalation_log(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_escalation_log_resolved ON escalation_log(resolved, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workload_snapshots_reviewer ON workload_snapshots(reviewer_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_workload_snapshots_date ON workload_snapshots(snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_assignment_history_submission ON assignment_history(submission_id);
CREATE INDEX IF NOT EXISTS idx_assignment_history_assigned_to ON assignment_history(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assignment_history_method ON assignment_history(assignment_method);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE reviewer_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE workload_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own analytics" ON reviewer_analytics FOR SELECT TO authenticated USING (reviewer_id = auth.uid());
CREATE POLICY "Service full analytics" ON reviewer_analytics FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "View own preferences" ON notification_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Update own preferences" ON notification_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service full preferences" ON notification_preferences FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "View own emails" ON email_queue FOR SELECT TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY "Service full emails" ON email_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "View escalation rules" ON escalation_rules FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Service full escalation rules" ON escalation_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "View related escalations" ON escalation_log FOR SELECT TO authenticated 
  USING (reviewer_id = auth.uid() OR escalated_to_id = auth.uid());
CREATE POLICY "Service full escalation log" ON escalation_log FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "View own workload" ON workload_snapshots FOR SELECT TO authenticated USING (reviewer_id = auth.uid());
CREATE POLICY "Service full workload" ON workload_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "View related history" ON assignment_history FOR SELECT TO authenticated 
  USING (assigned_by = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY "Service full history" ON assignment_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_reviewer_analytics(p_reviewer_id uuid)
RETURNS void AS $$
DECLARE
  v_stats record;
BEGIN
  SELECT
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
    COUNT(CASE WHEN status IN ('assigned', 'acknowledged', 'in_progress') THEN 1 END) as pending,
    COUNT(CASE WHEN status = 'declined' THEN 1 END) as declined,
    AVG(EXTRACT(EPOCH FROM (acknowledged_at - assigned_at))/3600) as avg_response_time,
    AVG(EXTRACT(EPOCH FROM (completed_at - assigned_at))/3600) as avg_completion_time,
    MIN(EXTRACT(EPOCH FROM (completed_at - assigned_at))/3600) as fastest,
    MAX(EXTRACT(EPOCH FROM (completed_at - assigned_at))/3600) as slowest
  INTO v_stats
  FROM submission_reviewer_assignments
  WHERE reviewer_id = p_reviewer_id;
  
  INSERT INTO reviewer_analytics (
    reviewer_id,
    reviewer_email,
    total_assignments,
    completed_reviews,
    pending_reviews,
    declined_reviews,
    average_response_time_hours,
    average_completion_time_hours,
    completion_rate,
    fastest_completion_hours,
    slowest_completion_hours,
    updated_at
  )
  SELECT
    p_reviewer_id,
    u.email,
    v_stats.total,
    v_stats.completed,
    v_stats.pending,
    v_stats.declined,
    ROUND(v_stats.avg_response_time, 2),
    ROUND(v_stats.avg_completion_time, 2),
    ROUND((v_stats.completed::numeric / NULLIF(v_stats.total, 0) * 100), 2),
    ROUND(v_stats.fastest, 2),
    ROUND(v_stats.slowest, 2),
    now()
  FROM auth.users u
  WHERE u.id = p_reviewer_id
  ON CONFLICT (reviewer_id) DO UPDATE SET
    total_assignments = EXCLUDED.total_assignments,
    completed_reviews = EXCLUDED.completed_reviews,
    pending_reviews = EXCLUDED.pending_reviews,
    declined_reviews = EXCLUDED.declined_reviews,
    average_response_time_hours = EXCLUDED.average_response_time_hours,
    average_completion_time_hours = EXCLUDED.average_completion_time_hours,
    completion_rate = EXCLUDED.completion_rate,
    fastest_completion_hours = EXCLUDED.fastest_completion_hours,
    slowest_completion_hours = EXCLUDED.slowest_completion_hours,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_available_reviewers_balanced(
  p_expertise_area text,
  p_required_level text,
  p_limit integer DEFAULT 3
)
RETURNS TABLE(
  reviewer_id uuid,
  reviewer_email text,
  expertise_level text,
  current_workload integer,
  capacity_remaining integer,
  completion_rate numeric,
  avg_completion_time numeric,
  balance_score numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sre.reviewer_id,
    sre.reviewer_email,
    sre.expertise_level,
    sre.current_review_count,
    sre.max_concurrent_reviews - sre.current_review_count,
    COALESCE(ra.completion_rate, 0) as completion_rate,
    COALESCE(ra.average_completion_time_hours, 48) as avg_completion_time,
    (
      (sre.max_concurrent_reviews - sre.current_review_count) * 10 +
      COALESCE(ra.completion_rate, 50) +
      (100 - LEAST(COALESCE(ra.average_completion_time_hours, 48), 100)) +
      CASE WHEN sre.expertise_level = 'expert' THEN 20
           WHEN sre.expertise_level = 'senior' THEN 10
           ELSE 5 END
    ) as balance_score
  FROM submission_reviewer_expertise sre
  LEFT JOIN reviewer_analytics ra ON ra.reviewer_id = sre.reviewer_id
  WHERE sre.is_active = true
    AND sre.is_available = true
    AND sre.current_review_count < sre.max_concurrent_reviews
    AND (p_required_level = 'any' OR sre.expertise_level >= p_required_level)
    AND (p_expertise_area IS NULL OR sre.expertise_area = p_expertise_area)
  ORDER BY balance_score DESC, sre.last_review_at ASC NULLS FIRST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_overdue_reviews()
RETURNS TABLE(
  assignment_id uuid,
  submission_id uuid,
  reviewer_id uuid,
  reviewer_email text,
  hours_overdue numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sra.id,
    sra.submission_id,
    sra.reviewer_id,
    sra.reviewer_email,
    ROUND(EXTRACT(EPOCH FROM (now() - sra.assigned_at))/3600, 2) as hours_overdue
  FROM submission_reviewer_assignments sra
  JOIN prompt_submissions ps ON ps.id = sra.submission_id
  WHERE sra.status IN ('assigned', 'acknowledged', 'in_progress')
    AND EXTRACT(EPOCH FROM (now() - sra.assigned_at))/3600 > 72
  ORDER BY hours_overdue DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SEED DATA
-- =============================================================================

INSERT INTO escalation_rules (rule_name, trigger_condition, threshold_hours, escalation_level, escalate_to_role, notification_template, email_template)
VALUES
  ('No Response 24h', 'no_response', 24, 1, 'reviewer', 
   'Reminder: You have a pending review assignment', 
   '<p>You have a review that has been pending for 24 hours. Please acknowledge or complete your review.</p>'),
  ('No Response 48h', 'no_response', 48, 2, 'senior', 
   'Escalation: Review not acknowledged after 48 hours', 
   '<p>A review assignment has not been acknowledged after 48 hours and requires attention.</p>'),
  ('Overdue 72h', 'overdue', 72, 3, 'manager', 
   'Critical: Review overdue by 72 hours', 
   '<p>A critical review is overdue and needs immediate attention.</p>')
ON CONFLICT (rule_name) DO NOTHING;

INSERT INTO notification_preferences (user_id, user_email, email_enabled, assignment_notifications, reminder_notifications)
SELECT id, email, true, true, true
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM notification_preferences WHERE user_id = auth.users.id)
ON CONFLICT (user_id) DO NOTHING;
