import { CategorySeedService } from './category-seed.service';
import { CANONICAL_EVENT_CATEGORIES } from './category-master-data';

describe('CategorySeedService', () => {
  it('inserts canonical categories into an empty category table', async () => {
    const repo = createCategoryRepo();
    const service = new CategorySeedService(repo as any, createDataSource() as any);

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
    const service = new CategorySeedService(repo as any, createDataSource() as any);

    await service.seedCanonicalCategories();
    await service.seedCanonicalCategories();

    expect(repo.rows).toHaveLength(CANONICAL_EVENT_CATEGORIES.length);
    expect(
      repo.rows.filter((category) => category.description === 'FESTIVAL'),
    ).toHaveLength(1);
  });

  it('adds missing categories when some canonical records already exist', async () => {
    const existing = CANONICAL_EVENT_CATEGORIES.slice(0, 5).map(
      (category, index) => ({
        id: `existing-${index + 1}`,
        name: category.name,
        description: category.code,
        deletedAt: null,
      }),
    );
    const repo = createCategoryRepo(existing);
    const service = new CategorySeedService(repo as any, createDataSource() as any);

    await service.seedCanonicalCategories();

    expect(repo.rows).toHaveLength(CANONICAL_EVENT_CATEGORIES.length);
    expect(repo.save).toHaveBeenCalledTimes(14);
  });

  it('restores soft-deleted canonical categories instead of creating duplicates', async () => {
    const repo = createCategoryRepo([
      {
        id: 'soft-deleted-festival',
        name: 'Lễ hội',
        description: 'FESTIVAL',
        deletedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    const service = new CategorySeedService(repo as any, createDataSource() as any);

    await service.seedCanonicalCategories();

    expect(repo.rows).toHaveLength(CANONICAL_EVENT_CATEGORIES.length);
    expect(
      repo.rows.filter((category) => category.description === 'FESTIVAL'),
    ).toHaveLength(1);
    expect(
      repo.rows.find((category) => category.description === 'FESTIVAL')
        ?.deletedAt,
    ).toBeNull();
  });

  function createCategoryRepo(seedRows: any[] = []) {
    const rows: any[] = [...seedRows];

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
          return true;
        });

        return Promise.resolve(match || null);
      }),
      count: jest.fn(({ where }: any = {}) => {
        const expectedDescriptions =
          where?.description?._value || where?.description?.value;
        const activeRows = rows.filter((row) => row.deletedAt == null);
        if (Array.isArray(expectedDescriptions)) {
          return Promise.resolve(
            activeRows.filter((row) =>
              expectedDescriptions.includes(row.description),
            ).length,
          );
        }

        return Promise.resolve(activeRows.length);
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

  function createDataSource() {
    return {
      options: {
        type: 'postgres',
        url: 'postgresql://user:password@database-1.example.com:5432/eventDb',
      },
    };
  }
});
