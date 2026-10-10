import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CANONICAL_EVENT_CATEGORIES } from './category-master-data';

@Injectable()
export class CategorySeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CategorySeedService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedCanonicalCategories();
  }

  async seedCanonicalCategories(): Promise<void> {
    this.logger.log('CATEGORY_SEED_START');
    this.logger.log(`CATEGORY_SEED_DB:${this.getSafeDatabaseIdentity()}`);

    try {
      const existingCount = await this.categoryRepo.count({
        where: { deletedAt: IsNull() },
      });
      this.logger.log(`CATEGORY_SEED_EXISTING_COUNT:${existingCount}`);

      let inserted = 0;
      let updated = 0;

      for (const canonicalCategory of CANONICAL_EVENT_CATEGORIES) {
        const categoryByCode = await this.categoryRepo.findOne({
          where: {
            description: canonicalCategory.code,
          },
          withDeleted: true,
        });

        if (categoryByCode) {
          if (this.applyCanonicalCategory(categoryByCode, canonicalCategory)) {
            await this.categoryRepo.save(categoryByCode);
            updated += 1;
          }
          continue;
        }

        const categoryByName = await this.categoryRepo.findOne({
          where: {
            name: canonicalCategory.name,
          },
          withDeleted: true,
        });

        if (categoryByName) {
          categoryByName.description = canonicalCategory.code;
          if (this.applyCanonicalCategory(categoryByName, canonicalCategory)) {
            await this.categoryRepo.save(categoryByName);
          } else {
            await this.categoryRepo.save(categoryByName);
          }
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

      const finalCount = await this.categoryRepo.count({
        where: {
          description: In(
            CANONICAL_EVENT_CATEGORIES.map((category) => category.code),
          ),
          deletedAt: IsNull(),
        },
      });

      this.logger.log(`CATEGORY_SEED_INSERTED:${inserted}`);
      this.logger.log(`CATEGORY_SEED_UPDATED:${updated}`);
      this.logger.log(`CATEGORY_SEED_FINAL_COUNT:${finalCount}`);
      this.logger.log('CATEGORY_SEED_DONE');
    } catch (error) {
      this.logger.error(
        `CATEGORY_SEED_FAILED:${this.getSafeErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private applyCanonicalCategory(
    category: Category,
    canonicalCategory: { code: string; name: string },
  ): boolean {
    let changed = false;

    if (category.name !== canonicalCategory.name) {
      category.name = canonicalCategory.name;
      changed = true;
    }

    if (category.description !== canonicalCategory.code) {
      category.description = canonicalCategory.code;
      changed = true;
    }

    if (category.deletedAt) {
      category.deletedAt = null;
      changed = true;
    }

    return changed;
  }

  private getSafeDatabaseIdentity(): string {
    const options = this.dataSource.options as Record<string, any>;
    const url = options.url ? this.parseDatabaseUrl(options.url) : undefined;
    const host = url?.host || options.host || 'unknown-host';
    const database = url?.database || options.database || 'unknown-database';

    return `database=${database}:host=${this.maskHost(host)}`;
  }

  private parseDatabaseUrl(
    value: string,
  ): { host: string; database: string } | undefined {
    try {
      const url = new URL(value);
      return {
        host: url.hostname,
        database: url.pathname.replace(/^\//, '') || 'unknown-database',
      };
    } catch {
      return undefined;
    }
  }

  private maskHost(host: string): string {
    const parts = host.split('.');
    if (parts.length <= 2) {
      return host.length > 3 ? `${host.slice(0, 3)}***` : '***';
    }

    return `${parts[0].slice(0, 3)}***.${parts.slice(-2).join('.')}`;
  }

  private getSafeErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}
