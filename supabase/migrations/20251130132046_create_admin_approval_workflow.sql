/*
  # Admin Approval Workflow System

  ## Overview
  Comprehensive admin-controlled prompt approval workflow:
  - Approval queue management
  - Admin review interface
  - Bulk approval/rejection
  - Revision requests
  - Approval history tracking
  - Notification system
  - Conditional approvals
  - SLA tracking and compliance

  ## New Tables
  1. **approval_queue** - Prompts awaiting approval
  2. **approval_actions** - Admin actions and decisions
  3. **approval_history** - Complete audit trail
  4. **revision_requests** - Admin feedback and changes needed
  5. **approval_notifications** - Notification queue
  6. **approval_sla_config** - SLA settings
  7. **approval_sla_tracking** - SLA compliance monitoring
*/

-- =============================================================================
-- 1. APPROVAL QUEUE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS approval_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  prompt_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE NOT NULL,
  
  queue_status text DEFAULT 'pending',
  
  submission_type text DEFAULT 'new',
  
  priority integer DEFAULT 5,
  
  submitted_by uuid NOT NULL,
  submitted_at timestamptz DEFAULT now(),
  
  assigned_to uuid,
  assigned_at timestamptz,
  
  department text,
  workflow text,
  tags text[],
  
  requires_testing boolean DEFAULT false,
  requires_peer_review boolean DEFAULT false,
  
  peer_review_completed boolean DEFAULT false,
  testing_completed boolean DEFAULT false,
  
  sla_deadline timestamptz,
  is_sla_breached boolean DEFAULT false,
  
  flagged_for_review boolean DEFAULT false,
  flag_reason text,
  
  metadata jsonb DEFAULT '{}',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_queue_status CHECK (queue_status IN (
    'pending', 'in_review', 'revision_requested', 'testing', 
    'approved', 'rejected', 'withdrawn', 'expired'
  )),
  CONSTRAINT valid_submission_type CHECK (submission_type IN (
    'new', 'revision', 'update', 'resubmission'
  )),
  CONSTRAINT unique_prompt_queue UNIQUE (prompt_id)
);

-- =============================================================================
-- 2. APPROVAL ACTIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS approval_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  queue_id uuid REFERENCES approval_queue(id) ON DELETE CASCADE NOT NULL,
  prompt_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE NOT NULL,
  
  action_type text NOT NULL,
  
  decision text NOT NULL,
  
  admin_id uuid NOT NULL,
  admin_email text,
  
  reason text,
  comments text,
  
  conditions jsonb,
  
  approval_scope text DEFAULT 'full',
  restricted_to_departments text[],
  restricted_to_workflows text[],
  
  requires_changes boolean DEFAULT false,
  requested_changes text[],
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_action_type CHECK (action_type IN (
    'approve', 'reject', 'request_revision', 'assign', 
    'escalate', 'defer', 'withdraw'
  )),
  CONSTRAINT valid_decision CHECK (decision IN (
    'approved', 'rejected', 'revision_needed', 'escalated', 
    'deferred', 'withdrawn', 'conditionally_approved'
  )),
  CONSTRAINT valid_approval_scope CHECK (approval_scope IN (
    'full', 'department', 'workflow', 'role', 'conditional'
  ))
);

-- =============================================================================
-- 3. APPROVAL HISTORY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  prompt_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE NOT NULL,
  queue_id uuid REFERENCES approval_queue(id) ON DELETE SET NULL,
  
  status_from text NOT NULL,
  status_to text NOT NULL,
  
  changed_by uuid NOT NULL,
  changed_by_email text,
  
  action_taken text NOT NULL,
  
  reason text,
  details jsonb,
  
  time_in_previous_status interval,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_action_taken CHECK (action_taken IN (
    'submitted', 'assigned', 'approved', 'rejected', 'revision_requested',
    'resubmitted', 'testing_started', 'testing_completed', 'escalated',
    'expired', 'withdrawn'
  ))
);

-- =============================================================================
-- 4. REVISION REQUESTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS revision_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  prompt_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE NOT NULL,
  queue_id uuid REFERENCES approval_queue(id) ON DELETE CASCADE NOT NULL,
  
  requested_by uuid NOT NULL,
  requested_by_email text,
  
  revision_type text NOT NULL,
  
  requested_changes text[] NOT NULL,
  
  detailed_feedback text,
  
  priority text DEFAULT 'normal',
  
  due_date timestamptz,
  
  status text DEFAULT 'pending',
  
  completed_at timestamptz,
  completed_by uuid,
  
  response_notes text,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_revision_type CHECK (revision_type IN (
    'content', 'formatting', 'testing', 'documentation', 
    'metadata', 'tags', 'other'
  )),
  CONSTRAINT valid_revision_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT valid_revision_status CHECK (status IN (
    'pending', 'in_progress', 'completed', 'declined', 'cancelled'
  ))
);

-- =============================================================================
-- 5. APPROVAL NOTIFICATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS approval_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  notification_type text NOT NULL,
  
  recipient_id uuid NOT NULL,
  recipient_email text NOT NULL,
  
  subject text NOT NULL,
  message text NOT NULL,
  
  prompt_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE,
  queue_id uuid REFERENCES approval_queue(id) ON DELETE SET NULL,
  
  action_url text,
  
  priority text DEFAULT 'normal',
  
  status text DEFAULT 'pending',
  
  sent_at timestamptz,
  read_at timestamptz,
  
  metadata jsonb DEFAULT '{}',
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_notification_type CHECK (notification_type IN (
    'approval_granted', 'approval_rejected', 'revision_requested',
    'assigned_for_review', 'sla_warning', 'sla_breach',
    'peer_review_complete', 'testing_complete', 'escalated'
  )),
  CONSTRAINT valid_notification_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT valid_notification_status CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed'))
);

-- =============================================================================
-- 6. APPROVAL SLA CONFIG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS approval_sla_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  config_name text NOT NULL UNIQUE,
  
  department text,
  workflow text,
  priority_level integer,
  
  target_hours integer NOT NULL,
  warning_threshold_hours integer,
  
  escalation_enabled boolean DEFAULT false,
  escalate_to_roles text[],
  
  business_hours_only boolean DEFAULT false,
  
  is_active boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 7. APPROVAL SLA TRACKING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS approval_sla_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  queue_id uuid REFERENCES approval_queue(id) ON DELETE CASCADE NOT NULL,
  prompt_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE NOT NULL,
  
  sla_config_id uuid REFERENCES approval_sla_config(id) ON DELETE SET NULL,
  
  target_completion_at timestamptz NOT NULL,
  warning_threshold_at timestamptz,
  
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  
  time_elapsed_hours numeric(10, 2),
  
  is_within_sla boolean,
  breach_time_hours numeric(10, 2),
  
  warning_sent boolean DEFAULT false,
  warning_sent_at timestamptz,
  
  breach_notified boolean DEFAULT false,
  breach_notified_at timestamptz,
  
  paused_at timestamptz,
  pause_reason text,
  total_pause_time interval DEFAULT '0 seconds',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_queue_sla UNIQUE (queue_id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_approval_queue_status ON approval_queue(queue_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_queue_priority ON approval_queue(priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_queue_assigned ON approval_queue(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_approval_queue_sla ON approval_queue(sla_deadline) WHERE sla_deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_approval_queue_breached ON approval_queue(is_sla_breached) WHERE is_sla_breached = true;
CREATE INDEX IF NOT EXISTS idx_approval_queue_department ON approval_queue(department, queue_status);

CREATE INDEX IF NOT EXISTS idx_approval_actions_queue ON approval_actions(queue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_actions_admin ON approval_actions(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_actions_decision ON approval_actions(decision);

CREATE INDEX IF NOT EXISTS idx_approval_history_prompt ON approval_history(prompt_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_history_queue ON approval_history(queue_id);

CREATE INDEX IF NOT EXISTS idx_revision_requests_prompt ON revision_requests(prompt_id, status);
CREATE INDEX IF NOT EXISTS idx_revision_requests_status ON revision_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_notifications_recipient ON approval_notifications(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_notifications_status ON approval_notifications(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sla_tracking_queue ON approval_sla_tracking(queue_id);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_breach ON approval_sla_tracking(is_within_sla) WHERE is_within_sla = false;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE approval_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE revision_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_sla_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_sla_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read approval queue" ON approval_queue FOR SELECT USING (true);
CREATE POLICY "Public read approval actions" ON approval_actions FOR SELECT USING (true);
CREATE POLICY "Public read approval history" ON approval_history FOR SELECT USING (true);
CREATE POLICY "Public read revision requests" ON revision_requests FOR SELECT USING (true);
CREATE POLICY "Public read notifications" ON approval_notifications FOR SELECT USING (true);
CREATE POLICY "Public read sla config" ON approval_sla_config FOR SELECT USING (true);
CREATE POLICY "Public read sla tracking" ON approval_sla_tracking FOR SELECT USING (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_sla_deadline(
  p_submitted_at timestamptz,
  p_target_hours integer,
  p_business_hours_only boolean DEFAULT false
)
RETURNS timestamptz AS $$
DECLARE
  v_deadline timestamptz;
BEGIN
  IF p_business_hours_only THEN
    v_deadline := p_submitted_at + (p_target_hours || ' hours')::interval;
  ELSE
    v_deadline := p_submitted_at + (p_target_hours || ' hours')::interval;
  END IF;
  
  RETURN v_deadline;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_queue_status(
  p_queue_id uuid,
  p_new_status text,
  p_changed_by uuid,
  p_reason text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_old_status text;
  v_prompt_id uuid;
  v_time_in_status interval;
BEGIN
  SELECT queue_status, prompt_id, (now() - updated_at)
  INTO v_old_status, v_prompt_id, v_time_in_status
  FROM approval_queue
  WHERE id = p_queue_id;
  
  UPDATE approval_queue
  SET queue_status = p_new_status,
      updated_at = now()
  WHERE id = p_queue_id;
  
  INSERT INTO approval_history (
    prompt_id,
    queue_id,
    status_from,
    status_to,
    changed_by,
    action_taken,
    reason,
    time_in_previous_status
  ) VALUES (
    v_prompt_id,
    p_queue_id,
    v_old_status,
    p_new_status,
    p_changed_by,
    p_new_status,
    p_reason,
    v_time_in_status
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_sla_compliance()
RETURNS void AS $$
DECLARE
  v_tracking record;
BEGIN
  FOR v_tracking IN 
    SELECT st.*, aq.sla_deadline
    FROM approval_sla_tracking st
    JOIN approval_queue aq ON aq.id = st.queue_id
    WHERE st.completed_at IS NULL
      AND st.paused_at IS NULL
  LOOP
    UPDATE approval_sla_tracking
    SET time_elapsed_hours = EXTRACT(EPOCH FROM (now() - started_at)) / 3600,
        is_within_sla = (now() < v_tracking.target_completion_at),
        breach_time_hours = CASE
          WHEN now() > v_tracking.target_completion_at
          THEN EXTRACT(EPOCH FROM (now() - v_tracking.target_completion_at)) / 3600
          ELSE 0
        END
    WHERE id = v_tracking.id;
    
    IF now() > v_tracking.warning_threshold_at AND NOT v_tracking.warning_sent THEN
      UPDATE approval_sla_tracking
      SET warning_sent = true,
          warning_sent_at = now()
      WHERE id = v_tracking.id;
      
      INSERT INTO approval_notifications (
        notification_type,
        recipient_id,
        recipient_email,
        subject,
        message,
        queue_id,
        priority
      )
      SELECT
        'sla_warning',
        aq.assigned_to,
        'admin@example.com',
        'SLA Warning: Prompt Approval Nearing Deadline',
        'A prompt assigned to you is approaching its SLA deadline.',
        aq.id,
        'high'
      FROM approval_queue aq
      WHERE aq.id = v_tracking.queue_id;
    END IF;
    
    IF now() > v_tracking.target_completion_at AND NOT v_tracking.breach_notified THEN
      UPDATE approval_sla_tracking
      SET breach_notified = true,
          breach_notified_at = now()
      WHERE id = v_tracking.id;
      
      UPDATE approval_queue
      SET is_sla_breached = true
      WHERE id = v_tracking.queue_id;
      
      INSERT INTO approval_notifications (
        notification_type,
        recipient_id,
        recipient_email,
        subject,
        message,
        queue_id,
        priority
      )
      SELECT
        'sla_breach',
        aq.assigned_to,
        'admin@example.com',
        'SLA BREACH: Prompt Approval Overdue',
        'A prompt has exceeded its SLA deadline.',
        aq.id,
        'urgent'
      FROM approval_queue aq
      WHERE aq.id = v_tracking.queue_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SEED DATA
-- =============================================================================

INSERT INTO approval_sla_config (
  config_name,
  department,
  target_hours,
  warning_threshold_hours,
  escalation_enabled
)
VALUES
  ('default_standard', NULL, 48, 36, false),
  ('high_priority', NULL, 24, 18, true),
  ('engineering_standard', 'Engineering', 72, 60, false),
  ('critical', NULL, 12, 9, true)
ON CONFLICT (config_name) DO NOTHING;
