/*
  # AI-Powered Task Generation Service
  AI task generation with learning capabilities
*/

-- Role task templates
CREATE TABLE IF NOT EXISTS role_task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_title text NOT NULL,
  department text,
  task_name text NOT NULL,
  task_description text,
  typical_frequency text,
  priority_level text,
  tags text[] DEFAULT '{}',
  estimated_time_minutes integer,
  is_common boolean DEFAULT true,
  usage_count integer DEFAULT 0,
  success_rate numeric(5, 2) DEFAULT 100,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_frequency CHECK (typical_frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'as_needed')),
  CONSTRAINT valid_priority CHECK (priority_level IN ('high_impact', 'frequent', 'compliance_critical', 'strategic', 'operational', 'administrative'))
);

-- Task generation requests
CREATE TABLE IF NOT EXISTS ai_task_generation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  role_title text NOT NULL,
  department text,
  team_context text,
  additional_requirements jsonb DEFAULT '{}',
  num_suggestions integer DEFAULT 7,
  status text DEFAULT 'pending',
  total_suggestions integer DEFAULT 0,
  processing_time_ms integer,
  used_template boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CONSTRAINT valid_num_suggestions CHECK (num_suggestions >= 5 AND num_suggestions <= 10)
);

-- Suggested tasks
CREATE TABLE IF NOT EXISTS ai_suggested_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES ai_task_generation_requests(id) ON DELETE CASCADE NOT NULL,
  suggestion_number integer NOT NULL,
  task_name text NOT NULL,
  task_description text,
  typical_frequency text,
  priority_tags text[] DEFAULT '{}',
  estimated_time_minutes integer,
  confidence_score numeric(5, 2),
  reasoning text,
  was_accepted boolean,
  was_modified boolean DEFAULT false,
  was_removed boolean DEFAULT false,
  final_task_name text,
  final_description text,
  user_feedback text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_confidence CHECK (confidence_score >= 0 AND confidence_score <= 100)
);

-- Knowledge base
CREATE TABLE IF NOT EXISTS role_task_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_title text NOT NULL,
  normalized_role text NOT NULL,
  department text,
  task_name text NOT NULL,
  task_description text,
  frequency text,
  priority_tags text[] DEFAULT '{}',
  source_type text DEFAULT 'user_confirmed',
  confirmation_count integer DEFAULT 1,
  rejection_count integer DEFAULT 0,
  modification_count integer DEFAULT 0,
  confidence_score numeric(5, 2),
  last_confirmed_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_source CHECK (source_type IN ('template', 'user_confirmed', 'ai_generated', 'imported')),
  CONSTRAINT unique_role_task UNIQUE (normalized_role, task_name)
);

-- Modification history
CREATE TABLE IF NOT EXISTS task_modification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_task_id uuid REFERENCES ai_suggested_tasks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  modification_type text NOT NULL,
  original_value text,
  new_value text,
  field_modified text,
  reasoning text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_modification CHECK (modification_type IN ('edit', 'accept', 'reject', 'add_tag', 'remove_tag', 'change_priority'))
);

-- Priority tags
CREATE TABLE IF NOT EXISTS task_priority_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_name text NOT NULL UNIQUE,
  tag_category text NOT NULL,
  description text,
  color text,
  icon text,
  usage_count integer DEFAULT 0,
  is_system_tag boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_category CHECK (tag_category IN ('impact', 'frequency', 'compliance', 'strategic', 'operational'))
);

-- Indexes
CREATE INDEX idx_role_templates_role ON role_task_templates(role_title);
CREATE INDEX idx_task_gen_requests_user ON ai_task_generation_requests(user_id);
CREATE INDEX idx_suggested_tasks_request ON ai_suggested_tasks(request_id);
CREATE INDEX idx_knowledge_base_role ON role_task_knowledge_base(normalized_role);
CREATE INDEX idx_task_modifications_task ON task_modification_history(suggested_task_id);

-- RLS
ALTER TABLE role_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_task_generation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggested_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_task_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_modification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_priority_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View templates" ON role_task_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full templates" ON role_task_templates FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View own requests" ON ai_task_generation_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Create requests" ON ai_task_generation_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service full requests" ON ai_task_generation_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View own suggestions" ON ai_suggested_tasks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM ai_task_generation_requests WHERE ai_task_generation_requests.id = ai_suggested_tasks.request_id AND ai_task_generation_requests.user_id = auth.uid()));
CREATE POLICY "Update own suggestions" ON ai_suggested_tasks FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM ai_task_generation_requests WHERE ai_task_generation_requests.id = ai_suggested_tasks.request_id AND ai_task_generation_requests.user_id = auth.uid()));
CREATE POLICY "Service full suggestions" ON ai_suggested_tasks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View knowledge" ON role_task_knowledge_base FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full knowledge" ON role_task_knowledge_base FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View own mods" ON task_modification_history FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Create mods" ON task_modification_history FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service full mods" ON task_modification_history FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View tags" ON task_priority_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full tags" ON task_priority_tags FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Functions
CREATE OR REPLACE FUNCTION normalize_role_title(p_role text)
RETURNS text AS $$
BEGIN
  RETURN lower(regexp_replace(trim(p_role), '\s+', '_', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Seed tags
INSERT INTO task_priority_tags (tag_name, tag_category, description, color, is_system_tag)
VALUES
  ('High Impact', 'impact', 'Significant business impact', '#EF4444', true),
  ('Frequent', 'frequency', 'Performed regularly', '#F59E0B', true),
  ('Compliance Critical', 'compliance', 'Regulatory compliance', '#DC2626', true),
  ('Strategic', 'strategic', 'Long-term initiatives', '#8B5CF6', true),
  ('Operational', 'operational', 'Day-to-day tasks', '#3B82F6', true)
ON CONFLICT (tag_name) DO NOTHING;

-- Seed templates
INSERT INTO role_task_templates (role_title, department, task_name, task_description, typical_frequency, priority_level, tags, estimated_time_minutes)
VALUES
  ('Account Executive', 'Sales', 'Prospect Research', 'Research potential clients', 'daily', 'high_impact', ARRAY['prospecting'], 60),
  ('Account Executive', 'Sales', 'Cold Outreach', 'Contact new prospects', 'daily', 'frequent', ARRAY['outreach'], 120),
  ('Account Executive', 'Sales', 'Sales Presentations', 'Product demos and presentations', 'weekly', 'high_impact', ARRAY['presentation'], 90),
  ('Recruiter', 'HR', 'Job Posting', 'Write and post job descriptions', 'weekly', 'operational', ARRAY['sourcing'], 45),
  ('Recruiter', 'HR', 'Resume Screening', 'Review candidate applications', 'daily', 'frequent', ARRAY['screening'], 90),
  ('Recruiter', 'HR', 'Phone Screens', 'Initial candidate screenings', 'daily', 'frequent', ARRAY['interviewing'], 120)
ON CONFLICT DO NOTHING;
