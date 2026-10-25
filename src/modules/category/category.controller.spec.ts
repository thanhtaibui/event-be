import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

describe('CategoryController', () => {
  it('keeps the category list public', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, CategoryController.prototype.findAll)).toBeUndefined();
  });

  it('keeps category management routes protected', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, CategoryController.prototype.create)).toHaveLength(2);
    expect(Reflect.getMetadata(GUARDS_METADATA, CategoryController.prototype.update)).toHaveLength(2);
    expect(Reflect.getMetadata(GUARDS_METADATA, CategoryController.prototype.remove)).toHaveLength(2);
  });

  it('returns the existing category list response from the service', async () => {
    const expected = { statusCode: 200, message: 'ok', data: [] };
    const categoryService = { findAll: jest.fn().mockResolvedValue(expected) } as unknown as CategoryService;
    const controller = new CategoryController(categoryService);

    await expect(controller.findAll()).resolves.toBe(expected);
    expect(categoryService.findAll).toHaveBeenCalledTimes(1);
  });
});
