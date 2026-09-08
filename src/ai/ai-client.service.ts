import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

const DEFAULT_GEMINI_CHAT_MODEL = 'gemini-2.0-flash';

@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);

  async chat(message: string): Promise<string> {
    const prompt = this.buildEventAssistantPrompt(message);
    const apiKey = this.getGeminiApiKey();
    const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_CHAT_MODEL;
    this.logger.log(`AI_CHAT:gemini:${model}`);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 700,
            },
          }),
        },
      );

      if (!response.ok) {
        throw new InternalServerErrorException(
          `Gemini API error: ${await response.text()}`,
        );
      }

      const output = await response.json();
      const reply = output.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text || '')
        .join('')
        .trim();

      if (!reply) {
        throw new InternalServerErrorException('Gemini did not return a reply');
      }

      return reply;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Gemini request failed';
      this.logger.error(`AI_CHAT_FAILED:${model}:${errorMessage}`);

      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to call AI chat provider: ${errorMessage}`,
      );
    }
  }

  private getGeminiApiKey(): string {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new BadRequestException('GEMINI_API_KEY is missing');
    }

    return apiKey;
  }

  private buildEventAssistantPrompt(message: string): string {
    return [
      'You are Eventix AI Event Assistant.',
      'Help with event ideas, event planning, marketing content, scripts, ticket/event copy, and image prompts.',
      'Answer in Vietnamese unless the user asks for another language.',
      '',
      `User: ${message}`,
    ].join('\n');
  }
}
