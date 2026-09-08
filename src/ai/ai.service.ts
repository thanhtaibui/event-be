import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InferenceClient } from '@huggingface/inference';

const DEFAULT_HF_CHAT_MODEL = 'Qwen/Qwen2.5-7B-Instruct';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  async chat(prompt: string): Promise<string> {
    const message = prompt?.trim();
    if (!message) {
      throw new BadRequestException('Message is required');
    }

    const client = this.createClient();
    const model = process.env.HF_CHAT_MODEL || DEFAULT_HF_CHAT_MODEL;
    this.logger.log(`HF_CHAT:${model}`);

    try {
      const output = await client.chatCompletion({
        model,
        provider: 'auto',
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
        max_tokens: 512,
        temperature: 0.2,
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
      const message =
        error instanceof Error ? error.message : 'Hugging Face request failed';
      this.logger.error(`HF_CHAT_FAILED:${model}:${message}`);

      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to call Hugging Face API: ${message}`,
      );
    }
  }

  private createClient(): InferenceClient {
    const token = process.env.HF_TOKEN;
    if (!token) {
      throw new BadRequestException('HF_TOKEN is missing');
    }

    return new InferenceClient(token);
  }
}
