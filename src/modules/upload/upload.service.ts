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
  private cachedClient?: S3Client;
  private cachedConfigSignature?: string;
  private cachedBucketName?: string;
  private cachedProvider: 'r2' | 's3' = 's3';
  private cachedEndpoint?: string;

  private getStorageConfig(): {
    client: S3Client;
    bucketName: string;
    provider: 'r2' | 's3';
    endpoint?: string;
  } {
    const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
    const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const r2BucketName = process.env.R2_BUCKET_NAME;
    const r2AccountId = process.env.R2_ACCOUNT_ID;
    const r2Endpoint =
      process.env.R2_ENDPOINT ||
      (r2AccountId
        ? `https://${r2AccountId}.r2.cloudflarestorage.com`
        : undefined);

    const isR2Configured = Boolean(
      r2AccessKeyId && r2SecretAccessKey && r2BucketName && r2Endpoint,
    );

    const s3Region = process.env.AWS_REGION;
    const s3AccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const s3SecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const s3BucketName =
      process.env.AWS_BUCKET ||
      process.env.AWS_S3_BUCKET_NAME ||
      process.env.AWS_S3_BUCKET;

    const isS3Configured = Boolean(
      s3Region && s3AccessKeyId && s3SecretAccessKey && s3BucketName,
    );

    const requestedProvider = (
      process.env.STORAGE_PROVIDER || ''
    ).toLowerCase();

    let provider: 'r2' | 's3' | null = null;
    if (requestedProvider === 'r2') {
      if (!isR2Configured) {
        const missingR2: string[] = [];
        if (!r2AccessKeyId) missingR2.push('R2_ACCESS_KEY_ID');
        if (!r2SecretAccessKey) missingR2.push('R2_SECRET_ACCESS_KEY');
        if (!r2BucketName) missingR2.push('R2_BUCKET_NAME');
        if (!r2Endpoint) missingR2.push('R2_ACCOUNT_ID or R2_ENDPOINT');
        throw new BadRequestException(
          Response(
            400,
            `STORAGE_PROVIDER=r2 is specified, but required Cloudflare R2 variables are missing: ${missingR2.join(', ')}`,
            null,
          ),
        );
      }
      provider = 'r2';
    } else if (requestedProvider === 's3') {
      if (!isS3Configured) {
        const missingS3: string[] = [];
        if (!s3Region) missingS3.push('AWS_REGION');
        if (!s3AccessKeyId) missingS3.push('AWS_ACCESS_KEY_ID');
        if (!s3SecretAccessKey) missingS3.push('AWS_SECRET_ACCESS_KEY');
        if (!s3BucketName) missingS3.push('AWS_S3_BUCKET_NAME/AWS_BUCKET');
        throw new BadRequestException(
          Response(
            400,
            `STORAGE_PROVIDER=s3 is specified, but required AWS S3 variables are missing: ${missingS3.join(', ')}`,
            null,
          ),
        );
      }
      provider = 's3';
    } else {
      if (isR2Configured) {
        provider = 'r2';
      } else if (isS3Configured) {
        provider = 's3';
      }
    }

    if (!provider) {
      throw new BadRequestException(
        Response(
          400,
          'Storage configuration is missing. Configure Cloudflare R2 (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ACCOUNT_ID/R2_ENDPOINT) or AWS S3.',
          null,
        ),
      );
    }

    const configSignature =
      provider === 'r2'
        ? `r2:${r2Endpoint}:${r2BucketName}:${r2AccessKeyId}`
        : `s3:${s3Region}:${s3BucketName}:${s3AccessKeyId}`;

    if (
      this.cachedClient &&
      this.cachedConfigSignature === configSignature &&
      this.cachedBucketName
    ) {
      return {
        client: this.cachedClient,
        bucketName: this.cachedBucketName,
        provider: this.cachedProvider,
        endpoint: this.cachedEndpoint,
      };
    }

    if (provider === 'r2') {
      this.cachedClient = new S3Client({
        region: 'auto',
        endpoint: r2Endpoint,
        credentials: {
          accessKeyId: r2AccessKeyId!,
          secretAccessKey: r2SecretAccessKey!,
        },
      });
      this.cachedBucketName = r2BucketName!;
      this.cachedProvider = 'r2';
      this.cachedEndpoint = r2Endpoint;
    } else {
      this.cachedClient = new S3Client({
        region: s3Region!,
        credentials: {
          accessKeyId: s3AccessKeyId!,
          secretAccessKey: s3SecretAccessKey!,
        },
      });
      this.cachedBucketName = s3BucketName!;
      this.cachedProvider = 's3';
      this.cachedEndpoint = undefined;
    }

    this.cachedConfigSignature = configSignature;

    return {
      client: this.cachedClient,
      bucketName: this.cachedBucketName,
      provider: this.cachedProvider,
      endpoint: this.cachedEndpoint,
    };
  }

  private getS3Client(): S3Client {
    return this.getStorageConfig().client;
  }

  async uploadFile(
    file: Express.Multer.File,
    folderName: string,
  ): Promise<ApiResponse<{ secure_url: string; public_id: string }>> {
    const config = this.getStorageConfig();
    try {
      const fileExtension = file.originalname.split('.').pop() || '';
      const baseName =
        file.originalname.substring(0, file.originalname.lastIndexOf('.')) ||
        file.originalname;
      const sanitizedFolder = folderName.replace(/^\/+|\/+$/g, '');
      const uniqueFileName = `${sanitizedFolder}/${baseName}-${Date.now()}.${fileExtension}`;

      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: uniqueFileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await config.client.send(command);

      let secureUrl: string;
      if (config.provider === 'r2') {
        const publicBase = process.env.R2_PUBLIC_BASE_URL
          ? process.env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '')
          : `${config.endpoint!.replace(/\/+$/, '')}/${config.bucketName}`;
        secureUrl = `${publicBase}/${uniqueFileName}`;
      } else {
        secureUrl = `https://${config.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFileName}`;
      }

      const providerLabel =
        config.provider === 'r2' ? 'Cloudflare R2' : 'AWS S3';
      return Response(200, `File uploaded successfully to ${providerLabel}`, {
        secure_url: secureUrl,
        public_id: uniqueFileName,
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const providerLabel =
        config.provider === 'r2' ? 'Cloudflare R2' : 'AWS S3';
      console.error(`${providerLabel} Upload Error:`, error);
      throw new InternalServerErrorException(
        Response(500, `Failed to upload file to ${providerLabel} storage`, null),
      );
    }
  }

  async deleteFile(fileUrl: string): Promise<ApiResponse<null>> {
    if (!fileUrl) {
      throw new BadRequestException(
        Response(400, 'File URL is required', null),
      );
    }
    const config = this.getStorageConfig();
    try {
      const storageKey = this.extractStorageKey(fileUrl, config.bucketName);
      const command = new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: storageKey,
      });
      await config.client.send(command);
      const providerLabel =
        config.provider === 'r2' ? 'Cloudflare R2' : 'AWS S3';
      return Response(200, `File deleted successfully from ${providerLabel}`, null);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const providerLabel =
        config.provider === 'r2' ? 'Cloudflare R2' : 'AWS S3';
      console.error(`${providerLabel} Delete Error:`, error);
      throw new InternalServerErrorException(
        Response(500, 'Failed to delete file', null),
      );
    }
  }

  public extractStorageKey(fileUrl: string, bucketName?: string): string {
    if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
      return fileUrl;
    }

    if (fileUrl.includes('.amazonaws.com/')) {
      const urlParts = fileUrl.split('.amazonaws.com/');
      if (urlParts.length > 1 && urlParts[1]) {
        return urlParts[1];
      }
    }

    if (fileUrl.includes('.r2.cloudflarestorage.com/')) {
      const urlParts = fileUrl.split('.r2.cloudflarestorage.com/');
      if (urlParts.length > 1 && urlParts[1]) {
        let key = urlParts[1];
        if (bucketName && key.startsWith(`${bucketName}/`)) {
          key = key.slice(bucketName.length + 1);
        }
        return key;
      }
    }

    const r2PublicBase = process.env.R2_PUBLIC_BASE_URL
      ? process.env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '')
      : undefined;
    if (r2PublicBase && fileUrl.startsWith(r2PublicBase)) {
      return fileUrl.slice(r2PublicBase.length).replace(/^\/+/, '');
    }

    try {
      const parsed = new URL(fileUrl);
      let pathname = parsed.pathname.replace(/^\/+/, '');
      if (bucketName && pathname.startsWith(`${bucketName}/`)) {
        pathname = pathname.slice(bucketName.length + 1);
      }
      if (pathname) {
        return pathname;
      }
    } catch {
      // not a standard URL
    }

    throw new BadRequestException(
      Response(400, 'Invalid file URL format', null),
    );
  }

  private extractS3Key(fileUrl: string): string {
    return this.extractStorageKey(fileUrl, this.cachedBucketName);
  }
}
