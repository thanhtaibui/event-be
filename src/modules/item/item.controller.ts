import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ItemService } from './item.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { ApiOperation } from '@nestjs/swagger';
import { ItemDto } from './dto/item.dto';

@Controller('items')
export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  @Post()
  @ApiOperation({ operationId: 'createItem' })
  async create(
    @Body() createItemDto: CreateItemDto,
  ): Promise<ApiResponse<CreateItemDto>> {
    return this.itemService.create(createItemDto);
  }

  @Get()
  @ApiOperation({ operationId: 'GetItems' })
  async findAll(): Promise<ApiResponse<ItemDto[]>> {
    return this.itemService.findAll();
  }

  @Get(':id')
  @ApiOperation({ operationId: 'GetItemsOfEvent' })
  async findOne(@Param('id') id: string): Promise<ApiResponse<ItemDto[]>> {
    return this.itemService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateItemDto: UpdateItemDto,
  ): Promise<ApiResponse<UpdateItemDto>> {
    return this.itemService.update(id, updateItemDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.itemService.remove(id);
  }
}
