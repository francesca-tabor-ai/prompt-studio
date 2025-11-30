import { BaseProvider } from '../BaseProvider';
import { LLMRequest, LLMResponse } from '../types';

export class GoogleProvider extends BaseProvider {
  name = 'Google';
  type = 'google' as const;

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    return this.retryWithBackoff(async () => {
      const model = request.model || 'gemini-pro';
      const response = await this.fetchWithTimeout(
        `${this.apiBaseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: request.prompt },
                ],
              },
            ],
            generationConfig: {
              temperature: request.temperature ?? 0.7,
              maxOutputTokens: request.maxTokens ?? 1000,
              stopSequences: request.stopSequences,
            },
          }),
        }
      );

      if (!response.ok) {
        const error: any = new Error(`Google API error: ${response.statusText}`);
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      const text = data.candidates[0].content.parts[0].text;
      const inputTokens = data.usageMetadata?.promptTokenCount || 0;
      const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;

      return {
        text,
        model,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        latency,
        cached: false,
      };
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.apiBaseUrl}/models?key=${this.apiKey}`,
        {
          method: 'GET',
        }
      );

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
