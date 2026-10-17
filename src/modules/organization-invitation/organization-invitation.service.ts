import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { render } from '@react-email/render';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { PermissionCode } from 'src/common/constants/permission-codes';
import { OrganizationInvitationStatus } from 'src/shared/enum/enum';
import OrganizationInviteEmail from 'src/emails/OrganizationInviteEmail';
import { Membership } from '../membership/entities/membership.entity';
import { MembershipService } from '../membership/membership.service';
import { Organization } from '../organization/entities/organization.entity';
import { Role } from '../role/entities/role.entity';
import { User } from '../user/entities/user.entity';
import { OrganizationInvitation } from './entities/organization-invitation.entity';
import { CreateOrganizationInvitationDto } from './dto/create-organization-invitation.dto';
import { InvitationInboxQueryDto } from './dto/invitation-inbox-query.dto';
import { isSuperAdminRole } from '../../common/system-account/super-admin-protection';

const HASHED_TOKEN_PREFIX = 'sha256:';

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
    private readonly membershipService: MembershipService,
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

    if (!organization) throw new NotFoundException('Organization not found');
    await this.assertCanManageOrganization(organizationId, currentUser);
    if (!inviter) throw new NotFoundException('Inviter not found');
    if (!role) throw new NotFoundException('Role not found');
    await this.membershipService.validateRoleAssignment(
      role,
      organizationId,
      currentUser,
    );

    const existingUser = await this.userRepo.findOne({ where: { email } });
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

    const token = this.createRawToken();
    const savedInvitation = await this.dataSource.transaction(
      async (manager) => {
        await manager.findOne(Organization, {
          where: { id: organizationId },
          lock: { mode: 'pessimistic_write' },
        });
        await this.expirePendingInvitations(organizationId, email, manager);
        const pending = await manager.findOne(OrganizationInvitation, {
          where: {
            organization: { id: organizationId },
            email,
            status: OrganizationInvitationStatus.PENDING,
          },
        });
        if (pending) {
          throw new BadRequestException('Pending invitation already exists');
        }

        const invitation = this.invitationRepo.create({
          id: uuidv4(),
          organization,
          email,
          role: role.role_code,
          status: OrganizationInvitationStatus.PENDING,
          token: this.hashToken(token),
          invitedBy: inviter,
          expiresAt: this.createExpiresAt(),
        });
        return manager.save(OrganizationInvitation, invitation);
      },
    );

    try {
      await this.sendInvitationEmail(
        savedInvitation,
        organization,
        inviter,
        token,
      );
    } catch {
      try {
        await this.invitationRepo.remove(savedInvitation);
      } catch {
        throw new ServiceUnavailableException(
          'Invitation was created but email delivery failed; retry with the resend API',
        );
      }
      throw new ServiceUnavailableException(
        'Unable to deliver invitation email',
      );
    }

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
    await this.expirePendingInvitations(organizationId);
    const invitations = await this.invitationRepo.find({
      where: { organization: { id: organizationId } },
      relations: ['organization', 'invitedBy'],
      order: { createdAt: 'DESC' },
    });
    return Response(
      200,
      'Get organization invitations successfully',
      invitations.map((invitation) => this.toInvitationDto(invitation)),
    );
  }

  async findForCurrentUser(
    currentUser: any,
    query: InvitationInboxQueryDto,
  ): Promise<ApiResponse<any>> {
    const email = this.normalizeEmail(currentUser?.email);
    await this.expirePendingInvitations(undefined, email);
    const page = query.page || 1;
    const limit = query.limit || 10;
    const [invitations, total] = await this.invitationRepo.findAndCount({
      where: { email, status: OrganizationInvitationStatus.PENDING },
      relations: ['organization', 'invitedBy'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return Response(200, 'Get my organization invitations successfully', {
      items: invitations.map((invitation) => this.toInvitationDto(invitation)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }

  async accept(
    id: string,
    currentUser: any,
    token?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.processRecipientAction(
      id,
      currentUser,
      token,
      OrganizationInvitationStatus.ACCEPTED,
    );
    if (result.expired) throw new BadRequestException('Invitation expired');
    return Response(
      200,
      'Organization invitation accepted successfully',
      this.toInvitationDto(result.invitation),
    );
  }

  async reject(
    id: string,
    currentUser: any,
    token?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.processRecipientAction(
      id,
      currentUser,
      token,
      OrganizationInvitationStatus.REJECTED,
    );
    if (result.expired) throw new BadRequestException('Invitation expired');
    return Response(
      200,
      'Organization invitation rejected successfully',
      this.toInvitationDto(result.invitation),
    );
  }

  async revoke(
    organizationId: string,
    id: string,
    currentUser?: any,
  ): Promise<ApiResponse<any>> {
    await this.assertCanManageOrganization(organizationId, currentUser);
    const result = await this.dataSource.transaction(async (manager) => {
      const invitation = await this.findOrganizationInvitationForUpdate(
        manager,
        organizationId,
        id,
      );
      if (invitation.status !== OrganizationInvitationStatus.PENDING) {
        throw new BadRequestException(
          'Only pending invitations can be changed',
        );
      }
      if (this.isExpired(invitation)) {
        invitation.status = OrganizationInvitationStatus.EXPIRED;
        await manager.save(OrganizationInvitation, invitation);
        return { invitation, expired: true };
      }
      invitation.status = OrganizationInvitationStatus.REVOKED;
      await manager.save(OrganizationInvitation, invitation);
      return { invitation, expired: false };
    });
    if (result.expired) throw new BadRequestException('Invitation expired');
    return Response(
      200,
      'Organization invitation revoked successfully',
      this.toInvitationDto(result.invitation),
    );
  }

  async resend(
    organizationId: string,
    id: string,
    currentUser?: any,
  ): Promise<ApiResponse<any>> {
    await this.assertCanManageOrganization(organizationId, currentUser);
    const inviter = await this.userRepo.findOne({
      where: { id: currentUser?.userId },
    });
    if (!inviter) throw new NotFoundException('Inviter not found');
    const invitation = await this.findOrganizationInvitation(
      organizationId,
      id,
    );
    const role = await this.findAssignableRole(invitation.role, organizationId);
    if (!role) throw new NotFoundException('Role not found');
    await this.membershipService.validateRoleAssignment(
      role,
      organizationId,
      currentUser,
    );

    const rawToken = this.createRawToken();
    const saved = await this.dataSource.transaction(async (manager) => {
      const locked = await this.findOrganizationInvitationForUpdate(
        manager,
        organizationId,
        id,
      );
      if (
        locked.status !== OrganizationInvitationStatus.PENDING &&
        locked.status !== OrganizationInvitationStatus.EXPIRED
      ) {
        throw new BadRequestException(
          'Only pending or expired invitations can be resent',
        );
      }
      locked.token = this.hashToken(rawToken);
      locked.status = OrganizationInvitationStatus.PENDING;
      locked.expiresAt = this.createExpiresAt();
      locked.invitedBy = inviter;
      return manager.save(OrganizationInvitation, locked);
    });
    try {
      await this.sendInvitationEmail(
        saved,
        saved.organization,
        inviter,
        rawToken,
      );
    } catch {
      saved.status = OrganizationInvitationStatus.EXPIRED;
      await this.invitationRepo.save(saved);
      throw new ServiceUnavailableException(
        'Unable to deliver invitation email',
      );
    }
    return Response(
      200,
      'Organization invitation resent successfully',
      this.toInvitationDto(saved),
    );
  }

  private async processRecipientAction(
    id: string,
    currentUser: any,
    token: string | undefined,
    nextStatus:
      | OrganizationInvitationStatus.ACCEPTED
      | OrganizationInvitationStatus.REJECTED,
  ): Promise<{ invitation: OrganizationInvitation; expired: boolean }> {
    this.assertValidTokenInput(token);
    if (!currentUser?.userId || !currentUser?.email) {
      throw new ForbiddenException('AUTHENTICATION_REQUIRED');
    }

    return this.dataSource.transaction(async (manager) => {
      const invitation = await manager.findOne(OrganizationInvitation, {
        where: { id },
        relations: ['organization', 'invitedBy'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!invitation) {
        throw new NotFoundException('Organization invitation not found');
      }
      if (this.normalizeEmail(currentUser.email) !== invitation.email) {
        throw new ForbiddenException(
          'Invitation email does not match current user',
        );
      }
      if (!this.tokenMatches(invitation.token, token!)) {
        throw new ForbiddenException('Invalid invitation token');
      }
      if (invitation.status !== OrganizationInvitationStatus.PENDING) {
        throw new BadRequestException('This invitation is already handled');
      }
      if (this.isExpired(invitation)) {
        invitation.status = OrganizationInvitationStatus.EXPIRED;
        await manager.save(OrganizationInvitation, invitation);
        return { invitation, expired: true };
      }

      if (nextStatus === OrganizationInvitationStatus.ACCEPTED) {
        const user = await this.userRepo.findOne({
          where: { id: currentUser.userId },
        });
        if (!user) throw new NotFoundException('User not found');
        const role = await this.findAssignableRole(
          invitation.role,
          invitation.organization.id,
        );
        if (!role) throw new NotFoundException('Role not found');
        if (isSuperAdminRole(role)) {
          throw new ForbiddenException(
            'SUPER_ADMIN system role cannot be assigned.',
          );
        }

        const existingMembership = await manager.findOne(Membership, {
          where: {
            user: { id: user.id },
            organization: { id: invitation.organization.id },
          },
          lock: { mode: 'pessimistic_write' },
        });
        if (existingMembership?.isActive) {
          throw new BadRequestException('User is already an active member');
        }
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
      }

      invitation.status = nextStatus;
      await manager.save(OrganizationInvitation, invitation);
      return { invitation, expired: false };
    });
  }

  private async assertCanManageOrganization(
    organizationId: string,
    currentUser?: any,
  ): Promise<void> {
    if (currentUser?.role?.isSuperAdmin) return;
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
        permission.permission_code ===
        PermissionCode.ORGANIZATION_MEMBER_MANAGE,
    );
    if (!hasPermission) {
      throw new ForbiddenException('Insufficient organization permission');
    }
  }

  private async findOrganizationInvitation(
    organizationId: string,
    id: string,
  ): Promise<OrganizationInvitation> {
    const invitation = await this.invitationRepo.findOne({
      where: { id, organization: { id: organizationId } },
      relations: ['organization', 'invitedBy'],
    });
    if (!invitation)
      throw new NotFoundException('Organization invitation not found');
    return invitation;
  }

  private async expirePendingInvitations(
    organizationId?: string,
    email?: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(OrganizationInvitation)
      : this.invitationRepo;
    const now = new Date();
    const query = repo
      .createQueryBuilder()
      .update(OrganizationInvitation)
      .set({ status: OrganizationInvitationStatus.EXPIRED });
    if (organizationId) {
      query.where('"organizationId" = :organizationId', { organizationId });
    }
    query.andWhere('"status" = :pending', {
      pending: OrganizationInvitationStatus.PENDING,
    });
    query.andWhere('"expiresAt" < :now', { now });
    if (email) query.andWhere('"email" = :email', { email });
    await query.execute();
  }

  private async findOrganizationInvitationForUpdate(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<OrganizationInvitation> {
    const invitation = await manager.findOne(OrganizationInvitation, {
      where: { id, organization: { id: organizationId } },
      relations: ['organization', 'invitedBy'],
      lock: { mode: 'pessimistic_write' },
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
      .andWhere(
        '(organization.id = :organizationId OR organization.id IS NULL)',
        {
          organizationId,
        },
      )
      .orderBy('CASE WHEN organization.id = :organizationId THEN 0 ELSE 1 END')
      .setParameter('organizationId', organizationId)
      .getOne();
  }

  private async sendInvitationEmail(
    invitation: OrganizationInvitation,
    organization: Organization,
    inviter: User,
    rawToken: string,
  ): Promise<void> {
    const baseUrl = process.env.FE_URL || 'http://localhost:5173';
    const tokenParam = encodeURIComponent(rawToken);
    const html = await render(
      OrganizationInviteEmail({
        organizationName: organization.name,
        inviterName: inviter.fullName,
        role: invitation.role,
        acceptUrl: `${baseUrl}/organizations/invitations/${invitation.id}/accept?token=${tokenParam}`,
        rejectUrl: `${baseUrl}/organizations/invitations/${invitation.id}/reject?token=${tokenParam}`,
      }),
    );
    await this.mailerService.sendMail({
      to: invitation.email,
      subject: `You're invited to join ${organization.name}`,
      html,
    });
  }

  private createRawToken(): string {
    return randomBytes(32).toString('hex');
  }

  private hashToken(token: string): string {
    return `${HASHED_TOKEN_PREFIX}${createHash('sha256').update(token).digest('hex')}`;
  }

  private tokenMatches(storedToken: string, providedToken: string): boolean {
    const expected = storedToken.startsWith(HASHED_TOKEN_PREFIX)
      ? storedToken.slice(HASHED_TOKEN_PREFIX.length)
      : storedToken;
    const candidate = storedToken.startsWith(HASHED_TOKEN_PREFIX)
      ? createHash('sha256').update(providedToken).digest('hex')
      : providedToken;
    const expectedBuffer = Buffer.from(expected);
    const candidateBuffer = Buffer.from(candidate);
    return (
      expectedBuffer.length === candidateBuffer.length &&
      timingSafeEqual(expectedBuffer, candidateBuffer)
    );
  }

  private assertValidTokenInput(token?: string): asserts token is string {
    if (!token || token.length > 512) {
      throw new BadRequestException('Invitation token is required');
    }
  }

  private createExpiresAt(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.invitationTtlDays);
    return expiresAt;
  }

  private isExpired(invitation: OrganizationInvitation): boolean {
    return invitation.expiresAt.getTime() <= Date.now();
  }

  private normalizeEmail(email?: string): string {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) throw new BadRequestException('Email is required');
    return normalizedEmail;
  }

  private normalizeRole(role?: string): string {
    const normalizedRole = role?.trim().toUpperCase();
    if (!normalizedRole) throw new BadRequestException('Role is required');
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
