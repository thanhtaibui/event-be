import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { AiImageService } from './ai-image.service';
import { ImagePromptGeneratorService } from './image-prompt-generator.service';

describe('AiImageService', () => {
  const originalFetch = global.fetch;
  const originalPromptLimit =
    process.env.CLOUDFLARE_IMAGE_GENERATION_MAX_PROMPT_CHARS;
  let validPng: Buffer;
  let aiPromptService: {
    fitPromptToProviderLimit: jest.Mock;
    generateImageEditInstruction: jest.Mock;
  };
  let imageStorageService: { createPreviewImage: jest.Mock };
  let cloudflareImageProvider: {
    generate: jest.Mock;
    edit: jest.Mock;
    inpaint: jest.Mock;
  };
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
      fitPromptToProviderLimit: jest
        .fn()
        .mockResolvedValue('compressed provider prompt'),
      generateImageEditInstruction: jest.fn().mockResolvedValue('Edit image'),
    };
    imageStorageService = {
      createPreviewImage: jest
        .fn()
        .mockResolvedValue('data:image/png;base64,edited'),
    };
    cloudflareImageProvider = {
      generate: jest.fn().mockResolvedValue({
        buffer: validPng,
        mimeType: 'image/png',
      }),
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
    if (originalPromptLimit === undefined) {
      delete process.env.CLOUDFLARE_IMAGE_GENERATION_MAX_PROMPT_CHARS;
    } else {
      process.env.CLOUDFLARE_IMAGE_GENERATION_MAX_PROMPT_CHARS =
        originalPromptLimit;
    }
  });

  it('sends a final prompt unchanged to Cloudflare without calling Groq', async () => {
    const prompt = '  Final render-ready event banner prompt.  ';
    aiPromptService.fitPromptToProviderLimit.mockRejectedValue(
      new Error('AI_PROMPT_PROVIDER_RATE_LIMITED'),
    );

    await expect(service.generate({ prompt })).resolves.toMatchObject({
      status: 'preview',
    });

    expect(cloudflareImageProvider.generate).toHaveBeenCalledWith({
      prompt,
      ratio: undefined,
    });
    expect(aiPromptService.fitPromptToProviderLimit).not.toHaveBeenCalled();
  });

  it('uses the legacy description field directly without calling Groq', async () => {
    const description = 'Modern neon music festival banner, DJ stage, 16:9.';

    await service.generate({ description });

    expect(cloudflareImageProvider.generate).toHaveBeenCalledWith({
      prompt: description,
      ratio: undefined,
    });
    expect(aiPromptService.fitPromptToProviderLimit).not.toHaveBeenCalled();
  });

  it('uses semantic fitting only when the prompt exceeds provider limit', async () => {
    const prompt = 'A'.repeat(2100);
    process.env.CLOUDFLARE_IMAGE_GENERATION_MAX_PROMPT_CHARS = '2048';

    await service.generate({ prompt });

    expect(aiPromptService.fitPromptToProviderLimit).toHaveBeenCalledWith(
      prompt,
      2048,
    );
    expect(cloudflareImageProvider.generate).toHaveBeenCalledWith({
      prompt: 'compressed provider prompt',
      ratio: undefined,
    });
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

describe('ImagePromptGeneratorService provider errors', () => {
  const originalFetch = global.fetch;
  const originalGroqApiKey = process.env.GROQ_API_KEY;
  const originalGroqModel = process.env.GROQ_CHAT_MODEL;

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'test-token';
    process.env.GROQ_CHAT_MODEL = 'test-model';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalGroqApiKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalGroqApiKey;
    if (originalGroqModel === undefined) delete process.env.GROQ_CHAT_MODEL;
    else process.env.GROQ_CHAT_MODEL = originalGroqModel;
  });

  it.each([
    [401, 'AI_PROMPT_PROVIDER_AUTHENTICATION_FAILED'],
    [403, 'AI_PROMPT_PROVIDER_PERMISSION_DENIED'],
    [429, 'AI_PROMPT_PROVIDER_RATE_LIMITED'],
    [503, 'AI_PROMPT_PROVIDER_SERVER_ERROR:503'],
  ])('preserves Groq HTTP failure %s as %s', async (status, code) => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status,
    });

    const service = new ImagePromptGeneratorService();

    await expect(
      service.generateImagePrompt('create a banner'),
    ).rejects.toMatchObject({
      response: { message: code },
    });
  });
});
