import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

const GROQ_CHAT_COMPLETIONS_URL =
  'https://api.groq.com/openai/v1/chat/completions';
const GROQ_PROMPT_TIMEOUT_MS = Number(
  process.env.GROQ_PROMPT_TIMEOUT_MS ?? 30000,
);

export type ImagePromptGenerationResult =
  | {
      type: 'NEED_MORE_INFORMATION';
      questions: string[];
      missingFields: string[];
    }
  | {
      type: 'IMAGE_PROMPT_READY';
      eventInfo: Record<string, unknown>;
      creativeDirection: Record<string, unknown>;
      prompt: string;
      negativePrompt: string;
    };

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

@Injectable()
export class ImagePromptGeneratorService {
  private readonly logger = new Logger(ImagePromptGeneratorService.name);
  private readonly designGuide = this.loadDesignGuide();

  async generateImagePrompt(
    userRequest: string,
    ratio?: string,
  ): Promise<ImagePromptGenerationResult> {
    const request = userRequest?.trim();
    if (!request) {
      throw new BadRequestException('description is required');
    }

    try {
      const response = await this.callGroq([
        'You are the Eventix LLM Creative Assistant.',
        'Your job is to analyze a user conversation/request before image generation.',
        'Use the AI Event Image Design Expert Guide as system knowledge.',
        '',
        'Required information before IMAGE_PROMPT_READY:',
        '- Event name',
        '- Organization',
        '- Event category',
        '- Main theme',
        '- Target audience',
        '- Visual style',
        '',
        'If any required information is missing, return NEED_MORE_INFORMATION with concise questions.',
        'If enough information exists, return IMAGE_PROMPT_READY.',
        '',
        'Return compact valid JSON only in one of these shapes:',
        '{"type":"NEED_MORE_INFORMATION","questions":["..."],"missingFields":["..."]}',
        '{"type":"IMAGE_PROMPT_READY","eventInfo":{},"creativeDirection":{},"prompt":"...","negativePrompt":"..."}',
        '',
        `Requested ratio: ${ratio || '16:9'}`,
        `User conversation/request: ${request}`,
      ]);

      return this.parsePromptGenerationResult(response);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }

      this.logger.error(
        `AI_PROMPT_GENERATION_FAILED:${this.getErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException('AI_PROMPT_GENERATION_FAILED');
    }
  }

  async generateEditInstruction(
    userRequest: string,
    ratio?: string,
  ): Promise<string> {
    const request = userRequest?.trim();
    if (!request) {
      throw new BadRequestException('description is required');
    }

    const response = await this.callGroq([
      'You are an Eventix professional AI image edit prompt engineer.',
      'Convert the user request into a concise image edit instruction.',
      'Preserve main products, faces, logos, and important details unless the user explicitly asks to change them.',
      'Avoid asking the image model to create readable text or fake logos.',
      'Return compact valid JSON only: {"instruction":"..."}',
      '',
      `Requested ratio: ${ratio || 'keep original image ratio'}`,
      `User edit request: ${request}`,
    ]);

    return this.parseJsonField(response, 'instruction');
  }

  private async callGroq(promptLines: string[]): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'AI_PROVIDER_CONFIGURATION_ERROR: GROQ_API_KEY is missing',
      );
    }

    const model = process.env.GROQ_CHAT_MODEL;
    if (!model) {
      throw new ServiceUnavailableException(
        'AI_PROVIDER_CONFIGURATION_ERROR: GROQ_CHAT_MODEL is missing',
      );
    }

    this.logger.log(`AI_PROMPT_GENERATOR:groq:${model}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GROQ_PROMPT_TIMEOUT_MS);

    try {
      const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: [
                'Return compact valid JSON only. Do not wrap in markdown.',
                '',
                this.designGuide,
              ].join('\n'),
            },
            {
              role: 'user',
              content: promptLines.join('\n'),
            },
          ],
          temperature: 0.2,
          max_tokens: 1400,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.error(
          `AI_PROMPT_GENERATOR_PROVIDER_ERROR:groq:${response.status}`,
        );
        throw new ServiceUnavailableException('AI_PROVIDER_UNAVAILABLE');
      }

      const output = (await response.json()) as GroqChatResponse;
      const text = output.choices?.[0]?.message?.content?.trim();
      if (!text) {
        throw new BadGatewayException('AI_REQUEST_FAILED');
      }

      return text;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceUnavailableException('AI_PROVIDER_TIMEOUT');
      }

      throw new ServiceUnavailableException('AI_PROMPT_GENERATION_FAILED');
    } finally {
      clearTimeout(timeout);
    }
  }

  private parsePromptGenerationResult(
    response: string,
  ): ImagePromptGenerationResult {
    const parsed = this.parseJson(response);
    if (parsed.type === 'NEED_MORE_INFORMATION') {
      return {
        type: 'NEED_MORE_INFORMATION',
        questions: Array.isArray(parsed.questions) ? parsed.questions : [],
        missingFields: Array.isArray(parsed.missingFields)
          ? parsed.missingFields
          : [],
      };
    }

    if (parsed.type === 'IMAGE_PROMPT_READY' && parsed.prompt) {
      return {
        type: 'IMAGE_PROMPT_READY',
        eventInfo: parsed.eventInfo || {},
        creativeDirection: parsed.creativeDirection || {},
        prompt: String(parsed.prompt).trim(),
        negativePrompt: String(parsed.negativePrompt || '').trim(),
      };
    }

    throw new BadGatewayException('AI_PROMPT_GENERATION_FAILED');
  }

  private parseJsonField(response: string, field: string): string {
    const parsed = this.parseJson(response);
    const value = parsed[field]?.trim();
    if (!value) {
      throw new BadGatewayException('AI_PROMPT_GENERATION_FAILED');
    }

    return value;
  }

  private parseJson(response: string): Record<string, any> {
    const cleaned = response.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch?.[0] || cleaned;

    try {
      return JSON.parse(jsonText);
    } catch (error) {
      this.logger.error(
        `AI_PROMPT_GENERATION_FAILED:invalid_json:${this.getErrorMessage(error)}`,
      );
      throw new BadGatewayException('AI_PROMPT_GENERATION_FAILED');
    }
  }

  private loadDesignGuide(): string {
    try {
      return readFileSync(
        join(process.cwd(), 'AI_EVENT_IMAGE_DESIGN_EXPERT_GUIDE.md'),
        'utf8',
      );
    } catch (error) {
      this.logger.error(
        `AI_PROMPT_GUIDE_LOAD_FAILED:${this.getErrorMessage(error)}`,
      );
      return '';
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}
