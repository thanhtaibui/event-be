import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { Order } from '../order/entities/order.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { TicketType } from '../ticket-type/entities/ticket-type.entity';
import { OrderStatus, PaymentStatus } from '../../shared/enum/enum';
import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PermissionCode } from '../../common/constants/permission-codes';
import {
  OrganizationPaymentAccount,
  PaymentAccountVerificationStatus,
} from './entities/organization-payment-account.entity';
import { OrganizationStatus } from '../../shared/enum/enum';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertOrganizationPaymentAccountDto } from './dto/upsert-organization-payment-account.dto';
import { LookupOrganizationPaymentAccountDto } from './dto/lookup-organization-payment-account.dto';

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

  it.each([
    PaymentAccountVerificationStatus.PENDING,
    PaymentAccountVerificationStatus.FAILED,
  ])('blocks QR payment when account verification is %s', (status) => {
    const service = new PaymentService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    expect(() =>
      (service as any).assertPaymentAccountVerified({
        verificationStatus: status,
      } as OrganizationPaymentAccount),
    ).toThrow('must be verified');
  });

  it('allows QR payment only for a verified account', () => {
    const service = new PaymentService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    expect(() =>
      (service as any).assertPaymentAccountVerified({
        verificationStatus: PaymentAccountVerificationStatus.VERIFIED,
        verifiedAccountName: 'NGUYEN VAN A',
        verificationProvider: 'VIETQR',
      } as OrganizationPaymentAccount),
    ).not.toThrow();
  });

  it('does not accept SePay account-setup records for payment creation', () => {
    const service = new PaymentService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    expect(() =>
      (service as any).assertPaymentAccountVerified({
        verificationStatus: PaymentAccountVerificationStatus.VERIFIED,
        verifiedAccountName: null,
        verificationProvider: 'SEPAY',
      } as OrganizationPaymentAccount),
    ).toThrow('verified by Eventix');
  });

  const makeCreatePaymentService = (
    verificationStatus: PaymentAccountVerificationStatus,
  ) => {
    const order: any = {
      id: 'order-1',
      user: { id: 'buyer-1' },
      organization: {
        id: 'org-1',
        status: OrganizationStatus.ACTIVE,
      },
      items: [
        {
          ticketType: {
            event: { organization: { id: 'org-1' } },
          },
        },
      ],
      status: OrderStatus.PENDING_PAYMENT,
      expiresAt: new Date(Date.now() + 60_000),
      totalPrice: 150000,
    };
    const payment: any = {
      id: 'payment-1',
      organization: order.organization,
      status: PaymentStatus.PENDING,
      amount: 150000,
      expiresAt: order.expiresAt,
      reference: 'EVT1234567890AB',
      bankBin: '970422',
      bankName: 'MB',
      accountName: 'NGUYEN VAN A',
      accountNumberEncrypted: 'cipher',
      accountNumberIv: 'iv',
      accountNumberTag: 'tag',
      currency: 'VND',
      method: 'VIETQR',
    };
    const orderRepository: any = {
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: order.id }),
      })),
      findOne: jest.fn().mockResolvedValue(order),
    };
    const paymentRepository: any = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_entity, values) => values),
    };
    const accountRepository: any = {
      findOne: jest.fn().mockResolvedValue({
        organization: order.organization,
        verificationStatus,
        verifiedAccountName:
          verificationStatus === PaymentAccountVerificationStatus.VERIFIED
            ? 'NGUYEN VAN A'
            : null,
        verificationProvider:
          verificationStatus === PaymentAccountVerificationStatus.VERIFIED
            ? 'VIETQR_LOOKUP'
            : null,
        accountNumberEncrypted: 'cipher',
        accountNumberIv: 'iv',
        accountNumberTag: 'tag',
        bankBin: '970422',
        bankName: 'MB',
        accountName: 'NGUYEN VAN A',
      }),
    };
    const manager: any = {
      getRepository: (entity: any) => {
        if (entity === Order) return orderRepository;
        if (entity === OrganizationPaymentAccount) return accountRepository;
        if (entity === Payment) return paymentRepository;
        throw new Error('Unexpected repository');
      },
      create: (_entity: any, values: any) => values,
      save: jest.fn(async (_entity, values) => ({ ...payment, ...values })),
    };
    const dataSource: any = {
      transaction: jest.fn((callback) => callback(manager)),
    };
    const service = new PaymentService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource,
      {
        decrypt: jest.fn().mockReturnValue('0123456789'),
      } as any,
      {
        createQrDataUrl: jest
          .fn()
          .mockResolvedValue('data:image/png;base64,qr'),
      } as any,
      {} as any,
    );
    return { service, accountRepository };
  };

  it.each([
    PaymentAccountVerificationStatus.PENDING,
    PaymentAccountVerificationStatus.FAILED,
  ])('does not create Payment or QR for %s bank account', async (status) => {
    const h = makeCreatePaymentService(status);
    await expect(
      h.service.createForOrder('order-1', { userId: 'buyer-1' }),
    ).rejects.toThrow('must be verified');
    expect(h.accountRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
  });

  it('creates Payment and QR for a VERIFIED bank account', async () => {
    const h = makeCreatePaymentService(
      PaymentAccountVerificationStatus.VERIFIED,
    );
    const result = await h.service.createForOrder('order-1', {
      userId: 'buyer-1',
    });
    expect(result.statusCode).toBe(201);
    expect(result.data.status).toBe(PaymentStatus.PENDING);
    expect(result.data.qrCode).toBe('data:image/png;base64,qr');
  });

  const makeAccountUpsertService = (valid = true) => {
    const organization: any = {
      id: 'org-1',
      status: OrganizationStatus.ACTIVE,
    };
    let storedAccount: any = {
      id: 'account-1',
      verificationStatus: PaymentAccountVerificationStatus.VERIFIED,
      verifiedAccountName: 'OLD HOLDER',
      verificationProvider: 'VIETQR_LOOKUP',
      accountNumberEncrypted: 'old-cipher',
      accountNumberIv: 'old-iv',
      accountNumberTag: 'old-tag',
    };
    const accountRepository: any = {
      findOne: jest.fn().mockResolvedValue(storedAccount),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        storedAccount = value;
        return value;
      }),
    };
    const membershipRepository: any = {
      findOne: jest.fn().mockResolvedValue({
        role: {
          permissions: [
            { permission_code: PermissionCode.ORGANIZATION_UPDATE },
          ],
        },
      }),
    };
    const dataSource: any = {
      transaction: jest.fn(async (callback) =>
        callback({
          getRepository: (entity: any) =>
            entity === OrganizationPaymentAccount
              ? {
                  findOne: jest.fn().mockResolvedValue(storedAccount),
                  create: jest.fn((value) => value),
                  save: accountRepository.save,
                }
              : { count: jest.fn().mockResolvedValue(0) },
        }),
      ),
    };
    const verificationService: any = {
      verifyAccountHolder: jest.fn(async (input) => {
        if (input.verificationToken && input.accountNumber !== '0123456789') {
          throw new BadRequestException('invalid verification token');
        }
        if (!valid) throw new BadRequestException('invalid bank account');
        return {
          bankBin: input.bankBin,
          accountNumber: input.accountNumber,
          accountName: 'NGUYEN VAN A',
          provider: 'VIETQR',
          bankName: 'MBBank',
        };
      }),
      lookup: jest.fn().mockResolvedValue({
        bankBin: '970422',
        bankName: 'MBBank',
        accountNumber: '0123456789',
        accountName: 'NGUYEN VAN A',
        verificationToken: 'signed-short-lived-token',
      }),
    };
    const service = new PaymentService(
      {} as any,
      {} as any,
      { findOne: jest.fn().mockResolvedValue(organization) } as any,
      accountRepository,
      membershipRepository,
      dataSource,
      {
        encrypt: jest
          .fn()
          .mockReturnValue({ encrypted: 'cipher', iv: 'iv', tag: 'tag' }),
        decrypt: jest.fn().mockReturnValue('0123456789'),
      } as any,
      {} as any,
      verificationService,
    );
    return {
      service,
      accountRepository,
      membershipRepository,
      dataSource,
      verificationService,
      getAccount: () => storedAccount,
    };
  };

  const accountInput = {
    bankBin: '970422',
    accountNumber: '0123456789',
    accountName: 'NGUYEN VAN A',
    verificationToken: 'signed-short-lived-token',
  };

  it('verifies the submitted account directly before saving as VERIFIED', async () => {
    const h = makeAccountUpsertService();
    const result = await h.service.upsertOrganizationAccount(
      'org-1',
      accountInput,
      { userId: 'user-1' },
    );
    expect(h.getAccount().verificationStatus).toBe(
      PaymentAccountVerificationStatus.VERIFIED,
    );
    expect(h.getAccount().verifiedAccountName).toBe('NGUYEN VAN A');
    expect(h.getAccount().verificationProvider).toBe('VIETQR_LOOKUP');
    expect(h.getAccount().verifiedAt).toBeInstanceOf(Date);
    expect(h.verificationService.verifyAccountHolder).toHaveBeenCalledWith({
      organizationId: 'org-1',
      userId: 'user-1',
      bankBin: '970422',
      accountNumber: '0123456789',
      accountName: 'NGUYEN VAN A',
      verificationToken: 'signed-short-lived-token',
    });
    expect(h.accountRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationStatus: PaymentAccountVerificationStatus.VERIFIED,
        verifiedAccountName: 'NGUYEN VAN A',
        verifiedAt: expect.any(Date),
        verificationProvider: 'VIETQR_LOOKUP',
      }),
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        bankBin: '970422',
        bankName: 'MBBank',
        maskedAccountNumber: '******6789',
        accountName: 'NGUYEN VAN A',
        verificationStatus: PaymentAccountVerificationStatus.VERIFIED,
        verifiedAccountName: 'NGUYEN VAN A',
        verifiedAt: expect.any(Date),
        verificationProvider: 'VIETQR_LOOKUP',
        verificationMethod: 'VIETQR_ACCOUNT_LOOKUP',
      }),
    );
    expect(JSON.stringify(result)).not.toContain('0123456789');
  });

  it('does not persist when the fresh provider verification fails', async () => {
    const h = makeAccountUpsertService(false);
    await expect(
      h.service.upsertOrganizationAccount('org-1', accountInput, {
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({
      message: 'invalid bank account',
    });
    expect(h.dataSource.transaction).not.toHaveBeenCalled();
    expect(h.accountRepository.save).not.toHaveBeenCalled();
  });

  it('does not persist when the verification provider times out', async () => {
    const h = makeAccountUpsertService();
    const original = h.getAccount();
    h.verificationService.verifyAccountHolder.mockRejectedValueOnce(
      new ServiceUnavailableException('provider timeout'),
    );
    await expect(
      h.service.upsertOrganizationAccount('org-1', accountInput, {
        userId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(h.dataSource.transaction).not.toHaveBeenCalled();
    expect(h.getAccount()).toBe(original);
  });

  it('does not persist when the submitted holder name does not match', async () => {
    const h = makeAccountUpsertService();
    const original = h.getAccount();
    h.verificationService.verifyAccountHolder.mockRejectedValueOnce(
      new BadRequestException({ code: 'ACCOUNT_HOLDER_NAME_MISMATCH' }),
    );
    await expect(
      h.service.upsertOrganizationAccount(
        'org-1',
        { ...accountInput, accountName: 'NGUYEN VAN B' },
        { userId: 'user-1' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.dataSource.transaction).not.toHaveBeenCalled();
    expect(h.getAccount()).toBe(original);
  });

  it('rejects a stale token when the submitted account number changed', async () => {
    const h = makeAccountUpsertService();
    await expect(
      h.service.upsertOrganizationAccount(
        'org-1',
        { ...accountInput, accountNumber: '0999999999' },
        { userId: 'user-1' },
      ),
    ).rejects.toThrow('invalid verification token');
    expect(h.verificationService.verifyAccountHolder).toHaveBeenCalledWith({
      organizationId: 'org-1',
      userId: 'user-1',
      bankBin: '970422',
      accountNumber: '0999999999',
      accountName: 'NGUYEN VAN A',
      verificationToken: 'signed-short-lived-token',
    });
    expect(h.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('allows a changed account only after a fresh lookup without an old token', async () => {
    const h = makeAccountUpsertService();
    const { verificationToken: _oldToken, ...newAccountInput } = accountInput;
    await h.service.upsertOrganizationAccount(
      'org-1',
      { ...newAccountInput, accountNumber: '0999999999' },
      { userId: 'user-1' },
    );
    expect(h.verificationService.verifyAccountHolder).toHaveBeenCalledWith({
      organizationId: 'org-1',
      userId: 'user-1',
      bankBin: '970422',
      accountNumber: '0999999999',
      accountName: 'NGUYEN VAN A',
      verificationToken: undefined,
    });
    expect(h.getAccount().accountNumberEncrypted).toBe('cipher');
  });

  it('checks organization permission before contacting the verification provider', async () => {
    const h = makeAccountUpsertService();
    h.membershipRepository.findOne.mockResolvedValueOnce(null);
    await expect(
      h.service.upsertOrganizationAccount('org-1', accountInput, {
        userId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.verificationService.verifyAccountHolder).not.toHaveBeenCalled();
    expect(h.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('preserves an existing VERIFIED account after an invalid replacement', async () => {
    const h = makeAccountUpsertService(false);
    const original = h.getAccount();
    await expect(
      h.service.upsertOrganizationAccount(
        'org-1',
        { ...accountInput, accountNumber: '0999999999' },
        { userId: 'user-1' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.getAccount()).toBe(original);
    expect(h.getAccount().verificationStatus).toBe(
      PaymentAccountVerificationStatus.VERIFIED,
    );
  });

  it('replaces a verified account only after the new account passes checks', async () => {
    const h = makeAccountUpsertService();
    await h.service.upsertOrganizationAccount(
      'org-1',
      {
        ...accountInput,
        accountNumber: '0999999999',
        verificationToken: undefined,
      },
      { userId: 'user-1' },
    );
    expect(h.getAccount()).toEqual(
      expect.objectContaining({
        bankName: 'MBBank',
        verificationStatus: PaymentAccountVerificationStatus.VERIFIED,
        verifiedAccountName: 'NGUYEN VAN A',
      }),
    );
  });

  it('looks up an account without persisting it', async () => {
    const h = makeAccountUpsertService();
    const result = await h.service.lookupOrganizationAccount(
      'org-1',
      { bankBin: '970422', accountNumber: '0123456789' } as any,
      { userId: 'user-1' },
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        accountName: 'NGUYEN VAN A',
        verificationToken: 'signed-short-lived-token',
      }),
    );
    expect(h.dataSource.transaction).not.toHaveBeenCalled();
    expect(h.accountRepository.save).not.toHaveBeenCalled();
  });

  it('keeps the existing account unchanged if persistence fails after lookup', async () => {
    const h = makeAccountUpsertService();
    const original = h.getAccount();
    h.accountRepository.save.mockRejectedValueOnce(new Error('db failure'));
    await expect(
      h.service.upsertOrganizationAccount(
        'org-1',
        {
          ...accountInput,
          accountNumber: '0999999999',
          verificationToken: undefined,
        },
        { userId: 'user-1' },
      ),
    ).rejects.toThrow('db failure');
    expect(h.getAccount()).toBe(original);
  });
});

describe('Organization payment account DTO validation', () => {
  it('requires the holder name and accepts an optional legacy lookup token', async () => {
    const dto = plainToInstance(UpsertOrganizationPaymentAccountDto, {
      bankBin: '970422',
      accountNumber: '0123456789',
      accountName: 'Nguyen Van A',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);

    const missingNameDto = plainToInstance(
      UpsertOrganizationPaymentAccountDto,
      {
        bankBin: '970422',
        accountNumber: '0123456789',
      },
    );
    expect(
      (await validate(missingNameDto)).map((error) => error.property),
    ).toContain('accountName');

    const legacyDto = plainToInstance(UpsertOrganizationPaymentAccountDto, {
      bankBin: '970422',
      bankName: 'Fake bank',
      accountName: 'Fake holder',
      accountNumber: '0123456789',
      verificationToken: 'signed-token',
    });
    const legacyErrors = await validate(legacyDto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(legacyErrors.map((error) => error.property)).toContain('bankName');
  });
});

describe('Organization payment account lookup DTO validation', () => {
  it('accepts the optional owner-entered account name under strict whitelist validation', async () => {
    const dto = plainToInstance(LookupOrganizationPaymentAccountDto, {
      bankBin: '970415',
      accountNumber: '10087387466',
      accountName: 'Bùi Thành Tài',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors).toHaveLength(0);
    expect(dto.accountName).toBe('Bùi Thành Tài');
  });
});
