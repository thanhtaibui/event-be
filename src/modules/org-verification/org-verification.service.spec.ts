import { OrganizationStatus, VerificationStatus } from 'src/shared/enum/enum';
import { OrgVerificationService } from './org-verification.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('OrgVerificationService', () => {
  it('approves verification by activating organization status and setting verified flag', async () => {
    const organization = {
      id: 'org-1',
      status: OrganizationStatus.PENDING,
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
        isVerified: true,
      }),
    );
    expect(organization.status).toBe(OrganizationStatus.ACTIVE);
    expect(organization.isVerified).toBe(true);
    expect(organization.verifiedAt).toBeInstanceOf(Date);
  });

  it('rejects verification by marking organization as rejected', async () => {
    const organization = {
      id: 'org-1',
      status: OrganizationStatus.PENDING,
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
      {
        status: VerificationStatus.REJECTED,
        adminNote: 'Missing legal document',
      },
      superAdmin.id,
    );

    expect(result.statusCode).toBe(200);
    expect(organizationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: OrganizationStatus.REJECTED,
        isVerified: false,
      }),
    );
    expect(organization.status).toBe(OrganizationStatus.REJECTED);
    expect(organization.isVerified).toBe(false);
  });

  it('allows only the organization owner to upload a private verification file', async () => {
    const { service, organizationRepo, uploadService } = createService({
      verificationRequest: null,
      verifier: null,
    });
    organizationRepo.findOne.mockResolvedValue({
      id: 'org-1',
      owner: { id: 'owner-1' },
    });

    const result = await service.uploadDocument(
      'org-1',
      { buffer: Buffer.from('%PDF-test') } as Express.Multer.File,
      'owner-1',
    );

    expect(uploadService.uploadPrivateVerificationDocument).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
    );
    expect(result.data?.documentKey).toMatch(/^org-verification\/org-1\//);

    await expect(
      service.uploadDocument(
        'org-1',
        {} as Express.Multer.File,
        'other-user',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(uploadService.uploadPrivateVerificationDocument).toHaveBeenCalledTimes(1);
  });

  it('rejects public URLs and keys belonging to another organization', async () => {
    const { service, orgVerificationRepo, organizationRepo } = createService({
      verificationRequest: null,
      verifier: null,
    });
    organizationRepo.findOne.mockResolvedValue({
      id: 'org-1',
      isVerified: false,
      owner: { id: 'owner-1' },
    });

    await expect(
      service.create(
        {
          organizationId: 'org-1',
          taxIdNumber: '123456789',
          documentKey: 'https://cdn.example.com/public-document.png',
        } as any,
        'owner-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(orgVerificationRepo.save).not.toHaveBeenCalled();
  });

  it('stores a private document key and returns only a signed temporary URL', async () => {
    const { service, orgVerificationRepo, organizationRepo, uploadService } =
      createService({
        verificationRequest: null,
        verifier: { id: 'owner-1' },
      });
    const organization = {
      id: 'org-1',
      isVerified: false,
      owner: { id: 'owner-1' },
    };
    organizationRepo.findOne.mockResolvedValue(organization);
    const documentKey =
      'org-verification/org-1/123e4567-e89b-42d3-a456-426614174000.pdf';
    uploadService.isPrivateVerificationDocumentKey.mockReturnValue(true);

    const result = await service.create(
      {
        organizationId: 'org-1',
        taxIdNumber: '123456789',
        documentKey,
      } as any,
      'owner-1',
    );

    expect(uploadService.assertPrivateVerificationDocumentExists).toHaveBeenCalledWith(
      documentKey,
      'org-1',
    );
    expect(orgVerificationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ documentUrl: documentKey }),
    );
    expect(result.data?.documentUrl).toBe('https://r2.example/signed');
    expect(result.data?.documentUrl).not.toBe(documentKey);
  });

  it('returns a short-lived signed URL instead of the private object key', async () => {
    const key = 'org-verification/org-1/123e4567-e89b-42d3-a456-426614174000.pdf';
    const request = {
      id: 'verification-1',
      organizationId: 'org-1',
      documentUrl: key,
      organization: { id: 'org-1' },
      requester: { id: 'owner-1' },
    };
    const { service, uploadService } = createService({
      verificationRequest: request,
      verifier: { id: 'owner-1', memberships: [] },
    });
    uploadService.isPrivateVerificationDocumentKey.mockReturnValue(true);
    uploadService.createPrivateVerificationDocumentUrl.mockResolvedValue({
      url: 'https://r2.example/signed?signature=temporary',
      expiresAt: new Date('2026-10-25T00:05:00.000Z'),
    });

    const result = await service.findOne(request.id, 'owner-1');

    expect(result.data?.documentUrl).toContain('signature=temporary');
    expect(result.data?.documentUrl).not.toBe(key);
    expect(result.data?.documentUrlExpiresAt).toBeInstanceOf(Date);
    expect(uploadService.createPrivateVerificationDocumentUrl).toHaveBeenCalledWith(
      key,
      'org-1',
    );
  });

  function createService(options: {
    verificationRequest: any;
    verifier: any;
  }) {
    const orgVerificationRepo = {
      create: jest.fn((value) => value),
      findOne: jest.fn().mockResolvedValue(options.verificationRequest),
      save: jest.fn((value) => Promise.resolve(value)),
    };
    const organizationRepo = {
      findOne: jest.fn(),
      save: jest.fn((value) => Promise.resolve(value)),
    };
    const userRepo = {
      findOne: jest.fn().mockResolvedValue(options.verifier),
    };
    const uploadService = {
      uploadPrivateVerificationDocument: jest
        .fn()
        .mockResolvedValue('org-verification/org-1/private.pdf'),
      isPrivateVerificationDocumentKey: jest
        .fn()
        .mockImplementation((key: string, organizationId?: string) =>
          key.startsWith(`org-verification/${organizationId}/`),
        ),
      assertPrivateVerificationDocumentExists: jest.fn().mockResolvedValue(undefined),
      createPrivateVerificationDocumentUrl: jest.fn().mockResolvedValue({
        url: 'https://r2.example/signed',
        expiresAt: new Date(),
      }),
    };
    const service = new OrgVerificationService(
      orgVerificationRepo as any,
      organizationRepo as any,
      userRepo as any,
      uploadService as any,
    );

    return {
      service,
      orgVerificationRepo,
      organizationRepo,
      userRepo,
      uploadService,
    };
  }
});
