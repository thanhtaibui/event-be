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

  async findAll(): Promise<ApiResponse<Category[]>> {
    const categories = await this.categoryRepo.find({
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return Response(200, 'Categories retrieved successfully', categories);
  }

  async findOne(id: string): Promise<ApiResponse<Category>> {
    const category = await this.categoryRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return Response(200, 'Category retrieved successfully', category);
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
}
