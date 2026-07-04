import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { ApiResponse, Response } from '../../common/utils/ApiResponse'; // Bạn check lại đúng đường dẫn tới file ApiResponse của bạn nhé

@Injectable()
export class UploadService {
  private s3Client?: S3Client;
  private bucketName?: string;

  private getS3Client(): S3Client {
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const bucketName = process.env.AWS_S3_BUCKET_NAME;

    if (!region || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new BadRequestException(
        Response(400, 'AWS S3 configuration is missing', null),
      );
    }

    if (this.s3Client && this.bucketName === bucketName) {
      return this.s3Client;
    }

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    this.bucketName = bucketName;

    return this.s3Client;
  }

  async uploadFile(
    file: Express.Multer.File,
    folderName: string,
  ): Promise<ApiResponse<{ secure_url: string; public_id: string }>> {
    try {
      const s3Client = this.getS3Client();
      const bucketName = this.bucketName!;
      const fileExtension = file.originalname.split('.').pop();

      const uniqueFileName = `${folderName}/${file.originalname.split('.').shift()}-${Date.now()}.${fileExtension}`;

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: uniqueFileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await s3Client.send(command);

      const secureUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFileName}`;

      return Response(200, 'File uploaded successfully to AWS S3', {
        secure_url: secureUrl,
        public_id: uniqueFileName,
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('AWS S3 Upload Error:', error);
      throw new InternalServerErrorException(
        Response(500, 'Failed to upload file to AWS S3 storage', null),
      );
    }
  }

  async deleteFile(fileUrl: string): Promise<ApiResponse<null>> {
    if (!fileUrl) {
      throw new BadRequestException(
        Response(400, 'File URL is required', null),
      );
    }
    try {
      const s3Client = this.getS3Client();
      const s3Key = this.extractS3Key(fileUrl);
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName!,
        Key: s3Key,
      });
      await s3Client.send(command);
      return Response(200, 'File deleted successfully from AWS S3', null);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('AWS S3 Delete Error:', error);
      throw new InternalServerErrorException(
        Response(500, 'Failed to delete file', null),
      );
    }
  }

  private extractS3Key(fileUrl: string): string {
    if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://'))
      return fileUrl;
    const urlParts = fileUrl.split('.amazonaws.com/');
    if (urlParts.length > 1) return urlParts[1];
    throw new BadRequestException(
      Response(400, 'Invalid AWS S3 URL format', null),
    );
  }
}
