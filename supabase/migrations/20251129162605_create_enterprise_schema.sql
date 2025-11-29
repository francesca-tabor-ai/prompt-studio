/*
  # Create Enterprise Schema

  1. New Tables
    - `employees`
      - `id` (uuid, primary key)
      - `name` (text) - Employee name
      - `role` (text) - Job role/title
      - `team` (text) - Team name
      - `department` (text) - Department name
      - `created_at` (timestamptz) - Creation timestamp
      
    - `tasks`
      - `id` (uuid, primary key)
      - `department` (text) - Department name
      - `team` (text) - Team name
      - `role` (text) - Role name
      - `task_name` (text) - Task description
      - `priority` (text) - Priority level (high, medium, low)
      - `created_at` (timestamptz) - Creation timestamp
      
    - `role_prompts`
      - `id` (uuid, primary key)
      - `department` (text) - Department name
      - `team` (text) - Team name
      - `role` (text) - Role name
      - `task_id` (uuid, foreign key) - Links to task
      - `prompt_text` (text) - Generated prompt content
      - `is_active` (boolean) - Whether prompt is active
      - `created_at` (timestamptz) - Creation timestamp

  2. Security
    - Enable RLS on all tables
    - Add policies for public access (enterprise data is managed internally)
    
  3. Indexes
    - Add indexes for common query patterns
    - Optimize for filtering by department, team, and role
*/

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  team text NOT NULL,
  department text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  team text NOT NULL,
  role text NOT NULL,
  task_name text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  created_at timestamptz DEFAULT now()
);

-- Create role_prompts table
CREATE TABLE IF NOT EXISTS role_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  team text NOT NULL,
  role text NOT NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  prompt_text text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_prompts ENABLE ROW LEVEL SECURITY;

-- Policies for employees
CREATE POLICY "Allow public read access to employees"
  ON employees
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert to employees"
  ON employees
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update to employees"
  ON employees
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from employees"
  ON employees
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Policies for tasks
CREATE POLICY "Allow public read access to tasks"
  ON tasks
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert to tasks"
  ON tasks
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update to tasks"
  ON tasks
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from tasks"
  ON tasks
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Policies for role_prompts
CREATE POLICY "Allow public read access to role_prompts"
  ON role_prompts
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert to role_prompts"
  ON role_prompts
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update to role_prompts"
  ON role_prompts
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from role_prompts"
  ON role_prompts
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_team ON employees(team);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
CREATE INDEX IF NOT EXISTS idx_tasks_department ON tasks(department);
CREATE INDEX IF NOT EXISTS idx_tasks_team ON tasks(team);
CREATE INDEX IF NOT EXISTS idx_tasks_role ON tasks(role);
CREATE INDEX IF NOT EXISTS idx_role_prompts_department ON role_prompts(department);
CREATE INDEX IF NOT EXISTS idx_role_prompts_task ON role_prompts(task_id);
