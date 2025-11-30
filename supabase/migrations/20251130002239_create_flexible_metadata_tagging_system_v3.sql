/*
  # Flexible Metadata and Tagging System
  
  Creates new tagging tables alongside existing prompt_tags table
*/

-- Tags master table (renamed to avoid conflict)
CREATE TABLE IF NOT EXISTS tag_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  tag_type text NOT NULL,
  color text,
  is_system_tag boolean DEFAULT false,
  is_approved boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  visibility text DEFAULT 'public',
  usage_count integer DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_tag_name CHECK (char_length(name) >= 2 AND char_length(name) <= 50),
  CONSTRAINT valid_tag_type CHECK (tag_type IN ('category', 'technical', 'domain', 'custom', 'organizational', 'workflow', 'quality')),
  CONSTRAINT valid_visibility CHECK (visibility IN ('public', 'private', 'team', 'department'))
);

-- Tag hierarchies
CREATE TABLE IF NOT EXISTS tag_hierarchies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_tag_id uuid REFERENCES tag_registry(id) ON DELETE CASCADE NOT NULL,
  child_tag_id uuid REFERENCES tag_registry(id) ON DELETE CASCADE NOT NULL,
  relationship_type text DEFAULT 'parent_child',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT different_tags CHECK (parent_tag_id != child_tag_id),
  CONSTRAINT unique_tag_relationship UNIQUE (parent_tag_id, child_tag_id)
);

-- Tag metadata
CREATE TABLE IF NOT EXISTS tag_metadata_extended (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid REFERENCES tag_registry(id) ON DELETE CASCADE NOT NULL UNIQUE,
  aliases text[] DEFAULT '{}',
  keywords text[] DEFAULT '{}',
  auto_suggest_enabled boolean DEFAULT true,
  min_confidence_score numeric(3, 2) DEFAULT 0.7,
  is_deprecated boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Prompt tag assignments
CREATE TABLE IF NOT EXISTS prompt_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE NOT NULL,
  tag_id uuid REFERENCES tag_registry(id) ON DELETE CASCADE NOT NULL,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assignment_source text DEFAULT 'manual',
  confidence_score numeric(3, 2),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_prompt_tag_assignment UNIQUE (prompt_id, tag_id),
  CONSTRAINT valid_assignment_source CHECK (assignment_source IN ('manual', 'auto_suggest', 'ai_generated'))
);

-- Tag suggestions
CREATE TABLE IF NOT EXISTS tag_auto_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid REFERENCES prompts(id) ON DELETE CASCADE NOT NULL,
  tag_id uuid REFERENCES tag_registry(id) ON DELETE CASCADE NOT NULL,
  confidence_score numeric(3, 2) NOT NULL,
  is_accepted boolean,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_confidence CHECK (confidence_score >= 0 AND confidence_score <= 1),
  CONSTRAINT unique_suggestion UNIQUE (prompt_id, tag_id)
);

-- Tag analytics
CREATE TABLE IF NOT EXISTS tag_usage_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid REFERENCES tag_registry(id) ON DELETE CASCADE NOT NULL,
  metric_date date NOT NULL,
  usage_count integer DEFAULT 0,
  unique_prompts integer DEFAULT 0,
  trend_direction text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_tag_date UNIQUE (tag_id, metric_date),
  CONSTRAINT valid_trend CHECK (trend_direction IN ('up', 'down', 'stable'))
);

-- Tag governance
CREATE TABLE IF NOT EXISTS tag_governance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid REFERENCES tag_registry(id) ON DELETE CASCADE,
  action text NOT NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  status text DEFAULT 'pending',
  request_details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_action CHECK (action IN ('create', 'update', 'delete', 'deprecate')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Indexes
CREATE INDEX idx_tag_registry_slug ON tag_registry(slug);
CREATE INDEX idx_tag_registry_type ON tag_registry(tag_type);
CREATE INDEX idx_tag_registry_usage ON tag_registry(usage_count DESC);
CREATE INDEX idx_tag_hierarchies_parent ON tag_hierarchies(parent_tag_id);
CREATE INDEX idx_tag_hierarchies_child ON tag_hierarchies(child_tag_id);
CREATE INDEX idx_prompt_tag_assignments_prompt ON prompt_tag_assignments(prompt_id);
CREATE INDEX idx_prompt_tag_assignments_tag ON prompt_tag_assignments(tag_id);
CREATE INDEX idx_tag_suggestions_prompt ON tag_auto_suggestions(prompt_id);
CREATE INDEX idx_tag_analytics_tag ON tag_usage_analytics(tag_id);
CREATE INDEX idx_tag_registry_fulltext ON tag_registry USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- RLS
ALTER TABLE tag_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_hierarchies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_metadata_extended ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_auto_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_governance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View approved public tags" ON tag_registry FOR SELECT TO authenticated USING ((is_approved = true AND visibility = 'public') OR created_by = auth.uid());
CREATE POLICY "Create custom tags" ON tag_registry FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND tag_type = 'custom');
CREATE POLICY "Service full access tags" ON tag_registry FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View hierarchies" ON tag_hierarchies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full access hierarchies" ON tag_hierarchies FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View metadata" ON tag_metadata_extended FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full access metadata" ON tag_metadata_extended FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View assignments" ON prompt_tag_assignments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM prompts WHERE prompts.id = prompt_tag_assignments.prompt_id AND (prompts.visibility = 'public' OR prompts.author_id = auth.uid())));
CREATE POLICY "Create assignments" ON prompt_tag_assignments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM prompts WHERE prompts.id = prompt_tag_assignments.prompt_id AND prompts.author_id = auth.uid()));
CREATE POLICY "Service full access assignments" ON prompt_tag_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View suggestions" ON tag_auto_suggestions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM prompts WHERE prompts.id = tag_auto_suggestions.prompt_id AND prompts.author_id = auth.uid()));
CREATE POLICY "Service full access suggestions" ON tag_auto_suggestions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View analytics" ON tag_usage_analytics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full access analytics" ON tag_usage_analytics FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View own governance" ON tag_governance_requests FOR SELECT TO authenticated USING (requested_by = auth.uid());
CREATE POLICY "Create governance" ON tag_governance_requests FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid());
CREATE POLICY "Service full access governance" ON tag_governance_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Functions
CREATE OR REPLACE FUNCTION update_tag_registry_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tag_registry SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tag_registry SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = OLD.tag_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tag_usage_trigger
  AFTER INSERT OR DELETE ON prompt_tag_assignments
  FOR EACH ROW EXECUTE FUNCTION update_tag_registry_usage_count();

-- Seed tags
INSERT INTO tag_registry (name, slug, tag_type, is_system_tag, visibility, description, color)
VALUES
  ('Customer Service', 'customer-service', 'category', true, 'public', 'Customer support content', '#3B82F6'),
  ('Technical', 'technical', 'category', true, 'public', 'Technical content', '#8B5CF6'),
  ('Marketing', 'marketing', 'category', true, 'public', 'Marketing content', '#EC4899'),
  ('Sales', 'sales', 'category', true, 'public', 'Sales content', '#10B981'),
  ('High Quality', 'high-quality', 'quality', true, 'public', 'Verified high-quality prompts', '#22C55E'),
  ('Beginner Friendly', 'beginner-friendly', 'quality', true, 'public', 'Easy to use', '#06B6D4')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tag_metadata_extended (tag_id, auto_suggest_enabled)
SELECT id, true FROM tag_registry WHERE id IS NOT NULL ON CONFLICT (tag_id) DO NOTHING;
