import { supabase } from '../lib/supabase';

export interface GenerationRequest {
  workflowDescription: string;
  outputRequirements?: {
    tone?: 'professional' | 'casual' | 'formal' | 'friendly' | 'technical' | 'creative';
    style?: 'concise' | 'detailed' | 'structured' | 'conversational' | 'instructional';
    length?: 'short' | 'medium' | 'long' | 'very_long';
    constraints?: string[];
    keywords?: string[];
    examples?: string[];
  };
  modelProvider?: 'openai' | 'anthropic';
  numCandidates?: number;
}

export interface GeneratedCandidate {
  id: string;
  candidateNumber: number;
  generatedPrompt: string;
  qualityScore: number;
  diversityScore: number;
  reasoning: string;
  tokensUsed: number;
  isSelected: boolean;
}

export interface GenerationResponse {
  requestId: string;
  candidates: GeneratedCandidate[];
  totalCost: number;
  cacheHit: boolean;
  processingTime: number;
}

export class AIPromptGenerator {
  private static instance: AIPromptGenerator;
  private cacheTimeout = 24 * 60 * 60 * 1000;

  private constructor() {}

  static getInstance(): AIPromptGenerator {
    if (!AIPromptGenerator.instance) {
      AIPromptGenerator.instance = new AIPromptGenerator();
    }
    return AIPromptGenerator.instance;
  }

  async generatePrompts(request: GenerationRequest): Promise<GenerationResponse> {
    const startTime = Date.now();
    const user = await this.getCurrentUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    await this.checkRateLimit(user.id);

    const cacheKey = this.generateCacheKey(request);
    const cachedResult = await this.getCachedResult(cacheKey);

    if (cachedResult) {
      await this.incrementRateLimit(user.id);
      await this.updateMetrics(user.id, 0, 0, true);
      return cachedResult;
    }

    const modelConfig = await this.getModelConfig(request.modelProvider || 'openai');

    const { data: requestRecord, error: requestError } = await supabase
      .from('ai_generation_requests')
      .insert({
        user_id: user.id,
        workflow_description: request.workflowDescription,
        output_requirements: request.outputRequirements || {},
        tone: request.outputRequirements?.tone,
        style: request.outputRequirements?.style,
        length: request.outputRequirements?.length,
        constraints: request.outputRequirements?.constraints || [],
        model_config_id: modelConfig.id,
        status: 'processing',
      })
      .select()
      .single();

    if (requestError) throw requestError;

    try {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(request);

      const candidates = await this.callLLMAPI(
        modelConfig,
        systemPrompt,
        userPrompt,
        request.numCandidates || 3
      );

      const candidateRecords = [];
      let totalTokens = 0;
      let totalCost = 0;

      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        const tokens = this.estimateTokens(candidate.prompt);
        const cost = (tokens / 1000) * (modelConfig.cost_per_1k_tokens || 0);

        totalTokens += tokens;
        totalCost += cost;

        const { data: candidateRecord } = await supabase
          .from('ai_generated_candidates')
          .insert({
            request_id: requestRecord.id,
            candidate_number: i + 1,
            generated_prompt: candidate.prompt,
            quality_score: candidate.qualityScore,
            diversity_score: candidate.diversityScore,
            reasoning: candidate.reasoning,
            tokens_used: tokens,
            generation_cost: cost,
          })
          .select()
          .single();

        candidateRecords.push(candidateRecord);
      }

      const processingTime = Date.now() - startTime;

      await supabase
        .from('ai_generation_requests')
        .update({
          status: 'completed',
          total_candidates: candidates.length,
          processing_time_ms: processingTime,
          total_cost: totalCost,
          completed_at: new Date().toISOString(),
        })
        .eq('id', requestRecord.id);

      await this.incrementRateLimit(user.id);
      await this.updateMetrics(user.id, totalTokens, totalCost, false);

      const response: GenerationResponse = {
        requestId: requestRecord.id,
        candidates: candidateRecords as GeneratedCandidate[],
        totalCost,
        cacheHit: false,
        processingTime,
      };

      await this.cacheResult(cacheKey, response);

      return response;
    } catch (error: any) {
      await supabase
        .from('ai_generation_requests')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', requestRecord.id);

      throw error;
    }
  }

  private buildSystemPrompt(): string {
    return `You are an expert prompt engineer specializing in creating effective prompts for large language models.

Your task is to generate multiple high-quality prompt variations based on user requirements.

Key principles:
1. Use clear, specific instructions
2. Include relevant context and constraints
3. Apply chain-of-thought reasoning when appropriate
4. Provide few-shot examples when beneficial
5. Structure prompts for optimal LLM performance

Generate prompts that are:
- Clear and unambiguous
- Appropriately detailed for the use case
- Structured with proper formatting
- Optimized for the specified tone and style
- Diverse in approach while meeting requirements`;
  }

  private buildUserPrompt(request: GenerationRequest): string {
    const { workflowDescription, outputRequirements } = request;

    let prompt = `Generate ${request.numCandidates || 3} diverse prompt variations for the following workflow:\n\n`;
    prompt += `Workflow Description: ${workflowDescription}\n\n`;

    if (outputRequirements) {
      prompt += `Requirements:\n`;
      if (outputRequirements.tone) prompt += `- Tone: ${outputRequirements.tone}\n`;
      if (outputRequirements.style) prompt += `- Style: ${outputRequirements.style}\n`;
      if (outputRequirements.length) prompt += `- Length: ${outputRequirements.length}\n`;
      if (outputRequirements.constraints?.length) {
        prompt += `- Constraints:\n`;
        outputRequirements.constraints.forEach(c => {
          prompt += `  * ${c}\n`;
        });
      }
      if (outputRequirements.keywords?.length) {
        prompt += `- Keywords to include: ${outputRequirements.keywords.join(', ')}\n`;
      }
      if (outputRequirements.examples?.length) {
        prompt += `- Example scenarios:\n`;
        outputRequirements.examples.forEach(ex => {
          prompt += `  * ${ex}\n`;
        });
      }
    }

    prompt += `\nFor each variation, provide:
1. The complete prompt text
2. A quality score (0-100) based on clarity, specificity, and effectiveness
3. A diversity score (0-100) indicating how different it is from other variations
4. Brief reasoning explaining the approach

Format your response as JSON:
{
  "candidates": [
    {
      "prompt": "...",
      "qualityScore": 85,
      "diversityScore": 90,
      "reasoning": "..."
    }
  ]
}`;

    return prompt;
  }

  private async callLLMAPI(
    modelConfig: any,
    systemPrompt: string,
    userPrompt: string,
    numCandidates: number
  ): Promise<any[]> {
    const mockResponse = {
      candidates: Array.from({ length: numCandidates }, (_, i) => ({
        prompt: this.generateMockPrompt(i + 1),
        qualityScore: 75 + Math.random() * 20,
        diversityScore: 70 + Math.random() * 25,
        reasoning: `Variation ${i + 1}: Focuses on ${['clarity and structure', 'detailed instructions', 'concise format'][i % 3]}`,
      })),
    };

    return mockResponse.candidates;
  }

  private generateMockPrompt(num: number): string {
    return `# Prompt Variation ${num}

## Context
You are an AI assistant tasked with helping users complete their workflow efficiently.

## Task
[Detailed task description based on workflow]

## Instructions
1. First, analyze the input carefully
2. Consider the context and constraints
3. Generate the output in the specified format
4. Ensure quality and completeness

## Output Format
[Structured format specification]

## Constraints
- Follow the specified tone and style
- Stay within length requirements
- Include all required elements

## Examples
[Few-shot examples if applicable]`;
  }

  async refinePrompt(
    candidateId: string,
    refinements: {
      tone?: string;
      complexity?: 'simpler' | 'more_complex';
      keywords?: string[];
      additionalContext?: string;
    }
  ): Promise<GeneratedCandidate> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const { data: candidate } = await supabase
      .from('ai_generated_candidates')
      .select('*')
      .eq('id', candidateId)
      .single();

    if (!candidate) throw new Error('Candidate not found');

    let refinedPrompt = candidate.generated_prompt;

    if (refinements.complexity === 'simpler') {
      refinedPrompt = this.simplifyPrompt(refinedPrompt);
    } else if (refinements.complexity === 'more_complex') {
      refinedPrompt = this.complexifyPrompt(refinedPrompt);
    }

    if (refinements.keywords?.length) {
      refinedPrompt = this.addKeywords(refinedPrompt, refinements.keywords);
    }

    if (refinements.additionalContext) {
      refinedPrompt = this.addContext(refinedPrompt, refinements.additionalContext);
    }

    const { data: refined } = await supabase
      .from('ai_generated_candidates')
      .insert({
        request_id: candidate.request_id,
        candidate_number: candidate.candidate_number + 100,
        generated_prompt: refinedPrompt,
        quality_score: candidate.quality_score,
        diversity_score: candidate.diversity_score,
        reasoning: `Refined version with: ${Object.keys(refinements).join(', ')}`,
        tokens_used: this.estimateTokens(refinedPrompt),
      })
      .select()
      .single();

    return refined as GeneratedCandidate;
  }

  private simplifyPrompt(prompt: string): string {
    return prompt.replace(/## Examples[\s\S]*?(?=##|$)/, '')
      .replace(/\d+\.\s+/g, '- ')
      .trim();
  }

  private complexifyPrompt(prompt: string): string {
    return `${prompt}\n\n## Advanced Considerations\n- Edge cases to handle\n- Performance optimization tips\n- Error handling strategies`;
  }

  private addKeywords(prompt: string, keywords: string[]): string {
    const keywordSection = `\n\n## Key Terms\nFocus on: ${keywords.join(', ')}`;
    return prompt + keywordSection;
  }

  private addContext(prompt: string, context: string): string {
    return prompt.replace('## Context', `## Context\n${context}\n\n## Additional Context`);
  }

  async submitFeedback(
    candidateId: string,
    feedback: {
      rating: number;
      type: 'positive' | 'negative' | 'neutral' | 'suggestion';
      text?: string;
      improvements?: string[];
      wasUsed?: boolean;
    }
  ): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    await supabase.from('ai_generation_feedback').insert({
      candidate_id: candidateId,
      user_id: user.id,
      rating: feedback.rating,
      feedback_type: feedback.type,
      feedback_text: feedback.text,
      improvements_suggested: feedback.improvements || [],
      was_used: feedback.wasUsed || false,
    });
  }

  private async checkRateLimit(userId: string): Promise<void> {
    const { data } = await supabase.rpc('check_rate_limit', { p_user_id: userId });

    if (!data?.allowed) {
      throw new Error(`Rate limit exceeded: ${data?.reason}`);
    }
  }

  private async incrementRateLimit(userId: string): Promise<void> {
    await supabase.rpc('increment_rate_limit', { p_user_id: userId });
  }

  private async updateMetrics(
    userId: string,
    tokens: number,
    cost: number,
    cacheHit: boolean
  ): Promise<void> {
    await supabase.rpc('update_ai_usage_metrics', {
      p_user_id: userId,
      p_tokens: tokens,
      p_cost: cost,
      p_cache_hit: cacheHit,
    });
  }

  private generateCacheKey(request: GenerationRequest): string {
    const key = JSON.stringify({
      workflow: request.workflowDescription,
      requirements: request.outputRequirements,
      provider: request.modelProvider,
    });
    return btoa(key);
  }

  private async getCachedResult(cacheKey: string): Promise<GenerationResponse | null> {
    await supabase.rpc('clean_expired_ai_cache');

    const { data } = await supabase
      .from('ai_request_cache')
      .select('cached_response, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();

    if (!data || new Date(data.expires_at) < new Date()) {
      return null;
    }

    await supabase
      .from('ai_request_cache')
      .update({
        hit_count: supabase.sql`hit_count + 1`,
        last_accessed_at: new Date().toISOString(),
      })
      .eq('cache_key', cacheKey);

    return data.cached_response as GenerationResponse;
  }

  private async cacheResult(cacheKey: string, response: GenerationResponse): Promise<void> {
    const expiresAt = new Date(Date.now() + this.cacheTimeout).toISOString();

    await supabase.from('ai_request_cache').upsert({
      cache_key: cacheKey,
      request_params: {},
      cached_response: response,
      expires_at: expiresAt,
      last_accessed_at: new Date().toISOString(),
    });
  }

  private async getModelConfig(provider: string): Promise<any> {
    const { data } = await supabase
      .from('ai_model_configs')
      .select('*')
      .eq('provider', provider)
      .eq('is_active', true)
      .order('cost_per_1k_tokens', { ascending: true })
      .limit(1)
      .single();

    return data;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.split(/\s+/).length * 1.3);
  }

  private async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  async getUserMetrics(userId: string, days: number = 30): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data } = await supabase
      .from('ai_usage_metrics')
      .select('*')
      .eq('user_id', userId)
      .gte('metric_date', startDate.toISOString().split('T')[0])
      .order('metric_date', { ascending: true });

    return data || [];
  }

  async getUserRateLimits(userId: string): Promise<any> {
    const { data } = await supabase
      .from('ai_rate_limits')
      .select('*')
      .eq('user_id', userId)
      .single();

    return data;
  }
}

export const aiPromptGenerator = AIPromptGenerator.getInstance();
