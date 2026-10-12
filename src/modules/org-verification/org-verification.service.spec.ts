import { OrganizationStatus, VerificationStatus } from 'src/shared/enum/enum';
import { OrgVerificationService } from './org-verification.service';

describe('OrgVerificationService', () => {
  it('approves verification without changing organization lifecycle status or active flag', async () => {
    const organization = {
      id: 'org-1',
      name: 'Green Future Community',
      status: OrganizationStatus.ACTIVE,
      isActive: true,
      isVerified: false,
      verifiedAt: null,
    };
    const verificationRequest = {
      id: 'verification-1',
      status: VerificationStatus.PENDING,
      organization,
      requester: {
        id: 'owner-1',
        fullName: 'Owner User',
        email: 'owner@example.com',
      },
      taxIdNumber: '123456789',
      documentUrl: 'https://cdn.example.com/document.png',
      adminNote: null,
      verifiedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const superAdmin = {
      id: 'super-admin',
      memberships: [{ role: { role_code: 'SUPER_ADMIN' } }],
    };
    const { service, organizationRepo } = createService({
      verificationRequest,
      verifier: superAdmin,
    });

    const result = await service.update(
      verificationRequest.id,
      { status: VerificationStatus.APPROVED },
      superAdmin.id,
    );

    expect(result.statusCode).toBe(200);
    expect(organizationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: OrganizationStatus.ACTIVE,
        isActive: true,
        isVerified: true,
      }),
    );
    expect(organization.status).toBe(OrganizationStatus.ACTIVE);
    expect(organization.isActive).toBe(true);
    expect(organization.isVerified).toBe(true);
    expect(organization.verifiedAt).toBeInstanceOf(Date);
  });

  function createService(options: {
    verificationRequest: any;
    verifier: any;
  }) {
    const orgVerificationRepo = {
      findOne: jest.fn().mockResolvedValue(options.verificationRequest),
      save: jest.fn((value) => Promise.resolve(value)),
    };
    const organizationRepo = {
      save: jest.fn((value) => Promise.resolve(value)),
    };
    const userRepo = {
      findOne: jest.fn().mockResolvedValue(options.verifier),
    };
    const service = new OrgVerificationService(
      orgVerificationRepo as any,
      organizationRepo as any,
      userRepo as any,
    );

    return {
      service,
      orgVerificationRepo,
      organizationRepo,
      userRepo,
    };
  }
});
