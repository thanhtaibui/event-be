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
import { PermissionService } from './permission.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { PermissionTreeDto } from './dto/permission.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionCode } from 'src/common/constants/permission-codes';

@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post()
  @Permissions(PermissionCode.PERMISSION_CREATE)
  create(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionService.create(createPermissionDto);
  }

  @Get()
  @ApiOperation({ operationId: 'GetAllPerTree' })
  @Permissions(PermissionCode.PERMISSION_VIEW)
  findAll(): Promise<ApiResponse<PermissionTreeDto[]>> {
    return this.permissionService.findAll();
  }

  @Get(':id')
  @Permissions(PermissionCode.PERMISSION_VIEW)
  findOne(@Param('id') id: string) {
    return this.permissionService.findOne(+id);
  }

  @Patch(':id')
  @Permissions(PermissionCode.PERMISSION_UPDATE)
  update(
    @Param('id') id: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    return this.permissionService.update(+id, updatePermissionDto);
  }

  @Delete(':id')
  @Permissions(PermissionCode.PERMISSION_DELETE)
  remove(@Param('id') id: string) {
    return this.permissionService.remove(+id);
  }
}
