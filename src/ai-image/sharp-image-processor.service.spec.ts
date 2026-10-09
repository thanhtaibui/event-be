import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { SharpImageProcessor } from './sharp-image-processor.service';
import { AiImageBuffer } from './interfaces/ai-image-provider.interface';

describe('SharpImageProcessor', () => {
  let processor: SharpImageProcessor;
  let image: AiImageBuffer;

  beforeAll(async () => {
    processor = new SharpImageProcessor();
    image = {
      buffer: await sharp({
        create: {
          width: 160,
          height: 90,
          channels: 3,
          background: '#3157ff',
        },
      })
        .png()
        .toBuffer(),
      mimeType: 'image/png',
    };
  });

  it('upscales image 2x', async () => {
    const result = await processor.process({
      image,
      action: 'upscale',
      factor: 2,
    });

    await expectDimensions(result.buffer, 320, 180);
  });

  it('upscales image 4x', async () => {
    const result = await processor.process({
      image,
      action: 'upscale',
      factor: 4,
    });

    await expectDimensions(result.buffer, 640, 360);
  });

  it('crops image to 1:1', async () => {
    const result = await processor.process({
      image,
      action: 'crop',
      ratio: '1:1',
    });

    await expectDimensions(result.buffer, 90, 90);
  });

  it('crops image to 16:9', async () => {
    const result = await processor.process({
      image,
      action: 'crop',
      ratio: '16:9',
    });

    await expectDimensions(result.buffer, 160, 90);
  });

  it('resizes image to requested dimensions', async () => {
    const result = await processor.process({
      image,
      action: 'resize',
      width: 320,
      height: 180,
    });

    await expectDimensions(result.buffer, 320, 180);
  });

  it('rotates image', async () => {
    const result = await processor.process({
      image,
      action: 'rotate',
      angle: 90,
    });

    await expectDimensions(result.buffer, 90, 160);
  });

  it('compresses image', async () => {
    const result = await processor.process({
      image,
      action: 'compress',
      format: 'jpeg',
      quality: 70,
    });

    expect(result.mimeType).toBe('image/jpeg');
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it('converts image format', async () => {
    const result = await processor.process({
      image,
      action: 'convert',
      format: 'webp',
    });

    expect(result.mimeType).toBe('image/webp');
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it('rejects invalid image', async () => {
    await expect(
      processor.process({
        image: { buffer: Buffer.from('not-image'), mimeType: 'image/png' },
        action: 'upscale',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  async function expectDimensions(
    buffer: Buffer,
    width: number,
    height: number,
  ) {
    const metadata = await sharp(buffer).metadata();
    expect(metadata.width).toBe(width);
    expect(metadata.height).toBe(height);
  }
});
