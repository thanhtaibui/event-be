import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { UploadService } from 'src/modules/upload/upload.service';
import { AiImageBuffer } from './interfaces/ai-image-provider.interface';

type UploadedImageResult = {
  secure_url: string;
  public_id: string;
};

@Injectable()
export class ImageStorageService {
  private readonly previewDir = join(process.cwd(), 'tmp', 'ai-images');

  constructor(private readonly uploadService: UploadService) {}

  async createPreviewImage(
    image: AiImageBuffer,
    fileNamePrefix: string,
  ): Promise<string> {
    await fs.mkdir(this.previewDir, { recursive: true });

    const extension = this.getExtensionFromMimeType(image.mimeType);
    const fileName = `${this.normalizeFileName(fileNamePrefix)}-${Date.now()}.${extension}`;
    const filePath = join(this.previewDir, fileName);

    await fs.writeFile(filePath, image.buffer);

    return `${this.getPublicBaseUrl()}/tmp/ai-images/${fileName}`;
  }

  async saveImageToS3(imageUrl: string): Promise<string> {
    const image = await this.readImageFromUrl(imageUrl);
    const uploaded = await this.uploadResult(image, 'ai-saved-image');

    return uploaded.secure_url;
  }

  private async readImageFromUrl(imageUrl: string): Promise<AiImageBuffer> {
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

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType,
    };
  }

  private readDataUrlImage(imageUrl: string): AiImageBuffer {
    const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      throw new BadRequestException('Invalid image data URL');
    }

    return {
      mimeType: match[1],
      buffer: Buffer.from(match[2], 'base64'),
    };
  }

  private async uploadResult(
    image: AiImageBuffer,
    fileNamePrefix: string,
  ): Promise<UploadedImageResult> {
    const extension = this.getExtensionFromMimeType(image.mimeType);
    const uploaded = await this.uploadService.uploadFile(
      {
        fieldname: 'file',
        originalname: `${fileNamePrefix}.${extension}`,
        encoding: '7bit',
        mimetype: image.mimeType,
        buffer: image.buffer,
        size: image.buffer.length,
      } as Express.Multer.File,
      'ai/images',
    );

    if (!uploaded.data) {
      throw new InternalServerErrorException('Upload image to S3 failed');
    }

    return uploaded.data;
  }

  private getPublicBaseUrl(): string {
    const port = Number(process.env.PORT ?? 3000);
    const baseUrl =
      process.env.API_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      `http://localhost:${port}`;

    return baseUrl.replace(/\/$/, '');
  }

  private getExtensionFromMimeType(mimeType: string): string {
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      return 'jpg';
    }
    if (mimeType.includes('webp')) {
      return 'webp';
    }
    return 'png';
  }

  private normalizeFileName(fileName: string): string {
    return fileName
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
