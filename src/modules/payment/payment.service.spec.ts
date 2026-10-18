import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { Order } from '../order/entities/order.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { TicketType } from '../ticket-type/entities/ticket-type.entity';
import { OrderStatus, PaymentStatus } from '../../shared/enum/enum';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PermissionCode } from '../../common/constants/permission-codes';

describe('PaymentService verified transfer processing', () => {
  const makeHarness = () => {
    const payment: any = {
      id: 'payment-1',
      orderId: 'order-1',
      order: { id: 'order-1' },
      status: PaymentStatus.PENDING,
      amount: 150000,
      expiresAt: new Date(Date.now() + 60_000),
      accountNumberEncrypted: 'encrypted',
      accountNumberIv: 'iv',
      accountNumberTag: 'tag',
      reference: 'EVT123456',
    };
    const order: any = {
      id: 'order-1',
      status: OrderStatus.PENDING_PAYMENT,
      user: { id: 'buyer-1' },
      items: [{ quantity: 1, ticketType: { id: 'type-1' } }],
    };
    let savedTransaction: any;
    const builder = (getOne: () => any) => ({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getOne: jest.fn(getOne),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 'type-1' }]),
    });
    const paymentRepo: any = {
      createQueryBuilder: jest.fn(() => builder(() => payment)),
    };
    const transactionRepo: any = {
      findOne: jest.fn(async () => savedTransaction || null),
      createQueryBuilder: jest.fn(() => builder(() => null)),
    };
    const orderRepo: any = {
      createQueryBuilder: jest.fn(() => builder(() => order)),
      findOne: jest.fn(async () => order),
    };
    const ticketRepo: any = { count: jest.fn().mockResolvedValue(0) };
    const manager: any = {
      getRepository: (entity: any) => {
        if (entity === Payment) return paymentRepo;
        if (entity === PaymentTransaction) return transactionRepo;
        if (entity === Order) return orderRepo;
        if (entity === Ticket) return ticketRepo;
        if (entity === TicketType)
          return { createQueryBuilder: jest.fn(() => builder(() => null)) };
        throw new Error('Unexpected entity');
      },
      create: (_entity: any, values: any) => values,
      save: jest.fn(async (entity: any, values: any) => {
        if (entity === PaymentTransaction)
          savedTransaction = { ...values, payment };
        return values;
      }),
    };
    const dataSource: any = {
      transaction: jest.fn((callback: (manager: any) => unknown) =>
        callback(manager),
      ),
    };
    const service = new PaymentService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource,
      { decrypt: jest.fn().mockReturnValue('0123456789') } as any,
      {} as any,
    );
    return {
      service,
      payment,
      order,
      manager,
      ticketRepo,
      getSavedTransaction: () => savedTransaction,
    };
  };

  it('marks exact verified payment paid and issues tickets once', async () => {
    const h = makeHarness();
    const transfer = {
      transactionId: 'bank-tx-1',
      reference: 'EVT123456',
      amount: 150000,
      receivingAccountNumber: '0123456789',
      occurredAt: new Date(),
      transferType: 'in',
    };
    const first = await h.service.processVerifiedTransfer(
      'test-adapter',
      transfer,
    );
    expect(h.payment.status).toBe(PaymentStatus.PAID);
    expect(h.order.status).toBe(OrderStatus.PAID);
    expect(h.manager.save).toHaveBeenCalledWith(Ticket, expect.any(Array));
    expect(first.statusCode).toBe(200);

    const second = await h.service.processVerifiedTransfer(
      'test-adapter',
      transfer,
    );
    expect(second.message).toContain('already processed');
    expect(
      h.manager.save.mock.calls.filter(([entity]: any[]) => entity === Ticket),
    ).toHaveLength(1);
    expect(h.getSavedTransaction().providerTransactionId).toBe('bank-tx-1');
  });

  it('records underpayment without changing the order or issuing tickets', async () => {
    const h = makeHarness();
    const result = await h.service.processVerifiedTransfer('test-adapter', {
      transactionId: 'bank-tx-partial',
      reference: 'EVT123456',
      amount: 50000,
      receivingAccountNumber: '0123456789',
      occurredAt: new Date(),
      transferType: 'in',
    });
    expect(h.payment.status).toBe(PaymentStatus.UNDERPAID);
    expect(h.order.status).toBe(OrderStatus.PENDING_PAYMENT);
    expect(result.statusCode).toBe(202);
    expect(h.manager.save).not.toHaveBeenCalledWith(Ticket, expect.anything());
  });

  it('rejects a transfer to a different receiving account without issuing tickets', async () => {
    const h = makeHarness();
    await expect(
      h.service.processVerifiedTransfer('test-adapter', {
        transactionId: 'bank-tx-wrong-account',
        reference: 'EVT123456',
        amount: 150000,
        receivingAccountNumber: '9999999999',
        occurredAt: new Date(),
        transferType: 'in',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.payment.status).toBe(PaymentStatus.PENDING);
    expect(h.manager.save).not.toHaveBeenCalledWith(Ticket, expect.anything());
  });

  it('requires organization-scoped permission to manage receiving account', async () => {
    const membershipRepo: any = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new PaymentService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      membershipRepo,
      {} as any,
      {} as any,
      {} as any,
    );
    await expect(
      (service as any).assertCanManageOrganization('org-a', {
        userId: 'user-a',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(membershipRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organization: { id: 'org-a' } }),
      }),
    );

    membershipRepo.findOne.mockResolvedValue({
      role: {
        permissions: [{ permission_code: PermissionCode.ORGANIZATION_UPDATE }],
      },
    });
    await expect(
      (service as any).assertCanManageOrganization('org-a', {
        userId: 'user-a',
      }),
    ).resolves.toBeUndefined();
  });
});
