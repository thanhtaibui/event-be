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
import { InviteService } from './invite.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { UpdateInviteDto } from './dto/update-invite.dto';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { ApiBearerAuth, ApiBody, ApiOperation } from '@nestjs/swagger';
import { InvitationStatus } from 'src/shared/enum/enum';
import {
  InviteStatusResDto,
  UpdateInviteStatusDto,
} from './dto/update-status.dto';
import { checkEmailDto, checkEmailResDto } from './dto/chekc-email.dto';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionCode } from 'src/common/constants/permission-codes';

@ApiBearerAuth('access-token')
@Controller('invites')
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  @Post()
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.INVITATION_CREATE)
  @ApiOperation({ operationId: 'createInvite' })
  create(@Body() createInviteDto: CreateInviteDto, @Req() req: any): Promise<
    ApiResponse<
      {
        email: string;
        token: string;
      }[]
    >
  > {
    return this.inviteService.create(createInviteDto, req.user);
  }

  @Get()
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.INVITATION_VIEW)
  findAll(@Req() req: any) {
    return this.inviteService.findAll(req.user);
  }

  @Get(':id')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.INVITATION_VIEW)
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.inviteService.findOne(id, req.user);
  }

  @Patch(':id')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.INVITATION_UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateInviteDto: UpdateInviteDto,
    @Req() req: any,
  ) {
    return this.inviteService.update(id, updateInviteDto, req.user);
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
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.INVITATION_CREATE)
  @ApiOperation({ operationId: 'checkEmail' })
  async sendInvitations(
    @Body() dto: checkEmailDto,
    @Req() req: any,
  ): Promise<ApiResponse<checkEmailResDto[]>> {
    return this.inviteService.checkEmails(dto, req.user);
  }

  @Delete(':id')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.INVITATION_DELETE)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.inviteService.remove(id, req.user);
  }
}
