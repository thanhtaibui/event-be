import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { VietQrAccountLookupService } from './vietqr-account-lookup.service';

describe('VietQrAccountLookupService', () => {
  const originalClientId = process.env.VIETQR_CLIENT_ID;
  const originalApiKey = process.env.VIETQR_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.VIETQR_CLIENT_ID = 'test-client';
    process.env.VIETQR_API_KEY = 'test-key-do-not-log';
  });

  afterEach(() => {
    if (originalClientId === undefined) delete process.env.VIETQR_CLIENT_ID;
    else process.env.VIETQR_CLIENT_ID = originalClientId;
    if (originalApiKey === undefined) delete process.env.VIETQR_API_KEY;
    else process.env.VIETQR_API_KEY = originalApiKey;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const response = (body: unknown, status = 200) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }) as Response;

  it('looks up account name using official BIN and credential headers', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        response({
          code: '00',
          data: [
            {
              bin: '970422',
              name: 'Military Commercial Joint Stock Bank',
              shortName: 'MB',
              lookupSupported: 1,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({ code: '00', data: { accountName: 'NGUYEN VAN A' } }),
      );
    global.fetch = fetchMock;

    const result = await new VietQrAccountLookupService().lookupAccount(
      '970422',
      '0123456789',
    );

    expect(result).toEqual({ bankName: 'MB', accountName: 'NGUYEN VAN A' });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.vietqr.io/v2/lookup',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-client-id': 'test-client',
          'x-api-key': 'test-key-do-not-log',
        }),
        body: JSON.stringify({ bin: 970422, accountNumber: '0123456789' }),
      }),
    );
  });

  it('rejects banks that do not support account lookup', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      response({
        code: '00',
        data: [
          {
            bin: '970422',
            name: 'MB',
            lookupSupported: 0,
          },
        ],
      }),
    );
    await expect(
      new VietQrAccountLookupService().lookupAccount('970422', '0123456789'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an account reported invalid by VietQR', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        response({
          code: '00',
          data: [{ bin: '970422', name: 'MB', lookupSupported: 1 }],
        }),
      )
      .mockResolvedValueOnce(response({ code: '42', desc: 'account invalid' }));
    await expect(
      new VietQrAccountLookupService().lookupAccount('970422', '0123456789'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails closed when provider credentials are missing', async () => {
    delete process.env.VIETQR_CLIENT_ID;
    await expect(
      new VietQrAccountLookupService().lookupAccount('970422', '0123456789'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(global.fetch).toBe(originalFetch);
  });

  it('treats provider HTTP errors as unavailable rather than verified', async () => {
    global.fetch = jest.fn().mockResolvedValue(response({}, 503));
    await expect(
      new VietQrAccountLookupService().lookupAccount('970422', '0123456789'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
