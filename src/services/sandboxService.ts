import { supabase } from '../lib/supabase';

export interface PromptVersion {
  id: string;
  prompt_text: string;
  scenario_id: string;
  scenario_name: string;
  version_number: number;
  created_at: string;
}

export interface TestResultData {
  id: string;
  prompt_version_id: string | null;
  test_input: string;
  test_output: string;
  accuracy: number;
  relevance: number;
  tone: number;
  consistency: number;
  created_at: string;
}

export interface TestScenario {
  id: string;
  scenarioName: string;
  scenarioCategory: string;
  description: string;
  sampleInputText?: string;
  sampleInputJson?: any;
  sampleInputForm?: any;
  expectedOutputFormat: string;
}

export interface ExecutionRequest {
  promptId?: string;
  promptText: string;
  scenarioId?: string;
  inputData: any;
  inputFormat: 'text' | 'json' | 'form' | 'csv';
  provider?: string;
  model?: string;
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  timeoutSeconds?: number;
}

export interface ExecutionResult {
  id: string;
  status: 'completed' | 'failed' | 'timeout';
  output?: string;
  outputJson?: any;
  metadata: {
    tokensUsed: number;
    promptTokens: number;
    completionTokens: number;
    executionTimeMs: number;
    modelVersion: string;
    provider: string;
    finishReason?: string;
  };
  errors?: ExecutionError[];
  resourceUsage: {
    tokensUsed: number;
    tokensLimit: number;
    executionTimeMs: number;
    executionTimeLimit: number;
    costEstimate: number;
    exceededLimits: boolean;
  };
}

export interface ExecutionError {
  type: string;
  code?: string;
  message: string;
  details?: any;
  isRetryable: boolean;
}

export class SandboxExecutionEngine {
  private static instance: SandboxExecutionEngine;

  private constructor() {}

  static getInstance(): SandboxExecutionEngine {
    if (!SandboxExecutionEngine.instance) {
      SandboxExecutionEngine.instance = new SandboxExecutionEngine();
    }
    return SandboxExecutionEngine.instance;
  }

  async getTestScenarios(category?: string): Promise<TestScenario[]> {
    let query = supabase
      .from('test_scenarios')
      .select('*')
      .eq('is_active', true)
      .order('scenario_name');

    if (category) {
      query = query.eq('scenario_category', category);
    }

    const { data } = await query;

    return (data || []).map(s => ({
      id: s.id,
      scenarioName: s.scenario_name,
      scenarioCategory: s.scenario_category,
      description: s.description,
      sampleInputText: s.sample_input_text,
      sampleInputJson: s.sample_input_json,
      sampleInputForm: s.sample_input_form,
      expectedOutputFormat: s.expected_output_format,
    }));
  }

  async executePrompt(request: ExecutionRequest): Promise<ExecutionResult> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const provider = request.provider || 'Mock Provider';
    const model = request.model || 'mock-model-1';
    const timeoutSeconds = request.timeoutSeconds || 30;

    const { data: executionRecord } = await supabase
      .from('sandbox_executions')
      .insert({
        user_id: user.id,
        prompt_id: request.promptId,
        test_scenario_id: request.scenarioId,
        execution_type: 'manual',
        input_data: request.inputData,
        input_format: request.inputFormat,
        llm_provider: provider,
        llm_model: model,
        llm_parameters: request.parameters || {},
        status: 'running',
        started_at: new Date().toISOString(),
        timeout_seconds: timeoutSeconds,
      })
      .select()
      .single();

    try {
      const startTime = Date.now();

      const result = await this.callLLM(
        provider,
        model,
        request.promptText,
        request.inputData,
        request.parameters || {},
        timeoutSeconds * 1000
      );

      const executionTimeMs = Date.now() - startTime;

      const tokensUsed = result.promptTokens + result.completionTokens;
      const costEstimate = this.calculateCost(tokensUsed, model);

      await supabase
        .from('sandbox_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          execution_time_ms: executionTimeMs,
        })
        .eq('id', executionRecord.id);

      const { data: outputRecord } = await supabase
        .from('execution_outputs')
        .insert({
          execution_id: executionRecord.id,
          output_text: result.output,
          output_json: result.outputJson,
          output_metadata: result.metadata || {},
          tokens_used: tokensUsed,
          prompt_tokens: result.promptTokens,
          completion_tokens: result.completionTokens,
          model_version: result.modelVersion,
          finish_reason: result.finishReason,
        })
        .select()
        .single();

      await supabase.from('resource_usage').insert({
        execution_id: executionRecord.id,
        tokens_used: tokensUsed,
        tokens_limit: 10000,
        execution_time_ms: executionTimeMs,
        execution_time_limit_ms: timeoutSeconds * 1000,
        api_calls: 1,
        cost_estimate: costEstimate,
        exceeded_limits: tokensUsed > 10000 || executionTimeMs > timeoutSeconds * 1000,
      });

      if (request.scenarioId) {
        await supabase
          .from('test_scenarios')
          .update({
            usage_count: supabase.sql`usage_count + 1`,
          })
          .eq('id', request.scenarioId);
      }

      return {
        id: executionRecord.id,
        status: 'completed',
        output: result.output,
        outputJson: result.outputJson,
        metadata: {
          tokensUsed,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          executionTimeMs,
          modelVersion: result.modelVersion,
          provider,
          finishReason: result.finishReason,
        },
        resourceUsage: {
          tokensUsed,
          tokensLimit: 10000,
          executionTimeMs,
          executionTimeLimit: timeoutSeconds * 1000,
          costEstimate,
          exceededLimits: tokensUsed > 10000 || executionTimeMs > timeoutSeconds * 1000,
        },
      };
    } catch (error: any) {
      const executionTimeMs = Date.now() - Date.parse(executionRecord.started_at);

      const isTimeout = error.message?.includes('timeout') || executionTimeMs >= timeoutSeconds * 1000;

      await supabase
        .from('sandbox_executions')
        .update({
          status: isTimeout ? 'timeout' : 'failed',
          completed_at: new Date().toISOString(),
          execution_time_ms: executionTimeMs,
          is_timeout: isTimeout,
        })
        .eq('id', executionRecord.id);

      const executionError = this.parseError(error);

      await supabase.from('execution_errors').insert({
        execution_id: executionRecord.id,
        error_type: executionError.type,
        error_code: executionError.code,
        error_message: executionError.message,
        error_details: executionError.details || {},
        stack_trace: error.stack,
        is_retryable: executionError.isRetryable,
      });

      return {
        id: executionRecord.id,
        status: isTimeout ? 'timeout' : 'failed',
        metadata: {
          tokensUsed: 0,
          promptTokens: 0,
          completionTokens: 0,
          executionTimeMs,
          modelVersion: model,
          provider,
        },
        errors: [executionError],
        resourceUsage: {
          tokensUsed: 0,
          tokensLimit: 10000,
          executionTimeMs,
          executionTimeLimit: timeoutSeconds * 1000,
          costEstimate: 0,
          exceededLimits: isTimeout,
        },
      };
    }
  }

  private async callLLM(
    provider: string,
    model: string,
    promptText: string,
    inputData: any,
    parameters: any,
    timeoutMs: number
  ): Promise<{
    output: string;
    outputJson?: any;
    promptTokens: number;
    completionTokens: number;
    modelVersion: string;
    finishReason: string;
    metadata?: any;
  }> {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Execution timeout')), timeoutMs);
    });

    const executionPromise = this.executeLLMCall(provider, model, promptText, inputData, parameters);

    return await Promise.race([executionPromise, timeoutPromise]) as any;
  }

  private async executeLLMCall(
    provider: string,
    model: string,
    promptText: string,
    inputData: any,
    parameters: any
  ): Promise<any> {
    if (provider === 'Mock Provider') {
      await new Promise(resolve => setTimeout(resolve, 500));

      const inputStr = typeof inputData === 'string' ? inputData : JSON.stringify(inputData);
      const outputText = `Mock response for prompt: "${promptText.substring(0, 50)}..."\n\nInput processed: ${inputStr.substring(0, 100)}...\n\nThis is a simulated LLM response for testing purposes.`;

      const words = outputText.split(' ');
      const promptTokens = Math.ceil(promptText.split(' ').length * 1.3);
      const completionTokens = Math.ceil(words.length * 1.3);

      return {
        output: outputText,
        outputJson: { success: true, mock: true },
        promptTokens,
        completionTokens,
        modelVersion: model + '-v1',
        finishReason: 'stop',
        metadata: { provider: 'mock', temperature: parameters.temperature || 0.7 },
      };
    }

    throw new Error(`Provider ${provider} not implemented`);
  }

  private parseError(error: any): ExecutionError {
    if (error.message?.includes('timeout')) {
      return {
        type: 'timeout',
        code: 'EXECUTION_TIMEOUT',
        message: 'Execution exceeded the time limit',
        details: { timeout: true },
        isRetryable: true,
      };
    }

    if (error.message?.includes('rate limit')) {
      return {
        type: 'rate_limit',
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'API rate limit exceeded',
        details: error,
        isRetryable: true,
      };
    }

    if (error.message?.includes('authentication') || error.message?.includes('unauthorized')) {
      return {
        type: 'authentication',
        code: 'AUTH_FAILED',
        message: 'Authentication failed',
        details: error,
        isRetryable: false,
      };
    }

    return {
      type: 'internal',
      code: 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: error,
      isRetryable: false,
    };
  }

  private calculateCost(tokens: number, model: string): number {
    let costPer1k = 0.001;

    if (model.includes('gpt-4')) {
      costPer1k = 0.03;
    } else if (model.includes('gpt-3.5')) {
      costPer1k = 0.002;
    } else if (model.includes('claude-3-opus')) {
      costPer1k = 0.015;
    } else if (model.includes('claude-3-sonnet')) {
      costPer1k = 0.003;
    }

    return Math.round((tokens / 1000) * costPer1k * 10000) / 10000;
  }

  async getExecutionHistory(filters?: {
    status?: string;
    provider?: string;
    scenarioId?: string;
  }): Promise<any[]> {
    const user = await this.getCurrentUser();
    if (!user) return [];

    let query = supabase
      .from('sandbox_executions')
      .select('*, execution_outputs(*), execution_errors(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.provider) {
      query = query.eq('llm_provider', filters.provider);
    }

    if (filters?.scenarioId) {
      query = query.eq('test_scenario_id', filters.scenarioId);
    }

    const { data } = await query;
    return data || [];
  }

  async getExecutionDetails(executionId: string): Promise<any> {
    const { data } = await supabase
      .from('sandbox_executions')
      .select('*, execution_outputs(*), execution_errors(*), resource_usage(*)')
      .eq('id', executionId)
      .single();

    return data;
  }

  async getLLMProviders(): Promise<any[]> {
    const { data } = await supabase
      .from('llm_providers')
      .select('*')
      .eq('is_enabled', true)
      .order('provider_name');

    return data || [];
  }

  private async getCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  }
}

export const sandboxExecutionEngine = SandboxExecutionEngine.getInstance();

export const sandboxService = {
  async savePromptVersion(
    promptText: string,
    scenarioId: string,
    scenarioName: string
  ): Promise<PromptVersion | null> {
    const { count } = await supabase
      .from('prompt_versions')
      .select('*', { count: 'exact', head: true })
      .eq('scenario_id', scenarioId);

    const versionNumber = (count || 0) + 1;

    const { data, error } = await supabase
      .from('prompt_versions')
      .insert({
        prompt_text: promptText,
        scenario_id: scenarioId,
        scenario_name: scenarioName,
        version_number: versionNumber,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving prompt version:', error);
      return null;
    }

    return data;
  },

  async getPromptVersions(scenarioId?: string): Promise<PromptVersion[]> {
    let query = supabase
      .from('prompt_versions')
      .select('*')
      .order('created_at', { ascending: false });

    if (scenarioId) {
      query = query.eq('scenario_id', scenarioId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching prompt versions:', error);
      return [];
    }

    return data || [];
  },

  async saveTestResult(
    promptVersionId: string | null,
    testInput: string,
    testOutput: string,
    metrics: {
      accuracy: number;
      relevance: number;
      tone: number;
      consistency: number;
    }
  ): Promise<TestResultData | null> {
    const { data, error } = await supabase
      .from('test_results')
      .insert({
        prompt_version_id: promptVersionId,
        test_input: testInput,
        test_output: testOutput,
        accuracy: metrics.accuracy,
        relevance: metrics.relevance,
        tone: metrics.tone,
        consistency: metrics.consistency,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving test result:', error);
      return null;
    }

    return data;
  },

  async getTestResults(promptVersionId?: string): Promise<TestResultData[]> {
    let query = supabase
      .from('test_results')
      .select('*')
      .order('created_at', { ascending: false });

    if (promptVersionId) {
      query = query.eq('prompt_version_id', promptVersionId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching test results:', error);
      return [];
    }

    return data || [];
  },

  async getLatestPromptVersion(scenarioId: string): Promise<PromptVersion | null> {
    const { data, error } = await supabase
      .from('prompt_versions')
      .select('*')
      .eq('scenario_id', scenarioId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching latest prompt version:', error);
      return null;
    }

    return data;
  },

  async deletePromptVersion(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('prompt_versions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting prompt version:', error);
      return false;
    }

    return true;
  },
};
