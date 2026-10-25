import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import cloudinary from '../../configs/cloudinary.config';
import { ApiResponse, Response } from '../../common/utils/ApiResponse';

@Injectable()
export class CloudinaryService {
  isCloudinaryUrl(fileUrl: string): boolean {
    try {
      return new URL(fileUrl).hostname === 'res.cloudinary.com';
    } catch {
      return false;
    }
  }

  async deleteFile(fileUrl: string): Promise<ApiResponse<null>> {
    if (!fileUrl) {
      throw new BadRequestException(
        Response(400, 'File URL is required for deletion', null),
      );
    }

    try {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (!cloudName || !apiKey || !apiSecret) {
        throw new Error('Legacy Cloudinary deletion is not configured');
      }
      if (!this.isCloudinaryUrl(fileUrl)) {
        throw new Error('URL is not a Cloudinary asset');
      }

      const publicId = this.extractPublicId(fileUrl);

      // We use 'auto' or try to detect type, but for deletion,
      // 'image' is default. If you upload PDFs as 'raw', you might need to handle that.
      const result = await cloudinary.uploader.destroy(publicId);

      if (result.result !== 'ok') {
        throw new Error(`Cloudinary returned: ${result.result}`);
      }

      return Response(200, 'File deleted successfully', null);
    } catch (error) {
      console.error(
        'LEGACY_CLOUDINARY_DELETE_FAILED',
        error instanceof Error ? error.name : 'unknown',
      );
      throw new InternalServerErrorException(
        Response(500, 'Failed to delete file from cloud storage', null),
      );
    }
  }

  private extractPublicId(fileUrl: string): string {
    try {
      // Regex này linh hoạt hơn để lấy public_id từ URL Cloudinary
      // Nó bỏ qua base URL và version number (v1234567...)
      const regex = /\/v\d+\/([^/]+(?:\/[^/]+)*)\.[a-z0-9]+$/i;
      const match = fileUrl.match(regex);

      if (match && match[1]) {
        return match[1];
      }

      throw new Error('Invalid Cloudinary URL format');
    } catch (error) {
      throw new BadRequestException(
        Response(400, 'Could not extract Public ID from provided URL', null),
      );
    }
  }
}
