/*
  # Enhanced RBAC System

  ## Overview
  Enhances existing RBAC with comprehensive features:
  - Granular permissions
  - Role hierarchy
  - Time-limited assignments
  - Department scoping
  - Role templates
  - Audit logging
*/

-- =============================================================================
-- 1. ENHANCE EXISTING TABLES
-- =============================================================================

-- Add columns to roles table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'role_level') THEN
    ALTER TABLE roles ADD COLUMN role_level integer DEFAULT 0;
    ALTER TABLE roles ADD CONSTRAINT valid_role_level CHECK (role_level >= 0 AND role_level <= 100);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'color_code') THEN
    ALTER TABLE roles ADD COLUMN color_code text DEFAULT '#6B7280';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'is_system_role') THEN
    ALTER TABLE roles ADD COLUMN is_system_role boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'is_assignable') THEN
    ALTER TABLE roles ADD COLUMN is_assignable boolean DEFAULT true;
  END IF;
END $$;

-- =============================================================================
-- 2. CREATE NEW RBAC TABLES
-- =============================================================================

-- User Roles with time limits and scoping
CREATE TABLE IF NOT EXISTS user_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id uuid NOT NULL,
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
  
  department_scope text[],
  workflow_scope text[],
  
  is_active boolean DEFAULT true,
  
  assigned_by uuid NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  
  assignment_reason text,
  
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text,
  
  CONSTRAINT unique_user_role_assignment UNIQUE (user_id, role_id),
  CONSTRAINT valid_date_range CHECK (valid_until IS NULL OR valid_until > valid_from)
);

-- Role Hierarchy
CREATE TABLE IF NOT EXISTS role_hierarchy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  parent_role_id uuid REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
  child_role_id uuid REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
  
  inherit_permissions boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_hierarchy UNIQUE (parent_role_id, child_role_id),
  CONSTRAINT no_self_reference CHECK (parent_role_id != child_role_id)
);

-- Department Permissions
CREATE TABLE IF NOT EXISTS department_scoped_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id uuid NOT NULL,
  department text NOT NULL,
  
  permission_level text DEFAULT 'read',
  
  can_manage_users boolean DEFAULT false,
  can_approve_prompts boolean DEFAULT false,
  can_view_analytics boolean DEFAULT false,
  can_export_data boolean DEFAULT false,
  
  assigned_by uuid NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  
  valid_until timestamptz,
  
  CONSTRAINT valid_dept_permission_level CHECK (permission_level IN (
    'read', 'write', 'manage', 'admin'
  )),
  CONSTRAINT unique_user_dept UNIQUE (user_id, department)
);

-- Role Templates
CREATE TABLE IF NOT EXISTS rbac_role_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  template_name text NOT NULL UNIQUE,
  template_slug text NOT NULL UNIQUE,
  
  description text,
  use_case text,
  
  role_config jsonb NOT NULL,
  permission_keys text[],
  
  department_scopes text[],
  
  is_public boolean DEFAULT true,
  is_recommended boolean DEFAULT false,
  
  usage_count integer DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RBAC Audit Log
CREATE TABLE IF NOT EXISTS rbac_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  event_type text NOT NULL,
  
  actor_id uuid NOT NULL,
  actor_email text,
  
  target_user_id uuid,
  target_role_id uuid,
  
  action text NOT NULL,
  
  changes jsonb,
  
  before_state jsonb,
  after_state jsonb,
  
  reason text,
  
  ip_address inet,
  
  success boolean DEFAULT true,
  error_message text,
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_rbac_event_type CHECK (event_type IN (
    'role_created', 'role_updated', 'role_deleted',
    'permission_granted', 'permission_revoked',
    'user_role_assigned', 'user_role_revoked',
    'role_hierarchy_changed', 'department_permission_changed'
  )),
  CONSTRAINT valid_rbac_action CHECK (action IN (
    'create', 'update', 'delete', 'grant', 'revoke', 'assign', 'modify'
  ))
);

-- =============================================================================
-- 3. INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user ON user_role_assignments(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_role ON user_role_assignments(role_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_expiry ON user_role_assignments(valid_until) WHERE valid_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_role_hierarchy_parent ON role_hierarchy(parent_role_id);
CREATE INDEX IF NOT EXISTS idx_role_hierarchy_child ON role_hierarchy(child_role_id);

CREATE INDEX IF NOT EXISTS idx_dept_scoped_perms_user ON department_scoped_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_dept_scoped_perms_dept ON department_scoped_permissions(department);

CREATE INDEX IF NOT EXISTS idx_rbac_change_log_actor ON rbac_change_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rbac_change_log_target ON rbac_change_log(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rbac_change_log_event ON rbac_change_log(event_type, created_at DESC);

-- =============================================================================
-- 4. RLS POLICIES
-- =============================================================================

ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_scoped_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbac_role_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbac_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read user role assignments" ON user_role_assignments FOR SELECT USING (true);
CREATE POLICY "Public read role hierarchy" ON role_hierarchy FOR SELECT USING (true);
CREATE POLICY "Public read department permissions" ON department_scoped_permissions FOR SELECT USING (true);
CREATE POLICY "Public read role templates" ON rbac_role_templates FOR SELECT USING (is_public = true);
CREATE POLICY "Public read rbac change log" ON rbac_change_log FOR SELECT USING (true);

-- =============================================================================
-- 5. HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_permission_keys(p_user_id uuid)
RETURNS TABLE(permission_key text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.name as permission_key
  FROM user_role_assignments ura
  JOIN role_permissions rp ON rp.role_id = ura.role_id
  JOIN permissions p ON p.id = rp.permission_id
  WHERE ura.user_id = p_user_id
    AND ura.is_active = true
    AND (ura.valid_until IS NULL OR ura.valid_until > now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_permission(
  p_user_id uuid,
  p_permission_key text
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM get_user_permission_keys(p_user_id) 
    WHERE permission_key = p_permission_key
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION expire_role_assignments()
RETURNS void AS $$
BEGIN
  UPDATE user_role_assignments
  SET is_active = false,
      revoked_at = now(),
      revoke_reason = 'Automatic expiration'
  WHERE is_active = true
    AND valid_until IS NOT NULL
    AND valid_until < now();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_rbac_change(
  p_event_type text,
  p_actor_id uuid,
  p_action text,
  p_target_user_id uuid DEFAULT NULL,
  p_target_role_id uuid DEFAULT NULL,
  p_changes jsonb DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO rbac_change_log (
    event_type,
    actor_id,
    target_user_id,
    target_role_id,
    action,
    changes,
    reason
  ) VALUES (
    p_event_type,
    p_actor_id,
    p_target_user_id,
    p_target_role_id,
    p_action,
    p_changes,
    p_reason
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 6. SEED DATA - UPDATE ROLES
-- =============================================================================

UPDATE roles SET 
  role_level = 100, 
  is_system_role = true, 
  color_code = '#DC2626',
  is_assignable = true
WHERE name = 'admin';

UPDATE roles SET 
  role_level = 60, 
  is_system_role = true, 
  color_code = '#D97706',
  is_assignable = true
WHERE name = 'reviewer';

UPDATE roles SET 
  role_level = 20, 
  is_system_role = true, 
  color_code = '#059669',
  is_assignable = true
WHERE name = 'contributor';

-- Insert additional system roles if not exist
INSERT INTO roles (name, description, role_level, is_system_role, color_code, is_assignable)
VALUES
  ('manager', 'Reviews and approves prompts', 60, true, '#D97706', true),
  ('viewer', 'Read-only access', 10, true, '#6B7280', true)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 7. SEED DATA - ROLE TEMPLATES
-- =============================================================================

INSERT INTO rbac_role_templates (
  template_name, 
  template_slug, 
  description, 
  use_case, 
  role_config, 
  permission_keys,
  is_recommended
)
VALUES
  (
    'Engineering Team Lead',
    'engineering_lead',
    'Full permissions for engineering department with approval authority',
    'Ideal for engineering managers and team leads',
    '{"department": "Engineering", "role_level": 70}',
    ARRAY['prompt:create', 'prompt:update', 'prompt:approve', 'analytics:view', 'users:view'],
    true
  ),
  (
    'Content Creator',
    'content_creator',
    'Focus on prompt creation and testing',
    'For team members creating and testing prompts',
    '{"role_level": 30}',
    ARRAY['prompt:create', 'prompt:read', 'prompt:update', 'testing:sandbox'],
    true
  ),
  (
    'Quality Reviewer',
    'quality_reviewer',
    'Review and approve prompt submissions',
    'For quality assurance and review team',
    '{"role_level": 50}',
    ARRAY['prompt:read', 'prompt:review', 'prompt:approve', 'testing:results'],
    true
  ),
  (
    'Analytics Specialist',
    'analytics_specialist',
    'Access to all analytics and reporting features',
    'For data analysts and reporting specialists',
    '{"role_level": 40}',
    ARRAY['analytics:view', 'analytics:export', 'reports:create', 'reports:view'],
    false
  )
ON CONFLICT (template_slug) DO NOTHING;
