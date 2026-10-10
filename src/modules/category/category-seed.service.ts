import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CANONICAL_EVENT_CATEGORIES } from './category-master-data';

@Injectable()
export class CategorySeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CategorySeedService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedCanonicalCategories();
  }

  async seedCanonicalCategories(): Promise<void> {
    let inserted = 0;
    let updated = 0;

    for (const canonicalCategory of CANONICAL_EVENT_CATEGORIES) {
      const categoryByCode = await this.categoryRepo.findOne({
        where: {
          description: canonicalCategory.code,
          deletedAt: IsNull(),
        },
      });

      if (categoryByCode) {
        if (categoryByCode.name !== canonicalCategory.name) {
          categoryByCode.name = canonicalCategory.name;
          await this.categoryRepo.save(categoryByCode);
          updated += 1;
        }
        continue;
      }

      const categoryByName = await this.categoryRepo.findOne({
        where: {
          name: canonicalCategory.name,
          deletedAt: IsNull(),
        },
      });

      if (categoryByName) {
        categoryByName.description = canonicalCategory.code;
        await this.categoryRepo.save(categoryByName);
        updated += 1;
        continue;
      }

      await this.categoryRepo.save(
        this.categoryRepo.create({
          name: canonicalCategory.name,
          description: canonicalCategory.code,
        }),
      );
      inserted += 1;
    }

    this.logger.log(
      `CATEGORY_MASTER_SEED:inserted=${inserted}:updated=${updated}:total=${CANONICAL_EVENT_CATEGORIES.length}`,
    );
  }
}
