import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InferenceClient } from '@huggingface/inference';

const DEFAULT_HF_CHAT_MODEL = 'Qwen/Qwen2.5-7B-Instruct';

@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);

  async chat(message: string): Promise<string> {
    const prompt = this.buildEventAssistantPrompt(message);
    const client = this.createHfClient();
    const model = DEFAULT_HF_CHAT_MODEL;
    this.logger.log(`AI_CHAT:huggingface:${model}`);

    try {
      const output = await client.chatCompletion({
        model,
        provider: 'auto',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 700,
        temperature: 0.3,
      });

      const reply = output.choices?.[0]?.message?.content;
      if (!reply) {
        throw new InternalServerErrorException(
          'Hugging Face did not return a reply',
        );
      }

      return Array.isArray(reply)
        ? reply.map((part: any) => part.text || '').join('')
        : reply;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Hugging Face request failed';
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

  private createHfClient(): InferenceClient {
    const token = process.env.HF_TOKEN;
    if (!token) {
      throw new BadRequestException('HF_TOKEN is missing');
    }

    return new InferenceClient(token);
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
