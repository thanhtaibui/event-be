import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { UploadService } from '../upload/upload.service';
import {
  ChatImageAction,
  ChatImageResultDto,
  ProcessChatImageDto,
} from './dto/process-chat-image.dto';
import { HuggingFaceService } from './hugging-face.service';

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

  constructor(
    private readonly uploadService: UploadService,
    private readonly huggingFaceService: HuggingFaceService,
  ) {}

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

      const imageResult =
        dto.action === ChatImageAction.CREATE_IMAGE_FROM_PROMPT
          ? await this.huggingFaceService.generateImage(
              this.buildPrompt(dto, preset),
            )
          : await this.huggingFaceService.editImage(
              this.buildPrompt(dto, preset),
              file!,
            );

      const uploaded = await this.uploadService.uploadFile(
        {
          fieldname: 'file',
          originalname: `${this.getFileNamePrefix(dto, preset)}.png`,
          encoding: '7bit',
          mimetype: imageResult.mimeType,
          buffer: imageResult.buffer,
          size: imageResult.buffer.length,
        } as Express.Multer.File,
        'chat/images',
      );

      return Response(200, 'Chat image processed successfully', {
        secure_url: uploaded.data!.secure_url,
        public_id: uploaded.data!.public_id,
        action: dto.action,
        size: preset.size,
        mimeType: imageResult.mimeType,
      });
    } finally {
      console.timeEnd(timer);
    }
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
}
