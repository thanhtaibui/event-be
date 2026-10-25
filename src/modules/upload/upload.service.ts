import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash, randomUUID } from 'crypto';
import sharp from 'sharp';
import type { Request } from 'express';
import { ApiResponse, Response } from '../../common/utils/ApiResponse';

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const IMAGE_FORMAT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'heif',
};
const FILE_EXTENSION_BY_MIME: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(IMAGE_FORMAT_BY_MIME).map(([mime, format]) => [
      mime,
      format === 'jpeg' ? 'jpg' : format === 'heif' ? 'avif' : format,
    ]),
  ),
  'application/pdf': 'pdf',
};

export function createUploadInterceptorOptions(imagesOnly = true) {
  const allowedMimeTypes = new Set(
    imagesOnly
      ? Object.keys(IMAGE_FORMAT_BY_MIME)
      : Object.keys(FILE_EXTENSION_BY_MIME),
  );

  return {
    limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
    fileFilter: (
      _request: Request,
      file: Express.Multer.File,
      callback: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      if (!allowedMimeTypes.has(file.mimetype)) {
        callback(new BadRequestException('Unsupported file type'), false);
        return;
      }
      callback(null, true);
    },
  };
}

type R2StorageConfig = {
  client: S3Client;
  bucketName: string;
  publicBaseUrl: URL;
};

type UploadedFileResult = {
  url: string;
  key: string;
  secure_url: string;
  public_id: string;
};

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private cachedClient?: S3Client;
  private cachedConfigSignature?: string;
  private cachedBucketName?: string;
  private cachedPublicBaseUrl?: URL;

  private getStorageConfig(): R2StorageConfig {
    const missing: string[] = [];
    const accountId = process.env.R2_ACCOUNT_ID;
    const endpoint =
      process.env.R2_ENDPOINT ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicBaseUrlValue = process.env.R2_PUBLIC_BASE_URL;

    if (process.env.STORAGE_PROVIDER?.trim().toLowerCase() !== 'r2') {
      missing.push('STORAGE_PROVIDER=r2');
    }
    if (!endpoint) missing.push('R2_ACCOUNT_ID or R2_ENDPOINT');
    if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
    if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
    if (!bucketName) missing.push('R2_BUCKET_NAME');
    if (!publicBaseUrlValue) missing.push('R2_PUBLIC_BASE_URL');
    if (missing.length) {
      throw new InternalServerErrorException(
        Response(
          500,
          `Cloudflare R2 configuration is incomplete: ${missing.join(', ')}`,
          null,
        ),
      );
    }

    let publicBaseUrl: URL;
    try {
      publicBaseUrl = new URL(publicBaseUrlValue!);
      if (
        publicBaseUrl.protocol !== 'https:' ||
        publicBaseUrl.username ||
        publicBaseUrl.password ||
        publicBaseUrl.search ||
        publicBaseUrl.hash ||
        publicBaseUrl.hostname.endsWith('.r2.cloudflarestorage.com')
      ) {
        throw new Error('Invalid public URL');
      }
      publicBaseUrl.pathname = publicBaseUrl.pathname.replace(/\/+$/, '');
    } catch {
      throw new InternalServerErrorException(
        Response(
          500,
          'R2_PUBLIC_BASE_URL must be an HTTPS public bucket or custom-domain URL, not the S3 API endpoint',
          null,
        ),
      );
    }

    const secretFingerprint = createHash('sha256')
      .update(secretAccessKey!)
      .digest('hex');
    const configSignature = `${endpoint}:${bucketName}:${accessKeyId}:${secretFingerprint}:${publicBaseUrl.toString()}`;
    if (
      !this.cachedClient ||
      this.cachedConfigSignature !== configSignature ||
      !this.cachedBucketName ||
      !this.cachedPublicBaseUrl
    ) {
      this.cachedClient = new S3Client({
        region: 'auto',
        endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: accessKeyId!,
          secretAccessKey: secretAccessKey!,
        },
      });
      this.cachedConfigSignature = configSignature;
      this.cachedBucketName = bucketName;
      this.cachedPublicBaseUrl = publicBaseUrl;
    }

    return {
      client: this.cachedClient,
      bucketName: this.cachedBucketName!,
      publicBaseUrl: this.cachedPublicBaseUrl!,
    };
  }

  isR2PublicUrl(fileUrl: string): boolean {
    try {
      const base = this.getPublicBaseUrl();
      const candidate = new URL(fileUrl);
      const basePath = base.pathname.replace(/\/+$/, '');
      return (
        candidate.protocol === 'https:' &&
        candidate.origin === base.origin &&
        !candidate.search &&
        !candidate.hash &&
        candidate.pathname.startsWith(`${basePath}/`)
      );
    } catch {
      return false;
    }
  }

  assertR2PublicUrl(fileUrl: string): void {
    if (!this.isR2PublicUrl(fileUrl)) {
      throw new BadRequestException(
        Response(
          400,
          'New media must use a URL returned by the R2 upload API',
          null,
        ),
      );
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folderName: string,
  ): Promise<ApiResponse<UploadedFileResult>> {
    const config = this.getStorageConfig();
    if (!Object.hasOwn(IMAGE_FORMAT_BY_MIME, file?.mimetype || '')) {
      throw new BadRequestException(
        'Public upload only accepts image files; use the private document endpoint for verification documents',
      );
    }
    await this.validateFile(file);

    const folder = this.normalizeFolder(folderName);
    if (folder === 'org-verification' || folder.startsWith('org-verification/')) {
      throw new BadRequestException(
        'Verification documents must use the private verification upload API',
      );
    }
    const extension = FILE_EXTENSION_BY_MIME[file.mimetype];
    const key = `${folder}/${randomUUID()}.${extension}`;
    try {
      await config.client.send(
        new PutObjectCommand({
          Bucket: config.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );

      const url = this.buildPublicUrl(config.publicBaseUrl, key);
      return Response(200, 'File uploaded successfully to Cloudflare R2', {
        url,
        key,
        secure_url: url,
        public_id: key,
      });
    } catch (error) {
      this.logger.error(
        `R2_UPLOAD_FAILED:${error instanceof Error ? error.name : 'unknown'}`,
      );
      throw new InternalServerErrorException(
        Response(500, 'Failed to upload file to Cloudflare R2 storage', null),
      );
    }
  }

  async uploadPrivateVerificationDocument(
    file: Express.Multer.File,
    organizationId: string,
  ): Promise<string> {
    const config = this.getStorageConfig();
    const privateBucket = this.getPrivateBucketName(config.bucketName);
    await this.validateFile(file);

    const extension = FILE_EXTENSION_BY_MIME[file.mimetype];
    const key = `org-verification/${organizationId}/${randomUUID()}.${extension}`;
    try {
      await config.client.send(
        new PutObjectCommand({
          Bucket: privateBucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: 'private, no-store',
        }),
      );
      return key;
    } catch (error) {
      this.logger.error(
        `R2_PRIVATE_DOCUMENT_UPLOAD_FAILED:${error instanceof Error ? error.name : 'unknown'}`,
      );
      throw new InternalServerErrorException(
        'Failed to upload private verification document',
      );
    }
  }

  isPrivateVerificationDocumentKey(key: string, organizationId?: string): boolean {
    if (typeof key !== 'string') return false;
    const match = /^org-verification\/([A-Za-z0-9-]+)\/([0-9a-f-]+\.(?:jpg|png|webp|gif|avif|pdf))$/i.exec(key);
    return Boolean(match && (!organizationId || match[1] === organizationId));
  }

  async createPrivateVerificationDocumentUrl(
    key: string,
    organizationId: string,
  ): Promise<{ url: string; expiresAt: Date }> {
    if (!this.isPrivateVerificationDocumentKey(key, organizationId)) {
      throw new BadRequestException('Invalid verification document reference');
    }

    const config = this.getStorageConfig();
    const bucket = this.getPrivateBucketName(config.bucketName);
    try {
      await this.assertPrivateVerificationDocumentExists(key, organizationId);
      const expiresIn = 300;
      const url = await getSignedUrl(
        config.client,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn },
      );
      return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (
        error instanceof Error &&
        ['NotFound', 'NoSuchKey', 'NotFoundException'].includes(error.name)
      ) {
        throw new BadRequestException('Verification document was not found');
      }
      this.logger.error(
        `R2_PRIVATE_DOCUMENT_SIGN_FAILED:${error instanceof Error ? error.name : 'unknown'}`,
      );
      throw new InternalServerErrorException(
        'Unable to create temporary document access URL',
      );
    }
  }

  async assertPrivateVerificationDocumentExists(
    key: string,
    organizationId: string,
  ): Promise<void> {
    if (!this.isPrivateVerificationDocumentKey(key, organizationId)) {
      throw new BadRequestException('Invalid verification document reference');
    }
    const config = this.getStorageConfig();
    const bucket = this.getPrivateBucketName(config.bucketName);
    try {
      await config.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    } catch (error) {
      if (
        error instanceof Error &&
        ['NotFound', 'NoSuchKey', 'NotFoundException'].includes(error.name)
      ) {
        throw new BadRequestException('Verification document was not found');
      }
      this.logger.error(
        `R2_PRIVATE_DOCUMENT_HEAD_FAILED:${error instanceof Error ? error.name : 'unknown'}`,
      );
      throw new InternalServerErrorException(
        'Unable to verify private verification document',
      );
    }
  }

  async deleteFile(fileUrl: string): Promise<ApiResponse<null>> {
    if (!fileUrl || !this.isR2PublicUrl(fileUrl)) {
      throw new BadRequestException(
        Response(
          400,
          'Only URLs from the configured R2 public domain can be deleted here',
          null,
        ),
      );
    }

    const config = this.getStorageConfig();
    const key = this.extractR2Key(fileUrl, config.publicBaseUrl);
    try {
      await config.client.send(
        new DeleteObjectCommand({ Bucket: config.bucketName, Key: key }),
      );
      return Response(200, 'File deleted successfully from Cloudflare R2', null);
    } catch (error) {
      this.logger.error(
        `R2_DELETE_FAILED:${error instanceof Error ? error.name : 'unknown'}`,
      );
      throw new InternalServerErrorException(
        Response(500, 'Failed to delete file from Cloudflare R2', null),
      );
    }
  }

  private getPublicBaseUrl(): URL {
    const value = process.env.R2_PUBLIC_BASE_URL;
    if (!value) throw new Error('R2_PUBLIC_BASE_URL is missing');
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.hostname.endsWith('.r2.cloudflarestorage.com')
    ) {
      throw new Error('R2_PUBLIC_BASE_URL is invalid');
    }
    url.pathname = url.pathname.replace(/\/+$/, '');
    return url;
  }

  private getPrivateBucketName(publicBucketName: string): string {
    const privateBucket = process.env.R2_PRIVATE_BUCKET_NAME?.trim();
    if (!privateBucket) {
      throw new InternalServerErrorException(
        'Cloudflare R2 private storage is not configured: R2_PRIVATE_BUCKET_NAME',
      );
    }
    if (privateBucket === publicBucketName) {
      throw new InternalServerErrorException(
        'R2 private documents must use a bucket separate from public assets',
      );
    }
    return privateBucket;
  }

  private normalizeFolder(folderName: string): string {
    const segments = (folderName || 'uploads')
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (
      !segments.length ||
      segments.some((segment) => segment === '.' || segment === '..')
    ) {
      throw new BadRequestException('Invalid upload folder');
    }
    return segments
      .map((segment) => segment.replace(/[^A-Za-z0-9_-]/g, '-'))
      .join('/');
  }

  private async validateFile(file: Express.Multer.File): Promise<void> {
    if (!file?.buffer?.length || file.buffer.length > MAX_UPLOAD_SIZE_BYTES) {
      throw new BadRequestException('File is missing or exceeds the 10 MB limit');
    }
    if (!Object.hasOwn(FILE_EXTENSION_BY_MIME, file.mimetype)) {
      throw new BadRequestException('Unsupported file type');
    }

    if (file.mimetype === 'application/pdf') {
      if (file.buffer.subarray(0, 5).toString() !== '%PDF-') {
        throw new BadRequestException('File content does not match its MIME type');
      }
      return;
    }

    try {
      const metadata = await sharp(file.buffer, { failOn: 'error' }).metadata();
      if (metadata.format !== IMAGE_FORMAT_BY_MIME[file.mimetype]) {
        throw new BadRequestException('File content does not match its MIME type');
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Invalid or unsupported image file');
    }
  }

  private buildPublicUrl(publicBaseUrl: URL, key: string): string {
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    return `${publicBaseUrl.toString().replace(/\/+$/, '')}/${encodedKey}`;
  }

  private extractR2Key(fileUrl: string, publicBaseUrl: URL): string {
    const candidate = new URL(fileUrl);
    const encodedBasePath = publicBaseUrl.pathname.replace(/\/+$/, '');
    const encodedKey = candidate.pathname.slice(encodedBasePath.length + 1);
    try {
      return encodedKey.split('/').map(decodeURIComponent).join('/');
    } catch {
      throw new BadRequestException('Invalid encoded R2 object URL');
    }
  }
}
