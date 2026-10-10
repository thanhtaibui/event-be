import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { Category } from './entities/category.entity';
import {
  CANONICAL_CATEGORY_CODE_BY_NAME,
  CANONICAL_CATEGORY_ORDER_BY_CODE,
} from './category-master-data';

export type CategoryOptionDto = {
  id: string;
  code: string;
  name: string;
};

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  async create(
    createCategoryDto: CreateCategoryDto,
  ): Promise<ApiResponse<Category>> {
    const existing = await this.categoryRepo.findOne({
      where: { name: createCategoryDto.name, deletedAt: IsNull() },
    });

    if (existing) {
      throw new ConflictException('Category name already exists');
    }

    const category = this.categoryRepo.create({
      name: createCategoryDto.name,
      description: createCategoryDto.description,
    });

    const saved = await this.categoryRepo.save(category);
    return Response(201, 'Category created successfully', saved);
  }

  async findAll(): Promise<ApiResponse<CategoryOptionDto[]>> {
    console.time('GET_CATEGORIES');
    try {
      const categories = await this.categoryRepo.find({
        where: { deletedAt: IsNull() },
      });
      const items = categories
        .map((category) => this.toCategoryOption(category))
        .sort((left, right) => {
          const leftOrder =
            CANONICAL_CATEGORY_ORDER_BY_CODE.get(left.code) ?? Number.MAX_SAFE_INTEGER;
          const rightOrder =
            CANONICAL_CATEGORY_ORDER_BY_CODE.get(right.code) ?? Number.MAX_SAFE_INTEGER;

          if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
          }

          return left.name.localeCompare(right.name, 'vi');
        });

      return Response(200, 'Categories retrieved successfully', items);
    } finally {
      console.timeEnd('GET_CATEGORIES');
    }
  }

  async findOne(id: string): Promise<ApiResponse<Category>> {
    const timer = `GET_CATEGORY_BY_ID:${id}`;
    console.time(timer);
    try {
      const category = await this.categoryRepo.findOne({
        where: { id, deletedAt: IsNull() },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      return Response(200, 'Category retrieved successfully', category);
    } finally {
      console.timeEnd(timer);
    }
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<ApiResponse<Category>> {
    const category = await this.categoryRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      const conflict = await this.categoryRepo.findOne({
        where: {
          id: Not(id),
          name: updateCategoryDto.name,
          deletedAt: IsNull(),
        },
      });

      if (conflict) {
        throw new ConflictException('Category name already exists');
      }
    }

    Object.assign(category, updateCategoryDto);

    const saved = await this.categoryRepo.save(category);
    return Response(200, 'Category updated successfully', saved);
  }

  async remove(id: string): Promise<ApiResponse<{ deleted: true }>> {
    const category = await this.categoryRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await this.categoryRepo.softDelete(id);
    return Response(200, 'Category deleted successfully', { deleted: true });
  }

  private toCategoryOption(category: Category): CategoryOptionDto {
    return {
      id: category.id,
      code:
        this.getCanonicalCode(category) ||
        this.toFallbackCode(category.name),
      name: category.name,
    };
  }

  private getCanonicalCode(category: Category): string | undefined {
    const description = category.description?.trim();
    if (description && CANONICAL_CATEGORY_ORDER_BY_CODE.has(description)) {
      return description;
    }

    return CANONICAL_CATEGORY_CODE_BY_NAME.get(category.name);
  }

  private toFallbackCode(name: string): string {
    return name
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
  }
}
