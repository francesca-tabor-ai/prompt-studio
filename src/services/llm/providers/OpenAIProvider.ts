import { BaseProvider } from '../BaseProvider';
import { LLMRequest, LLMResponse } from '../types';

export class OpenAIProvider extends BaseProvider {
  name = 'OpenAI';
  type = 'openai' as const;

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.apiBaseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: request.model || 'gpt-4',
            messages: [
              ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
              { role: 'user', content: request.prompt },
            ],
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 1000,
            stop: request.stopSequences,
          }),
        }
      );

      if (!response.ok) {
        const error: any = new Error(`OpenAI API error: ${response.statusText}`);
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      return {
        text: data.choices[0].message.content,
        model: data.model,
        usage: {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
        latency,
        cached: false,
      };
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.apiBaseUrl}/models`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
