import { CategorySeedService } from './category-seed.service';
import { CANONICAL_EVENT_CATEGORIES } from './category-master-data';

describe('CategorySeedService', () => {
  it('inserts canonical categories into an empty category table', async () => {
    const repo = createCategoryRepo();
    const service = new CategorySeedService(repo as any);

    await service.seedCanonicalCategories();

    expect(repo.rows).toHaveLength(CANONICAL_EVENT_CATEGORIES.length);
    expect(repo.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Lễ hội',
          description: 'FESTIVAL',
        }),
        expect.objectContaining({
          name: 'Công nghệ',
          description: 'TECHNOLOGY',
        }),
      ]),
    );
  });

  it('is idempotent and does not create duplicate canonical categories', async () => {
    const repo = createCategoryRepo();
    const service = new CategorySeedService(repo as any);

    await service.seedCanonicalCategories();
    await service.seedCanonicalCategories();

    expect(repo.rows).toHaveLength(CANONICAL_EVENT_CATEGORIES.length);
    expect(
      repo.rows.filter((category) => category.description === 'FESTIVAL'),
    ).toHaveLength(1);
  });

  function createCategoryRepo() {
    const rows: any[] = [];

    return {
      rows,
      findOne: jest.fn(({ where }: any) => {
        const match = rows.find((row) => {
          if (where.description && row.description !== where.description) {
            return false;
          }
          if (where.name && row.name !== where.name) {
            return false;
          }
          return row.deletedAt == null;
        });

        return Promise.resolve(match || null);
      }),
      create: jest.fn((value: any) => ({
        id: `category-${rows.length + 1}`,
        deletedAt: null,
        ...value,
      })),
      save: jest.fn((value: any) => {
        const existingIndex = rows.findIndex((row) => row.id === value.id);
        if (existingIndex >= 0) {
          rows[existingIndex] = value;
          return Promise.resolve(value);
        }

        const saved = {
          id: value.id || `category-${rows.length + 1}`,
          deletedAt: null,
          ...value,
        };
        rows.push(saved);
        return Promise.resolve(saved);
      }),
    };
  }
});
