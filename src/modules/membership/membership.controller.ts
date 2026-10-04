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
import { MembershipService } from './membership.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import {
  UpdateMembershipRoleDto,
  UpdateMembershipStatusDto,
  UpdateMembershipDto,
} from './dto/update-membership.dto';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionCode } from 'src/common/constants/permission-codes';

@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('membership')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) { }

  @Post()
  @Permissions(PermissionCode.ORGANIZATION_MEMBER_MANAGE)
  create(@Body() createMembershipDto: CreateMembershipDto, @Req() req: any) {
    return this.membershipService.create(createMembershipDto, req.user);
  }

  @Get()
  @Permissions(PermissionCode.ORGANIZATION_MEMBER_MANAGE)
  findAll(@Req() req: any) {
    return this.membershipService.findAll(req.user);
  }

  @Get('organization/:orgId')
  @Permissions(PermissionCode.ORGANIZATION_MEMBER_MANAGE)
  findByOrganization(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Req() req: any,
  ) {
    return this.membershipService.findByOrganization(orgId, req.user);
  }

  @Get('org/:slug')
  @Permissions(PermissionCode.ORGANIZATION_MEMBER_MANAGE)
  findByOrganizationSlug(@Param('slug') slug: string, @Req() req: any) {
    return this.membershipService.findByOrganizationSlug(
      slug,
      req.user.userId,
    );
  }

  @Get(':id')
  @Permissions(PermissionCode.ORGANIZATION_MEMBER_MANAGE)
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.membershipService.findOne(id, req.user);
  }

  @Patch(':id')
  @Permissions(PermissionCode.ORGANIZATION_MEMBER_MANAGE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMembershipDto: UpdateMembershipDto,
    @Req() req: any,
  ) {
    return this.membershipService.update(id, updateMembershipDto, req.user);
  }

  @Patch(':id/status')
  @Permissions(PermissionCode.ORGANIZATION_MEMBER_MANAGE)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMembershipStatusDto: UpdateMembershipStatusDto,
    @Req() req: any,
  ) {
    return this.membershipService.updateStatus(
      id,
      updateMembershipStatusDto,
      req.user,
    );
  }

  @Patch(':id/role')
  @Permissions(PermissionCode.ORGANIZATION_MEMBER_MANAGE)
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMembershipRoleDto: UpdateMembershipRoleDto,
    @Req() req: any,
  ) {
    return this.membershipService.updateRole(
      id,
      updateMembershipRoleDto,
      req.user,
    );
  }

  @Delete(':id')
  @Permissions(PermissionCode.ORGANIZATION_MEMBER_MANAGE)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.membershipService.remove(id, req.user);
  }
}
