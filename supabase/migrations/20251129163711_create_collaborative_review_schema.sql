/*
  # Create Collaborative Review Schema

  1. New Tables
    - `prompt_submissions`
      - `id` (uuid, primary key)
      - `title` (text) - Prompt title
      - `workflow` (text) - Workflow category
      - `role` (text) - Target role
      - `prompt_content` (text) - The actual prompt
      - `sample_output` (text) - Example output
      - `submitter_name` (text) - Name of submitter
      - `status` (text) - Status: pending, approved, changes_requested, archived
      - `created_at` (timestamptz) - Submission timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      
    - `prompt_reviews`
      - `id` (uuid, primary key)
      - `submission_id` (uuid, foreign key) - Links to submission
      - `reviewer_name` (text) - Name of reviewer
      - `accuracy_rating` (integer) - Rating 1-5
      - `clarity_rating` (integer) - Rating 1-5
      - `usefulness_rating` (integer) - Rating 1-5
      - `comment` (text) - Review comment
      - `action` (text) - approve, request_changes, none
      - `created_at` (timestamptz) - Review timestamp
      
    - `prompt_suggestions`
      - `id` (uuid, primary key)
      - `submission_id` (uuid, foreign key) - Links to submission
      - `suggestion_text` (text) - AI-generated suggestion
      - `suggestion_type` (text) - Type: clarity, structure, examples, tone
      - `is_applied` (boolean) - Whether suggestion was used
      - `created_at` (timestamptz) - Creation timestamp
      
    - `contributor_stats`
      - `id` (uuid, primary key)
      - `contributor_name` (text) - Name of contributor
      - `submissions_count` (integer) - Total submissions
      - `approvals_count` (integer) - Approved submissions
      - `reviews_count` (integer) - Total reviews given
      - `avg_rating` (numeric) - Average rating received
      - `points` (integer) - Total contribution points
      - `created_at` (timestamptz) - First contribution
      - `updated_at` (timestamptz) - Last update

  2. Security
    - Enable RLS on all tables
    - Add policies for public access (collaborative environment)
    
  3. Indexes
    - Add indexes for common query patterns
    - Optimize for filtering by status, ratings, and contributors
*/

-- Create prompt_submissions table
CREATE TABLE IF NOT EXISTS prompt_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  workflow text NOT NULL,
  role text NOT NULL,
  prompt_content text NOT NULL,
  sample_output text NOT NULL,
  submitter_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'changes_requested', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create prompt_reviews table
CREATE TABLE IF NOT EXISTS prompt_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE,
  reviewer_name text NOT NULL,
  accuracy_rating integer NOT NULL CHECK (accuracy_rating >= 1 AND accuracy_rating <= 5),
  clarity_rating integer NOT NULL CHECK (clarity_rating >= 1 AND clarity_rating <= 5),
  usefulness_rating integer NOT NULL CHECK (usefulness_rating >= 1 AND usefulness_rating <= 5),
  comment text NOT NULL,
  action text NOT NULL DEFAULT 'none' CHECK (action IN ('approve', 'request_changes', 'none')),
  created_at timestamptz DEFAULT now()
);

-- Create prompt_suggestions table
CREATE TABLE IF NOT EXISTS prompt_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES prompt_submissions(id) ON DELETE CASCADE,
  suggestion_text text NOT NULL,
  suggestion_type text NOT NULL CHECK (suggestion_type IN ('clarity', 'structure', 'examples', 'tone')),
  is_applied boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create contributor_stats table
CREATE TABLE IF NOT EXISTS contributor_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_name text UNIQUE NOT NULL,
  submissions_count integer DEFAULT 0,
  approvals_count integer DEFAULT 0,
  reviews_count integer DEFAULT 0,
  avg_rating numeric DEFAULT 0,
  points integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE prompt_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributor_stats ENABLE ROW LEVEL SECURITY;

-- Policies for prompt_submissions
CREATE POLICY "Allow public read access to prompt_submissions"
  ON prompt_submissions
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert to prompt_submissions"
  ON prompt_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update to prompt_submissions"
  ON prompt_submissions
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from prompt_submissions"
  ON prompt_submissions
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Policies for prompt_reviews
CREATE POLICY "Allow public read access to prompt_reviews"
  ON prompt_reviews
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert to prompt_reviews"
  ON prompt_reviews
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update to prompt_reviews"
  ON prompt_reviews
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from prompt_reviews"
  ON prompt_reviews
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Policies for prompt_suggestions
CREATE POLICY "Allow public read access to prompt_suggestions"
  ON prompt_suggestions
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert to prompt_suggestions"
  ON prompt_suggestions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update to prompt_suggestions"
  ON prompt_suggestions
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from prompt_suggestions"
  ON prompt_suggestions
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Policies for contributor_stats
CREATE POLICY "Allow public read access to contributor_stats"
  ON contributor_stats
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert to contributor_stats"
  ON contributor_stats
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update to contributor_stats"
  ON contributor_stats
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from contributor_stats"
  ON contributor_stats
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_submissions_status ON prompt_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitter ON prompt_submissions(submitter_name);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON prompt_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_submission ON prompt_reviews(submission_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON prompt_reviews(reviewer_name);
CREATE INDEX IF NOT EXISTS idx_suggestions_submission ON prompt_suggestions(submission_id);
CREATE INDEX IF NOT EXISTS idx_contributor_stats_points ON contributor_stats(points DESC);
CREATE INDEX IF NOT EXISTS idx_contributor_stats_name ON contributor_stats(contributor_name);
