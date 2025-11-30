export interface LLMProvider {
  name: string;
  type: 'openai' | 'anthropic' | 'google' | 'cohere' | 'custom';
  generate(request: LLMRequest): Promise<LLMResponse>;
  healthCheck(): Promise<boolean>;
}

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  metadata?: Record<string, any>;
}

export interface LLMResponse {
  text: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  latency: number;
  cached: boolean;
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: string;
  apiBaseUrl: string;
  isActive: boolean;
  priority: number;
  maxTokens: number;
  timeout: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  models: any[];
}

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
}
