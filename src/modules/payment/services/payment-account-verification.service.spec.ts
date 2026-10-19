import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PaymentAccountVerificationService } from './payment-account-verification.service';

describe('PaymentAccountVerificationService', () => {
  const makeService = (overrides?: { providerResult?: any; error?: Error }) => {
    const accountLookup: any = {
      lookup: overrides?.error
        ? jest.fn().mockRejectedValue(overrides.error)
        : jest.fn().mockResolvedValue(
            overrides?.providerResult ?? {
              accountNumber: '10087387466',
              accountName: 'BUI THANH TAI',
              bankBin: '970415',
              provider: 'VIETQR',
            },
          ),
    };
    const lookupToken: any = {
      issue: jest.fn().mockReturnValue('signed-token'),
      verify: jest.fn().mockReturnValue({
        accountName: 'BUI THANH TAI',
        provider: 'VIETQR',
      }),
    };
    return {
      service: new PaymentAccountVerificationService(
        accountLookup,
        lookupToken,
      ),
      accountLookup,
      lookupToken,
    };
  };

  it('returns provider beneficiary and a scoped confirmation token without saving', async () => {
    const h = makeService();
    const result = await h.service.lookup({
      organizationId: 'org-1',
      userId: 'user-1',
      bankBin: '970415',
      accountNumber: '10087387466',
    });
    expect(result).toEqual({
      bankBin: '970415',
      bankName: 'VietinBank',
      accountNumber: '10087387466',
      accountName: 'BUI THANH TAI',
      verificationToken: 'signed-token',
    });
    expect(h.accountLookup.lookup).toHaveBeenCalledWith({
      bankBin: '970415',
      accountNumber: '10087387466',
    });
    expect(h.lookupToken.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        bankBin: '970415',
        accountNumber: '10087387466',
        accountName: 'BUI THANH TAI',
        provider: 'VIETQR',
      }),
    );
  });

  it('does not call lookup for unsupported banks or invalid account inputs', async () => {
    const h = makeService();
    await expect(
      h.service.lookup({
        organizationId: 'org-1',
        userId: 'user-1',
        bankBin: '000000',
        accountNumber: '10087387466',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      h.service.lookup({
        organizationId: 'org-1',
        userId: 'user-1',
        bankBin: '970415',
        accountNumber: '1234567890',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.accountLookup.lookup).not.toHaveBeenCalled();
  });

  it('does not issue a token when the provider returns another account or bank', async () => {
    const h = makeService({
      providerResult: {
        accountNumber: 'different-account',
        accountName: 'BUI THANH TAI',
        bankBin: '970415',
        provider: 'VIETQR',
      },
    });
    await expect(
      h.service.lookup({
        organizationId: 'org-1',
        userId: 'user-1',
        bankBin: '970415',
        accountNumber: '10087387466',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(h.lookupToken.issue).not.toHaveBeenCalled();
  });

  it('propagates invalid-account and unavailable-provider outcomes without a token', async () => {
    const notFound = makeService({ error: new NotFoundException() });
    await expect(
      notFound.service.lookup({
        organizationId: 'org-1',
        userId: 'user-1',
        bankBin: '970415',
        accountNumber: '10087387466',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const unavailable = makeService({
      error: new ServiceUnavailableException(),
    });
    await expect(
      unavailable.service.lookup({
        organizationId: 'org-1',
        userId: 'user-1',
        bankBin: '970415',
        accountNumber: '10087387466',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(unavailable.lookupToken.issue).not.toHaveBeenCalled();
  });

  it('returns only the signed provider name during confirmation', () => {
    const h = makeService();
    expect(
      h.service.verifyConfirmation({
        organizationId: 'org-1',
        userId: 'user-1',
        bankBin: '970415',
        accountNumber: '10087387466',
        verificationToken: 'signed-token',
      }),
    ).toEqual({
      accountName: 'BUI THANH TAI',
      provider: 'VIETQR',
      bankName: 'VietinBank',
    });
    expect(h.lookupToken.verify).toHaveBeenCalledWith('signed-token', {
      organizationId: 'org-1',
      userId: 'user-1',
      bankBin: '970415',
      accountNumber: '10087387466',
    });
  });
});
