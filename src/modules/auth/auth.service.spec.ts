import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';

describe('AuthService password reset', () => {
  const originalFrontendUrl = process.env.FE_URL;

  afterEach(() => {
    if (originalFrontendUrl === undefined) delete process.env.FE_URL;
    else process.env.FE_URL = originalFrontendUrl;
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
    const mailer = { sendMail: jest.fn().mockResolvedValue(undefined) };
    const jwt: any = { sign: jest.fn().mockReturnValue('signed-token') };
    const service = new AuthService(
      jwt,
      userRepo,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { findOne: jest.fn() } as any,
      { find: jest.fn(), save: jest.fn(), create: jest.fn() } as any,
      mailer as any,
    );

    return { service, user, userRepo, mailer, jwt, queryBuilder };
  }

  async function requestAndReadToken(
    harness: Awaited<ReturnType<typeof createHarness>>,
  ) {
    await harness.service.forgotPassword(' USER@example.com ');
    const html = harness.mailer.sendMail.mock.calls[0][0].html as string;
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
    expect(existing.mailer.sendMail).toHaveBeenCalledTimes(1);
    expect(unknown.mailer.sendMail).not.toHaveBeenCalled();
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
    harness.mailer.sendMail.mockRejectedValueOnce(
      new Error('SMTP unavailable'),
    );

    const response = await harness.service.forgotPassword('user@example.com');

    expect(response.statusCode).toBe(200);
    expect(harness.user.passwordResetTokenHash).toBeNull();
    expect(harness.user.passwordResetExpiresAt).toBeNull();
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
