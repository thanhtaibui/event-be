import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { AiImageService } from './ai-image.service';

describe('AiImageService', () => {
  const originalFetch = global.fetch;
  let validPng: Buffer;
  let aiPromptService: { generateImageEditInstruction: jest.Mock };
  let imageStorageService: { createPreviewImage: jest.Mock };
  let cloudflareImageProvider: { edit: jest.Mock; inpaint: jest.Mock };
  let service: AiImageService;

  beforeAll(async () => {
    validPng = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn();
    aiPromptService = {
      generateImageEditInstruction: jest.fn().mockResolvedValue('Edit image'),
    };
    imageStorageService = {
      createPreviewImage: jest.fn().mockResolvedValue('data:image/png;base64,edited'),
    };
    cloudflareImageProvider = {
      edit: jest.fn().mockResolvedValue({
        buffer: validPng,
        mimeType: 'image/png',
      }),
      inpaint: jest.fn(),
    };
    service = new AiImageService(
      aiPromptService as any,
      imageStorageService as any,
      cloudflareImageProvider as any,
      {} as any,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('accepts a public HTTP image URL for edit', async () => {
    mockImageFetch(validPng, 'image/png');

    const result = await service.edit({
      imageUrl: 'https://example.com/source.png',
      description: 'make it simpler',
      ratio: '16:9',
    });

    expect(result).toEqual({
      imageUrl: 'data:image/png;base64,edited',
      status: 'preview',
    });
    expect(cloudflareImageProvider.edit).toHaveBeenCalledWith(
      expect.objectContaining({
        image: expect.objectContaining({
          buffer: expect.any(Buffer),
          mimeType: 'image/png',
        }),
        imageUrl: 'https://example.com/source.png',
        instruction: 'Edit image',
      }),
    );
  });

  it('accepts data URL image data for edit', async () => {
    const imageData = `data:image/png;base64,${validPng.toString('base64')}`;

    await service.edit({
      imageData,
      description: 'make it brighter',
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(cloudflareImageProvider.edit).toHaveBeenCalledWith(
      expect.objectContaining({
        image: expect.objectContaining({
          buffer: expect.any(Buffer),
          mimeType: 'image/png',
        }),
      }),
    );
  });

  it('rejects browser blob URLs with a clean domain error', async () => {
    await expect(
      service.edit({
        imageUrl: 'blob:http://localhost:5173/generated-image',
        description: 'edit this',
      }),
    ).rejects.toMatchObject({
      response: { message: 'INVALID_IMAGE_SOURCE' },
    });

    expect(cloudflareImageProvider.edit).not.toHaveBeenCalled();
  });

  it('rejects edit requests without imageUrl or imageData', async () => {
    await expect(
      service.edit({
        description: 'edit this',
      }),
    ).rejects.toMatchObject({
      response: { message: 'INVALID_IMAGE_SOURCE' },
    });

    expect(cloudflareImageProvider.edit).not.toHaveBeenCalled();
  });

  it('rejects malformed base64 image data', async () => {
    await expect(
      service.edit({
        imageData: 'data:image/png;base64,not-valid-base64',
        description: 'edit this',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.edit({
        imageData: 'data:image/png;base64,not-valid-base64',
        description: 'edit this',
      }),
    ).rejects.toMatchObject({
      response: { message: 'INVALID_IMAGE_DATA' },
    });

    expect(cloudflareImageProvider.edit).not.toHaveBeenCalled();
  });

  it('normalizes generated image data before calling Cloudflare edit provider', async () => {
    const imageData = `data:image/png;base64,${validPng.toString('base64')}`;

    await service.edit({
      imageData,
      prompt: 'change the background',
      strength: 0.7,
    });

    expect(aiPromptService.generateImageEditInstruction).toHaveBeenCalledWith(
      'change the background',
      undefined,
    );
    expect(cloudflareImageProvider.edit).toHaveBeenCalledWith(
      expect.objectContaining({
        image: expect.objectContaining({
          buffer: expect.any(Buffer),
          mimeType: 'image/png',
        }),
        imageUrl: undefined,
        instruction: 'Edit image',
        strength: 0.7,
      }),
    );
  });

  function mockImageFetch(buffer: Buffer, mimeType: string) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-type' ? mimeType : null,
      },
      arrayBuffer: jest
        .fn()
        .mockResolvedValue(
          buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength,
          ),
        ),
    });
  }
});
