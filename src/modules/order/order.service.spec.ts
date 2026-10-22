import { ForbiddenException } from '@nestjs/common';
import { OrderService } from './order.service';

describe('OrderService organization-scoped listing', () => {
  const manager = {
    userId: 'manager-1',
    role: { isSuperAdmin: false, permissions: ['TICKET_MANAGE'] },
  };
  const superAdmin = {
    userId: 'super-admin',
    role: { isSuperAdmin: true, permissions: ['*'] },
  };

  it('lists only orders in organizations where the role has TICKET_MANAGE', async () => {
    const { service, orderRepo, membershipRepo } = createService();
    membershipRepo.find.mockResolvedValueOnce([
      {
        organization: { id: 'org-a' },
        role: { permissions: [{ permission_code: 'TICKET_MANAGE' }] },
      },
      {
        organization: { id: 'org-b' },
        role: { permissions: [{ permission_code: 'TICKET_VIEW' }] },
      },
    ]);
    orderRepo.find.mockResolvedValueOnce([makeOrder()]);

    const result = await service.findAll(manager);

    const options = orderRepo.find.mock.calls[0][0];
    expect(options.where.organization.id._value).toEqual(['org-a']);
    expect(result.data).toHaveLength(1);
  });

  it('returns an empty list when the user cannot manage any organization', async () => {
    const { service, orderRepo, membershipRepo } = createService();
    membershipRepo.find.mockResolvedValueOnce([
      {
        organization: { id: 'org-b' },
        role: { permissions: [{ permission_code: 'TICKET_VIEW' }] },
      },
    ]);
    orderRepo.find.mockResolvedValueOnce([]);

    const result = await service.findAll(manager);

    expect(orderRepo.find.mock.calls[0][0].where.organization.id._value).toEqual(
      [],
    );
    expect(result.data).toEqual([]);
  });

  it('keeps Super Admin listing system-wide', async () => {
    const { service, orderRepo, membershipRepo } = createService();
    orderRepo.find.mockResolvedValueOnce([makeOrder()]);

    const result = await service.findAll(superAdmin);

    expect(membershipRepo.find).not.toHaveBeenCalled();
    expect(orderRepo.find.mock.calls[0][0].where).toBeUndefined();
    expect(result.data).toHaveLength(1);
  });

  it('rejects calls without an authenticated user', async () => {
    const { service, orderRepo } = createService();

    await expect(service.findAll()).rejects.toBeInstanceOf(ForbiddenException);
    expect(orderRepo.find).not.toHaveBeenCalled();
  });

  function makeOrder() {
    return {
      id: 'order-1',
      totalPrice: 100000,
      status: 'PAID',
      expiresAt: null,
      organization: { id: 'org-a', name: 'Org A' },
      createdAt: new Date('2026-10-20T00:00:00Z'),
      user: { id: 'buyer-1', fullName: 'Buyer', email: 'buyer@example.com' },
      tickets: [],
      items: [],
    };
  }

  function createService() {
    const orderRepo = { find: jest.fn() };
    const membershipRepo = { find: jest.fn() };
    const service = new OrderService(
      orderRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      membershipRepo as any,
      {} as any,
    );

    return { service, orderRepo, membershipRepo };
  }
});
