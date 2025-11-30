import { LLMProvider, LLMRequest, LLMResponse, RetryConfig } from './types';

export abstract class BaseProvider implements LLMProvider {
  abstract name: string;
  abstract type: 'openai' | 'anthropic' | 'google' | 'cohere' | 'custom';

  protected apiKey: string;
  protected apiBaseUrl: string;
  protected timeout: number;

  protected retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  };

  constructor(apiKey: string, apiBaseUrl: string, timeout: number = 30000) {
    this.apiKey = apiKey;
    this.apiBaseUrl = apiBaseUrl;
    this.timeout = timeout;
  }

  abstract generate(request: LLMRequest): Promise<LLMResponse>;
  abstract healthCheck(): Promise<boolean>;

  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (retryCount >= this.retryConfig.maxRetries) {
        throw error;
      }

      const shouldRetry = this.isRetryableError(error);
      if (!shouldRetry) {
        throw error;
      }

      const delay = Math.min(
        this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, retryCount),
        this.retryConfig.maxDelay
      );

      await this.sleep(delay);
      return this.retryWithBackoff(fn, retryCount + 1);
    }
  }

  protected isRetryableError(error: any): boolean {
    if (error.status === 429) return true;
    if (error.status >= 500) return true;
    if (error.code === 'ECONNRESET') return true;
    if (error.code === 'ETIMEDOUT') return true;
    return false;
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected async fetchWithTimeout(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  protected calculateCost(inputTokens: number, outputTokens: number, costPer1kInput: number, costPer1kOutput: number): number {
    return (inputTokens / 1000 * costPer1kInput) + (outputTokens / 1000 * costPer1kOutput);
  }
}
