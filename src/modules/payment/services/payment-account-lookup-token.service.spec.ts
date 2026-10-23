import { BadRequestException } from '@nestjs/common';
import { PaymentAccountLookupTokenService } from './payment-account-lookup-token.service';

describe('PaymentAccountLookupTokenService', () => {
  const previousSecret = process.env.JWT_SECRET;
  const service = new PaymentAccountLookupTokenService();
  const input = {
    organizationId: 'org-1',
    userId: 'user-1',
    bankBin: '970415',
    accountNumber: '10087387466',
    accountName: 'BUI THANH TAI',
    provider: 'VIETQR',
  };

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  afterAll(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it('binds the provider name to org, user, bank and account for five minutes', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-19T12:00:00Z'));
    const token = service.issue(input);
    expect(
      service.verify(token, {
        organizationId: input.organizationId,
        userId: input.userId,
        bankBin: input.bankBin,
        accountNumber: input.accountNumber,
      }),
    ).toEqual({ accountName: input.accountName, provider: 'VIETQR' });
    jest.useRealTimers();
  });

  it.each([
    ['organization', { organizationId: 'org-2' }],
    ['user', { userId: 'user-2' }],
    ['bank', { bankBin: '970436' }],
    ['account', { accountNumber: '10000000000' }],
  ])('rejects a token reused for another %s', (_label, overrides) => {
    const token = service.issue(input);
    expect(() =>
      service.verify(token, {
        organizationId: input.organizationId,
        userId: input.userId,
        bankBin: input.bankBin,
        accountNumber: input.accountNumber,
        ...overrides,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects a tampered token and an expired token', () => {
    const token = service.issue(input);
    const [payload, sig] = token.split('.');
    const tampered = `${payload}.${sig.startsWith('a') ? 'b' : 'a'}${sig.slice(1)}`;
    expect(() => service.verify(tampered, input)).toThrow(
      BadRequestException,
    );

    jest.useFakeTimers().setSystemTime(new Date('2026-10-19T12:00:00Z'));
    const expiringToken = service.issue(input);
    jest.advanceTimersByTime(5 * 60 * 1000);
    expect(() => service.verify(expiringToken, input)).toThrow(
      BadRequestException,
    );
    jest.useRealTimers();
  });
});
