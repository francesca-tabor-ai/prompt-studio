/*
  # Enhanced Peer Review Workflow System

  ## Overview
  Comprehensive enhancements to existing peer review system:
  - User-based reviewer routing and assignments
  - Threaded discussions and comments
  - Approval workflows with configurable logic
  - Resubmission tracking with versioning
  - Notification system
  - Complete audit trail
  - Reviewer expertise tracking
  - Workflow configuration

  ## Enhancements
  1. Extend existing tables with user references
  2. Add threaded comment system
  3. Add approval tracking
  4. Add notification queue
  5. Add audit logging
  6. Add workflow configuration
  7. Add reviewer expertise

  ## Notes
  - Works with existing prompt_submissions table
  - Extends prompt_reviews functionality
  - Maintains backward compatibility
*/

-- =============================================================================
-- 1. EXTEND PROMPT_SUBMISSIONS TABLE
-- =============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_submissions' AND column_name = 'submitter_id') THEN
    ALTER TABLE prompt_submissions ADD COLUMN submitter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_submissions' AND column_name = 'description') THEN
    ALTER TABLE prompt_submissions ADD COLUMN description text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_submissions' AND column_name = 'submission_version') THEN
    ALTER TABLE prompt_submissions ADD COLUMN submission_version integer DEFAULT 1;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_submissions' AND column_name = 'parent_submission_id') THEN
    ALTER TABLE prompt_submissions ADD COLUMN parent_submission_id uuid REFERENCES prompt_submissions(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_submissions' AND column_name = 'required_approvals') THEN
    ALTER TABLE prompt_submissions ADD COLUMN required_approvals integer DEFAULT 2;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_submissions' AND column_name = 'reviewer_level') THEN
    ALTER TABLE prompt_submissions ADD COLUMN reviewer_level text DEFAULT 'senior';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_submissions' AND column_name = 'reviewed_at') THEN
    ALTER TABLE prompt_submissions ADD COLUMN reviewed_at timestamptz;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_submissions' AND column_name = 'approved_at') THEN
    ALTER TABLE prompt_submissions ADD COLUMN approved_at timestamptz;
  END IF;
END $$;

-- =============================================================================
-- 2. EXTEND PROMPT_REVIEWS TABLE
-- =============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_reviews' AND column_name = 'reviewer_id') THEN
    ALTER TABLE prompt_reviews ADD COLUMN reviewer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_reviews' AND column_name = 'completeness_rating') THEN
    ALTER TABLE prompt_reviews ADD COLUMN completeness_rating integer CHECK (completeness_rating BETWEEN 1 AND 5);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_reviews' AND column_name = 'overall_rating') THEN
    ALTER TABLE prompt_reviews ADD COLUMN overall_rating integer CHECK (overall_rating BETWEEN 1 AND 5);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_reviews' AND column_name = 'strengths') THEN
    ALTER TABLE prompt_reviews ADD COLUMN strengths text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_reviews' AND column_name = 'weaknesses') THEN
    ALTER TABLE prompt_reviews ADD COLUMN weaknesses text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_reviews' AND column_name = 'suggestions') THEN
    ALTER TABLE prompt_reviews ADD COLUMN suggestions text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_reviews' AND column_name = 'recommendation') THEN
    ALTER TABLE prompt_reviews ADD COLUMN recommendation text CHECK (recommendation IN ('approve', 'request_changes', 'reject'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_reviews' AND column_name = 'updated_at') THEN
    ALTER TABLE prompt_reviews ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Update action column to match recommendation (backward compatibility)
UPDATE prompt_reviews SET recommendation = action WHERE recommendation IS NULL AND action IS NOT NULL;

-- =============================================================================
-- 3. REVIEWER ASSIGNMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS submission_reviewer_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE NOT NULL,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reviewer_email text NOT NULL,
  reviewer_role text,
  reviewer_level text DEFAULT 'senior',
  
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assignment_reason text,
  
  notified_at timestamptz,
  acknowledged_at timestamptz,
  completed_at timestamptz,
  
  status text DEFAULT 'assigned',
  
  CONSTRAINT valid_assignment_status CHECK (status IN ('assigned', 'acknowledged', 'in_progress', 'completed', 'declined')),
  CONSTRAINT valid_assignment_level CHECK (reviewer_level IN ('junior', 'senior', 'expert')),
  CONSTRAINT unique_reviewer_assignment UNIQUE (submission_id, reviewer_id)
);

-- =============================================================================
-- 4. THREADED COMMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS submission_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE NOT NULL,
  review_id uuid REFERENCES prompt_reviews(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES submission_comments(id) ON DELETE CASCADE,
  
  commenter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  commenter_name text NOT NULL,
  commenter_role text,
  
  comment_text text NOT NULL,
  comment_type text DEFAULT 'general',
  is_resolved boolean DEFAULT false,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  
  thread_depth integer DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_thread_comment_type CHECK (comment_type IN ('general', 'question', 'suggestion', 'concern', 'praise')),
  CONSTRAINT valid_thread_comment_depth CHECK (thread_depth <= 5)
);

-- =============================================================================
-- 5. APPROVAL DECISIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS submission_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE NOT NULL,
  review_id uuid REFERENCES prompt_reviews(id) ON DELETE CASCADE NOT NULL,
  approver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  approver_email text NOT NULL,
  approver_level text NOT NULL,
  
  decision text NOT NULL,
  decision_reason text,
  conditions text,
  
  decided_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_approval_decision CHECK (decision IN ('approve', 'reject', 'conditional')),
  CONSTRAINT valid_approval_level CHECK (approver_level IN ('junior', 'senior', 'expert')),
  CONSTRAINT unique_approver_decision UNIQUE (submission_id, approver_id)
);

-- =============================================================================
-- 6. NOTIFICATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS submission_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipient_email text NOT NULL,
  
  submission_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE,
  review_id uuid REFERENCES prompt_reviews(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES submission_comments(id) ON DELETE CASCADE,
  
  notification_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  action_url text,
  
  priority text DEFAULT 'normal',
  
  sent_at timestamptz DEFAULT now(),
  read_at timestamptz,
  acknowledged_at timestamptz,
  
  is_read boolean DEFAULT false,
  is_acknowledged boolean DEFAULT false,
  
  metadata jsonb DEFAULT '{}',
  
  CONSTRAINT valid_notif_type CHECK (notification_type IN (
    'assignment', 'new_comment', 'review_complete', 'changes_requested',
    'approved', 'rejected', 'resubmission', 'mention', 'reminder'
  )),
  CONSTRAINT valid_notif_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- =============================================================================
-- 7. AUDIT LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS submission_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE NOT NULL,
  
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text NOT NULL,
  actor_role text,
  
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  
  old_value jsonb,
  new_value jsonb,
  changes jsonb DEFAULT '{}',
  
  reason text,
  metadata jsonb DEFAULT '{}',
  
  created_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text,
  
  CONSTRAINT valid_audit_action CHECK (action IN (
    'created', 'updated', 'deleted', 'submitted', 'assigned', 'reviewed',
    'commented', 'approved', 'rejected', 'resubmitted', 'published', 'withdrawn'
  )),
  CONSTRAINT valid_audit_entity CHECK (entity_type IN (
    'submission', 'review', 'comment', 'approval', 'assignment', 'notification'
  ))
);

-- =============================================================================
-- 8. WORKFLOW CONFIGURATION TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS submission_workflow_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name text NOT NULL UNIQUE,
  workflow_type text NOT NULL,
  
  description text,
  
  required_approvals integer DEFAULT 2,
  required_reviewer_level text DEFAULT 'senior',
  allow_self_review boolean DEFAULT false,
  require_all_reviewers boolean DEFAULT false,
  auto_assign_reviewers boolean DEFAULT true,
  
  approval_rules jsonb DEFAULT '{}',
  routing_rules jsonb DEFAULT '{}',
  notification_rules jsonb DEFAULT '{}',
  
  min_reviewers integer DEFAULT 2,
  max_reviewers integer DEFAULT 5,
  review_timeout_hours integer DEFAULT 72,
  
  is_active boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  CONSTRAINT valid_wf_type CHECK (workflow_type IN ('standard', 'expedited', 'thorough', 'custom')),
  CONSTRAINT valid_wf_level CHECK (required_reviewer_level IN ('junior', 'senior', 'expert', 'any')),
  CONSTRAINT valid_wf_min CHECK (min_reviewers >= 1),
  CONSTRAINT valid_wf_max CHECK (max_reviewers >= min_reviewers)
);

-- =============================================================================
-- 9. REVIEWER EXPERTISE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS submission_reviewer_expertise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reviewer_email text NOT NULL,
  
  expertise_area text NOT NULL,
  expertise_level text NOT NULL,
  role_specialization text,
  
  review_count integer DEFAULT 0,
  average_review_time_hours numeric(10, 2),
  average_rating numeric(3, 2),
  
  is_active boolean DEFAULT true,
  is_available boolean DEFAULT true,
  max_concurrent_reviews integer DEFAULT 5,
  current_review_count integer DEFAULT 0,
  
  last_review_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_exp_level CHECK (expertise_level IN ('junior', 'senior', 'expert')),
  CONSTRAINT unique_reviewer_exp UNIQUE (reviewer_id, expertise_area)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_submissions_submitter ON prompt_submissions(submitter_id);
CREATE INDEX IF NOT EXISTS idx_submissions_parent ON prompt_submissions(parent_submission_id);
CREATE INDEX IF NOT EXISTS idx_submissions_reviewed ON prompt_submissions(reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON prompt_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_recommendation ON prompt_reviews(recommendation);
CREATE INDEX IF NOT EXISTS idx_reviews_overall ON prompt_reviews(overall_rating DESC);

CREATE INDEX IF NOT EXISTS idx_assignments_submission ON submission_reviewer_assignments(submission_id);
CREATE INDEX IF NOT EXISTS idx_assignments_reviewer ON submission_reviewer_assignments(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON submission_reviewer_assignments(status);

CREATE INDEX IF NOT EXISTS idx_comments_submission ON submission_comments(submission_id);
CREATE INDEX IF NOT EXISTS idx_comments_review ON submission_comments(review_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON submission_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_commenter ON submission_comments(commenter_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON submission_comments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approvals_submission ON submission_approvals(submission_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver ON submission_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_approvals_decision ON submission_approvals(decision);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON submission_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_submission ON submission_notifications(submission_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON submission_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON submission_notifications(is_read, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_submission ON submission_audit_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON submission_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON submission_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON submission_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expertise_reviewer ON submission_reviewer_expertise(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_expertise_area ON submission_reviewer_expertise(expertise_area);
CREATE INDEX IF NOT EXISTS idx_expertise_level ON submission_reviewer_expertise(expertise_level);
CREATE INDEX IF NOT EXISTS idx_expertise_available ON submission_reviewer_expertise(is_available, is_active);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE submission_reviewer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_workflow_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_reviewer_expertise ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own assignments" ON submission_reviewer_assignments FOR SELECT TO authenticated 
  USING (reviewer_id = auth.uid() OR EXISTS (SELECT 1 FROM prompt_submissions WHERE prompt_submissions.id = submission_reviewer_assignments.submission_id AND prompt_submissions.submitter_id = auth.uid()));

CREATE POLICY "View submission comments" ON submission_comments FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM prompt_submissions WHERE prompt_submissions.id = submission_comments.submission_id AND (prompt_submissions.submitter_id = auth.uid() OR EXISTS (SELECT 1 FROM submission_reviewer_assignments WHERE submission_reviewer_assignments.submission_id = prompt_submissions.id AND submission_reviewer_assignments.reviewer_id = auth.uid()))));

CREATE POLICY "Create comments" ON submission_comments FOR INSERT TO authenticated 
  WITH CHECK (commenter_id = auth.uid());

CREATE POLICY "Update own comments" ON submission_comments FOR UPDATE TO authenticated 
  USING (commenter_id = auth.uid());

CREATE POLICY "View submission approvals" ON submission_approvals FOR SELECT TO authenticated 
  USING (approver_id = auth.uid() OR EXISTS (SELECT 1 FROM prompt_submissions WHERE prompt_submissions.id = submission_approvals.submission_id AND prompt_submissions.submitter_id = auth.uid()));

CREATE POLICY "View own notifications" ON submission_notifications FOR SELECT TO authenticated 
  USING (recipient_id = auth.uid());

CREATE POLICY "Update own notifications" ON submission_notifications FOR UPDATE TO authenticated 
  USING (recipient_id = auth.uid());

CREATE POLICY "View submission audit" ON submission_audit_log FOR SELECT TO authenticated 
  USING (actor_id = auth.uid() OR EXISTS (SELECT 1 FROM prompt_submissions WHERE prompt_submissions.id = submission_audit_log.submission_id AND (prompt_submissions.submitter_id = auth.uid() OR EXISTS (SELECT 1 FROM submission_reviewer_assignments WHERE submission_reviewer_assignments.submission_id = prompt_submissions.id AND submission_reviewer_assignments.reviewer_id = auth.uid()))));

CREATE POLICY "View workflow config" ON submission_workflow_config FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "View all expertise" ON submission_reviewer_expertise FOR SELECT TO authenticated USING (true);

CREATE POLICY "Update own expertise" ON submission_reviewer_expertise FOR UPDATE TO authenticated 
  USING (reviewer_id = auth.uid());

-- Service role full access
CREATE POLICY "Service full assignments" ON submission_reviewer_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full comments" ON submission_comments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full approvals" ON submission_approvals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full notifications" ON submission_notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full audit" ON submission_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full workflow" ON submission_workflow_config FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service full expertise" ON submission_reviewer_expertise FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION get_submission_review_summary(p_submission_id uuid)
RETURNS TABLE(
  total_reviewers integer,
  completed_reviews integer,
  approve_count integer,
  reject_count integer,
  changes_count integer,
  avg_overall_rating numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT sra.id)::integer as total_reviewers,
    COUNT(DISTINCT CASE WHEN sra.status = 'completed' THEN sra.id END)::integer as completed_reviews,
    COUNT(CASE WHEN pr.recommendation = 'approve' THEN 1 END)::integer as approve_count,
    COUNT(CASE WHEN pr.recommendation = 'reject' THEN 1 END)::integer as reject_count,
    COUNT(CASE WHEN pr.recommendation = 'request_changes' THEN 1 END)::integer as changes_count,
    ROUND(AVG(pr.overall_rating), 2) as avg_overall_rating
  FROM submission_reviewer_assignments sra
  LEFT JOIN prompt_reviews pr ON pr.submission_id = sra.submission_id AND pr.reviewer_id = sra.reviewer_id
  WHERE sra.submission_id = p_submission_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_submission_approval_criteria(p_submission_id uuid)
RETURNS boolean AS $$
DECLARE
  v_submission record;
  v_approve_count integer;
  v_senior_approvals integer;
BEGIN
  SELECT * INTO v_submission FROM prompt_submissions WHERE id = p_submission_id;
  
  SELECT 
    COUNT(CASE WHEN pr.recommendation = 'approve' THEN 1 END),
    COUNT(CASE WHEN pr.recommendation = 'approve' AND sra.reviewer_level IN ('senior', 'expert') THEN 1 END)
  INTO v_approve_count, v_senior_approvals
  FROM prompt_reviews pr
  JOIN submission_reviewer_assignments sra ON sra.submission_id = pr.submission_id AND sra.reviewer_id = pr.reviewer_id
  WHERE pr.submission_id = p_submission_id;
  
  IF v_submission.reviewer_level = 'senior' THEN
    RETURN v_senior_approvals >= v_submission.required_approvals;
  ELSE
    RETURN v_approve_count >= v_submission.required_approvals;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION find_available_reviewers(
  p_workflow text,
  p_role text,
  p_required_level text,
  p_limit integer DEFAULT 5
)
RETURNS TABLE(
  reviewer_id uuid,
  reviewer_email text,
  expertise_level text,
  review_count integer,
  current_review_count integer,
  match_score integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sre.reviewer_id,
    sre.reviewer_email,
    sre.expertise_level,
    sre.review_count,
    sre.current_review_count,
    (CASE
      WHEN sre.role_specialization = p_role THEN 10
      ELSE 0
    END +
    CASE
      WHEN sre.expertise_level = 'expert' THEN 5
      WHEN sre.expertise_level = 'senior' THEN 3
      ELSE 1
    END -
    sre.current_review_count) as match_score
  FROM submission_reviewer_expertise sre
  WHERE sre.is_active = true
    AND sre.is_available = true
    AND sre.current_review_count < sre.max_concurrent_reviews
    AND (p_required_level = 'any' OR sre.expertise_level >= p_required_level)
  ORDER BY match_score DESC, sre.last_review_at ASC NULLS FIRST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SEED DATA
-- =============================================================================

INSERT INTO submission_workflow_config (workflow_name, workflow_type, description, required_approvals, required_reviewer_level, min_reviewers, max_reviewers)
VALUES
  ('Standard Review', 'standard', 'Standard peer review process requiring 2 senior approvals', 2, 'senior', 2, 3),
  ('Expedited Review', 'expedited', 'Fast-track review for urgent submissions', 1, 'any', 1, 2),
  ('Thorough Review', 'thorough', 'Comprehensive review requiring 3 expert approvals', 3, 'expert', 3, 5)
ON CONFLICT (workflow_name) DO NOTHING;
