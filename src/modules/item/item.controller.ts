import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ItemService } from './item.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ItemDto } from './dto/item.dto';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionCode } from 'src/common/constants/permission-codes';

@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('items')
export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  @Post()
  @ApiOperation({ operationId: 'createItem' })
  @Permissions(PermissionCode.EVENT_MANAGE)
  async create(
    @Body() createItemDto: CreateItemDto,
  ): Promise<ApiResponse<CreateItemDto>> {
    return this.itemService.create(createItemDto);
  }

  @Get()
  @ApiOperation({ operationId: 'GetItems' })
  @Permissions(PermissionCode.EVENT_VIEW)
  async findAll(): Promise<ApiResponse<ItemDto[]>> {
    return this.itemService.findAll();
  }

  @Get(':id')
  @ApiOperation({ operationId: 'GetItemsOfEvent' })
  @Permissions(PermissionCode.EVENT_VIEW)
  async findOne(@Param('id') id: string): Promise<ApiResponse<ItemDto[]>> {
    return this.itemService.findOne(id);
  }

  @Patch(':id')
  @Permissions(PermissionCode.EVENT_MANAGE)
  async update(
    @Param('id') id: string,
    @Body() updateItemDto: UpdateItemDto,
  ): Promise<ApiResponse<UpdateItemDto>> {
    return this.itemService.update(id, updateItemDto);
  }

  @Delete(':id')
  @Permissions(PermissionCode.EVENT_MANAGE)
  remove(@Param('id') id: string) {
    return this.itemService.remove(id);
  }
}
