import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

@Injectable()
export class AiPromptService {
  private readonly logger = new Logger(AiPromptService.name);

  async generateImagePrompt(description: string, ratio?: string): Promise<string> {
    const userDescription = description?.trim();
    if (!userDescription) {
      throw new BadRequestException('description is required');
    }

    const response = await this.callGemini([
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

    const response = await this.callGemini([
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

  private async callGemini(promptLines: string[]): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new BadRequestException('GEMINI_API_KEY is missing');
    }

    const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    this.logger.log(`AI_PROMPT:gemini:${model}`);

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
                parts: [{ text: promptLines.join('\n') }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 900,
              responseMimeType: 'application/json',
            },
          }),
        },
      );

      if (!response.ok) {
        throw new InternalServerErrorException(
          `Gemini prompt API error: ${await response.text()}`,
        );
      }

      const output = await response.json();
      const text = output.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text || '')
        .join('')
        .trim();

      if (!text) {
        throw new InternalServerErrorException('Gemini did not return prompt');
      }

      return text;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : 'Gemini prompt request failed';
      throw new InternalServerErrorException(
        `Failed to generate AI image prompt: ${message}`,
      );
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
      this.logger.warn(`Cannot parse Gemini ${field} JSON response`);
    }

    return cleaned;
  }
}
