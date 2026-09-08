import { Injectable } from '@nestjs/common';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { ChatImageAction } from './dto/process-chat-image.dto';

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
}
