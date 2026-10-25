import { BadRequestException, HttpException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import {
  createUploadInterceptorOptions,
  UploadService,
} from './upload.service';

describe('UploadService R2 storage', () => {
  const envKeys = [
    'STORAGE_PROVIDER',
    'R2_ACCOUNT_ID',
    'R2_ENDPOINT',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PRIVATE_BUCKET_NAME',
    'R2_PUBLIC_BASE_URL',
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_S3_BUCKET_NAME',
    'AWS_S3_BUCKET',
    'AWS_BUCKET',
  ] as const;
  const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]));

  beforeEach(() => {
    process.env.STORAGE_PROVIDER = 'r2';
    process.env.R2_ACCOUNT_ID = 'test-account';
    delete process.env.R2_ENDPOINT;
    process.env.R2_ACCESS_KEY_ID = 'test-access-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
    process.env.R2_BUCKET_NAME = 'eventix-test';
    process.env.R2_PRIVATE_BUCKET_NAME = 'eventix-private-test';
    process.env.R2_PUBLIC_BASE_URL = 'https://cdn.example.test/eventix';
    process.env.AWS_REGION = 'ap-southeast-1';
    process.env.AWS_ACCESS_KEY_ID = 'aws-access-key-must-not-be-used';
    process.env.AWS_SECRET_ACCESS_KEY = 'aws-secret-must-not-be-used';
    process.env.AWS_S3_BUCKET_NAME = 'aws-fallback-must-not-be-used';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const key of envKeys) {
      const value = originalEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('uploads a validated image to R2 and preserves URL/key response fields', async () => {
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    const service = new UploadService();
    const buffer = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#00aa55' },
    })
      .png()
      .toBuffer();

    const result = await service.uploadFile(
      { buffer, mimetype: 'image/png', size: buffer.length } as Express.Multer.File,
      'events/posters',
    );

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input.Bucket).toBe('eventix-test');
    expect(command.input.Key).toMatch(/^events\/posters\/[0-9a-f-]+\.png$/i);
    expect(command.input.ContentType).toBe('image/png');
    expect(result.data?.url).toBe(result.data?.secure_url);
    expect(result.data?.key).toBe(result.data?.public_id);
    expect(result.data?.url).toMatch(/^https:\/\/cdn\.example\.test\/eventix\/events\/posters\//);
  });

  it('fails configuration rather than falling back when R2 is not explicitly selected', async () => {
    process.env.STORAGE_PROVIDER = 's3';
    const send = jest.spyOn(S3Client.prototype, 'send');
    const service = new UploadService();
    const buffer = await sharp({
      create: { width: 1, height: 1, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();

    await expect(
      service.uploadFile(
        { buffer, mimetype: 'image/png', size: buffer.length } as Express.Multer.File,
        'events',
      ),
    ).rejects.toBeInstanceOf(HttpException);
    expect(send).not.toHaveBeenCalled();
  });

  it('does not fall back to AWS S3 if the R2 provider rejects the upload', async () => {
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockImplementation(
        () => Promise.reject(new Error('provider unavailable')) as never,
      );
    const service = new UploadService();
    const buffer = await sharp({
      create: { width: 1, height: 1, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();

    await expect(
      service.uploadFile(
        { buffer, mimetype: 'image/png', size: buffer.length } as Express.Multer.File,
        'events',
      ),
    ).rejects.toBeInstanceOf(HttpException);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
  });

  it('rejects URLs outside the configured public domain and only deletes R2 objects', async () => {
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    const service = new UploadService();
    const r2Url = 'https://cdn.example.test/eventix/old/logo.png';

    expect(service.isR2PublicUrl(r2Url)).toBe(true);
    expect(service.isR2PublicUrl('https://res.cloudinary.com/old/logo.png')).toBe(false);
    expect(() => service.assertR2PublicUrl('https://cdn.example.test.evil/path')).toThrow(
      HttpException,
    );

    await expect(service.deleteFile('https://res.cloudinary.com/old/logo.png')).rejects.toThrow(
      HttpException,
    );
    await service.deleteFile(r2Url);
    const command = send.mock.calls[0][0] as DeleteObjectCommand;
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input.Key).toBe('old/logo.png');
  });

  it('rejects image content that does not match its declared MIME type', async () => {
    const send = jest.spyOn(S3Client.prototype, 'send');
    const service = new UploadService();

    await expect(
      service.uploadFile(
        {
          buffer: Buffer.from('not a png'),
          mimetype: 'image/png',
          size: 10,
        } as Express.Multer.File,
        'events',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects PDF and unsupported files on the public upload API', async () => {
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    const service = new UploadService();
    const pdf = Buffer.from('%PDF-1.7\nminimal test file');

    await expect(
      service.uploadFile(
        { buffer: pdf, mimetype: 'application/pdf', size: pdf.length } as Express.Multer.File,
        'documents',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(send).not.toHaveBeenCalled();

    const options = createUploadInterceptorOptions();
    const callback = jest.fn() as jest.MockedFunction<
      (error: Error | null, acceptFile: boolean) => void
    >;
    options.fileFilter({} as never, {
      mimetype: 'application/x-msdownload',
    } as Express.Multer.File, callback);
    expect(callback).toHaveBeenCalledWith(expect.any(BadRequestException), false);

    const publicPdfCallback = jest.fn();
    createUploadInterceptorOptions().fileFilter({} as never, {
      mimetype: 'application/pdf',
    } as Express.Multer.File, publicPdfCallback);
    expect(publicPdfCallback).toHaveBeenCalledWith(
      expect.any(BadRequestException),
      false,
    );
  });

  it('uploads verification documents only to a distinct private R2 bucket', async () => {
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    const service = new UploadService();
    const key = await service.uploadPrivateVerificationDocument(
      {
        buffer: Buffer.from('%PDF-1.7\nprivate'),
        mimetype: 'application/pdf',
      } as Express.Multer.File,
      'org-123',
    );

    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command.input.Bucket).toBe('eventix-private-test');
    expect(command.input.Bucket).not.toBe('eventix-test');
    expect(command.input.Key).toBe(key);
    expect(command.input.CacheControl).toBe('private, no-store');
    expect(service.isPrivateVerificationDocumentKey(key, 'org-123')).toBe(true);
    expect(service.isPrivateVerificationDocumentKey(key, 'org-other')).toBe(false);
  });

  it('checks private object existence and creates an expiring signed GET URL', async () => {
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    const service = new UploadService();
    const key =
      'org-verification/org-123/123e4567-e89b-42d3-a456-426614174000.pdf';

    const result = await service.createPrivateVerificationDocumentUrl(
      key,
      'org-123',
    );

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
    expect(result.url).toContain('X-Amz-Expires=300');
    expect(result.url).toContain(key);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects missing private objects and refuses to reuse the public bucket', async () => {
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockRejectedValueOnce(Object.assign(new Error('missing'), { name: 'NotFound' }) as never);
    const service = new UploadService();
    const key =
      'org-verification/org-123/123e4567-e89b-42d3-a456-426614174000.pdf';

    await expect(
      service.createPrivateVerificationDocumentUrl(key, 'org-123'),
    ).rejects.toThrow('Verification document was not found');

    process.env.R2_PRIVATE_BUCKET_NAME = process.env.R2_BUCKET_NAME;
    await expect(
      service.uploadPrivateVerificationDocument(
        {
          buffer: Buffer.from('%PDF-1.7\nprivate'),
          mimetype: 'application/pdf',
        } as Express.Multer.File,
        'org-123',
      ),
    ).rejects.toThrow('separate from public assets');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('blocks verification document prefixes on the public upload API', async () => {
    const send = jest.spyOn(S3Client.prototype, 'send');
    const service = new UploadService();
    const image = await sharp({
      create: { width: 1, height: 1, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();

    await expect(
      service.uploadFile(
        { buffer: image, mimetype: 'image/png' } as Express.Multer.File,
        'org-verification/org-123',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });
});
