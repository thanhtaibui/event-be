import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

type GeminiPart = {
  text?: string;
  inlineData?: {
    mimeType?: string;
    data?: string;
  };
  inline_data?: {
    mime_type?: string;
    data?: string;
  };
};

type GeminiImageResult = {
  b64Json: string;
  mimeType: string;
};

const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

@Injectable()
export class GeminiService {
  async generateImage(prompt: string): Promise<GeminiImageResult> {
    return this.requestImage(prompt);
  }

  async editImage(
    prompt: string,
    file: Express.Multer.File,
  ): Promise<GeminiImageResult> {
    return this.requestImage(prompt, file);
  }

  private async requestImage(
    prompt: string,
    file?: Express.Multer.File,
  ): Promise<GeminiImageResult> {
    const model = this.getGeminiImageModel();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.getGeminiApiKey()}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.buildRequestBody(prompt, file)),
      },
    );

    return this.extractImage(response);
  }

  private buildRequestBody(prompt: string, file?: Express.Multer.File) {
    const parts: any[] = [{ text: prompt }];

    if (file) {
      parts.push({
        inline_data: {
          mime_type: file.mimetype,
          data: Buffer.from(file.buffer).toString('base64'),
        },
      });
    }

    return {
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    };
  }

  private async extractImage(
    response: globalThis.Response,
  ): Promise<GeminiImageResult> {
    const data = await response.json();

    if (!response.ok) {
      throw new HttpException(
        {
          statusCode: response.status,
          message: data?.error?.message || 'Failed to process image with Gemini',
          data: null,
        },
        response.status,
      );
    }

    const parts: GeminiPart[] = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part) => part.inlineData || part.inline_data);
    const inlineData = imagePart?.inlineData;
    const inlineDataSnake = imagePart?.inline_data;
    const b64Json = inlineData?.data || inlineDataSnake?.data;

    if (!b64Json) {
      throw new InternalServerErrorException(
        'Gemini did not return an image result',
      );
    }

    return {
      b64Json,
      mimeType:
        inlineData?.mimeType || inlineDataSnake?.mime_type || 'image/png',
    };
  }

  private getGeminiApiKey(): string {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new BadRequestException('GEMINI_API_KEY is missing');
    }

    return apiKey;
  }

  private getGeminiImageModel(): string {
    return process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL;
  }
}
