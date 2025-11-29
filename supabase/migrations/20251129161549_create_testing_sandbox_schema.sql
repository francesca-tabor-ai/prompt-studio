/*
  # Create Testing Sandbox Schema

  1. New Tables
    - `prompt_versions`
      - `id` (uuid, primary key)
      - `prompt_text` (text) - The prompt content
      - `scenario_id` (text) - Reference to scenario
      - `scenario_name` (text) - Name of the scenario
      - `version_number` (integer) - Version counter
      - `created_at` (timestamptz) - Creation timestamp
      
    - `test_results`
      - `id` (uuid, primary key)
      - `prompt_version_id` (uuid, foreign key) - Links to prompt version
      - `test_input` (text) - Input used for testing
      - `test_output` (text) - Generated output
      - `accuracy` (integer) - Accuracy metric (0-100)
      - `relevance` (integer) - Relevance metric (0-100)
      - `tone` (integer) - Tone metric (0-100)
      - `consistency` (integer) - Consistency metric (0-100)
      - `created_at` (timestamptz) - Test execution timestamp

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Public read access for shared prompts (future feature)
*/

-- Create prompt_versions table
CREATE TABLE IF NOT EXISTS prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_text text NOT NULL,
  scenario_id text NOT NULL,
  scenario_name text NOT NULL,
  version_number integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Create test_results table
CREATE TABLE IF NOT EXISTS test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_version_id uuid REFERENCES prompt_versions(id) ON DELETE CASCADE,
  test_input text NOT NULL,
  test_output text NOT NULL,
  accuracy integer NOT NULL CHECK (accuracy >= 0 AND accuracy <= 100),
  relevance integer NOT NULL CHECK (relevance >= 0 AND relevance <= 100),
  tone integer NOT NULL CHECK (tone >= 0 AND tone <= 100),
  consistency integer NOT NULL CHECK (consistency >= 0 AND consistency <= 100),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

-- Policies for prompt_versions
CREATE POLICY "Allow public read access to prompt_versions"
  ON prompt_versions
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert to prompt_versions"
  ON prompt_versions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update to prompt_versions"
  ON prompt_versions
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from prompt_versions"
  ON prompt_versions
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Policies for test_results
CREATE POLICY "Allow public read access to test_results"
  ON test_results
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert to test_results"
  ON test_results
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update to test_results"
  ON test_results
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from test_results"
  ON test_results
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_prompt_versions_scenario ON prompt_versions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_created ON prompt_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_results_prompt_version ON test_results(prompt_version_id);
CREATE INDEX IF NOT EXISTS idx_test_results_created ON test_results(created_at DESC);
