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
import { TicketService } from './ticket.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionCode } from 'src/common/constants/permission-codes';

@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('ticket')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post()
  @Permissions(PermissionCode.TICKET_MANAGE)
  create(@Body() createTicketDto: CreateTicketDto) {
    return this.ticketService.create(createTicketDto);
  }

  @Get()
  @Permissions(PermissionCode.TICKET_MANAGE)
  findAll() {
    return this.ticketService.findAll();
  }

  @Get(':id')
  @Permissions(PermissionCode.TICKET_VIEW)
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.ticketService.findOne(id, req.user);
  }

  @Patch(':id')
  @Permissions(PermissionCode.TICKET_UPDATE)
  update(@Param('id') id: string, @Body() updateTicketDto: UpdateTicketDto) {
    return this.ticketService.update(+id, updateTicketDto);
  }

  @Delete(':id')
  @Permissions(PermissionCode.TICKET_MANAGE)
  remove(@Param('id') id: string) {
    return this.ticketService.remove(+id);
  }
}
