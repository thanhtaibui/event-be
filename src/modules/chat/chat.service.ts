import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { UploadService } from '../upload/upload.service';
import {
  ChatImageAction,
  ChatImageResultDto,
  ProcessChatImageDto,
} from './dto/process-chat-image.dto';

type ImagePreset = {
  label: string;
  action: ChatImageAction;
  size: '1024x1024' | '1024x1536' | '1536x1024';
  defaultPrompt: string;
  requiresImage: boolean;
  background?: 'transparent' | 'opaque' | 'auto';
};

@Injectable()
export class ChatService {
  private readonly presets: Record<ChatImageAction, ImagePreset> = {
    [ChatImageAction.FIT_EVENT_BANNER]: {
      label: 'Fit event banner',
      action: ChatImageAction.FIT_EVENT_BANNER,
      size: '1536x1024',
      requiresImage: true,
      background: 'opaque',
      defaultPrompt:
        'Transform this image into a clean horizontal event banner. Crop and extend naturally, keep the main subject visible, avoid text unless it already exists, and make it ready for an event listing page.',
    },
    [ChatImageAction.FIT_EVENT_POSTER]: {
      label: 'Fit event poster',
      action: ChatImageAction.FIT_EVENT_POSTER,
      size: '1024x1536',
      requiresImage: true,
      background: 'opaque',
      defaultPrompt:
        'Transform this image into a vertical event poster. Keep the main subject centered, crop neatly, enhance lighting, and make it ready for upload.',
    },
    [ChatImageAction.FIT_ORGANIZATION_LOGO]: {
      label: 'Fit organization logo',
      action: ChatImageAction.FIT_ORGANIZATION_LOGO,
      size: '1024x1024',
      requiresImage: true,
      background: 'transparent',
      defaultPrompt:
        'Convert this image into a clean square organization logo. Center the mark, simplify noisy background, keep edges sharp, and use transparent background when possible.',
    },
    [ChatImageAction.UPSCALE_IMAGE]: {
      label: 'Upscale image',
      action: ChatImageAction.UPSCALE_IMAGE,
      size: '1536x1024',
      requiresImage: true,
      background: 'auto',
      defaultPrompt:
        'Enhance and upscale this image. Improve sharpness, clarity, lighting, and details while preserving the original composition.',
    },
    [ChatImageAction.REMOVE_BACKGROUND]: {
      label: 'Remove background',
      action: ChatImageAction.REMOVE_BACKGROUND,
      size: '1024x1024',
      requiresImage: true,
      background: 'transparent',
      defaultPrompt:
        'Remove the background and keep only the main subject. Preserve clean edges and output with transparent background.',
    },
    [ChatImageAction.CREATE_IMAGE_FROM_PROMPT]: {
      label: 'Create image from prompt',
      action: ChatImageAction.CREATE_IMAGE_FROM_PROMPT,
      size: '1536x1024',
      requiresImage: false,
      background: 'opaque',
      defaultPrompt:
        'Create a polished horizontal event banner image suitable for an event listing page.',
    },
  };

  constructor(private readonly uploadService: UploadService) {}

  getImagePresets(): ApiResponse<ImagePreset[]> {
    return Response(200, 'Get chat image presets successfully', [
      this.presets[ChatImageAction.FIT_EVENT_BANNER],
      this.presets[ChatImageAction.FIT_EVENT_POSTER],
      this.presets[ChatImageAction.FIT_ORGANIZATION_LOGO],
      this.presets[ChatImageAction.UPSCALE_IMAGE],
      this.presets[ChatImageAction.REMOVE_BACKGROUND],
      this.presets[ChatImageAction.CREATE_IMAGE_FROM_PROMPT],
    ]);
  }

  async processImage(
    dto: ProcessChatImageDto,
    file?: Express.Multer.File,
  ): Promise<ApiResponse<ChatImageResultDto>> {
    const timer = `POST_CHAT_IMAGE_PROCESS:${dto.action}`;
    console.time(timer);
    try {
      const preset = this.presets[dto.action];
      if (!preset) {
        throw new BadRequestException('Invalid image action');
      }

      if (preset.requiresImage && !file) {
        throw new BadRequestException('Image file is required for this action');
      }

      if (file && !file.mimetype.startsWith('image/')) {
        throw new BadRequestException('Only image files are allowed');
      }

      const b64Json =
        dto.action === ChatImageAction.CREATE_IMAGE_FROM_PROMPT
          ? await this.generateImage(dto, preset)
          : await this.editImage(dto, preset, file!);

      const buffer = Buffer.from(b64Json, 'base64');
      const uploaded = await this.uploadService.uploadFile(
        {
          fieldname: 'file',
          originalname: `${this.getFileNamePrefix(dto, preset)}.png`,
          encoding: '7bit',
          mimetype: 'image/png',
          buffer,
          size: buffer.length,
        } as Express.Multer.File,
        'chat/images',
      );

      return Response(200, 'Chat image processed successfully', {
        secure_url: uploaded.data!.secure_url,
        public_id: uploaded.data!.public_id,
        action: dto.action,
        size: preset.size,
        mimeType: 'image/png',
      });
    } finally {
      console.timeEnd(timer);
    }
  }

  private async generateImage(
    dto: ProcessChatImageDto,
    preset: ImagePreset,
  ): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getOpenAiApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
        prompt: this.buildPrompt(dto, preset),
        size: preset.size,
        quality: 'auto',
        background: preset.background || 'auto',
        output_format: 'png',
      }),
    });

    return this.extractImage(response);
  }

  private async editImage(
    dto: ProcessChatImageDto,
    preset: ImagePreset,
    file: Express.Multer.File,
  ): Promise<string> {
    const formData = new FormData();
    formData.append('model', process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1');
    formData.append('prompt', this.buildPrompt(dto, preset));
    formData.append('size', preset.size);
    formData.append('quality', 'auto');
    formData.append('background', preset.background || 'auto');
    formData.append('output_format', 'png');
    formData.append(
      'image',
      new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
      file.originalname || 'image.png',
    );

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getOpenAiApiKey()}`,
      },
      body: formData,
    });

    return this.extractImage(response);
  }

  private async extractImage(response: globalThis.Response): Promise<string> {
    const data = await response.json();
    if (!response.ok) {
      throw new HttpException(
        {
          statusCode: response.status,
          message: data?.error?.message || 'Failed to process image with OpenAI',
          data: null,
        },
        response.status,
      );
    }

    const b64Json = data?.data?.[0]?.b64_json;
    if (!b64Json) {
      throw new InternalServerErrorException(
        'OpenAI did not return an image result',
      );
    }

    return b64Json;
  }

  private buildPrompt(dto: ProcessChatImageDto, preset: ImagePreset): string {
    const userPrompt = dto.prompt?.trim();
    if (!userPrompt) {
      return preset.defaultPrompt;
    }

    return `${preset.defaultPrompt}\n\nUser instruction: ${userPrompt}`;
  }

  private getFileNamePrefix(
    dto: ProcessChatImageDto,
    preset: ImagePreset,
  ): string {
    return (dto.fileNamePrefix || preset.action)
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private getOpenAiApiKey(): string {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new BadRequestException('OPENAI_API_KEY is missing');
    }
    return apiKey;
  }
}
