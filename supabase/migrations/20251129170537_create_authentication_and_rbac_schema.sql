/*
  # Create Authentication and RBAC Schema

  1. New Tables
    - `user_profiles`
      - `id` (uuid, primary key) - Links to auth.users
      - `email` (text) - User email
      - `full_name` (text) - Full name
      - `avatar_url` (text) - Profile picture URL
      - `company` (text) - Company name
      - `department` (text) - Department
      - `is_active` (boolean) - Account status
      - `created_at` (timestamptz) - Registration date
      - `updated_at` (timestamptz) - Last update
      
    - `roles`
      - `id` (uuid, primary key)
      - `name` (text, unique) - Role name (admin, manager, user, reviewer)
      - `description` (text) - Role description
      - `created_at` (timestamptz)
      
    - `permissions`
      - `id` (uuid, primary key)
      - `name` (text, unique) - Permission name (e.g., prompts.create, prompts.approve)
      - `resource` (text) - Resource type (prompts, users, analytics, etc.)
      - `action` (text) - Action type (create, read, update, delete, approve)
      - `description` (text) - Permission description
      - `created_at` (timestamptz)
      
    - `role_permissions`
      - `id` (uuid, primary key)
      - `role_id` (uuid, foreign key) - Links to roles
      - `permission_id` (uuid, foreign key) - Links to permissions
      - `created_at` (timestamptz)
      
    - `user_roles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key) - Links to auth.users
      - `role_id` (uuid, foreign key) - Links to roles
      - `created_at` (timestamptz)
      
    - `auth_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key) - Links to auth.users
      - `token_hash` (text) - Hashed JWT token
      - `expires_at` (timestamptz) - Expiration timestamp
      - `ip_address` (text) - Client IP address
      - `user_agent` (text) - Client user agent
      - `created_at` (timestamptz)
      
    - `auth_audit_log`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - User ID (nullable for failed attempts)
      - `email` (text) - Email used in attempt
      - `event_type` (text) - login, logout, login_failed, password_reset, etc.
      - `ip_address` (text) - Client IP
      - `user_agent` (text) - Client user agent
      - `metadata` (jsonb) - Additional event data
      - `created_at` (timestamptz)
      
    - `login_attempts`
      - `id` (uuid, primary key)
      - `email` (text) - Email attempting login
      - `ip_address` (text) - Client IP
      - `attempt_count` (integer) - Number of attempts
      - `last_attempt_at` (timestamptz) - Last attempt timestamp
      - `locked_until` (timestamptz) - Account lock expiration

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated access
    - Restrict admin operations
    
  3. Indexes
    - Optimize for common query patterns
    - Add indexes for email, user_id, and timestamps
    
  4. Default Data
    - Create default roles (admin, manager, user, reviewer)
    - Create default permissions
    - Link permissions to roles
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  company text,
  department text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  resource text NOT NULL,
  action text NOT NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- Create auth_sessions table
CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create auth_audit_log table
CREATE TABLE IF NOT EXISTS auth_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  event_type text NOT NULL,
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create login_attempts table
CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text NOT NULL,
  attempt_count integer DEFAULT 1,
  last_attempt_at timestamptz DEFAULT now(),
  locked_until timestamptz,
  UNIQUE(email, ip_address)
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can manage all profiles"
  ON user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for roles (read-only for authenticated users)
CREATE POLICY "Authenticated users can view roles"
  ON roles
  FOR SELECT
  TO authenticated
  USING (true);

-- Policies for permissions (read-only for authenticated users)
CREATE POLICY "Authenticated users can view permissions"
  ON permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Policies for role_permissions (read-only for authenticated users)
CREATE POLICY "Authenticated users can view role permissions"
  ON role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Policies for user_roles
CREATE POLICY "Users can view own roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage user roles"
  ON user_roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for auth_sessions
CREATE POLICY "Users can view own sessions"
  ON auth_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage sessions"
  ON auth_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for auth_audit_log
CREATE POLICY "Users can view own audit logs"
  ON auth_audit_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage audit logs"
  ON auth_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for login_attempts
CREATE POLICY "Service role can manage login attempts"
  ON login_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_active ON user_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id ON auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_created ON auth_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);

-- Insert default roles
INSERT INTO roles (name, description) VALUES
  ('admin', 'Full system access with all permissions'),
  ('manager', 'Department manager with approval and management permissions'),
  ('user', 'Standard user with basic prompt creation and testing permissions'),
  ('reviewer', 'Can review and approve submitted prompts')
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (name, resource, action, description) VALUES
  ('prompts.create', 'prompts', 'create', 'Create new prompts'),
  ('prompts.read', 'prompts', 'read', 'View prompts'),
  ('prompts.update', 'prompts', 'update', 'Edit existing prompts'),
  ('prompts.delete', 'prompts', 'delete', 'Delete prompts'),
  ('prompts.approve', 'prompts', 'approve', 'Approve submitted prompts'),
  ('users.read', 'users', 'read', 'View user profiles'),
  ('users.create', 'users', 'create', 'Create new users'),
  ('users.update', 'users', 'update', 'Edit user profiles'),
  ('users.delete', 'users', 'delete', 'Delete users'),
  ('analytics.read', 'analytics', 'read', 'View analytics dashboard'),
  ('analytics.export', 'analytics', 'export', 'Export analytics data'),
  ('roles.manage', 'roles', 'manage', 'Manage roles and permissions'),
  ('audit.read', 'audit', 'read', 'View audit logs'),
  ('sandbox.access', 'sandbox', 'access', 'Access testing sandbox'),
  ('library.access', 'library', 'access', 'Access prompt library'),
  ('collaborate.submit', 'collaborate', 'submit', 'Submit prompts for review'),
  ('collaborate.review', 'collaborate', 'review', 'Review submitted prompts'),
  ('enterprise.access', 'enterprise', 'access', 'Access enterprise features')
ON CONFLICT (name) DO NOTHING;

-- Link permissions to admin role (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Link permissions to manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'manager'
  AND p.name IN (
    'prompts.create', 'prompts.read', 'prompts.update', 'prompts.approve',
    'users.read', 'analytics.read', 'analytics.export',
    'sandbox.access', 'library.access', 'collaborate.submit',
    'collaborate.review', 'enterprise.access'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Link permissions to user role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'user'
  AND p.name IN (
    'prompts.create', 'prompts.read', 'prompts.update',
    'analytics.read', 'sandbox.access', 'library.access',
    'collaborate.submit'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Link permissions to reviewer role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'reviewer'
  AND p.name IN (
    'prompts.read', 'prompts.approve', 'analytics.read',
    'library.access', 'collaborate.review'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Create function to automatically create user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    true
  );
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT NEW.id, id FROM public.roles WHERE name = 'user';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
