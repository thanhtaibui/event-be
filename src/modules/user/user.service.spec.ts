import { ForbiddenException } from '@nestjs/common';
import { UserService } from './user.service';

describe('UserService SUPER_ADMIN protection', () => {
  const superAdminUser = {
    id: 'super-admin-user-id',
    fullName: 'System Admin',
    memberships: [{ role: { role_code: 'SUPER_ADMIN' } }],
  };

  const createService = () => {
    const userRepo = {
      findOne: jest.fn().mockResolvedValue(superAdminUser),
      find: jest.fn().mockResolvedValue([superAdminUser]),
      save: jest.fn(),
      update: jest.fn(),
    };

    const service = new UserService(
      userRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return { service, userRepo };
  };

  it('returns 403 when normal admin updates SUPER_ADMIN target user', async () => {
    const { service } = createService();

    await expect(
      service.update(superAdminUser.id, { fullName: 'Downgraded' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns 403 when normal admin deactivates SUPER_ADMIN target user', async () => {
    const { service } = createService();

    await expect(service.updateActive(superAdminUser.id, false)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns 403 when SUPER_ADMIN self is deleted through normal CRUD', async () => {
    const { service } = createService();

    await expect(
      service.deleteSort({ ids: [superAdminUser.id] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not write when SUPER_ADMIN deletion is blocked', async () => {
    const { service, userRepo } = createService();

    await expect(
      service.deleteSort({ ids: [superAdminUser.id] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(userRepo.update).not.toHaveBeenCalled();
  });
});
