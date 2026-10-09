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
import { AiChatResponseDto } from './dto/ai-chat.dto';

const GROQ_CHAT_COMPLETIONS_URL =
  'https://api.groq.com/openai/v1/chat/completions';
const GROQ_CHAT_TIMEOUT_MS = Number(process.env.GROQ_CHAT_TIMEOUT_MS ?? 30000);
const GROQ_MAX_OUTPUT_TOKENS = Number(process.env.GROQ_MAX_OUTPUT_TOKENS ?? 1200);

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

  async chat(message: string): Promise<AiChatResponseDto> {
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

      return this.normalizeChatReply(reply);
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
      '',
      'You must classify whether the user is asking for normal chat help or asking to create an image/banner/poster/event visual.',
      'Always return compact valid JSON only. Do not wrap in markdown.',
      '',
      'If the user is NOT asking to create an image, return:',
      '{"mode":"chat","message":"normal helpful answer"}',
      '',
      'If the user is asking to create an image/banner/poster/event visual, check required fields:',
      '- eventName',
      '- organization',
      '- theme',
      '- style',
      '- colors',
      'Audience may be inferred safely if missing. If any required field is missing, return:',
      '{"mode":"need_more_information","message":"short clarification request","questions":["..."],"missingFields":["..."]}',
      '',
      'If enough information exists, return exactly:',
      '{"mode":"image_prompt_ready","summary":{"eventName":"","organization":"","theme":"","audience":"","style":"","colors":""},"imagePrompt":"","negativePrompt":""}',
      '',
      'For image_prompt_ready:',
      '- message should not be long; the backend will format the final message.',
      '- summary must be concise.',
      '- imagePrompt must be in English and ready to copy into Create Image.',
      '- imagePrompt must include image type, event name, organization, theme, target audience, style, main colors, visual tone, composition, and restrictions.',
      '- Do not use markdown tables.',
      '- Do not mix general explanation into imagePrompt.',
      '- negativePrompt must be short and include no website logo, no purple dominant color, no cyberpunk, no distorted faces, no low quality text, no messy composition when relevant.',
    ].join('\n');
  }

  private normalizeChatReply(reply: string): AiChatResponseDto {
    const parsed = this.tryParseJson(reply);
    if (!parsed) {
      return {
        type: 'text',
        message: reply,
        mode: 'chat',
      };
    }

    if (parsed.mode === 'image_prompt_ready') {
      const summary = this.normalizeSummary(parsed.summary);
      const imagePrompt = String(parsed.imagePrompt || '').trim();
      const negativePrompt = String(parsed.negativePrompt || '').trim();

      if (!imagePrompt) {
        return {
          type: 'text',
          message: reply,
          mode: 'chat',
        };
      }

      return {
        type: 'text',
        mode: 'image_prompt_ready',
        summary,
        imagePrompt,
        negativePrompt,
        canUseForCreate: true,
        message: this.buildImagePromptReadyMessage(
          summary,
          imagePrompt,
          negativePrompt,
        ),
      };
    }

    if (parsed.mode === 'need_more_information') {
      const questions = Array.isArray(parsed.questions)
        ? parsed.questions.map((question) => String(question)).filter(Boolean)
        : [];
      const missingFields = Array.isArray(parsed.missingFields)
        ? parsed.missingFields.map((field) => String(field)).filter(Boolean)
        : [];

      return {
        type: 'text',
        mode: 'need_more_information',
        canUseForCreate: false,
        questions,
        missingFields,
        message:
          String(parsed.message || '').trim() ||
          this.buildNeedMoreInformationMessage(questions),
      };
    }

    return {
      type: 'text',
      message: String(parsed.message || reply).trim(),
      mode: 'chat',
    };
  }

  private tryParseJson(reply: string): Record<string, any> | null {
    const cleaned = reply.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch?.[0] || cleaned;

    try {
      return JSON.parse(jsonText);
    } catch {
      return null;
    }
  }

  private normalizeSummary(summary: unknown): AiChatResponseDto['summary'] {
    const value = summary && typeof summary === 'object' ? summary : {};
    const source = value as Record<string, unknown>;

    return {
      eventName: this.asOptionalString(source.eventName),
      organization: this.asOptionalString(source.organization),
      theme: this.asOptionalString(source.theme),
      audience: this.asOptionalString(source.audience),
      style: this.asOptionalString(source.style),
      colors: this.asOptionalString(source.colors),
    };
  }

  private buildImagePromptReadyMessage(
    summary: AiChatResponseDto['summary'],
    imagePrompt: string,
    negativePrompt: string,
  ): string {
    return [
      'SUMMARY:',
      `eventName: ${summary?.eventName || 'N/A'}`,
      `organization: ${summary?.organization || 'N/A'}`,
      `theme: ${summary?.theme || 'N/A'}`,
      `audience: ${summary?.audience || 'N/A'}`,
      `style: ${summary?.style || 'N/A'}`,
      `colors: ${summary?.colors || 'N/A'}`,
      '',
      'IMAGE_PROMPT_READY:',
      imagePrompt,
      '',
      'NEGATIVE_PROMPT:',
      negativePrompt,
    ].join('\n');
  }

  private buildNeedMoreInformationMessage(questions: string[]): string {
    if (!questions.length) {
      return 'Mình cần thêm một vài thông tin về event trước khi tạo prompt ảnh.';
    }

    return ['Mình cần thêm thông tin để tạo prompt ảnh chính xác:', ...questions]
      .join('\n- ')
      .replace(':\n- ', ':\n- ');
  }

  private asOptionalString(value: unknown): string | undefined {
    const normalized = String(value || '').trim();
    return normalized || undefined;
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
