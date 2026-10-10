import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
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
const ALLOWED_INPUT_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

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
      const prompt = await this.aiPromptService.generateReadyImagePrompt(
        dto.description,
        dto.ratio,
      );
      const generatedImage = await this.cloudflareImageProvider.generate({
        prompt,
        ratio: dto.ratio,
      });
      const image = await this.normalizeGeneratedImageRatio(
        generatedImage,
        dto.ratio,
      );
      const previewUrl = await this.imageStorageService.createPreviewImage(
        image,
        'ai-generated-image',
      );

      return this.toPreviewResponse(previewUrl);
    } catch (error) {
      this.logger.error(
        `POST_AI_IMAGE_GENERATE_FAILED:${this.getErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    } finally {
      console.timeEnd(timer);
    }
  }

  async edit(dto: EditImageDto) {
    const timer = dto.maskImageUrl ? 'POST_AI_IMAGE_INPAINT' : 'POST_AI_IMAGE_EDIT';
    console.time(timer);
    try {
      const editPrompt = this.getEditPrompt(dto);
      const sourceImage = await this.normalizeImageSource({
        imageUrl: dto.imageUrl,
        imageData: dto.imageData,
      });
      const instruction =
        await this.aiPromptService.generateImageEditInstruction(
          editPrompt,
          dto.ratio,
        );

      const image = dto.maskImageUrl
        ? await this.cloudflareImageProvider.inpaint({
            image: sourceImage,
            imageUrl: dto.imageUrl,
            mask: await this.normalizeImageSource({
              imageUrl: dto.maskImageUrl,
            }),
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

  private async normalizeImageSource(input: {
    imageUrl?: string;
    imageData?: string;
  }): Promise<AiImageBuffer> {
    const imageUrl = input.imageUrl?.trim();
    const imageData = input.imageData?.trim();

    if (imageUrl && imageData) {
      throw new BadRequestException('INVALID_IMAGE_SOURCE');
    }

    if (!imageUrl && !imageData) {
      throw new BadRequestException('INVALID_IMAGE_SOURCE');
    }

    const image = imageData
      ? this.readImageData(imageData)
      : await this.fetchImageFromUrl(imageUrl as string);

    await this.validateImageBuffer(image);

    return image;
  }

  private async fetchImageFromUrl(imageUrl: string): Promise<AiImageBuffer> {
    if (imageUrl.startsWith('blob:')) {
      throw new BadRequestException('INVALID_IMAGE_SOURCE');
    }

    if (imageUrl.startsWith('data:image/')) {
      return this.readImageData(imageUrl);
    }

    if (!this.isHttpImageUrl(imageUrl)) {
      throw new BadRequestException('INVALID_IMAGE_SOURCE');
    }

    let response: globalThis.Response;
    try {
      response = await fetch(imageUrl);
    } catch {
      throw new BadRequestException('INVALID_IMAGE_SOURCE');
    }

    if (!response.ok) {
      throw new BadRequestException('INVALID_IMAGE_SOURCE');
    }

    const mimeType = this.normalizeMimeType(
      response.headers.get('content-type') || 'image/png',
    );
    if (!this.isAllowedImageMimeType(mimeType)) {
      throw new BadRequestException('INVALID_IMAGE_SOURCE');
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    this.validateImageSize(buffer);

    return {
      buffer,
      mimeType,
    };
  }

  private readImageData(imageData: string): AiImageBuffer {
    const dataUrlMatch = imageData.match(
      /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i,
    );
    const mimeType = this.normalizeMimeType(dataUrlMatch?.[1] || 'image/png');
    const base64 = dataUrlMatch?.[2] || imageData;

    if (!this.isAllowedImageMimeType(mimeType)) {
      throw new BadRequestException('INVALID_IMAGE_DATA');
    }

    if (!this.isValidBase64(base64)) {
      throw new BadRequestException('INVALID_IMAGE_DATA');
    }

    const buffer = Buffer.from(base64.replace(/\s/g, ''), 'base64');
    this.validateImageSize(buffer);

    return {
      mimeType,
      buffer,
    };
  }

  private validateImageSize(buffer: Buffer): void {
    if (buffer.length > MAX_INPUT_IMAGE_BYTES) {
      throw new BadRequestException('IMAGE_TOO_LARGE');
    }
  }

  private async validateImageBuffer(image: AiImageBuffer): Promise<void> {
    if (!this.isAllowedImageMimeType(image.mimeType)) {
      throw new BadRequestException('INVALID_IMAGE_SOURCE');
    }

    this.validateImageSize(image.buffer);

    try {
      await sharp(image.buffer).metadata();
    } catch {
      throw new BadRequestException('INVALID_IMAGE_DATA');
    }
  }

  private getEditPrompt(dto: EditImageDto): string {
    const prompt = (dto.description || dto.prompt || '').trim();
    if (!prompt) {
      throw new BadRequestException('INVALID_IMAGE_EDIT_PROMPT');
    }

    return prompt;
  }

  private isHttpImageUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private normalizeMimeType(value: string): string {
    return value.split(';')[0].trim().toLowerCase();
  }

  private isAllowedImageMimeType(mimeType: string): boolean {
    return (ALLOWED_INPUT_IMAGE_MIME_TYPES as readonly string[]).includes(
      this.normalizeMimeType(mimeType),
    );
  }

  private isValidBase64(value: string): boolean {
    const normalized = value.replace(/\s/g, '');
    if (!normalized || normalized.length % 4 !== 0) {
      return false;
    }

    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
      return false;
    }

    return Buffer.from(normalized, 'base64').toString('base64') === normalized;
  }

  private toPreviewResponse(imageUrl: string) {
    return {
      imageUrl,
      status: 'preview' as const,
    };
  }

  private async normalizeGeneratedImageRatio(
    image: AiImageBuffer,
    ratio?: string,
  ): Promise<AiImageBuffer> {
    if (!ratio) {
      return image;
    }

    const croppedImage = await this.sharpImageProcessor.process({
      image,
      action: 'crop',
      ratio,
    });
    const size = this.getGeneratedImageSize(ratio);

    return this.sharpImageProcessor.process({
      image: croppedImage,
      action: 'resize',
      width: size.width,
      height: size.height,
      format: 'png',
    });
  }

  private getGeneratedImageSize(ratio: string): { width: number; height: number } {
    if (ratio === '1:1') {
      return { width: 1024, height: 1024 };
    }
    if (ratio === '9:16') {
      return { width: 576, height: 1024 };
    }

    return { width: 1024, height: 576 };
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
