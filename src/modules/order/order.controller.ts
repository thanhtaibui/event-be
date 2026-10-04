import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionCode } from 'src/common/constants/permission-codes';

@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @Permissions(PermissionCode.TICKET_CREATE)
  create(@Body() createOrderDto: CreateOrderDto, @Req() req: any) {
    return this.orderService.create(createOrderDto, req.user.userId);
  }

  @Get()
  @Permissions(PermissionCode.TICKET_MANAGE)
  findAll() {
    return this.orderService.findAll();
  }

  @Get(':id')
  @Permissions(PermissionCode.TICKET_VIEW)
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.orderService.findOne(id, req.user);
  }

  @Patch(':id')
  @Permissions(PermissionCode.TICKET_MANAGE)
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.orderService.update(+id, updateOrderDto);
  }

  @Delete(':id')
  @Permissions(PermissionCode.TICKET_MANAGE)
  remove(@Param('id') id: string) {
    return this.orderService.remove(+id);
  }
}
