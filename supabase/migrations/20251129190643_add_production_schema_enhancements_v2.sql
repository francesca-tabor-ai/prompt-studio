/*
  # Add Production Schema Enhancements V2

  ## Overview
  This migration enhances the existing database schema with production-ready features:
  - Adds departments and teams tables for hierarchical organization
  - Adds employee_tasks for task management
  - Adds prompt_tags for categorization
  - Enhances existing tables with additional fields
  - Adds analytics_events for usage tracking
  - Adds comprehensive indexes for performance
  - Adds triggers for automation
*/

-- =============================================================================
-- 1. ORGANIZATIONAL STRUCTURE TABLES
-- =============================================================================

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  parent_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  manager_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  budget_allocated numeric(12, 2) DEFAULT 0,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_dept_name CHECK (char_length(name) >= 2 AND char_length(name) <= 200)
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
  team_lead_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_team_name CHECK (char_length(name) >= 2 AND char_length(name) <= 200),
  CONSTRAINT unique_team_per_dept UNIQUE (name, department_id)
);

-- =============================================================================
-- 2. EMPLOYEE TASKS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS employee_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  task_name text NOT NULL,
  task_description text,
  priority text DEFAULT 'medium',
  status text DEFAULT 'pending',
  due_date date,
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT valid_employee_task_status CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

-- =============================================================================
-- 3. PROMPT TAGGING SYSTEM
-- =============================================================================

-- Prompt tags table
CREATE TABLE IF NOT EXISTS prompt_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  color text DEFAULT '#3B82F6',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_tag_name CHECK (char_length(name) >= 2 AND char_length(name) <= 50)
);

-- Prompt tag associations (many-to-many)
CREATE TABLE IF NOT EXISTS prompt_tag_associations (
  prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE NOT NULL,
  tag_id uuid REFERENCES prompt_tags(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (prompt_id, tag_id)
);

-- =============================================================================
-- 4. ANALYTICS & TRACKING TABLES
-- =============================================================================

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  event_name text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  session_id text,
  page_url text,
  referrer_url text,
  user_agent text,
  ip_address inet,
  device_type text,
  browser text,
  operating_system text,
  country text,
  city text,
  duration_seconds integer,
  properties jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_event_type CHECK (event_type IN ('page_view', 'prompt_view', 'prompt_create', 'prompt_edit', 'prompt_delete', 'test_run', 'review_submit', 'search', 'export', 'share', 'other'))
);

-- Enhanced audit logs table (separate from auth_audit_log)
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  changes jsonb DEFAULT '{}',
  old_values jsonb DEFAULT '{}',
  new_values jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  status text DEFAULT 'success',
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_action CHECK (action IN ('create', 'read', 'update', 'delete', 'login', 'logout', 'permission_change', 'other')),
  CONSTRAINT valid_resource_type CHECK (resource_type IN ('user', 'employee', 'department', 'team', 'prompt', 'review', 'test', 'role', 'permission', 'other')),
  CONSTRAINT valid_audit_status CHECK (status IN ('success', 'failure', 'warning'))
);

-- =============================================================================
-- ENHANCE EXISTING TABLES WITH NEW COLUMNS
-- =============================================================================

-- Add columns to prompts table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'author_id') THEN
    ALTER TABLE prompts ADD COLUMN author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'visibility') THEN
    ALTER TABLE prompts ADD COLUMN visibility text DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'department', 'public'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'is_archived') THEN
    ALTER TABLE prompts ADD COLUMN is_archived boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'rating_average') THEN
    ALTER TABLE prompts ADD COLUMN rating_average numeric(3, 2) DEFAULT 0 CHECK (rating_average >= 0 AND rating_average <= 5);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'rating_count') THEN
    ALTER TABLE prompts ADD COLUMN rating_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'department_id') THEN
    ALTER TABLE prompts ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'team_id') THEN
    ALTER TABLE prompts ADD COLUMN team_id uuid REFERENCES teams(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add columns to prompt_versions table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_versions' AND column_name = 'prompt_id') THEN
    ALTER TABLE prompt_versions ADD COLUMN prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_versions' AND column_name = 'change_summary') THEN
    ALTER TABLE prompt_versions ADD COLUMN change_summary text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_versions' AND column_name = 'change_type') THEN
    ALTER TABLE prompt_versions ADD COLUMN change_type text DEFAULT 'minor' CHECK (change_type IN ('major', 'minor', 'patch', 'rollback'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_versions' AND column_name = 'author_id') THEN
    ALTER TABLE prompt_versions ADD COLUMN author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_versions' AND column_name = 'title') THEN
    ALTER TABLE prompt_versions ADD COLUMN title text;
  END IF;
END $$;

-- Add columns to employees table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'department_id') THEN
    ALTER TABLE employees ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'team_id') THEN
    ALTER TABLE employees ADD COLUMN team_id uuid REFERENCES teams(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'manager_id') THEN
    ALTER TABLE employees ADD COLUMN manager_id uuid REFERENCES employees(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'employment_status') THEN
    ALTER TABLE employees ADD COLUMN employment_status text DEFAULT 'active' CHECK (employment_status IN ('active', 'inactive', 'on_leave', 'terminated'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'email') THEN
    ALTER TABLE employees ADD COLUMN email text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'phone') THEN
    ALTER TABLE employees ADD COLUMN phone text;
  END IF;
END $$;

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================

-- Departments indexes
CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments(parent_department_id);
CREATE INDEX IF NOT EXISTS idx_departments_manager ON departments(manager_user_id);
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(is_active);
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);

-- Teams indexes
CREATE INDEX IF NOT EXISTS idx_teams_department ON teams(department_id);
CREATE INDEX IF NOT EXISTS idx_teams_lead ON teams(team_lead_user_id);
CREATE INDEX IF NOT EXISTS idx_teams_active ON teams(is_active);
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);

-- Employee tasks indexes
CREATE INDEX IF NOT EXISTS idx_employee_tasks_employee ON employee_tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_tasks_status ON employee_tasks(status);
CREATE INDEX IF NOT EXISTS idx_employee_tasks_priority ON employee_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_employee_tasks_due_date ON employee_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_employee_tasks_created ON employee_tasks(created_at DESC);

-- Enhanced prompts indexes
CREATE INDEX IF NOT EXISTS idx_prompts_author_id ON prompts(author_id);
CREATE INDEX IF NOT EXISTS idx_prompts_department_id ON prompts(department_id);
CREATE INDEX IF NOT EXISTS idx_prompts_team_id ON prompts(team_id);
CREATE INDEX IF NOT EXISTS idx_prompts_visibility ON prompts(visibility);
CREATE INDEX IF NOT EXISTS idx_prompts_archived ON prompts(is_archived);
CREATE INDEX IF NOT EXISTS idx_prompts_rating ON prompts(rating_average DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_title_search ON prompts(title);

-- Enhanced prompt_versions indexes
CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id ON prompt_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_author_id ON prompt_versions(author_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_created_desc ON prompt_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_version_num ON prompt_versions(version_number DESC);

-- Prompt tags indexes
CREATE INDEX IF NOT EXISTS idx_prompt_tags_name ON prompt_tags(name);
CREATE INDEX IF NOT EXISTS idx_prompt_tags_created_by ON prompt_tags(created_by);

-- Prompt tag associations indexes
CREATE INDEX IF NOT EXISTS idx_tag_assoc_prompt ON prompt_tag_associations(prompt_id);
CREATE INDEX IF NOT EXISTS idx_tag_assoc_tag ON prompt_tag_associations(tag_id);

-- Analytics events indexes
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_prompt ON analytics_events(prompt_id);
CREATE INDEX IF NOT EXISTS idx_analytics_department ON analytics_events(department_id);
CREATE INDEX IF NOT EXISTS idx_analytics_team ON analytics_events(team_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at DESC);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_status ON audit_logs(status);

-- Enhanced employees indexes
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_team_fk ON employees(team_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(employment_status);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on new tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_tag_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Departments policies
CREATE POLICY "Authenticated users can view departments"
  ON departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Department managers can update departments"
  ON departments FOR UPDATE TO authenticated
  USING (manager_user_id = auth.uid())
  WITH CHECK (manager_user_id = auth.uid());

CREATE POLICY "Service role full access departments"
  ON departments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Teams policies
CREATE POLICY "Authenticated users can view teams"
  ON teams FOR SELECT TO authenticated USING (true);

CREATE POLICY "Team leads can update teams"
  ON teams FOR UPDATE TO authenticated
  USING (team_lead_user_id = auth.uid())
  WITH CHECK (team_lead_user_id = auth.uid());

CREATE POLICY "Service role full access teams"
  ON teams FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Employee tasks policies
CREATE POLICY "Employees can view own tasks"
  ON employee_tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = employee_tasks.employee_id
      AND employees.name = (SELECT full_name FROM user_profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Service role full access employee_tasks"
  ON employee_tasks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Prompt tags policies
CREATE POLICY "Authenticated users can view tags"
  ON prompt_tags FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create tags"
  ON prompt_tags FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Service role full access prompt_tags"
  ON prompt_tags FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Prompt tag associations policies
CREATE POLICY "Users can view tag associations"
  ON prompt_tag_associations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role full access tag_associations"
  ON prompt_tag_associations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Analytics events policies
CREATE POLICY "Users can view own analytics"
  ON analytics_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access analytics"
  ON analytics_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Audit logs policies
CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access audit_logs"
  ON audit_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =============================================================================
-- HELPER FUNCTIONS & TRIGGERS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to tables with updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_departments_updated_at') THEN
    CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_teams_updated_at') THEN
    CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_employee_tasks_updated_at') THEN
    CREATE TRIGGER update_employee_tasks_updated_at BEFORE UPDATE ON employee_tasks
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Function to create comprehensive audit log
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values)
    VALUES (auth.uid(), 'delete', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values)
    VALUES (auth.uid(), 'update', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values)
    VALUES (auth.uid(), 'create', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to critical tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_prompts_changes') THEN
    CREATE TRIGGER audit_prompts_changes AFTER INSERT OR UPDATE OR DELETE ON prompts
      FOR EACH ROW EXECUTE FUNCTION create_audit_log();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_departments_changes') THEN
    CREATE TRIGGER audit_departments_changes AFTER INSERT OR UPDATE OR DELETE ON departments
      FOR EACH ROW EXECUTE FUNCTION create_audit_log();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_teams_changes') THEN
    CREATE TRIGGER audit_teams_changes AFTER INSERT OR UPDATE OR DELETE ON teams
      FOR EACH ROW EXECUTE FUNCTION create_audit_log();
  END IF;
END $$;

-- Function to update prompt rating when reviews are added
CREATE OR REPLACE FUNCTION update_prompt_rating()
RETURNS TRIGGER AS $$
DECLARE
  v_prompt_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'prompt_reviews' THEN
    v_prompt_id := COALESCE(NEW.submission_id, OLD.submission_id);
    
    IF v_prompt_id IS NOT NULL THEN
      UPDATE prompts
      SET 
        rating_average = COALESCE((
          SELECT AVG((accuracy_rating + clarity_rating + usefulness_rating) / 3.0)::numeric(3,2)
          FROM prompt_reviews
          WHERE submission_id = v_prompt_id
        ), 0),
        rating_count = (
          SELECT COUNT(*)
          FROM prompt_reviews
          WHERE submission_id = v_prompt_id
        )
      WHERE id = v_prompt_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_rating_on_review_change') THEN
    CREATE TRIGGER update_rating_on_review_change
      AFTER INSERT OR UPDATE OR DELETE ON prompt_reviews
      FOR EACH ROW EXECUTE FUNCTION update_prompt_rating();
  END IF;
END $$;

-- Function to log analytics event
CREATE OR REPLACE FUNCTION log_analytics_event(
  p_event_type text,
  p_event_name text,
  p_user_id uuid DEFAULT NULL,
  p_prompt_id uuid DEFAULT NULL,
  p_properties jsonb DEFAULT '{}'
)
RETURNS uuid AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO analytics_events (
    event_type,
    event_name,
    user_id,
    prompt_id,
    properties
  ) VALUES (
    p_event_type,
    p_event_name,
    p_user_id,
    p_prompt_id,
    p_properties
  ) RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
