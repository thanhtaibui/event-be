import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import {
  AiImageBuffer,
  EnhanceImageInput,
} from './interfaces/ai-image-provider.interface';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_OUTPUT_DIMENSION = 4096;
type ImageOutputFormat = 'png' | 'jpeg' | 'webp';

@Injectable()
export class SharpImageProcessor {
  async process(input: EnhanceImageInput): Promise<AiImageBuffer> {
    await this.validateImage(input.image);

    switch (input.action) {
      case 'upscale':
        return this.upscale(input);
      case 'crop':
        return this.crop(input);
      case 'resize':
        return this.resize(input);
      case 'rotate':
        return this.rotate(input);
      case 'compress':
        return this.compress(input);
      case 'convert':
        return this.convert(input);
      case 'remove_background':
        throw new BadRequestException('IMAGE_PROCESSING_ACTION_UNSUPPORTED');
      default:
        throw new BadRequestException('IMAGE_PROCESSING_ACTION_UNSUPPORTED');
    }
  }

  private async upscale(input: EnhanceImageInput): Promise<AiImageBuffer> {
    const factor = input.factor ?? 2;
    if (![2, 4].includes(factor)) {
      throw new BadRequestException('Invalid upscale factor');
    }

    const metadata = await sharp(input.image.buffer).metadata();
    const width = this.ensureOutputDimension((metadata.width || 1) * factor);
    const height = this.ensureOutputDimension((metadata.height || 1) * factor);

    return this.toOutput(
      sharp(input.image.buffer)
        .resize(width, height, {
          kernel: sharp.kernel.lanczos3,
          fit: 'fill',
        })
        .sharpen({ sigma: 0.6 }),
      input.format || this.getFormatFromMimeType(input.image.mimeType),
      input.quality,
    );
  }

  private async crop(input: EnhanceImageInput): Promise<AiImageBuffer> {
    const metadata = await sharp(input.image.buffer).metadata();
    const sourceWidth = metadata.width;
    const sourceHeight = metadata.height;
    if (!sourceWidth || !sourceHeight) {
      throw new BadRequestException('Invalid image');
    }

    const ratio = this.getRatioNumber(input.ratio || '1:1');
    const sourceRatio = sourceWidth / sourceHeight;
    const width =
      sourceRatio > ratio ? Math.round(sourceHeight * ratio) : sourceWidth;
    const height =
      sourceRatio > ratio ? sourceHeight : Math.round(sourceWidth / ratio);

    return this.toOutput(
      sharp(input.image.buffer).resize(width, height, {
        fit: 'cover',
        position: 'centre',
      }),
      input.format || this.getFormatFromMimeType(input.image.mimeType),
      input.quality,
    );
  }

  private async resize(input: EnhanceImageInput): Promise<AiImageBuffer> {
    if (!input.width && !input.height && !input.ratio) {
      throw new BadRequestException('width, height or ratio is required');
    }

    const size = input.ratio
      ? this.getSizeFromRatio(input.ratio, input.width)
      : {
          width: input.width
            ? this.ensureOutputDimension(input.width)
            : undefined,
          height: input.height
            ? this.ensureOutputDimension(input.height)
            : undefined,
        };

    return this.toOutput(
      sharp(input.image.buffer).resize(size.width, size.height, {
        fit: 'cover',
        kernel: sharp.kernel.lanczos3,
      }),
      input.format || this.getFormatFromMimeType(input.image.mimeType),
      input.quality,
    );
  }

  private rotate(input: EnhanceImageInput): Promise<AiImageBuffer> {
    return this.toOutput(
      sharp(input.image.buffer).rotate(input.angle ?? 90),
      input.format || this.getFormatFromMimeType(input.image.mimeType),
      input.quality,
    );
  }

  private compress(input: EnhanceImageInput): Promise<AiImageBuffer> {
    return this.toOutput(
      sharp(input.image.buffer),
      input.format || this.getFormatFromMimeType(input.image.mimeType),
      input.quality ?? 80,
    );
  }

  private convert(input: EnhanceImageInput): Promise<AiImageBuffer> {
    if (!input.format) {
      throw new BadRequestException('format is required');
    }

    return this.toOutput(sharp(input.image.buffer), input.format, input.quality);
  }

  private async toOutput(
    pipeline: sharp.Sharp,
    format: ImageOutputFormat,
    quality = 90,
  ): Promise<AiImageBuffer> {
    const normalizedFormat = this.normalizeFormat(format);
    const buffer = await pipeline
      .toFormat(normalizedFormat, { quality })
      .toBuffer();

    return {
      buffer,
      mimeType: this.getMimeTypeFromFormat(normalizedFormat),
    };
  }

  private async validateImage(image: AiImageBuffer): Promise<void> {
    if (!image.mimeType.startsWith('image/')) {
      throw new BadRequestException('Unsupported image MIME type');
    }
    if (image.buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Image file is too large');
    }

    try {
      await sharp(image.buffer).metadata();
    } catch {
      throw new BadRequestException('Invalid image');
    }
  }

  private getRatioNumber(ratio: string): number {
    if (ratio === '1:1') {
      return 1;
    }
    if (ratio === '9:16') {
      return 9 / 16;
    }

    return 16 / 9;
  }

  private getSizeFromRatio(
    ratio: string,
    preferredWidth = 1024,
  ): { width: number; height: number } {
    const width = this.ensureOutputDimension(preferredWidth);
    const height = this.ensureOutputDimension(
      Math.round(width / this.getRatioNumber(ratio)),
    );

    return { width, height };
  }

  private ensureOutputDimension(value: number): number {
    return Math.max(1, Math.min(Math.round(value), MAX_OUTPUT_DIMENSION));
  }

  private normalizeFormat(
    format: ImageOutputFormat,
  ): ImageOutputFormat {
    return format;
  }

  private getFormatFromMimeType(mimeType: string): ImageOutputFormat {
    if (mimeType.includes('webp')) {
      return 'webp';
    }
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      return 'jpeg';
    }

    return 'png';
  }

  private getMimeTypeFromFormat(format: ImageOutputFormat): string {
    if (format === 'jpeg') {
      return 'image/jpeg';
    }
    if (format === 'webp') {
      return 'image/webp';
    }

    return 'image/png';
  }
}
