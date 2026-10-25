import { BadRequestException } from '@nestjs/common';
import { ItemService } from './item.service';

describe('ItemService public image storage', () => {
  function createService() {
    const itemRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
    };
    const eventRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'event-1' }),
    };
    const uploadService = {
      assertR2PublicUrl: jest.fn((url: string) => {
        if (!url.startsWith('https://cdn.example.test/')) {
          throw new BadRequestException('Expected R2 public URL');
        }
      }),
    };
    return {
      service: new ItemService(
        itemRepository as any,
        eventRepository as any,
        uploadService as any,
      ),
      itemRepository,
      uploadService,
    };
  }

  it('accepts item posters from the configured R2 public domain', async () => {
    const { service, uploadService } = createService();

    const response = await service.create({
      eventId: 'event-1',
      name: 'Event poster item',
      imageUrl: 'https://cdn.example.test/items/poster.png',
      price: 1000,
    } as any);

    expect(response.statusCode).toBe(201);
    expect(uploadService.assertR2PublicUrl).toHaveBeenCalledWith(
      'https://cdn.example.test/items/poster.png',
    );
  });

  it('rejects non-R2 item posters before persisting them', async () => {
    const { service, itemRepository } = createService();

    await expect(
      service.create({
        eventId: 'event-1',
        name: 'External image',
        imageUrl: 'https://res.cloudinary.com/old/item.png',
        price: 1000,
      } as any),
    ).rejects.toThrow(BadRequestException);
    expect(itemRepository.save).not.toHaveBeenCalled();
  });
});
