import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  EditImageDto,
  EnhanceImageDto,
  GenerateImageDto,
  SaveImageDto,
} from './dto/ai-image.dto';
import { AiPromptService } from './ai-prompt.service';
import { ImageStorageService } from './image-storage.service';
import { AiImageBuffer } from './interfaces/ai-image-provider.interface';
import { CloudflareImageProvider } from './cloudflare-image-provider.service';
import { SharpImageProcessor } from './sharp-image-processor.service';

const MAX_INPUT_IMAGE_BYTES = 12 * 1024 * 1024;

@Injectable()
export class AiImageService {
  private readonly logger = new Logger(AiImageService.name);

  constructor(
    private readonly aiPromptService: AiPromptService,
    private readonly imageStorageService: ImageStorageService,
    private readonly cloudflareImageProvider: CloudflareImageProvider,
    private readonly sharpImageProcessor: SharpImageProcessor,
  ) {}

  async generate(dto: GenerateImageDto) {
    const timer = 'POST_AI_IMAGE_GENERATE';
    console.time(timer);
    try {
      const prompt = await this.aiPromptService.generateImagePrompt(
        dto.description,
        dto.ratio,
      );
      const image = await this.cloudflareImageProvider.generate({
        prompt,
        ratio: dto.ratio,
      });
      const previewUrl = await this.imageStorageService.createPreviewImage(
        image,
        'ai-generated-image',
      );

      return this.toPreviewResponse(previewUrl);
    } finally {
      console.timeEnd(timer);
    }
  }

  async edit(dto: EditImageDto) {
    const timer = dto.maskImageUrl ? 'POST_AI_IMAGE_INPAINT' : 'POST_AI_IMAGE_EDIT';
    console.time(timer);
    try {
      const sourceImage = await this.fetchImageFromUrl(dto.imageUrl);
      const instruction =
        await this.aiPromptService.generateImageEditInstruction(
          dto.description,
          dto.ratio,
        );

      const image = dto.maskImageUrl
        ? await this.cloudflareImageProvider.inpaint({
            image: sourceImage,
            imageUrl: dto.imageUrl,
            mask: await this.fetchImageFromUrl(dto.maskImageUrl),
            instruction,
            ratio: dto.ratio,
            strength: dto.strength,
          })
        : await this.cloudflareImageProvider.edit({
            image: sourceImage,
            imageUrl: dto.imageUrl,
            instruction,
            ratio: dto.ratio,
            strength: dto.strength,
          });

      const previewUrl = await this.imageStorageService.createPreviewImage(
        image,
        dto.maskImageUrl ? 'ai-inpainted-image' : 'ai-edited-image',
      );

      return this.toPreviewResponse(previewUrl);
    } finally {
      console.timeEnd(timer);
    }
  }

  async enhance(dto: EnhanceImageDto) {
    const timer = `POST_AI_IMAGE_ENHANCE:${dto.action}`;
    console.time(timer);
    try {
      const sourceImage = await this.fetchImageFromUrl(dto.imageUrl);
      const image = await this.sharpImageProcessor.process({
        image: sourceImage,
        action: dto.action,
        factor: dto.factor,
        ratio: dto.ratio,
        width: dto.width,
        height: dto.height,
        angle: dto.angle,
        quality: dto.quality,
        format: dto.format,
      });
      const previewUrl = await this.imageStorageService.createPreviewImage(
        image,
        `ai-${dto.action}`,
      );

      return this.toPreviewResponse(previewUrl);
    } finally {
      console.timeEnd(timer);
    }
  }

  async save(dto: SaveImageDto) {
    const timer = 'POST_AI_IMAGE_SAVE';
    console.time(timer);
    try {
      const imageUrl = await this.imageStorageService.saveImageToS3(
        dto.imageUrl,
      );

      return {
        imageUrl,
        status: 'saved' as const,
      };
    } finally {
      console.timeEnd(timer);
    }
  }

  private async fetchImageFromUrl(imageUrl: string): Promise<AiImageBuffer> {
    if (imageUrl.startsWith('data:image/')) {
      return this.readDataUrlImage(imageUrl);
    }

    let response: globalThis.Response;
    try {
      response = await fetch(imageUrl);
    } catch {
      throw new BadRequestException('Cannot download image from imageUrl');
    }

    if (!response.ok) {
      throw new BadRequestException('Cannot download image from imageUrl');
    }

    const mimeType = response.headers.get('content-type') || 'image/png';
    if (!mimeType.startsWith('image/')) {
      throw new BadRequestException('imageUrl must point to an image file');
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    this.validateImageSize(buffer);

    return {
      buffer,
      mimeType,
    };
  }

  private readDataUrlImage(imageUrl: string): AiImageBuffer {
    const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      throw new BadRequestException('Invalid image data URL');
    }

    const buffer = Buffer.from(match[2], 'base64');
    this.validateImageSize(buffer);

    return {
      mimeType: match[1],
      buffer,
    };
  }

  private validateImageSize(buffer: Buffer): void {
    if (buffer.length > MAX_INPUT_IMAGE_BYTES) {
      throw new BadRequestException('Image file is too large');
    }
  }

  private toPreviewResponse(imageUrl: string) {
    return {
      imageUrl,
      status: 'preview' as const,
    };
  }
}
