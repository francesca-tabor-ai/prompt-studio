/*
  # Prompt Library Schema

  1. New Tables
    - `prompts`
      - `id` (uuid, primary key) - Unique identifier for each prompt
      - `title` (text) - Prompt title
      - `description` (text) - Detailed description
      - `content` (text) - Actual prompt content/template
      - `role` (text) - Target role (Admin, Manager, Developer, Analyst, etc.)
      - `department` (text) - Department (Engineering, Marketing, Sales, Operations, etc.)
      - `workflow` (text) - Workflow type (Customer Support, Sales, Analytics, Documentation, etc.)
      - `prompt_type` (text) - Type (Template, Custom, System, etc.)
      - `status` (text) - Status (Active, Draft, Archived, Under Review)
      - `accuracy_score` (integer) - Performance accuracy percentage (0-100)
      - `relevance_score` (integer) - Relevance score (0-100)
      - `usage_count` (integer) - Number of times used
      - `created_by` (uuid) - Reference to user who created it
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      - `tags` (text[]) - Array of tags for categorization

  2. Security
    - Enable RLS on `prompts` table
    - Add policy for authenticated users to read all prompts
    - Add policy for authenticated users to create prompts
    - Add policy for users to update their own prompts
    - Add policy for users to delete their own prompts

  3. Indexes
    - Index on `role` for filtering
    - Index on `department` for filtering
    - Index on `status` for filtering
    - Index on `created_at` for sorting
*/

CREATE TABLE IF NOT EXISTS prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  content text NOT NULL,
  role text NOT NULL,
  department text NOT NULL,
  workflow text NOT NULL,
  prompt_type text NOT NULL DEFAULT 'Template',
  status text NOT NULL DEFAULT 'Active',
  accuracy_score integer DEFAULT 0 CHECK (accuracy_score >= 0 AND accuracy_score <= 100),
  relevance_score integer DEFAULT 0 CHECK (relevance_score >= 0 AND relevance_score <= 100),
  usage_count integer DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  tags text[] DEFAULT '{}'::text[]
);

ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all prompts"
  ON prompts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create prompts"
  ON prompts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their own prompts"
  ON prompts FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own prompts"
  ON prompts FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE INDEX IF NOT EXISTS idx_prompts_role ON prompts(role);
CREATE INDEX IF NOT EXISTS idx_prompts_department ON prompts(department);
CREATE INDEX IF NOT EXISTS idx_prompts_status ON prompts(status);
CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at DESC);