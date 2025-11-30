import { BaseProvider } from '../BaseProvider';
import { LLMRequest, LLMResponse } from '../types';

export class AnthropicProvider extends BaseProvider {
  name = 'Anthropic';
  type = 'anthropic' as const;

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    return this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.apiBaseUrl}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: request.model || 'claude-3-sonnet-20240229',
            messages: [
              { role: 'user', content: request.prompt },
            ],
            system: request.systemPrompt,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 1000,
            stop_sequences: request.stopSequences,
          }),
        }
      );

      if (!response.ok) {
        const error: any = new Error(`Anthropic API error: ${response.statusText}`);
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      return {
        text: data.content[0].text,
        model: data.model,
        usage: {
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        },
        latency,
        cached: false,
      };
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.apiBaseUrl}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 10,
          }),
        }
      );

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
