import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { ApiResponse, Response } from '../../common/utils/ApiResponse'; // Bạn check lại đúng đường dẫn tới file ApiResponse của bạn nhé
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {

    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || '',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || "";
  }

  async uploadFile(
    file: Express.Multer.File,
    folderName: string,
  ): Promise<ApiResponse<{ secure_url: string; public_id: string }>> {
    try {
      const fileExtension = file.originalname.split('.').pop();

      const uniqueFileName = `${folderName}/${file.originalname.split('.').shift()}-${Date.now()}.${fileExtension}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: uniqueFileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);

      const secureUrl = `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'ap-southeast-1'}.amazonaws.com/${uniqueFileName}`;

      return Response(200, "File uploaded successfully to AWS S3", {
        secure_url: secureUrl,
        public_id: uniqueFileName
      });
    } catch (error) {
      console.error('AWS S3 Upload Error:', error);
      throw new InternalServerErrorException(
        Response(500, 'Failed to upload file to AWS S3 storage', null)
      );
    }
  }

  async deleteFile(fileUrl: string): Promise<ApiResponse<null>> {
    if (!fileUrl) {
      throw new BadRequestException(Response(400, 'File URL is required', null));
    }
    try {
      const s3Key = this.extractS3Key(fileUrl);
      const command = new DeleteObjectCommand({ Bucket: this.bucketName, Key: s3Key });
      await this.s3Client.send(command);
      return Response(200, 'File deleted successfully from AWS S3', null);
    } catch (error) {
      console.error('AWS S3 Delete Error:', error);
      throw new InternalServerErrorException(Response(500, 'Failed to delete file', null));
    }
  }

  private extractS3Key(fileUrl: string): string {
    if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) return fileUrl;
    const urlParts = fileUrl.split('.amazonaws.com/');
    if (urlParts.length > 1) return urlParts[1];
    throw new BadRequestException(Response(400, 'Invalid AWS S3 URL format', null));
  }
}