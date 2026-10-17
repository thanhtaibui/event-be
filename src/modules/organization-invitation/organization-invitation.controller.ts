import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionCode } from 'src/common/constants/permission-codes';
import { OrganizationInvitationService } from './organization-invitation.service';
import { CreateOrganizationInvitationDto } from './dto/create-organization-invitation.dto';
import { InvitationActionDto } from './dto/invitation-action.dto';
import { InvitationInboxQueryDto } from './dto/invitation-inbox-query.dto';

@ApiBearerAuth('access-token')
@Controller()
export class OrganizationInvitationController {
  constructor(
    private readonly organizationInvitationService: OrganizationInvitationService,
  ) {}

  @Post('organizations/:organizationId/invitations')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.ORGANIZATION_MEMBER_MANAGE)
  @ApiOperation({ operationId: 'createOrganizationInvitation' })
  create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateOrganizationInvitationDto,
    @Req() req: any,
  ) {
    return this.organizationInvitationService.create(
      organizationId,
      dto,
      req.user,
    );
  }

  @Get('organization-invitations/inbox')
  @UseGuards(JwtGuard)
  @ApiOperation({ operationId: 'getMyOrganizationInvitations' })
  findForCurrentUser(@Req() req: any, @Query() query: InvitationInboxQueryDto) {
    return this.organizationInvitationService.findForCurrentUser(
      req.user,
      query,
    );
  }

  @Get('organizations/:organizationId/invitations')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.ORGANIZATION_MEMBER_MANAGE)
  @ApiOperation({ operationId: 'getOrganizationInvitations' })
  findByOrganization(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Req() req: any,
  ) {
    return this.organizationInvitationService.findByOrganization(
      organizationId,
      req.user,
    );
  }

  @Post('organization-invitations/:id/accept')
  @UseGuards(JwtGuard)
  @ApiOperation({ operationId: 'acceptOrganizationInvitation' })
  accept(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InvitationActionDto,
    @Req() req: any,
  ) {
    return this.organizationInvitationService.accept(id, req.user, dto.token);
  }

  @Post('organization-invitations/:id/reject')
  @UseGuards(JwtGuard)
  @ApiOperation({ operationId: 'rejectOrganizationInvitation' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InvitationActionDto,
    @Req() req: any,
  ) {
    return this.organizationInvitationService.reject(id, req.user, dto.token);
  }

  @Patch('organizations/:organizationId/invitations/:id/revoke')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.ORGANIZATION_MEMBER_MANAGE)
  @ApiOperation({ operationId: 'revokeOrganizationInvitation' })
  revoke(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return this.organizationInvitationService.revoke(
      organizationId,
      id,
      req.user,
    );
  }

  @Post('organizations/:organizationId/invitations/:id/resend')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(PermissionCode.ORGANIZATION_MEMBER_MANAGE)
  @ApiOperation({ operationId: 'resendOrganizationInvitation' })
  resend(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return this.organizationInvitationService.resend(
      organizationId,
      id,
      req.user,
    );
  }
}
