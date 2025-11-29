/*
  # Create Data Ingestion Schema

  1. New Tables
    - `ingestion_jobs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key) - User who initiated the job
      - `status` (text) - pending, processing, completed, failed
      - `source_type` (text) - csv, text, linkedin
      - `total_records` (integer) - Total records in input
      - `processed_records` (integer) - Successfully processed records
      - `failed_records` (integer) - Failed records
      - `duplicate_records` (integer) - Duplicate records found
      - `error_report` (jsonb) - Detailed error information
      - `created_at` (timestamptz)
      - `completed_at` (timestamptz)
      
    - `ingestion_errors`
      - `id` (uuid, primary key)
      - `job_id` (uuid, foreign key) - Links to ingestion_jobs
      - `row_number` (integer) - Row number in source data
      - `error_type` (text) - validation, parsing, duplicate
      - `error_message` (text) - Detailed error message
      - `raw_data` (jsonb) - Original raw data that caused error
      - `created_at` (timestamptz)
      
    - `ingested_employees`
      - `id` (uuid, primary key)
      - `job_id` (uuid, foreign key) - Links to ingestion_jobs
      - `full_name` (text) - Employee full name
      - `job_title` (text) - Employee job title
      - `team` (text) - Team name
      - `department` (text) - Department name
      - `email` (text) - Employee email (optional)
      - `phone` (text) - Employee phone (optional)
      - `location` (text) - Employee location (optional)
      - `normalized_data` (jsonb) - Normalized field values
      - `raw_data` (jsonb) - Original raw data
      - `is_duplicate` (boolean) - Duplicate flag
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only access their own ingestion jobs
    - Service role has full access
    
  3. Indexes
    - Optimize for lookups by job_id, user_id
    - Add indexes for duplicate detection
    
  4. Functions
    - Create function for duplicate detection
    - Create function for data normalization
*/

-- Create ingestion_jobs table
CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  source_type text NOT NULL,
  total_records integer DEFAULT 0,
  processed_records integer DEFAULT 0,
  failed_records integer DEFAULT 0,
  duplicate_records integer DEFAULT 0,
  error_report jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CHECK (source_type IN ('csv', 'text', 'linkedin'))
);

-- Create ingestion_errors table
CREATE TABLE IF NOT EXISTS ingestion_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  error_type text NOT NULL,
  error_message text NOT NULL,
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  CHECK (error_type IN ('validation', 'parsing', 'duplicate', 'other'))
);

-- Create ingested_employees table
CREATE TABLE IF NOT EXISTS ingested_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  job_title text,
  team text,
  department text,
  email text,
  phone text,
  location text,
  normalized_data jsonb DEFAULT '{}',
  raw_data jsonb DEFAULT '{}',
  is_duplicate boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingested_employees ENABLE ROW LEVEL SECURITY;

-- Policies for ingestion_jobs
CREATE POLICY "Users can view own ingestion jobs"
  ON ingestion_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own ingestion jobs"
  ON ingestion_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ingestion jobs"
  ON ingestion_jobs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all ingestion jobs"
  ON ingestion_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for ingestion_errors
CREATE POLICY "Users can view own ingestion errors"
  ON ingestion_errors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ingestion_jobs
      WHERE ingestion_jobs.id = ingestion_errors.job_id
      AND ingestion_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all ingestion errors"
  ON ingestion_errors
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for ingested_employees
CREATE POLICY "Users can view own ingested employees"
  ON ingested_employees
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ingestion_jobs
      WHERE ingestion_jobs.id = ingested_employees.job_id
      AND ingestion_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all ingested employees"
  ON ingested_employees
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_user_id ON ingestion_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status ON ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_created ON ingestion_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_errors_job_id ON ingestion_errors(job_id);
CREATE INDEX IF NOT EXISTS idx_ingested_employees_job_id ON ingested_employees(job_id);
CREATE INDEX IF NOT EXISTS idx_ingested_employees_name ON ingested_employees(full_name);
CREATE INDEX IF NOT EXISTS idx_ingested_employees_email ON ingested_employees(email);
CREATE INDEX IF NOT EXISTS idx_ingested_employees_duplicate ON ingested_employees(is_duplicate);

-- Create function for normalizing text
CREATE OR REPLACE FUNCTION normalize_text(input_text text)
RETURNS text AS $$
BEGIN
  RETURN TRIM(REGEXP_REPLACE(input_text, '\s+', ' ', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function for detecting duplicates
CREATE OR REPLACE FUNCTION check_duplicate_employee(
  p_full_name text,
  p_email text,
  p_job_id uuid
)
RETURNS boolean AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM ingested_employees
  WHERE job_id = p_job_id
  AND (
    LOWER(TRIM(full_name)) = LOWER(TRIM(p_full_name))
    OR (p_email IS NOT NULL AND email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(p_email)))
  );
  
  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql;
