/*
  # System Prompt Generation Service

  ## Overview
  Automatic generation of AI system prompts based on role-task combinations with:
  - Contextual prompt generation
  - Template system
  - Bulk generation
  - Preview capabilities
  - Export to CSV/Excel
  - Best practices integration

  ## New Tables
  1. **prompt_templates** - Reusable prompt templates
  2. **generated_system_prompts** - Generated prompts
  3. **prompt_generation_requests** - Bulk generation tracking
  4. **prompt_components** - Reusable prompt components
  5. **prompt_examples** - Example outputs
  6. **prompt_generation_history** - Generation audit trail
*/

-- =============================================================================
-- 1. PROMPT TEMPLATES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL UNIQUE,
  template_category text NOT NULL,
  description text,
  template_structure jsonb NOT NULL,
  variables text[] DEFAULT '{}',
  default_tone text DEFAULT 'professional',
  default_style text DEFAULT 'structured',
  is_system_template boolean DEFAULT false,
  usage_count integer DEFAULT 0,
  rating_average numeric(3, 2) DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_category CHECK (template_category IN ('general', 'sales', 'support', 'technical', 'creative', 'analytical', 'operational')),
  CONSTRAINT valid_tone CHECK (default_tone IN ('professional', 'casual', 'formal', 'friendly', 'technical', 'empathetic'))
);

-- =============================================================================
-- 2. GENERATED SYSTEM PROMPTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS generated_system_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_request_id uuid,
  department text,
  team text,
  role text NOT NULL,
  task_name text NOT NULL,
  generated_prompt text NOT NULL,
  prompt_structure jsonb,
  tone text,
  constraints jsonb DEFAULT '[]',
  output_format text,
  examples jsonb DEFAULT '[]',
  template_used uuid REFERENCES prompt_templates(id) ON DELETE SET NULL,
  status text DEFAULT 'draft',
  preview_approved boolean DEFAULT false,
  added_to_library boolean DEFAULT false,
  library_prompt_id uuid,
  quality_score numeric(3, 2),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'preview', 'approved', 'published', 'archived'))
);

-- =============================================================================
-- 3. PROMPT GENERATION REQUESTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_generation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  request_type text DEFAULT 'single',
  input_parameters jsonb NOT NULL,
  total_combinations integer DEFAULT 1,
  completed_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  status text DEFAULT 'pending',
  processing_time_ms integer,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT valid_request_type CHECK (request_type IN ('single', 'bulk', 'batch')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial'))
);

-- =============================================================================
-- 4. PROMPT COMPONENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_name text NOT NULL UNIQUE,
  component_type text NOT NULL,
  content_template text NOT NULL,
  variables text[] DEFAULT '{}',
  applicable_roles text[] DEFAULT '{}',
  applicable_tasks text[] DEFAULT '{}',
  usage_count integer DEFAULT 0,
  is_system_component boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_component_type CHECK (component_type IN ('role_definition', 'constraint', 'tone_guideline', 'output_format', 'example', 'context'))
);

-- =============================================================================
-- 5. PROMPT EXAMPLES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  example_name text NOT NULL,
  role text,
  task_name text,
  input_example text NOT NULL,
  expected_output text NOT NULL,
  explanation text,
  is_few_shot boolean DEFAULT true,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 6. PROMPT GENERATION HISTORY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_generation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_prompt_id uuid REFERENCES generated_system_prompts(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  old_value text,
  new_value text,
  notes text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_action CHECK (action IN ('created', 'previewed', 'approved', 'rejected', 'modified', 'exported', 'published'))
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_prompt_templates_category ON prompt_templates(template_category);
CREATE INDEX idx_prompt_templates_usage ON prompt_templates(usage_count DESC);
CREATE INDEX idx_generated_prompts_role ON generated_system_prompts(role);
CREATE INDEX idx_generated_prompts_task ON generated_system_prompts(task_name);
CREATE INDEX idx_generated_prompts_status ON generated_system_prompts(status);
CREATE INDEX idx_generated_prompts_library ON generated_system_prompts(added_to_library);
CREATE INDEX idx_generation_requests_user ON prompt_generation_requests(user_id);
CREATE INDEX idx_generation_requests_status ON prompt_generation_requests(status);
CREATE INDEX idx_prompt_components_type ON prompt_components(component_type);
CREATE INDEX idx_prompt_examples_role ON prompt_examples(role);
CREATE INDEX idx_generation_history_prompt ON prompt_generation_history(generated_prompt_id);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_generation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_generation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View templates" ON prompt_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full templates" ON prompt_templates FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View own prompts" ON generated_system_prompts FOR SELECT TO authenticated USING (created_by = auth.uid() OR added_to_library = true);
CREATE POLICY "Create prompts" ON generated_system_prompts FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Update own prompts" ON generated_system_prompts FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Service full prompts" ON generated_system_prompts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View own requests" ON prompt_generation_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Create requests" ON prompt_generation_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service full requests" ON prompt_generation_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View components" ON prompt_components FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full components" ON prompt_components FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View examples" ON prompt_examples FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service full examples" ON prompt_examples FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "View own history" ON prompt_generation_history FOR SELECT TO authenticated USING (performed_by = auth.uid());
CREATE POLICY "Service full history" ON prompt_generation_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- SEED TEMPLATES
-- =============================================================================

INSERT INTO prompt_templates (template_name, template_category, description, template_structure, variables, is_system_template)
VALUES
  ('Sales Support', 'sales', 'Template for sales-related AI assistance', 
   '{"sections": ["role", "context", "constraints", "tone", "output_format", "examples"]}',
   ARRAY['role', 'task', 'department', 'team'], true),
  ('Technical Support', 'support', 'Template for technical support scenarios',
   '{"sections": ["role", "context", "constraints", "tone", "output_format", "examples"]}',
   ARRAY['role', 'task', 'technical_level'], true),
  ('General Assistant', 'general', 'Flexible template for general tasks',
   '{"sections": ["role", "context", "tone", "output_format"]}',
   ARRAY['role', 'task', 'context'], true)
ON CONFLICT (template_name) DO NOTHING;

-- =============================================================================
-- SEED COMPONENTS
-- =============================================================================

INSERT INTO prompt_components (component_name, component_type, content_template, variables, is_system_component)
VALUES
  ('Professional Tone', 'tone_guideline', 'Maintain a professional, courteous tone in all interactions. Use clear, concise language.', ARRAY[]::text[], true),
  ('Structured Output', 'output_format', 'Format responses in a clear, structured manner using:\n- Bullet points for lists\n- Numbered steps for processes\n- Clear headers for sections', ARRAY[]::text[], true),
  ('Constraint Template', 'constraint', 'Adhere to the following constraints:\n- Maximum response length: {max_length}\n- Required information: {required_fields}\n- Prohibited content: {prohibited}', ARRAY['max_length', 'required_fields', 'prohibited'], true)
ON CONFLICT (component_name) DO NOTHING;

-- =============================================================================
-- SEED EXAMPLES
-- =============================================================================

INSERT INTO prompt_examples (example_name, role, task_name, input_example, expected_output, explanation, is_few_shot)
VALUES
  ('Sales Email', 'Account Executive', 'Cold Outreach', 
   'Company: TechCorp, Industry: SaaS, Pain Point: Manual data entry',
   'Subject: Automate Your Data Entry Process\n\nHi [Name],\n\nI noticed TechCorp is in the SaaS space. Many companies like yours struggle with manual data entry...',
   'Professional, value-focused cold email', true),
  ('Support Response', 'Customer Support', 'Technical Issue Resolution',
   'Customer reports: Cannot log in to account',
   '1. Verify email address\n2. Check password reset option\n3. Clear browser cache\n4. Try alternate browser',
   'Structured troubleshooting steps', true)
ON CONFLICT DO NOTHING;
