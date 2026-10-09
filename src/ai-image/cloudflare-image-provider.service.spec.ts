import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CloudflareImageProvider } from './cloudflare-image-provider.service';

describe('CloudflareImageProvider', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...originalEnv,
      CLOUDFLARE_ACCOUNT_ID: 'test-account',
      CLOUDFLARE_API_TOKEN: 'test-token',
      CLOUDFLARE_IMAGE_GENERATION_MODEL:
        '@cf/black-forest-labs/flux-1-schnell',
      CLOUDFLARE_IMAGE_EDIT_MODEL:
        '@cf/stabilityai/stable-diffusion-xl-base-1.0',
      CLOUDFLARE_IMAGE_INPAINT_MODEL:
        '@cf/runwayml/stable-diffusion-v1-5-inpainting',
    };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('calls FLUX generate and normalizes base64 image response', async () => {
    mockJsonResponse(200, {
      result: { image: Buffer.from('generated').toString('base64') },
    });

    const provider = new CloudflareImageProvider();
    const result = await provider.generate({
      prompt: 'Create event banner',
      ratio: '16:9',
    });

    expect(result.buffer.toString()).toBe('generated');
    expect(result.mimeType).toBe('image/png');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        '/ai/run/%40cf/black-forest-labs/flux-1-schnell',
      ),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );

    const [, request] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(request.body)).toMatchObject({
      prompt: 'Create event banner',
      width: 1024,
      height: 576,
    });
  });

  it('calls SDXL img2img for edit', async () => {
    mockJsonResponse(200, {
      result: { image: Buffer.from('edited').toString('base64') },
    });

    const provider = new CloudflareImageProvider();
    const result = await provider.edit({
      image: { buffer: Buffer.from('source'), mimeType: 'image/png' },
      imageUrl: 'https://example.com/source.png',
      instruction: 'Make darker',
      ratio: '1:1',
      strength: 0.7,
    });

    expect(result.buffer.toString()).toBe('edited');
    const [, request] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(request.body)).toMatchObject({
      prompt: 'Make darker',
      image: Buffer.from('source').toString('base64'),
      strength: 0.7,
      width: 1024,
      height: 1024,
    });
  });

  it('calls inpainting model when mask is supplied', async () => {
    mockJsonResponse(200, {
      result: { image: Buffer.from('inpainted').toString('base64') },
    });

    const provider = new CloudflareImageProvider();
    const result = await provider.inpaint({
      image: { buffer: Buffer.from('source'), mimeType: 'image/png' },
      mask: { buffer: Buffer.from('mask'), mimeType: 'image/png' },
      imageUrl: 'https://example.com/source.png',
      instruction: 'Replace area',
      ratio: '9:16',
    });

    expect(result.buffer.toString()).toBe('inpainted');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        '/ai/run/%40cf/runwayml/stable-diffusion-v1-5-inpainting',
      ),
      expect.any(Object),
    );

    const [, request] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(request.body)).toMatchObject({
      prompt: 'Replace area',
      image: Buffer.from('source').toString('base64'),
      mask: Buffer.from('mask').toString('base64'),
      width: 576,
      height: 1024,
    });
  });

  it('normalizes Cloudflare free quota exhausted', async () => {
    expect.assertions(3);
    mockJsonResponse(429, { errors: [{ message: 'daily neuron quota exhausted' }] });

    const provider = new CloudflareImageProvider();

    await provider.generate({ prompt: 'test' }).catch((error: unknown) => {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as Error).message).toContain(
        "AI image generation has reached today's free usage limit",
      );
    });
  });

  it('normalizes model unavailable', async () => {
    mockJsonResponse(404, { errors: [{ message: 'model not found' }] });

    const provider = new CloudflareImageProvider();

    await expect(provider.generate({ prompt: 'test' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('normalizes Cloudflare unavailable', async () => {
    mockJsonResponse(503, { errors: [{ message: 'unavailable' }] });

    const provider = new CloudflareImageProvider();

    await expect(provider.generate({ prompt: 'test' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('fails before external call when credentials are missing', async () => {
    delete process.env.CLOUDFLARE_API_TOKEN;

    const provider = new CloudflareImageProvider();

    await expect(provider.generate({ prompt: 'test' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  function mockJsonResponse(status: number, body: unknown) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-type' ? 'application/json' : null,
      },
      json: jest.fn().mockResolvedValue(body),
      text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    });
  }
});
