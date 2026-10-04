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
import { TicketTypeService } from './ticket-type.service';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TicketTypeDto } from './dto/ticket-type.dto';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionCode } from 'src/common/constants/permission-codes';

@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('ticket-types')
export class TicketTypeController {
  constructor(private readonly ticketTypeService: TicketTypeService) {}

  @Post()
  @ApiOperation({ operationId: 'createTicketType' })
  @Permissions(PermissionCode.TICKET_MANAGE)
  create(@Body() createTicketTypeDto: CreateTicketTypeDto, @Req() req: any) {
    return this.ticketTypeService.create(createTicketTypeDto, req.user);
  }

  @Get()
  @Permissions(PermissionCode.TICKET_VIEW)
  findAll() {
    return this.ticketTypeService.findAll();
  }

  @Get(':id')
  @Permissions(PermissionCode.TICKET_VIEW)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<TicketTypeDto>> {
    return this.ticketTypeService.findOne(id);
  }

  @Patch(':id')
  @Permissions(PermissionCode.TICKET_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTicketTypeDto: UpdateTicketTypeDto,
    @Req() req: any,
  ): Promise<ApiResponse<TicketTypeDto>> {
    return this.ticketTypeService.update(id, updateTicketTypeDto, req.user);
  }

  @Delete(':id')
  @Permissions(PermissionCode.TICKET_MANAGE)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.ticketTypeService.remove(id, req.user);
  }
}
