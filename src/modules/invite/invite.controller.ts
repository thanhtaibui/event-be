import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { InviteService } from './invite.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { UpdateInviteDto } from './dto/update-invite.dto';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { ApiBody, ApiOperation } from '@nestjs/swagger';
import { InvitationStatus } from 'src/shared/enum/enum';
import {
  InviteStatusResDto,
  UpdateInviteStatusDto,
} from './dto/update-status.dto';
import { checkEmailDto, checkEmailResDto } from './dto/chekc-email.dto';

@Controller('invites')
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  @Post()
  @ApiOperation({ operationId: 'createInvite' })
  create(@Body() createInviteDto: CreateInviteDto): Promise<
    ApiResponse<
      {
        email: string;
        token: string;
      }[]
    >
  > {
    return this.inviteService.create(createInviteDto);
  }
  s;

  @Get()
  findAll() {
    return this.inviteService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inviteService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateInviteDto: UpdateInviteDto) {
    return this.inviteService.update(+id, updateInviteDto);
  }

  @Patch(':token/status')
  @ApiOperation({ operationId: 'updateStatus' })
  updateStatus(
    @Param('token') token: string,
    @Body() updateStatusDto: UpdateInviteStatusDto,
  ): Promise<ApiResponse<InviteStatusResDto>> {
    return this.inviteService.updateStatus(token, updateStatusDto);
  }

  @Post('check-email')
  @ApiOperation({ operationId: 'checkEmail' })
  async sendInvitations(
    @Body() dto: checkEmailDto,
  ): Promise<ApiResponse<checkEmailResDto[]>> {
    return this.inviteService.checkEmails(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.inviteService.remove(+id);
  }
}
