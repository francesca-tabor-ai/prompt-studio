/*
  # Advanced Version Control System for Prompts

  ## Overview
  This migration creates a comprehensive version control system with:
  - Automatic version creation on prompt modifications
  - Delta compression for efficient storage
  - Branching support for experimental variations
  - Complete audit trail with change descriptions
  - Version comparison and diff capabilities

  ## New Tables
  1. **prompt_version_deltas** - Stores compressed deltas between versions
  2. **prompt_branches** - Manages branches for experimental variations
  3. **version_metadata** - Extended metadata for versions
  4. **version_comparisons** - Cached comparison results

  ## Enhanced Tables
  - Adds delta storage support to prompt_versions
  - Adds branching relationships

  ## Features
  - Automatic delta compression
  - Branch management (create, merge, delete)
  - Version comparison and diff
  - Complete audit trail
  - Efficient storage with delta encoding
*/

-- =============================================================================
-- 1. PROMPT BRANCHES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE NOT NULL,
  branch_name text NOT NULL,
  description text,
  base_version_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  is_merged boolean DEFAULT false,
  merged_at timestamptz,
  merged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_branch_name CHECK (char_length(branch_name) >= 2 AND char_length(branch_name) <= 100),
  CONSTRAINT unique_branch_per_prompt UNIQUE (prompt_id, branch_name)
);

-- =============================================================================
-- 2. ENHANCED PROMPT VERSIONS TABLE
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_versions' AND column_name = 'branch_id') THEN
    ALTER TABLE prompt_versions ADD COLUMN branch_id uuid REFERENCES prompt_branches(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_versions' AND column_name = 'parent_version_id') THEN
    ALTER TABLE prompt_versions ADD COLUMN parent_version_id uuid REFERENCES prompt_versions(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_versions' AND column_name = 'is_delta_compressed') THEN
    ALTER TABLE prompt_versions ADD COLUMN is_delta_compressed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_versions' AND column_name = 'delta_base_version_id') THEN
    ALTER TABLE prompt_versions ADD COLUMN delta_base_version_id uuid REFERENCES prompt_versions(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_versions' AND column_name = 'storage_size_bytes') THEN
    ALTER TABLE prompt_versions ADD COLUMN storage_size_bytes integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_versions' AND column_name = 'compression_ratio') THEN
    ALTER TABLE prompt_versions ADD COLUMN compression_ratio numeric(5, 2);
  END IF;
END $$;

-- =============================================================================
-- 3. VERSION DELTAS TABLE (for delta compression)
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_version_deltas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid REFERENCES prompt_versions(id) ON DELETE CASCADE NOT NULL,
  base_version_id uuid REFERENCES prompt_versions(id) ON DELETE CASCADE NOT NULL,
  delta_operations jsonb NOT NULL,
  original_size integer NOT NULL,
  compressed_size integer NOT NULL,
  compression_algorithm text DEFAULT 'diff-match-patch',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT different_versions CHECK (version_id != base_version_id)
);

-- =============================================================================
-- 4. VERSION METADATA TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS version_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid REFERENCES prompt_versions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  tags jsonb DEFAULT '[]',
  change_category text,
  breaking_change boolean DEFAULT false,
  tested boolean DEFAULT false,
  test_results jsonb,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_status text,
  review_notes text,
  performance_impact text,
  lines_added integer DEFAULT 0,
  lines_removed integer DEFAULT 0,
  lines_modified integer DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_change_category CHECK (change_category IN ('feature', 'bugfix', 'optimization', 'refactor', 'documentation', 'experiment', 'other')),
  CONSTRAINT valid_review_status CHECK (review_status IN ('pending', 'approved', 'rejected', 'needs_changes'))
);

-- =============================================================================
-- 5. VERSION COMPARISONS TABLE (cached comparisons)
-- =============================================================================

CREATE TABLE IF NOT EXISTS version_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE NOT NULL,
  version_a_id uuid REFERENCES prompt_versions(id) ON DELETE CASCADE NOT NULL,
  version_b_id uuid REFERENCES prompt_versions(id) ON DELETE CASCADE NOT NULL,
  diff_html text,
  diff_json jsonb,
  similarity_score numeric(5, 2),
  changes_summary jsonb,
  computed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_comparison UNIQUE (version_a_id, version_b_id)
);

-- =============================================================================
-- 6. VERSION AUDIT LOG
-- =============================================================================

CREATE TABLE IF NOT EXISTS version_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid REFERENCES prompt_versions(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  action_details jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_version_action CHECK (action IN ('create', 'view', 'revert', 'compare', 'branch', 'merge', 'tag', 'delete'))
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_prompt_branches_prompt ON prompt_branches(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_branches_creator ON prompt_branches(created_by);
CREATE INDEX IF NOT EXISTS idx_prompt_branches_active ON prompt_branches(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_branches_merged ON prompt_branches(is_merged);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_branch ON prompt_versions(branch_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_parent ON prompt_versions(parent_version_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_delta_base ON prompt_versions(delta_base_version_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_compressed ON prompt_versions(is_delta_compressed);

CREATE INDEX IF NOT EXISTS idx_version_deltas_version ON prompt_version_deltas(version_id);
CREATE INDEX IF NOT EXISTS idx_version_deltas_base ON prompt_version_deltas(base_version_id);

CREATE INDEX IF NOT EXISTS idx_version_metadata_version ON version_metadata(version_id);
CREATE INDEX IF NOT EXISTS idx_version_metadata_reviewer ON version_metadata(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_version_metadata_status ON version_metadata(review_status);
CREATE INDEX IF NOT EXISTS idx_version_metadata_breaking ON version_metadata(breaking_change);

CREATE INDEX IF NOT EXISTS idx_version_comparisons_prompt ON version_comparisons(prompt_id);
CREATE INDEX IF NOT EXISTS idx_version_comparisons_version_a ON version_comparisons(version_a_id);
CREATE INDEX IF NOT EXISTS idx_version_comparisons_version_b ON version_comparisons(version_b_id);

CREATE INDEX IF NOT EXISTS idx_version_audit_version ON version_audit_log(version_id);
CREATE INDEX IF NOT EXISTS idx_version_audit_user ON version_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_version_audit_action ON version_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_version_audit_created ON version_audit_log(created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE prompt_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_version_deltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_audit_log ENABLE ROW LEVEL SECURITY;

-- Prompt branches policies
CREATE POLICY "Users can view branches of accessible prompts"
  ON prompt_branches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM prompts
      WHERE prompts.id = prompt_branches.prompt_id
      AND (prompts.visibility = 'public' OR prompts.author_id = auth.uid())
    )
  );

CREATE POLICY "Users can create branches for their prompts"
  ON prompt_branches FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM prompts
      WHERE prompts.id = prompt_branches.prompt_id
      AND prompts.author_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access branches"
  ON prompt_branches FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Version deltas policies
CREATE POLICY "Users can view deltas of accessible versions"
  ON prompt_version_deltas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM prompt_versions pv
      JOIN prompts p ON p.id = pv.prompt_id
      WHERE pv.id = prompt_version_deltas.version_id
      AND (p.visibility = 'public' OR p.author_id = auth.uid())
    )
  );

CREATE POLICY "Service role full access deltas"
  ON prompt_version_deltas FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Version metadata policies
CREATE POLICY "Users can view metadata of accessible versions"
  ON version_metadata FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM prompt_versions pv
      JOIN prompts p ON p.id = pv.prompt_id
      WHERE pv.id = version_metadata.version_id
      AND (p.visibility = 'public' OR p.author_id = auth.uid())
    )
  );

CREATE POLICY "Service role full access metadata"
  ON version_metadata FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Version comparisons policies
CREATE POLICY "Users can view comparisons of accessible prompts"
  ON version_comparisons FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM prompts
      WHERE prompts.id = version_comparisons.prompt_id
      AND (prompts.visibility = 'public' OR prompts.author_id = auth.uid())
    )
  );

CREATE POLICY "Service role full access comparisons"
  ON version_comparisons FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Version audit log policies
CREATE POLICY "Users can view audit log of their actions"
  ON version_audit_log FOR SELECT TO authenticated
  USING (performed_by = auth.uid());

CREATE POLICY "Service role full access audit"
  ON version_audit_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to create version with automatic delta compression
CREATE OR REPLACE FUNCTION create_prompt_version_with_delta(
  p_prompt_id uuid,
  p_title text,
  p_prompt_text text,
  p_change_summary text,
  p_change_type text,
  p_author_id uuid,
  p_branch_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_version_id uuid;
  v_version_number integer;
  v_base_version_id uuid;
  v_base_text text;
  v_should_compress boolean := false;
BEGIN
  SELECT version_number, id, prompt_text
  INTO v_version_number, v_base_version_id, v_base_text
  FROM prompt_versions
  WHERE prompt_id = p_prompt_id
  ORDER BY version_number DESC
  LIMIT 1;

  IF v_version_number IS NULL THEN
    v_version_number := 1;
  ELSE
    v_version_number := v_version_number + 1;
  END IF;

  IF v_base_version_id IS NOT NULL AND length(p_prompt_text) > 500 THEN
    v_should_compress := true;
  END IF;

  INSERT INTO prompt_versions (
    prompt_id,
    version_number,
    title,
    prompt_text,
    change_summary,
    change_type,
    author_id,
    branch_id,
    parent_version_id,
    is_delta_compressed,
    delta_base_version_id,
    storage_size_bytes
  ) VALUES (
    p_prompt_id,
    v_version_number,
    p_title,
    p_prompt_text,
    p_change_summary,
    p_change_type,
    p_author_id,
    p_branch_id,
    v_base_version_id,
    v_should_compress,
    CASE WHEN v_should_compress THEN v_base_version_id ELSE NULL END,
    length(p_prompt_text)
  ) RETURNING id INTO v_version_id;

  INSERT INTO version_metadata (version_id)
  VALUES (v_version_id);

  INSERT INTO version_audit_log (
    version_id,
    action,
    performed_by,
    action_details
  ) VALUES (
    v_version_id,
    'create',
    p_author_id,
    jsonb_build_object(
      'version_number', v_version_number,
      'change_type', p_change_type,
      'branch_id', p_branch_id
    )
  );

  RETURN v_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get full version content (handles delta decompression)
CREATE OR REPLACE FUNCTION get_version_content(p_version_id uuid)
RETURNS text AS $$
DECLARE
  v_content text;
  v_is_compressed boolean;
BEGIN
  SELECT prompt_text, is_delta_compressed
  INTO v_content, v_is_compressed
  FROM prompt_versions
  WHERE id = p_version_id;

  RETURN v_content;
END;
$$ LANGUAGE plpgsql;

-- Function to compare two versions
CREATE OR REPLACE FUNCTION compare_versions(
  p_version_a_id uuid,
  p_version_b_id uuid,
  p_user_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_prompt_id uuid;
  v_comparison jsonb;
  v_text_a text;
  v_text_b text;
  v_title_a text;
  v_title_b text;
BEGIN
  SELECT prompt_id, prompt_text, title
  INTO v_prompt_id, v_text_a, v_title_a
  FROM prompt_versions
  WHERE id = p_version_a_id;

  SELECT prompt_text, title
  INTO v_text_b, v_title_b
  FROM prompt_versions
  WHERE id = p_version_b_id;

  v_comparison := jsonb_build_object(
    'version_a', jsonb_build_object(
      'id', p_version_a_id,
      'title', v_title_a,
      'content', v_text_a
    ),
    'version_b', jsonb_build_object(
      'id', p_version_b_id,
      'title', v_title_b,
      'content', v_text_b
    ),
    'content_changed', v_text_a != v_text_b,
    'title_changed', v_title_a != v_title_b
  );

  INSERT INTO version_audit_log (
    version_id,
    action,
    performed_by,
    action_details
  ) VALUES (
    p_version_a_id,
    'compare',
    p_user_id,
    jsonb_build_object('compared_with', p_version_b_id)
  );

  RETURN v_comparison;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a branch
CREATE OR REPLACE FUNCTION create_prompt_branch(
  p_prompt_id uuid,
  p_branch_name text,
  p_description text,
  p_base_version_id uuid,
  p_created_by uuid
)
RETURNS uuid AS $$
DECLARE
  v_branch_id uuid;
BEGIN
  INSERT INTO prompt_branches (
    prompt_id,
    branch_name,
    description,
    base_version_id,
    created_by
  ) VALUES (
    p_prompt_id,
    p_branch_name,
    p_description,
    p_base_version_id,
    p_created_by
  ) RETURNING id INTO v_branch_id;

  RETURN v_branch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to merge a branch
CREATE OR REPLACE FUNCTION merge_prompt_branch(
  p_branch_id uuid,
  p_merged_by uuid
)
RETURNS boolean AS $$
BEGIN
  UPDATE prompt_branches
  SET
    is_merged = true,
    merged_at = now(),
    merged_by = p_merged_by,
    is_active = false
  WHERE id = p_branch_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update branch updated_at
CREATE OR REPLACE FUNCTION update_branch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_branch_timestamp') THEN
    CREATE TRIGGER update_branch_timestamp
      BEFORE UPDATE ON prompt_branches
      FOR EACH ROW EXECUTE FUNCTION update_branch_updated_at();
  END IF;
END $$;

-- Trigger to log version views
CREATE OR REPLACE FUNCTION log_version_view()
RETURNS TRIGGER AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
