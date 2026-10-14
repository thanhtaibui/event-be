import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
    return this.organizationInvitationService.create(organizationId, dto, req.user);
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
  accept(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.organizationInvitationService.accept(id, req.user);
  }

  @Post('organization-invitations/:id/reject')
  @UseGuards(JwtGuard)
  @ApiOperation({ operationId: 'rejectOrganizationInvitation' })
  reject(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.organizationInvitationService.reject(id, req.user);
  }
}
