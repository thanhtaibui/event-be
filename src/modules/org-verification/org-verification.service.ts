import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrgVerificationDto } from './dto/create-org-verification.dto';
import { UpdateOrgVerificationDto } from './dto/update-org-verification.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { OrgVerification } from './entities/org-verification.entity';
import { Repository } from 'typeorm';
import { Organization } from '../organization/entities/organization.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { VerificationStatus } from 'src/shared/enum/enum';

@Injectable()
export class OrgVerificationService {
  constructor(
    @InjectRepository(OrgVerification)
    private orgVerificationRepo: Repository<OrgVerification>,
    @InjectRepository(Organization)
    private organizationRepo: Repository<Organization>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async create(
    createOrgVerificationDto: CreateOrgVerificationDto,
    requesterId: string,
  ): Promise<ApiResponse<any>> {
    const { organizationId, taxIdNumber, documentUrl } =
      createOrgVerificationDto;

    const org = await this.organizationRepo.findOne({
      where: { id: organizationId },
      relations: ['owner'],
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (org.isVerified) {
      throw new BadRequestException('Organization is already verified');
    }

    if (!org.owner || org.owner.id !== requesterId) {
      throw new ForbiddenException(
        'Only organization owner can submit verification request',
      );
    }

    const requester = await this.userRepo.findOne({
      where: { id: requesterId },
    });

    if (!requester) {
      throw new NotFoundException('Requester not found');
    }

    const pendingRequest = await this.orgVerificationRepo.findOne({
      where: {
        organization: { id: organizationId },
        status: VerificationStatus.PENDING,
      },
    });

    if (pendingRequest) {
      throw new BadRequestException(
        'Organization already has a pending verification request',
      );
    }

    const verification = this.orgVerificationRepo.create({
      organization: org,
      organizationId: org.id,
      requester,
      taxIdNumber,
      documentUrl,
      status: VerificationStatus.PENDING,
    });

    const savedVerification =
      await this.orgVerificationRepo.save(verification);

    return Response(
      201,
      'Submit organization verification request successfully',
      this.toResponse(savedVerification),
    );
  }

  async findAll(
    currentUserId: string,
    status?: VerificationStatus,
    organizationId?: string,
    requesterId?: string,
  ): Promise<ApiResponse<any[]>> {
    const currentUser = await this.findUserWithRoles(currentUserId);

    if (!this.isSuperAdmin(currentUser)) {
      throw new ForbiddenException(
        'Only super admin can view verification requests',
      );
    }

    const requests = await this.orgVerificationRepo.find({
      where: {
        ...(status ? { status } : {}),
        ...(organizationId ? { organization: { id: organizationId } } : {}),
        ...(requesterId ? { requester: { id: requesterId } } : {}),
      },
      relations: ['organization', 'requester', 'verifiedBy'],
      order: { createdAt: 'DESC' },
    });

    return Response(
      200,
      'Get organization verification requests successfully',
      requests.map((request) => this.toResponse(request)),
    );
  }

  async findOne(id: string, currentUserId: string): Promise<ApiResponse<any>> {
    const request = await this.findRequestById(id);
    await this.assertCanAccessRequest(request, currentUserId);

    return Response(
      200,
      'Get organization verification request successfully',
      this.toResponse(request),
    );
  }

  async update(
    id: string,
    updateOrgVerificationDto: UpdateOrgVerificationDto,
    verifiedById: string,
  ): Promise<ApiResponse<any>> {
    const { status, adminNote } = updateOrgVerificationDto;

    if (
      status !== VerificationStatus.APPROVED &&
      status !== VerificationStatus.REJECTED
    ) {
      throw new BadRequestException('Status must be APPROVED or REJECTED');
    }

    if (status === VerificationStatus.REJECTED && !adminNote) {
      throw new BadRequestException('Admin note is required when rejecting');
    }

    const request = await this.findRequestById(id);

    if (request.status !== VerificationStatus.PENDING) {
      throw new BadRequestException('Verification request is already processed');
    }

    const verifiedBy = await this.userRepo.findOne({
      where: { id: verifiedById },
      relations: ['memberships', 'memberships.role'],
    });

    if (!verifiedBy) {
      throw new NotFoundException('Verifier not found');
    }

    const isSuperAdmin = (verifiedBy.memberships || []).some(
      (membership) => membership.role?.role_code === 'SUPER_ADMIN',
    );

    if (!isSuperAdmin) {
      throw new ForbiddenException('Only super admin can verify organization');
    }

    request.status = status;
    request.adminNote = adminNote || null;
    request.verifiedBy = verifiedBy;
    request.verifiedAt = new Date();

    if (status === VerificationStatus.APPROVED) {
      request.organization.isVerified = true;
      request.organization.verifiedAt = request.verifiedAt;
      await this.organizationRepo.save(request.organization);
    }

    const savedRequest = await this.orgVerificationRepo.save(request);

    return Response(
      200,
      'Update organization verification request successfully',
      this.toResponse(savedRequest),
    );
  }

  async remove(id: string, currentUserId: string): Promise<ApiResponse<any>> {
    const request = await this.findRequestById(id);
    await this.assertCanAccessRequest(request, currentUserId);

    if (request.status !== VerificationStatus.PENDING) {
      throw new BadRequestException('Only pending request can be cancelled');
    }

    await this.orgVerificationRepo.delete(id);

    return Response(200, 'Cancel organization verification request successfully', {
      id,
    });
  }

  private async findRequestById(id: string): Promise<OrgVerification> {
    const request = await this.orgVerificationRepo.findOne({
      where: { id },
      relations: ['organization', 'requester', 'verifiedBy'],
    });

    if (!request) {
      throw new NotFoundException('Organization verification request not found');
    }

    return request;
  }

  private async findUserWithRoles(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['memberships', 'memberships.role'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private isSuperAdmin(user: User): boolean {
    return (user.memberships || []).some(
      (membership) => membership.role?.role_code === 'SUPER_ADMIN',
    );
  }

  private async assertCanAccessRequest(
    request: OrgVerification,
    currentUserId: string,
  ) {
    const currentUser = await this.findUserWithRoles(currentUserId);

    if (
      this.isSuperAdmin(currentUser) ||
      request.requester?.id === currentUserId
    ) {
      return;
    }

    throw new ForbiddenException(
      'You do not have permission to access this verification request',
    );
  }

  private toResponse(request: OrgVerification) {
    return {
      id: request.id,
      status: request.status,
      taxIdNumber: request.taxIdNumber,
      documentUrl: request.documentUrl,
      adminNote: request.adminNote,
      verifiedAt: request.verifiedAt,
      createdAt: request.createdAt,
      organization: request.organization
        ? {
            id: request.organization.id,
            name: request.organization.name,
            legalName: request.organization.legalName,
            isVerified: request.organization.isVerified,
            verifiedAt: request.organization.verifiedAt,
          }
        : null,
      requester: request.requester
        ? {
            id: request.requester.id,
            fullName: request.requester.fullName,
            email: request.requester.email,
          }
        : null,
      verifiedBy: request.verifiedBy
        ? {
            id: request.verifiedBy.id,
            fullName: request.verifiedBy.fullName,
            email: request.verifiedBy.email,
          }
        : null,
    };
  }
}
