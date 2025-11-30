import { supabase } from '../../lib/supabase';
import { LLMProvider, LLMRequest, LLMResponse, ProviderConfig, CacheConfig } from './types';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { GoogleProvider } from './providers/GoogleProvider';

export class LLMManager {
  private static instance: LLMManager;
  private providers: Map<string, LLMProvider> = new Map();
  private cacheConfig: CacheConfig = {
    enabled: true,
    ttl: 3600,
  };

  private constructor() {
    this.initializeProviders();
  }

  static getInstance(): LLMManager {
    if (!LLMManager.instance) {
      LLMManager.instance = new LLMManager();
    }
    return LLMManager.instance;
  }

  private async initializeProviders() {
    const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
    const anthropicKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    const googleKey = import.meta.env.VITE_GOOGLE_API_KEY;

    if (openaiKey) {
      this.providers.set('openai', new OpenAIProvider(
        openaiKey,
        'https://api.openai.com/v1'
      ));
    }

    if (anthropicKey) {
      this.providers.set('anthropic', new AnthropicProvider(
        anthropicKey,
        'https://api.anthropic.com/v1'
      ));
    }

    if (googleKey) {
      this.providers.set('google', new GoogleProvider(
        googleKey,
        'https://generativelanguage.googleapis.com/v1'
      ));
    }
  }

  async generate(request: LLMRequest, preferredProvider?: string): Promise<LLMResponse> {
    const cacheKey = this.generateCacheKey(request);

    if (this.cacheConfig.enabled) {
      const cached = await this.getCachedResponse(cacheKey);
      if (cached) {
        await this.logRequest('cached', request, cached, true);
        return { ...cached, cached: true };
      }
    }

    const provider = await this.selectProvider(preferredProvider);
    if (!provider) {
      throw new Error('No LLM providers available');
    }

    const requestId = await this.logRequestStart(provider.name, request);

    try {
      const response = await provider.generate(request);

      await this.logRequestComplete(requestId, response);

      if (this.cacheConfig.enabled) {
        await this.cacheResponse(cacheKey, provider.name, request, response);
      }

      return response;
    } catch (error: any) {
      await this.logRequestError(requestId, error.message);

      const fallbackProvider = await this.getFallbackProvider(provider.name);
      if (fallbackProvider) {
        console.warn(`Primary provider failed, trying fallback: ${fallbackProvider.name}`);
        try {
          const response = await fallbackProvider.generate(request);
          await this.logRequestComplete(requestId, response);
          return response;
        } catch (fallbackError) {
          throw fallbackError;
        }
      }

      throw error;
    }
  }

  private async selectProvider(preferredProvider?: string): Promise<LLMProvider | null> {
    if (preferredProvider && this.providers.has(preferredProvider)) {
      const provider = this.providers.get(preferredProvider);
      const isHealthy = await provider?.healthCheck();
      if (isHealthy) return provider!;
    }

    const { data: configs } = await supabase
      .from('llm_providers')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    for (const config of configs || []) {
      const provider = this.providers.get(config.provider_type);
      if (provider) {
        const isHealthy = await provider.healthCheck();
        if (isHealthy) return provider;
      }
    }

    for (const provider of this.providers.values()) {
      return provider;
    }

    return null;
  }

  private async getFallbackProvider(primaryProvider: string): Promise<LLMProvider | null> {
    const { data: configs } = await supabase
      .from('llm_providers')
      .select('*')
      .eq('is_active', true)
      .neq('provider_type', primaryProvider)
      .order('priority', { ascending: false })
      .limit(1);

    if (configs && configs.length > 0) {
      return this.providers.get(configs[0].provider_type) || null;
    }

    return null;
  }

  private generateCacheKey(request: LLMRequest): string {
    const hash = this.hashString(
      JSON.stringify({
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        model: request.model,
        temperature: request.temperature,
      })
    );
    return `llm_cache_${hash}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private async getCachedResponse(cacheKey: string): Promise<LLMResponse | null> {
    try {
      const { data } = await supabase
        .from('llm_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (data) {
        await supabase
          .from('llm_cache')
          .update({ hit_count: data.hit_count + 1 })
          .eq('id', data.id);

        return {
          text: data.response_text,
          model: data.model_name,
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
          },
          latency: 0,
          cached: true,
        };
      }
    } catch (error) {
      console.error('Cache retrieval error:', error);
    }

    return null;
  }

  private async cacheResponse(
    cacheKey: string,
    providerName: string,
    request: LLMRequest,
    response: LLMResponse
  ): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + this.cacheConfig.ttl);

      await supabase.from('llm_cache').insert({
        cache_key: cacheKey,
        provider_name: providerName,
        model_name: response.model,
        prompt_hash: cacheKey,
        response_text: response.text,
        expires_at: expiresAt.toISOString(),
      });
    } catch (error) {
      console.error('Cache storage error:', error);
    }
  }

  private async logRequestStart(providerName: string, request: LLMRequest): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: provider } = await supabase
      .from('llm_providers')
      .select('id')
      .eq('provider_name', providerName)
      .single();

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const { data } = await supabase
      .from('llm_requests')
      .insert({
        provider_id: provider?.id,
        request_id: requestId,
        model_name: request.model || 'default',
        user_id: user?.id,
        prompt: request.prompt,
        status: 'pending',
      })
      .select()
      .single();

    return data?.id || requestId;
  }

  private async logRequestComplete(requestId: string, response: LLMResponse): Promise<void> {
    const { data: request } = await supabase
      .from('llm_requests')
      .select('provider_id')
      .eq('id', requestId)
      .single();

    const { data: provider } = await supabase
      .from('llm_providers')
      .select('cost_per_1k_input_tokens, cost_per_1k_output_tokens')
      .eq('id', request?.provider_id)
      .single();

    const cost = provider
      ? (response.usage.inputTokens / 1000 * provider.cost_per_1k_input_tokens) +
        (response.usage.outputTokens / 1000 * provider.cost_per_1k_output_tokens)
      : 0;

    await supabase
      .from('llm_requests')
      .update({
        response_text: response.text,
        input_tokens: response.usage.inputTokens,
        output_tokens: response.usage.outputTokens,
        cost,
        latency_ms: response.latency,
        status: 'completed',
        cache_hit: response.cached,
      })
      .eq('id', requestId);

    await this.updateUsageMetrics(
      request?.provider_id,
      response.model,
      response.usage.inputTokens,
      response.usage.outputTokens,
      cost,
      response.latency
    );
  }

  private async logRequestError(requestId: string, errorMessage: string): Promise<void> {
    await supabase
      .from('llm_requests')
      .update({
        status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', requestId);
  }

  private async logRequest(
    provider: string,
    request: LLMRequest,
    response: LLMResponse,
    cached: boolean
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await supabase.from('llm_requests').insert({
      request_id: requestId,
      model_name: response.model,
      user_id: user?.id,
      prompt: request.prompt,
      response_text: response.text,
      input_tokens: response.usage.inputTokens,
      output_tokens: response.usage.outputTokens,
      latency_ms: response.latency,
      status: 'cached',
      cache_hit: cached,
    });
  }

  private async updateUsageMetrics(
    providerId: string,
    modelName: string,
    inputTokens: number,
    outputTokens: number,
    cost: number,
    latency: number
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const { data: existing } = await supabase
      .from('llm_usage_metrics')
      .select('*')
      .eq('provider_id', providerId)
      .eq('metric_date', today)
      .eq('model_name', modelName)
      .single();

    if (existing) {
      const newRequestCount = existing.request_count + 1;
      const newAvgLatency =
        (existing.avg_latency_ms * existing.request_count + latency) / newRequestCount;

      await supabase
        .from('llm_usage_metrics')
        .update({
          request_count: newRequestCount,
          success_count: existing.success_count + 1,
          total_tokens: existing.total_tokens + inputTokens + outputTokens,
          total_cost: existing.total_cost + cost,
          avg_latency_ms: newAvgLatency,
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('llm_usage_metrics').insert({
        provider_id: providerId,
        metric_date: today,
        model_name: modelName,
        request_count: 1,
        success_count: 1,
        total_tokens: inputTokens + outputTokens,
        total_cost: cost,
        avg_latency_ms: latency,
      });
    }
  }

  async getUsageMetrics(startDate: Date, endDate: Date): Promise<any[]> {
    const { data } = await supabase
      .from('llm_usage_metrics')
      .select('*, llm_providers(provider_name)')
      .gte('metric_date', startDate.toISOString().split('T')[0])
      .lte('metric_date', endDate.toISOString().split('T')[0])
      .order('metric_date', { ascending: false });

    return data || [];
  }

  async getProviderHealth(): Promise<Map<string, boolean>> {
    const health = new Map<string, boolean>();

    for (const [name, provider] of this.providers) {
      const isHealthy = await provider.healthCheck();
      health.set(name, isHealthy);

      await supabase.from('llm_health_checks').insert({
        provider_id: (await this.getProviderId(name)),
        status: isHealthy ? 'healthy' : 'unhealthy',
      });
    }

    return health;
  }

  private async getProviderId(providerName: string): Promise<string | null> {
    const { data } = await supabase
      .from('llm_providers')
      .select('id')
      .eq('provider_name', providerName)
      .single();

    return data?.id || null;
  }

  setCacheConfig(config: Partial<CacheConfig>): void {
    this.cacheConfig = { ...this.cacheConfig, ...config };
  }

  async clearCache(): Promise<number> {
    const { count } = await supabase
      .from('llm_cache')
      .delete()
      .lt('expires_at', new Date().toISOString());

    return count || 0;
  }
}

export const llmManager = LLMManager.getInstance();
