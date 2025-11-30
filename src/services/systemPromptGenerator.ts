import { supabase } from '../lib/supabase';

export interface PromptGenerationInput {
  department?: string;
  team?: string;
  role: string;
  taskName: string;
  customContext?: string;
  tone?: string;
  outputFormat?: string;
  constraints?: string[];
  includeExamples?: boolean;
  templateId?: string;
}

export interface GeneratedSystemPrompt {
  id: string;
  department?: string;
  team?: string;
  role: string;
  taskName: string;
  generatedPrompt: string;
  promptStructure: any;
  tone: string;
  constraints: string[];
  outputFormat: string;
  examples: any[];
  status: string;
  qualityScore: number;
  previewApproved: boolean;
}

export interface BulkGenerationInput {
  roles: string[];
  tasks: string[];
  department?: string;
  team?: string;
  sharedSettings?: {
    tone?: string;
    outputFormat?: string;
    constraints?: string[];
  };
}

export class SystemPromptGenerator {
  private static instance: SystemPromptGenerator;

  private constructor() {}

  static getInstance(): SystemPromptGenerator {
    if (!SystemPromptGenerator.instance) {
      SystemPromptGenerator.instance = new SystemPromptGenerator();
    }
    return SystemPromptGenerator.instance;
  }

  async generatePrompt(input: PromptGenerationInput): Promise<GeneratedSystemPrompt> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const { data: requestRecord } = await supabase
      .from('prompt_generation_requests')
      .insert({
        user_id: user.id,
        request_type: 'single',
        input_parameters: input,
        total_combinations: 1,
      })
      .select()
      .single();

    const template = input.templateId
      ? await this.getTemplate(input.templateId)
      : await this.selectBestTemplate(input.role, input.taskName);

    const components = await this.getRelevantComponents(input.role, input.taskName);
    const examples = input.includeExamples
      ? await this.getRelevantExamples(input.role, input.taskName)
      : [];

    const promptText = this.buildPromptText(input, template, components, examples);
    const promptStructure = this.buildPromptStructure(input, template);
    const qualityScore = this.calculateQualityScore(promptText, input);

    const { data: generatedPrompt } = await supabase
      .from('generated_system_prompts')
      .insert({
        generation_request_id: requestRecord.id,
        department: input.department,
        team: input.team,
        role: input.role,
        task_name: input.taskName,
        generated_prompt: promptText,
        prompt_structure: promptStructure,
        tone: input.tone || template?.default_tone || 'professional',
        constraints: input.constraints || [],
        output_format: input.outputFormat || 'structured',
        examples: examples,
        template_used: template?.id,
        status: 'preview',
        quality_score: qualityScore,
        created_by: user.id,
      })
      .select()
      .single();

    await supabase.from('prompt_generation_history').insert({
      generated_prompt_id: generatedPrompt.id,
      action: 'created',
      performed_by: user.id,
    });

    await supabase
      .from('prompt_generation_requests')
      .update({
        status: 'completed',
        completed_count: 1,
      })
      .eq('id', requestRecord.id);

    return generatedPrompt as GeneratedSystemPrompt;
  }

  private buildPromptText(
    input: PromptGenerationInput,
    template: any,
    components: any[],
    examples: any[]
  ): string {
    let prompt = '# System Prompt\n\n';

    prompt += this.buildRoleSection(input);
    prompt += this.buildContextSection(input);
    prompt += this.buildConstraintsSection(input, components);
    prompt += this.buildToneSection(input, components);
    prompt += this.buildOutputFormatSection(input, components);

    if (examples.length > 0) {
      prompt += this.buildExamplesSection(examples);
    }

    prompt += this.buildInstructionsSection(input);

    return prompt;
  }

  private buildRoleSection(input: PromptGenerationInput): string {
    let section = `## Role Definition\n\n`;
    section += `You are an AI assistant serving as a ${input.role}`;

    if (input.department) {
      section += ` in the ${input.department} department`;
    }

    if (input.team) {
      section += ` on the ${input.team} team`;
    }

    section += `. Your primary responsibility is to assist with: **${input.taskName}**.\n\n`;

    return section;
  }

  private buildContextSection(input: PromptGenerationInput): string {
    let section = `## Context\n\n`;

    section += `As a ${input.role}, you are expected to:\n`;
    section += `- Understand the specific requirements of ${input.taskName}\n`;
    section += `- Apply best practices relevant to this role and task\n`;
    section += `- Consider organizational context and team dynamics\n`;

    if (input.customContext) {
      section += `\nAdditional context: ${input.customContext}\n`;
    }

    section += '\n';
    return section;
  }

  private buildConstraintsSection(input: PromptGenerationInput, components: any[]): string {
    let section = `## Constraints\n\n`;
    section += `You must adhere to the following constraints:\n\n`;

    if (input.constraints && input.constraints.length > 0) {
      input.constraints.forEach(constraint => {
        section += `- ${constraint}\n`;
      });
    } else {
      section += `- Provide accurate, relevant information\n`;
      section += `- Stay within the scope of the task\n`;
      section += `- Respect confidentiality and privacy\n`;
      section += `- Follow organizational policies and guidelines\n`;
    }

    section += '\n';
    return section;
  }

  private buildToneSection(input: PromptGenerationInput, components: any[]): string {
    const tone = input.tone || 'professional';
    let section = `## Tone Guidelines\n\n`;

    const toneDescriptions: Record<string, string> = {
      professional:
        'Maintain a professional, courteous tone. Use clear, concise language. Be respectful and business-appropriate.',
      casual:
        'Use a friendly, conversational tone. Be approachable and relatable while remaining helpful.',
      formal:
        'Use formal, precise language. Maintain a serious, authoritative tone appropriate for official communications.',
      friendly:
        'Be warm and welcoming. Show empathy and understanding. Create a positive, supportive atmosphere.',
      technical:
        'Use technical terminology appropriately. Be precise and detailed. Assume technical competence from the audience.',
      empathetic:
        'Show understanding and compassion. Acknowledge emotions. Provide supportive, caring responses.',
    };

    section += toneDescriptions[tone] || toneDescriptions.professional;
    section += '\n\n';

    return section;
  }

  private buildOutputFormatSection(input: PromptGenerationInput, components: any[]): string {
    let section = `## Output Format\n\n`;
    section += `Structure your responses as follows:\n\n`;

    if (input.outputFormat === 'structured') {
      section += `- Use clear headers and sections\n`;
      section += `- Employ bullet points for lists\n`;
      section += `- Use numbered steps for processes\n`;
      section += `- Provide summaries for complex information\n`;
    } else if (input.outputFormat === 'conversational') {
      section += `- Write in natural, flowing paragraphs\n`;
      section += `- Use transitions between ideas\n`;
      section += `- Maintain a conversational flow\n`;
    } else {
      section += `- Format responses appropriately for the task\n`;
      section += `- Use structure when beneficial\n`;
      section += `- Prioritize clarity and readability\n`;
    }

    section += '\n';
    return section;
  }

  private buildExamplesSection(examples: any[]): string {
    let section = `## Examples\n\n`;
    section += `Here are examples of expected interactions:\n\n`;

    examples.forEach((example, index) => {
      section += `### Example ${index + 1}: ${example.example_name}\n\n`;
      section += `**Input:**\n${example.input_example}\n\n`;
      section += `**Expected Output:**\n${example.expected_output}\n\n`;

      if (example.explanation) {
        section += `**Note:** ${example.explanation}\n\n`;
      }
    });

    return section;
  }

  private buildInstructionsSection(input: PromptGenerationInput): string {
    let section = `## Instructions\n\n`;
    section += `When responding:\n\n`;
    section += `1. **Understand the Request:** Carefully read and analyze the user's input\n`;
    section += `2. **Apply Context:** Consider the role, task, and organizational context\n`;
    section += `3. **Follow Guidelines:** Adhere to tone, constraints, and format requirements\n`;
    section += `4. **Provide Value:** Deliver helpful, actionable, and relevant responses\n`;
    section += `5. **Be Complete:** Ensure all aspects of the request are addressed\n`;
    section += `6. **Maintain Quality:** Review your response for accuracy and clarity\n\n`;

    section += `Remember: Your goal is to effectively assist with ${input.taskName} in your capacity as a ${input.role}.\n`;

    return section;
  }

  private buildPromptStructure(input: PromptGenerationInput, template: any): any {
    return {
      template: template?.template_name || 'Custom',
      sections: ['role', 'context', 'constraints', 'tone', 'output_format', 'examples', 'instructions'],
      parameters: {
        role: input.role,
        task: input.taskName,
        department: input.department,
        team: input.team,
        tone: input.tone,
        outputFormat: input.outputFormat,
      },
    };
  }

  private calculateQualityScore(promptText: string, input: PromptGenerationInput): number {
    let score = 50;

    if (promptText.length > 500) score += 10;
    if (promptText.length > 1000) score += 10;

    if (input.constraints && input.constraints.length > 0) score += 10;
    if (input.customContext) score += 5;
    if (input.outputFormat) score += 5;
    if (input.includeExamples) score += 10;

    return Math.min(score, 100);
  }

  async bulkGenerate(input: BulkGenerationInput): Promise<{
    requestId: string;
    totalCombinations: number;
    prompts: GeneratedSystemPrompt[];
  }> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const combinations = input.roles.length * input.tasks.length;

    const { data: requestRecord } = await supabase
      .from('prompt_generation_requests')
      .insert({
        user_id: user.id,
        request_type: 'bulk',
        input_parameters: input,
        total_combinations: combinations,
        status: 'processing',
      })
      .select()
      .single();

    const prompts: GeneratedSystemPrompt[] = [];
    let completed = 0;

    for (const role of input.roles) {
      for (const task of input.tasks) {
        try {
          const prompt = await this.generatePrompt({
            role,
            taskName: task,
            department: input.department,
            team: input.team,
            tone: input.sharedSettings?.tone,
            outputFormat: input.sharedSettings?.outputFormat,
            constraints: input.sharedSettings?.constraints,
            includeExamples: true,
          });

          prompts.push(prompt);
          completed++;
        } catch (error) {
          console.error(`Failed to generate prompt for ${role} - ${task}:`, error);
        }
      }
    }

    await supabase
      .from('prompt_generation_requests')
      .update({
        status: 'completed',
        completed_count: completed,
        failed_count: combinations - completed,
      })
      .eq('id', requestRecord.id);

    return {
      requestId: requestRecord.id,
      totalCombinations: combinations,
      prompts,
    };
  }

  async approvePrompt(promptId: string): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    await supabase
      .from('generated_system_prompts')
      .update({
        status: 'approved',
        preview_approved: true,
      })
      .eq('id', promptId);

    await supabase.from('prompt_generation_history').insert({
      generated_prompt_id: promptId,
      action: 'approved',
      performed_by: user.id,
    });
  }

  async publishToLibrary(promptId: string): Promise<string> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const { data: prompt } = await supabase
      .from('generated_system_prompts')
      .select('*')
      .eq('id', promptId)
      .single();

    if (!prompt) throw new Error('Prompt not found');

    const { data: libraryPrompt } = await supabase
      .from('prompts')
      .insert({
        title: `${prompt.role} - ${prompt.task_name}`,
        description: `AI system prompt for ${prompt.role} performing ${prompt.task_name}`,
        content: prompt.generated_prompt,
        role: prompt.role,
        department: prompt.department,
        workflow: prompt.task_name,
        prompt_type: 'System',
        status: 'Active',
        author_id: user.id,
        visibility: 'public',
      })
      .select()
      .single();

    await supabase
      .from('generated_system_prompts')
      .update({
        status: 'published',
        added_to_library: true,
        library_prompt_id: libraryPrompt.id,
      })
      .eq('id', promptId);

    await supabase.from('prompt_generation_history').insert({
      generated_prompt_id: promptId,
      action: 'published',
      performed_by: user.id,
    });

    return libraryPrompt.id;
  }

  async exportToCSV(promptIds: string[]): Promise<string> {
    const { data: prompts } = await supabase
      .from('generated_system_prompts')
      .select('*')
      .in('id', promptIds);

    if (!prompts || prompts.length === 0) {
      throw new Error('No prompts found');
    }

    let csv = 'Role,Task,Department,Team,Tone,Status,Prompt\n';

    prompts.forEach((prompt: any) => {
      const row = [
        this.escapeCSV(prompt.role),
        this.escapeCSV(prompt.task_name),
        this.escapeCSV(prompt.department || ''),
        this.escapeCSV(prompt.team || ''),
        this.escapeCSV(prompt.tone),
        this.escapeCSV(prompt.status),
        this.escapeCSV(prompt.generated_prompt),
      ].join(',');
      csv += row + '\n';
    });

    return csv;
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private async getTemplate(templateId: string): Promise<any> {
    const { data } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    return data;
  }

  private async selectBestTemplate(role: string, taskName: string): Promise<any> {
    const { data } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('is_system_template', true)
      .order('usage_count', { ascending: false })
      .limit(1)
      .single();

    return data;
  }

  private async getRelevantComponents(role: string, taskName: string): Promise<any[]> {
    const { data } = await supabase
      .from('prompt_components')
      .select('*')
      .or(`applicable_roles.cs.{${role}},applicable_tasks.cs.{${taskName}}`)
      .limit(10);

    return data || [];
  }

  private async getRelevantExamples(role: string, taskName: string): Promise<any[]> {
    const { data } = await supabase
      .from('prompt_examples')
      .select('*')
      .or(`role.eq.${role},task_name.eq.${taskName}`)
      .limit(3);

    return data || [];
  }

  async getGeneratedPrompts(filters?: {
    status?: string;
    role?: string;
    addedToLibrary?: boolean;
  }): Promise<GeneratedSystemPrompt[]> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    let query = supabase
      .from('generated_system_prompts')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.role) {
      query = query.eq('role', filters.role);
    }

    if (filters?.addedToLibrary !== undefined) {
      query = query.eq('added_to_library', filters.addedToLibrary);
    }

    const { data } = await query;
    return (data || []) as GeneratedSystemPrompt[];
  }

  private async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }
}

export const systemPromptGenerator = SystemPromptGenerator.getInstance();
