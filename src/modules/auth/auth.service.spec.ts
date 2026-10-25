import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';

describe('AuthService password reset', () => {
  const originalFrontendUrl = process.env.FE_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalResendApiKey = process.env.RESEND_API_KEY;
  const originalMailFrom = process.env.MAIL_FROM;
  let resendFetch: jest.SpyInstance;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.MAIL_FROM = 'Eventix <no-reply@example.com>';
    resendFetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'resend-email-id' }),
    } as Response);
  });

  afterEach(() => {
    if (originalFrontendUrl === undefined) delete process.env.FE_URL;
    else process.env.FE_URL = originalFrontendUrl;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalResendApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalResendApiKey;
    if (originalMailFrom === undefined) delete process.env.MAIL_FROM;
    else process.env.MAIL_FROM = originalMailFrom;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function createHarness(users = []) {
    process.env.FE_URL = 'https://eventix.example';
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      fullName: 'Eventix User',
      password: await bcrypt.hash('OldPassword123!', 10),
      refreshToken: 'stored-refresh-hash' as string | null,
      isDelete: false,
      passwordResetTokenHash: null as string | null,
      passwordResetExpiresAt: null as Date | null,
    };
    const matchedUsers = users.length ? users : [user];
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockImplementation(async () => matchedUsers),
    };
    const userRepo: any = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOne: jest.fn().mockImplementation(async ({ where }) => {
        if (where?.passwordResetTokenHash) {
          return where.passwordResetTokenHash === user.passwordResetTokenHash
            ? user
            : null;
        }
        return user;
      }),
      update: jest.fn().mockImplementation(async (_criteria, values) => {
        Object.assign(user, values);
        return { affected: 1 };
      }),
    };
    const jwt: any = { sign: jest.fn().mockReturnValue('signed-token') };
    const service = new AuthService(
      jwt,
      userRepo,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { findOne: jest.fn() } as any,
      { find: jest.fn(), save: jest.fn(), create: jest.fn() } as any,
    );

    return { service, user, userRepo, resendFetch, jwt, queryBuilder };
  }

  async function requestAndReadToken(
    harness: Awaited<ReturnType<typeof createHarness>>,
  ) {
    await harness.service.forgotPassword(' USER@example.com ');
    const request = JSON.parse(harness.resendFetch.mock.calls[0][1].body);
    const html = request.html as string;
    const url = new URL(html.match(/href="([^"]+)"/)![1]);
    return url.searchParams.get('token')!;
  }

  it('returns an identical public response for existing and unknown emails', async () => {
    const existing = await createHarness();
    const unknown = await createHarness([]);
    unknown.queryBuilder.getMany.mockResolvedValueOnce([]);

    const existingResponse =
      await existing.service.forgotPassword(' USER@example.com ');
    const unknownResponse = await unknown.service.forgotPassword(
      'unknown@example.com',
    );

    expect(existingResponse).toEqual(unknownResponse);
    expect(existing.resendFetch).toHaveBeenCalledTimes(1);
  });

  it('stores only a token hash, resets the password once, and invalidates refresh', async () => {
    const harness = await createHarness();
    const token = await requestAndReadToken(harness);
    const storedTokenHash = harness.user.passwordResetTokenHash;

    expect(storedTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedTokenHash).not.toBe(token);
    expect(harness.user.passwordResetExpiresAt!.getTime()).toBeGreaterThan(
      Date.now(),
    );

    await harness.service.resetPassword(token, 'NewPassword123!');
    expect(await bcrypt.compare('NewPassword123!', harness.user.password)).toBe(
      true,
    );
    expect(await bcrypt.compare('OldPassword123!', harness.user.password)).toBe(
      false,
    );
    expect(harness.user.passwordResetTokenHash).toBeNull();
    expect(harness.user.passwordResetExpiresAt).toBeNull();
    expect(harness.user.refreshToken).toBeNull();

    jest
      .spyOn(harness.service as any, 'findUserWithAuthRelations')
      .mockResolvedValue({ ...harness.user, memberships: [] });
    const login = await harness.service.login({
      email: harness.user.email,
      password: 'NewPassword123!',
    } as any);
    expect(login.statusCode).toBe(200);
    await expect(
      harness.service.login({
        email: harness.user.email,
        password: 'OldPassword123!',
      } as any),
    ).rejects.toThrow('Wrong password');

    await expect(
      harness.service.resetPassword(token, 'AnotherPassword123!'),
    ).rejects.toThrow('INVALID_OR_EXPIRED_RESET_TOKEN');
  });

  it('allows only one of two concurrent requests to consume a reset token', async () => {
    const harness = await createHarness();
    const token = 'C'.repeat(43);
    harness.user.passwordResetTokenHash = createHash('sha256')
      .update(token)
      .digest('hex');
    harness.user.passwordResetExpiresAt = new Date(Date.now() + 60_000);
    harness.userRepo.findOne.mockResolvedValue(harness.user);
    harness.userRepo.update
      .mockImplementationOnce(async (_criteria, values) => {
        Object.assign(harness.user, values);
        return { affected: 1 };
      })
      .mockResolvedValueOnce({ affected: 0 });

    const results = await Promise.allSettled([
      harness.service.resetPassword(token, 'FirstNewPassword123!'),
      harness.service.resetPassword(token, 'SecondNewPassword123!'),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    );
    expect(harness.userRepo.update).toHaveBeenCalledTimes(2);
    expect(harness.userRepo.update.mock.calls[0][0]).toEqual(
      harness.userRepo.update.mock.calls[1][0],
    );
  });

  it('rejects unknown and expired reset tokens', async () => {
    const harness = await createHarness();
    const expiredToken = 'B'.repeat(43);
    harness.user.passwordResetTokenHash = createHash('sha256')
      .update(expiredToken)
      .digest('hex');
    harness.user.passwordResetExpiresAt = new Date(Date.now() - 1000);

    await expect(
      harness.service.resetPassword(expiredToken, 'NewPassword123!'),
    ).rejects.toThrow(BadRequestException);
    expect(harness.userRepo.update).not.toHaveBeenCalled();

    await expect(
      harness.service.resetPassword('A'.repeat(43), 'NewPassword123!'),
    ).rejects.toThrow('INVALID_OR_EXPIRED_RESET_TOKEN');
  });

  it('does not refresh a session after password reset revoked its refresh token', async () => {
    const harness = await createHarness();
    harness.user.refreshToken = null;
    harness.jwt.verify = jest.fn().mockReturnValue({ sub: harness.user.id });

    await expect(
      harness.service.refreshToken('previous-refresh-token'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('clears the stored token when email delivery fails without changing the public response', async () => {
    const harness = await createHarness();
    jest
      .spyOn((harness.service as any).logger, 'error')
      .mockImplementation(() => undefined);
    harness.resendFetch.mockRejectedValueOnce(
      Object.assign(new Error('provider unavailable'), {
        code: 'EMAIL_PROVIDER_UNAVAILABLE',
      }),
    );

    const response = await harness.service.forgotPassword('user@example.com');

    expect(response.statusCode).toBe(200);
    expect(harness.user.passwordResetTokenHash).toBeNull();
    expect(harness.user.passwordResetExpiresAt).toBeNull();
  });

  it('preserves an older unexpired reset link when replacement email delivery fails', async () => {
    const harness = await createHarness();
    const previousToken = 'P'.repeat(43);
    const previousHash = createHash('sha256')
      .update(previousToken)
      .digest('hex');
    const previousExpiry = new Date(Date.now() + 60_000);
    harness.user.passwordResetTokenHash = previousHash;
    harness.user.passwordResetExpiresAt = previousExpiry;
    harness.resendFetch.mockRejectedValueOnce(
      Object.assign(new Error('provider timeout'), {
        code: 'EMAIL_PROVIDER_TIMEOUT',
      }),
    );

    await harness.service.forgotPassword('user@example.com');

    expect(harness.user.passwordResetTokenHash).toBe(previousHash);
    expect(harness.user.passwordResetExpiresAt).toEqual(previousExpiry);
  });

  it('aborts a Resend request that exceeds the provider timeout', async () => {
    const harness = await createHarness();
    jest.useFakeTimers();
    jest
      .spyOn((harness.service as any).logger, 'error')
      .mockImplementation(() => undefined);
    harness.resendFetch.mockImplementationOnce(
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    );

    const request = harness.service.forgotPassword('user@example.com');
    await jest.advanceTimersByTimeAsync(10_000);
    const response = await request;

    expect(response.statusCode).toBe(200);
    expect(harness.resendFetch).toHaveBeenCalledTimes(1);
    expect(harness.user.passwordResetTokenHash).toBeNull();
    expect((harness.service as any).logger.error).toHaveBeenCalledWith(
      expect.stringContaining('category=EMAIL_PROVIDER_TIMEOUT'),
    );
  });

  it.each([
    ['API key rejected', 401, 'EMAIL_PROVIDER_AUTH_FAILED'],
    ['rate limited', 429, 'EMAIL_PROVIDER_RATE_LIMITED'],
    ['provider timeout', 408, 'EMAIL_PROVIDER_TIMEOUT'],
    ['provider unavailable', 503, 'EMAIL_PROVIDER_UNAVAILABLE'],
  ])(
    'handles %s without retrying or disclosing account existence',
    async (_, status, category) => {
      const existing = await createHarness();
      const unknown = await createHarness([]);
      unknown.queryBuilder.getMany.mockResolvedValueOnce([]);
      existing.resendFetch.mockResolvedValueOnce({
        ok: false,
        status,
        json: async () => ({ message: 'provider failure' }),
      } as Response);
      jest
        .spyOn((existing.service as any).logger, 'error')
        .mockImplementation(() => undefined);

      const existingResponse =
        await existing.service.forgotPassword('user@example.com');
      const unknownResponse = await unknown.service.forgotPassword(
        'unknown@example.com',
      );

      expect(existingResponse).toEqual(unknownResponse);
      expect(existing.resendFetch).toHaveBeenCalledTimes(1);
      expect(existing.user.passwordResetTokenHash).toBeNull();
      expect((existing.service as any).logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`category=${category}`),
      );
    },
  );

  it('returns a service-unavailable error when database lookup fails', async () => {
    const harness = await createHarness();
    harness.queryBuilder.getMany.mockRejectedValueOnce(
      Object.assign(new Error('database unavailable'), { code: 'ECONNRESET' }),
    );

    await expect(
      harness.service.forgotPassword('user@example.com'),
    ).rejects.toThrow('PASSWORD_RESET_UNAVAILABLE');
    expect(harness.resendFetch).not.toHaveBeenCalled();
  });

  it('does not send a reset email when the database cannot store the token', async () => {
    const harness = await createHarness();
    harness.userRepo.update.mockRejectedValueOnce(
      Object.assign(new Error('database unavailable'), { code: 'ECONNRESET' }),
    );

    await expect(
      harness.service.forgotPassword('user@example.com'),
    ).rejects.toThrow('PASSWORD_RESET_UNAVAILABLE');
    expect(harness.resendFetch).not.toHaveBeenCalled();
  });

  it('does not create a reset token when Resend configuration is missing', async () => {
    const harness = await createHarness();
    delete process.env.RESEND_API_KEY;

    const response = await harness.service.forgotPassword('user@example.com');

    expect(response.statusCode).toBe(200);
    expect(harness.user.passwordResetTokenHash).toBeNull();
    expect(harness.resendFetch).not.toHaveBeenCalled();
  });

  it.each(['http://localhost:5173', 'https://old-frontend.vercel.app'])(
    'rejects unsafe production reset frontend URL %s',
    async (frontendUrl) => {
      const harness = await createHarness();
      process.env.NODE_ENV = 'production';
      process.env.FE_URL = frontendUrl;

      await harness.service.forgotPassword('user@example.com');

      expect(harness.resendFetch).not.toHaveBeenCalled();
      expect(harness.user.passwordResetTokenHash).toBeNull();
    },
  );

  it('uses the configured HTTPS Cloudflare Pages URL for production reset links', async () => {
    const harness = await createHarness();
    process.env.NODE_ENV = 'production';
    process.env.FE_URL = 'https://eventix.pages.dev';
    const logSpy = jest
      .spyOn((harness.service as any).logger, 'log')
      .mockImplementation(() => undefined);
    const errorSpy = jest
      .spyOn((harness.service as any).logger, 'error')
      .mockImplementation(() => undefined);

    await harness.service.forgotPassword('user@example.com');

    const request = JSON.parse(harness.resendFetch.mock.calls[0][1].body);
    const html = request.html as string;
    const resetUrl = new URL(html.match(/href="([^"]+)"/)![1]);
    expect(harness.resendFetch.mock.calls[0][0]).toBe(
      'https://api.resend.com/emails',
    );
    expect(harness.resendFetch.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-resend-key',
        'Content-Type': 'application/json',
      },
    });
    expect(request.from).toBe('Eventix <no-reply@example.com>');
    expect(request.to).toEqual(['user@example.com']);
    expect(resetUrl.origin).toBe('https://eventix.pages.dev');
    expect(resetUrl.pathname).toBe('/reset-password');
    expect(resetUrl.searchParams.get('token')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const logs = [...logSpy.mock.calls, ...errorSpy.mock.calls]
      .flat()
      .join(' ');
    expect(logs).not.toContain('test-resend-key');
    expect(logs).not.toContain(resetUrl.searchParams.get('token'));
  });

  it('validates reset token shape and applies the existing strong password policy', async () => {
    const valid = plainToInstance(ResetPasswordDto, {
      token: 'A'.repeat(43),
      newPassword: 'NewPassword123!',
    });
    const weak = plainToInstance(ResetPasswordDto, {
      token: 'bad-token',
      newPassword: 'weak',
    });
    const forgot = plainToInstance(ForgotPasswordDto, {
      email: ' USER@EXAMPLE.COM ',
    });

    expect(await validate(valid)).toHaveLength(0);
    expect((await validate(weak)).length).toBeGreaterThan(0);
    expect(await validate(forgot)).toHaveLength(0);
    expect(forgot.email).toBe('user@example.com');
  });
});
