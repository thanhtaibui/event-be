import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ApiResponse as ApiResponseType } from 'src/common/utils/ApiResponse';
import { Category } from './entities/category.entity';
import { JwtGuard } from 'src/common/guards/jwt.guard';

@ApiTags('category')
@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @UseGuards(JwtGuard)
  @ApiOperation({ operationId: 'createCategory' })
  @ApiResponse({ status: 201, description: 'Category created successfully.' })
  @ApiResponse({ status: 409, description: 'Category name already exists.' })
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<ApiResponseType<Category>> {
    return this.categoryService.create(createCategoryDto);
  }

  @Get()
  @ApiOperation({ operationId: 'getCategories' })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully.',
  })
  async findAll(): Promise<ApiResponseType<Category[]>> {
    return this.categoryService.findAll();
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getCategoryById' })
  @ApiResponse({ status: 200, description: 'Category retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseType<Category>> {
    return this.categoryService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtGuard)
  @ApiOperation({ operationId: 'updateCategory' })
  @ApiResponse({ status: 200, description: 'Category updated successfully.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  @ApiResponse({ status: 409, description: 'Category name already exists.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<ApiResponseType<Category>> {
    return this.categoryService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @UseGuards(JwtGuard)
  @ApiOperation({ operationId: 'deleteCategory' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseType<{ deleted: true }>> {
    return this.categoryService.remove(id);
  }
}
