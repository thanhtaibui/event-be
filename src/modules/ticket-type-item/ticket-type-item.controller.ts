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
import { TicketTypeItemService } from './ticket-type-item.service';
import { CreateTicketTypeItemDto } from './dto/create-ticket-type-item.dto';
import { UpdateTicketTypeItemDto } from './dto/update-ticket-type-item.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionCode } from 'src/common/constants/permission-codes';

@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('ticket-type-item')
export class TicketTypeItemController {
  constructor(private readonly ticketTypeItemService: TicketTypeItemService) {}

  @Post()
  @Permissions(PermissionCode.TICKET_MANAGE)
  create(@Body() createTicketTypeItemDto: CreateTicketTypeItemDto) {
    return this.ticketTypeItemService.create(createTicketTypeItemDto);
  }

  @Get()
  @Permissions(PermissionCode.TICKET_VIEW)
  findAll() {
    return this.ticketTypeItemService.findAll();
  }

  @Get(':id')
  @Permissions(PermissionCode.TICKET_VIEW)
  findOne(@Param('id') id: string) {
    return this.ticketTypeItemService.findOne(+id);
  }

  @Patch(':id')
  @Permissions(PermissionCode.TICKET_MANAGE)
  update(
    @Param('id') id: string,
    @Body() updateTicketTypeItemDto: UpdateTicketTypeItemDto,
  ) {
    return this.ticketTypeItemService.update(+id, updateTicketTypeItemDto);
  }

  @Delete(':id')
  @Permissions(PermissionCode.TICKET_MANAGE)
  remove(@Param('id') id: string) {
    return this.ticketTypeItemService.remove(+id);
  }
}
