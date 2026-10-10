import { CategoryService } from './category.service';

describe('CategoryService', () => {
  it('returns categories as stable read options with canonical codes', async () => {
    const repo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'category-festival',
          name: 'Lễ hội',
          description: 'FESTIVAL',
          deletedAt: null,
        },
        {
          id: 'category-conference',
          name: 'Hội nghị',
          description: 'CONFERENCE',
          deletedAt: null,
        },
      ]),
    };
    const service = new CategoryService(repo as any);

    const result = await service.findAll();

    expect(result.statusCode).toBe(200);
    expect(result.data).toEqual([
      {
        id: 'category-conference',
        code: 'CONFERENCE',
        name: 'Hội nghị',
      },
      {
        id: 'category-festival',
        code: 'FESTIVAL',
        name: 'Lễ hội',
      },
    ]);
    expect(repo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({ deletedAt: expect.any(Object) }),
    });
  });
});
