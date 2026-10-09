import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

const GROQ_CHAT_COMPLETIONS_URL =
  'https://api.groq.com/openai/v1/chat/completions';
const GROQ_PROMPT_TIMEOUT_MS = Number(
  process.env.GROQ_PROMPT_TIMEOUT_MS ?? 30000,
);

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

@Injectable()
export class AiPromptService {
  private readonly logger = new Logger(AiPromptService.name);

  async generateImagePrompt(description: string, ratio?: string): Promise<string> {
    const userDescription = description?.trim();
    if (!userDescription) {
      throw new BadRequestException('description is required');
    }

    const response = await this.callGroq([
      'Bạn là chuyên gia viết prompt tạo ảnh cho hệ thống AI Event Assistant.',
      'Nhiệm vụ: chuyển yêu cầu tự nhiên của user thành prompt tạo ảnh chuyên nghiệp.',
      'Prompt phải có: chủ đề, phong cách thiết kế, màu sắc, bố cục, đối tượng chính, ánh sáng, tỷ lệ ảnh, chất lượng hình ảnh.',
      'Chỉ trả JSON hợp lệ theo dạng: {"prompt":"..."}',
      '',
      `Yêu cầu user: ${userDescription}`,
      `Tỷ lệ ảnh: ${ratio || '16:9'}`,
    ]);

    return this.parseJsonField(response, 'prompt');
  }

  async generateImageEditInstruction(
    description: string,
    ratio?: string,
  ): Promise<string> {
    const userDescription = description?.trim();
    if (!userDescription) {
      throw new BadRequestException('description is required');
    }

    const response = await this.callGroq([
      'Bạn là chuyên gia chỉnh sửa hình ảnh cho hệ thống AI Event Assistant.',
      'Nhiệm vụ: chuyển yêu cầu tự nhiên của user thành instruction dành cho AI Image Edit.',
      'Luôn yêu cầu giữ nguyên sản phẩm chính, khuôn mặt, logo, chữ quan trọng và chi tiết quan trọng nếu user không yêu cầu đổi.',
      'Instruction cần rõ ràng, cụ thể, dùng được trực tiếp cho model chỉnh ảnh.',
      'Chỉ trả JSON hợp lệ theo dạng: {"instruction":"..."}',
      '',
      `Yêu cầu user: ${userDescription}`,
      `Tỷ lệ ảnh: ${ratio || 'giữ theo ảnh gốc'}`,
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

    this.logger.log(`AI_PROMPT:groq:${model}`);
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
              content:
                'Return compact valid JSON only. Do not wrap in markdown.',
            },
            {
              role: 'user',
              content: promptLines.join('\n'),
            },
          ],
          temperature: 0.2,
          max_tokens: 900,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.error(`AI_PROMPT_PROVIDER_ERROR:groq:${response.status}`);
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

      throw new ServiceUnavailableException('AI_PROVIDER_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseJsonField(response: string, field: 'prompt' | 'instruction'): string {
    const cleaned = response.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch?.[0] || cleaned;

    try {
      const parsed = JSON.parse(jsonText);
      const value = parsed[field]?.trim();
      if (value) {
        return value;
      }
    } catch {
      this.logger.warn(`Cannot parse Groq ${field} JSON response`);
    }

    return cleaned;
  }
}
