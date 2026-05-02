import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import cloudinary from '../../configs/cloudinary.config';
import { ApiResponse, Response } from '../../common/utils/ApiResponse';

@Injectable()
export class CloudinaryService {
  async uploadFile(
    file: Express.Multer.File,
    folderName: string,
  ): Promise<ApiResponse<{ secure_url: string; public_id: string }>> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder: folderName,
          resource_type: 'auto' // Automatically detects image, video, or raw file
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Cloudinary upload result is undefined'));

          // Return both URL and public_id (best practice for later deletion)
          resolve(Response(200, "File upload successfully", {
            secure_url: result.secure_url,
            public_id: result.public_id
          }));
        },
      );
      upload.end(file.buffer);
    });
  }

  async deleteFile(fileUrl: string): Promise<ApiResponse<null>> {
    if (!fileUrl) {
      throw new BadRequestException(
        Response(400, 'File URL is required for deletion', null),
      );
    }

    try {
      const publicId = this.extractPublicId(fileUrl);

      // We use 'auto' or try to detect type, but for deletion, 
      // 'image' is default. If you upload PDFs as 'raw', you might need to handle that.
      const result = await cloudinary.uploader.destroy(publicId);

      if (result.result !== 'ok') {
        throw new Error(`Cloudinary returned: ${result.result}`);
      }

      return Response(200, 'File deleted successfully', null);
    } catch (error) {
      console.error('Cloudinary Delete Error:', error);
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