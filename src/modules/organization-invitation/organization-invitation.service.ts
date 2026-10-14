import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { render } from '@react-email/render';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { PermissionCode } from 'src/common/constants/permission-codes';
import { OrganizationInvitationStatus } from 'src/shared/enum/enum';
import OrganizationInviteEmail from 'src/emails/OrganizationInviteEmail';
import { Membership } from '../membership/entities/membership.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Role } from '../role/entities/role.entity';
import { User } from '../user/entities/user.entity';
import { OrganizationInvitation } from './entities/organization-invitation.entity';
import { CreateOrganizationInvitationDto } from './dto/create-organization-invitation.dto';
import { isSuperAdminRole } from '../../common/system-account/super-admin-protection';

@Injectable()
export class OrganizationInvitationService {
  private readonly invitationTtlDays = 7;

  constructor(
    @InjectRepository(OrganizationInvitation)
    private readonly invitationRepo: Repository<OrganizationInvitation>,
    @InjectRepository(Organization)
    private readonly organizationRepo: Repository<Organization>,
    @InjectRepository(Membership)
    private readonly membershipRepo: Repository<Membership>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly mailerService: MailerService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateOrganizationInvitationDto,
    currentUser?: any,
  ): Promise<ApiResponse<any>> {
    const email = this.normalizeEmail(dto.email);
    const roleCode = this.normalizeRole(dto.role);

    const [organization, inviter, role] = await Promise.all([
      this.organizationRepo.findOne({ where: { id: organizationId } }),
      this.userRepo.findOne({ where: { id: currentUser?.userId } }),
      this.findAssignableRole(roleCode, organizationId),
    ]);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    await this.assertCanManageOrganization(organizationId, currentUser);

    if (!inviter) {
      throw new NotFoundException('Inviter not found');
    }
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (isSuperAdminRole(role)) {
      throw new ForbiddenException('SUPER_ADMIN system role cannot be assigned.');
    }

    const existingUser = await this.userRepo.findOne({
      where: { email },
    });

    if (existingUser) {
      const existingMembership = await this.membershipRepo.findOne({
        where: {
          user: { id: existingUser.id },
          organization: { id: organizationId },
          isActive: true,
        },
      });

      if (existingMembership) {
        throw new BadRequestException('User is already an active member');
      }
    }

    await this.assertNoPendingInvitation(organizationId, email);

    const invitation = this.invitationRepo.create({
      organization,
      email,
      role: role.role_code,
      status: OrganizationInvitationStatus.PENDING,
      token: uuidv4(),
      invitedBy: inviter,
      expiresAt: this.createExpiresAt(),
    });
    const savedInvitation = await this.invitationRepo.save(invitation);

    await this.sendInvitationEmail(savedInvitation, organization, inviter);

    return Response(
      201,
      'Organization invitation created successfully',
      this.toInvitationDto(savedInvitation),
    );
  }

  async findByOrganization(
    organizationId: string,
    currentUser?: any,
  ): Promise<ApiResponse<any[]>> {
    await this.assertCanManageOrganization(organizationId, currentUser);

    const invitations = await this.invitationRepo.find({
      where: {
        organization: { id: organizationId },
      },
      relations: ['organization', 'invitedBy'],
      order: { createdAt: 'DESC' },
    });

    return Response(
      200,
      'Get organization invitations successfully',
      invitations.map((invitation) => this.toInvitationDto(invitation)),
    );
  }

  async accept(id: string, currentUser?: any): Promise<ApiResponse<any>> {
    const invitation = await this.findInvitationForAction(id);
    await this.assertInvitationCanBeHandledByCurrentUser(invitation, currentUser);
    await this.assertPendingAndNotExpired(invitation);

    const user = await this.userRepo.findOne({
      where: { id: currentUser.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.findAssignableRole(
      invitation.role,
      invitation.organization.id,
    );
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (isSuperAdminRole(role)) {
      throw new ForbiddenException('SUPER_ADMIN system role cannot be assigned.');
    }

    const existingMembership = await this.membershipRepo.findOne({
      where: {
        user: { id: user.id },
        organization: { id: invitation.organization.id },
      },
    });
    if (existingMembership?.isActive) {
      throw new BadRequestException('User is already an active member');
    }

    await this.dataSource.transaction(async (manager) => {
      if (existingMembership) {
        existingMembership.role = role;
        existingMembership.isActive = true;
        await manager.save(Membership, existingMembership);
      } else {
        const membership = manager.create(Membership, {
          user,
          organization: invitation.organization,
          role,
          isActive: true,
        });
        await manager.save(Membership, membership);
      }

      invitation.status = OrganizationInvitationStatus.ACCEPTED;
      await manager.save(OrganizationInvitation, invitation);
    });

    return Response(
      200,
      'Organization invitation accepted successfully',
      this.toInvitationDto(invitation),
    );
  }

  async reject(id: string, currentUser?: any): Promise<ApiResponse<any>> {
    const invitation = await this.findInvitationForAction(id);
    await this.assertInvitationCanBeHandledByCurrentUser(invitation, currentUser);
    await this.assertPendingAndNotExpired(invitation);

    invitation.status = OrganizationInvitationStatus.REJECTED;
    const savedInvitation = await this.invitationRepo.save(invitation);

    return Response(
      200,
      'Organization invitation rejected successfully',
      this.toInvitationDto(savedInvitation),
    );
  }

  private async assertNoPendingInvitation(
    organizationId: string,
    email: string,
  ): Promise<void> {
    const pendingInvitation = await this.invitationRepo.findOne({
      where: {
        organization: { id: organizationId },
        email,
        status: OrganizationInvitationStatus.PENDING,
      },
    });

    if (!pendingInvitation) {
      return;
    }

    if (this.isExpired(pendingInvitation)) {
      pendingInvitation.status = OrganizationInvitationStatus.EXPIRED;
      await this.invitationRepo.save(pendingInvitation);
      return;
    }

    throw new BadRequestException('Pending invitation already exists');
  }

  private async assertCanManageOrganization(
    organizationId: string,
    currentUser?: any,
  ): Promise<void> {
    if (currentUser?.role?.isSuperAdmin) {
      return;
    }

    if (!currentUser?.userId) {
      throw new ForbiddenException('AUTHENTICATION_REQUIRED');
    }

    const membership = await this.membershipRepo.findOne({
      where: {
        user: { id: currentUser.userId },
        organization: { id: organizationId },
        isActive: true,
      },
      relations: ['role', 'role.permissions'],
    });

    if (!membership) {
      throw new ForbiddenException('User does not belong to this organization');
    }

    const hasPermission = membership.role?.permissions?.some(
      (permission) =>
        permission.permission_code === PermissionCode.ORGANIZATION_MEMBER_MANAGE,
    );

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient organization permission');
    }
  }

  private async assertInvitationCanBeHandledByCurrentUser(
    invitation: OrganizationInvitation,
    currentUser?: any,
  ): Promise<void> {
    if (!currentUser?.userId || !currentUser?.email) {
      throw new ForbiddenException('AUTHENTICATION_REQUIRED');
    }

    if (this.normalizeEmail(currentUser.email) !== invitation.email) {
      throw new ForbiddenException('Invitation email does not match current user');
    }
  }

  private async assertPendingAndNotExpired(
    invitation: OrganizationInvitation,
  ): Promise<void> {
    if (invitation.status !== OrganizationInvitationStatus.PENDING) {
      throw new BadRequestException('This invitation is already handled');
    }

    if (this.isExpired(invitation)) {
      invitation.status = OrganizationInvitationStatus.EXPIRED;
      await this.invitationRepo.save(invitation);
      throw new BadRequestException('Invitation expired');
    }
  }

  private async findInvitationForAction(
    id: string,
  ): Promise<OrganizationInvitation> {
    const invitation = await this.invitationRepo.findOne({
      where: { id },
      relations: ['organization', 'invitedBy'],
    });

    if (!invitation) {
      throw new NotFoundException('Organization invitation not found');
    }

    return invitation;
  }

  private async findAssignableRole(
    roleCode: string,
    organizationId: string,
  ): Promise<Role | null> {
    return this.roleRepo
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.organization', 'organization')
      .leftJoinAndSelect('role.permissions', 'permissions')
      .where('role.role_code = :roleCode', { roleCode })
      .andWhere('role.deletedAt IS NULL')
      .andWhere('(organization.id = :organizationId OR organization.id IS NULL)', {
        organizationId,
      })
      .orderBy('CASE WHEN organization.id = :organizationId THEN 0 ELSE 1 END')
      .setParameter('organizationId', organizationId)
      .getOne();
  }

  private async sendInvitationEmail(
    invitation: OrganizationInvitation,
    organization: Organization,
    inviter: User,
  ): Promise<void> {
    const baseUrl = process.env.FE_URL || 'http://localhost:5173';
    const html = await render(
      OrganizationInviteEmail({
        organizationName: organization.name,
        inviterName: inviter.fullName,
        role: invitation.role,
        acceptUrl: `${baseUrl}/organizations/invitations/${invitation.id}/accept?token=${invitation.token}`,
        rejectUrl: `${baseUrl}/organizations/invitations/${invitation.id}/reject?token=${invitation.token}`,
      }),
    );

    await this.mailerService.sendMail({
      to: invitation.email,
      subject: `You're invited to join ${organization.name}`,
      html,
    });
  }

  private createExpiresAt(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.invitationTtlDays);
    return expiresAt;
  }

  private isExpired(invitation: OrganizationInvitation): boolean {
    return invitation.expiresAt.getTime() <= Date.now();
  }

  private normalizeEmail(email: string): string {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }
    return normalizedEmail;
  }

  private normalizeRole(role: string): string {
    const normalizedRole = role?.trim().toUpperCase();
    if (!normalizedRole) {
      throw new BadRequestException('Role is required');
    }
    return normalizedRole;
  }

  private toInvitationDto(invitation: OrganizationInvitation) {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
      organization: invitation.organization
        ? {
            id: invitation.organization.id,
            name: invitation.organization.name,
            slug: invitation.organization.slug,
          }
        : null,
      invitedBy: invitation.invitedBy
        ? {
            id: invitation.invitedBy.id,
            fullName: invitation.invitedBy.fullName,
          }
        : null,
    };
  }
}
