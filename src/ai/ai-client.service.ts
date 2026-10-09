import {
  BadRequestException,
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

const GROQ_CHAT_COMPLETIONS_URL =
  'https://api.groq.com/openai/v1/chat/completions';
const GROQ_CHAT_TIMEOUT_MS = Number(process.env.GROQ_CHAT_TIMEOUT_MS ?? 30000);
const GROQ_MAX_OUTPUT_TOKENS = Number(process.env.GROQ_MAX_OUTPUT_TOKENS ?? 700);

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);

  async chat(message: string): Promise<string> {
    const apiKey = this.getGroqApiKey();
    const model = this.getGroqChatModel();
    this.logger.log(`AI_CHAT:groq:${model}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GROQ_CHAT_TIMEOUT_MS);
    try {
      const response = await fetch(
        GROQ_CHAT_COMPLETIONS_URL,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: this.getEventAssistantSystemPrompt() },
              { role: 'user', content: message },
            ],
            temperature: 0.3,
            max_tokens: GROQ_MAX_OUTPUT_TOKENS,
          }),
        },
      );

      if (!response.ok) {
        throw await this.normalizeGroqError(response);
      }

      const output = (await response.json()) as GroqChatResponse;
      const reply = output.choices?.[0]?.message?.content?.trim();

      if (!reply) {
        throw new BadGatewayException('AI_REQUEST_FAILED');
      }

      return reply;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.error(`AI_CHAT_TIMEOUT:groq:${model}`);
        throw new GatewayTimeoutException('AI_PROVIDER_TIMEOUT');
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Groq request failed';
      this.logger.error(`AI_CHAT_FAILED:groq:${model}:${errorMessage}`);

      throw new ServiceUnavailableException('AI_PROVIDER_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }
  }

  private getGroqApiKey(): string {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      this.logger.warn('AI_CHAT_CONFIG_MISSING:GROQ_API_KEY');
      throw new ServiceUnavailableException(
        'AI_PROVIDER_CONFIGURATION_ERROR: GROQ_API_KEY is missing',
      );
    }

    return apiKey;
  }

  private getGroqChatModel(): string {
    const model = process.env.GROQ_CHAT_MODEL?.trim();
    if (!model) {
      this.logger.warn('AI_CHAT_CONFIG_MISSING:GROQ_CHAT_MODEL');
      throw new ServiceUnavailableException(
        'AI_PROVIDER_CONFIGURATION_ERROR: GROQ_CHAT_MODEL is missing',
      );
    }

    return model;
  }

  private getEventAssistantSystemPrompt(): string {
    return [
      'You are Eventix AI Event Assistant.',
      'Help with event ideas, event planning, marketing content, scripts, ticket/event copy, and image prompts.',
      'Answer in Vietnamese unless the user asks for another language.',
    ].join('\n');
  }

  private async normalizeGroqError(response: Response): Promise<HttpException> {
    const body = await response.text().catch(() => '');
    const normalizedBody = body.toLowerCase();

    this.logger.error(`AI_CHAT_PROVIDER_ERROR:groq:${response.status}`);

    if (response.status === HttpStatus.TOO_MANY_REQUESTS) {
      return new HttpException('AI_RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (
      response.status === HttpStatus.UNAUTHORIZED ||
      response.status === HttpStatus.FORBIDDEN
    ) {
      return new ServiceUnavailableException(
        'AI_PROVIDER_CONFIGURATION_ERROR',
      );
    }

    if (
      normalizedBody.includes('model') &&
      (normalizedBody.includes('not found') ||
        normalizedBody.includes('decommissioned') ||
        normalizedBody.includes('does not exist') ||
        normalizedBody.includes('not available'))
    ) {
      return new BadRequestException('AI_MODEL_UNAVAILABLE');
    }

    if (response.status >= 500) {
      return new ServiceUnavailableException('AI_PROVIDER_UNAVAILABLE');
    }

    return new BadGatewayException('AI_REQUEST_FAILED');
  }
}
