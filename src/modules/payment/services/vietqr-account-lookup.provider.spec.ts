import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { VietQrAccountLookupProvider } from './vietqr-account-lookup.provider';

describe('VietQrAccountLookupProvider', () => {
  const oldClientId = process.env.VIETQR_CLIENT_ID;
  const oldApiKey = process.env.VIETQR_API_KEY;
  const oldFetch = global.fetch;
  const provider = new VietQrAccountLookupProvider();

  beforeEach(() => {
    process.env.VIETQR_CLIENT_ID = 'test-client-id';
    process.env.VIETQR_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    global.fetch = oldFetch;
    if (oldClientId === undefined) delete process.env.VIETQR_CLIENT_ID;
    else process.env.VIETQR_CLIENT_ID = oldClientId;
    if (oldApiKey === undefined) delete process.env.VIETQR_API_KEY;
    else process.env.VIETQR_API_KEY = oldApiKey;
  });

  it('calls VietQR with credentials and returns the provider beneficiary name', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '00',
        data: { accountName: 'BUI THANH TAI' },
      }),
    });
    global.fetch = fetchMock as any;

    await expect(
      provider.lookup({ bankBin: '970415', accountNumber: '10087387466' }),
    ).resolves.toEqual({
      bankBin: '970415',
      accountNumber: '10087387466',
      accountName: 'BUI THANH TAI',
      provider: 'VIETQR',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.vietqr.io/v2/lookup',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-client-id': 'test-client-id',
          'x-api-key': 'test-api-key',
        }),
        body: JSON.stringify({ bin: 970415, accountNumber: '10087387466' }),
      }),
    );
  });

  it('maps an invalid account response to BANK_ACCOUNT_NOT_FOUND', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ code: '42' }),
    }) as any;
    await expect(
      provider.lookup({ bankBin: '970415', accountNumber: '10087387466' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'BANK_ACCOUNT_NOT_FOUND' }),
    });
  });

  it('fails closed when credentials are missing', async () => {
    delete process.env.VIETQR_CLIENT_ID;
    delete process.env.VIETQR_API_KEY;
    global.fetch = jest.fn() as any;
    await expect(
      provider.lookup({ bankBin: '970415', accountNumber: '10087387466' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('maps provider errors and timeouts to a generic unavailable response', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network failure')) as any;
    await expect(
      provider.lookup({ bankBin: '970415', accountNumber: '10087387466' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: '45', desc: 'busy' }),
    }) as any;
    await expect(
      provider.lookup({ bankBin: '970415', accountNumber: '10087387466' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('does not return success when the provider omits the beneficiary name', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: '00', data: {} }),
    }) as any;
    await expect(
      provider.lookup({ bankBin: '970415', accountNumber: '10087387466' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('maps HTTP 429 Too Many Requests to ACCOUNT_LOOKUP_RATE_LIMITED', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: HttpStatus.TOO_MANY_REQUESTS,
      json: async () => ({ message: 'Too many requests' }),
    }) as any;
    await expect(
      provider.lookup({ bankBin: '970415', accountNumber: '10087387466' }),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      response: expect.objectContaining({
        code: 'ACCOUNT_LOOKUP_RATE_LIMITED',
      }),
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: '429', desc: 'Rate limit exceeded' }),
    }) as any;
    await expect(
      provider.lookup({ bankBin: '970415', accountNumber: '10087387466' }),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      response: expect.objectContaining({
        code: 'ACCOUNT_LOOKUP_RATE_LIMITED',
      }),
    });
  });

  it('maps HTTP 401 and 403 authentication failures to ServiceUnavailableException', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    }) as any;
    await expect(
      provider.lookup({ bankBin: '970415', accountNumber: '10087387466' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Forbidden' }),
    }) as any;
    await expect(
      provider.lookup({ bankBin: '970415', accountNumber: '10087387466' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('maps HTTP 5xx upstream server errors to ServiceUnavailableException', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Internal Server Error' }),
    }) as any;
    await expect(
      provider.lookup({ bankBin: '970415', accountNumber: '10087387466' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('maps codes 41, 10, 21, 22 to BadRequestException', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: '41' }),
    }) as any;
    await expect(
      provider.lookup({ bankBin: '970415', accountNumber: '10087387466' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'BANK_LOOKUP_UNSUPPORTED',
      }),
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: '21' }),
    }) as any;
    await expect(
      provider.lookup({ bankBin: '970415', accountNumber: '10087387466' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'INVALID_BANK_ACCOUNT',
      }),
    });
  });
});
