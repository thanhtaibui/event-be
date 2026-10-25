import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GoogleOAuthDto, LoginDto, RegisterDto } from './dto/login.dto';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { Organization } from '../organization/entities/organization.entity';
import { Role } from '../role/entities/role.entity';
import { Membership } from '../membership/entities/membership.entity';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Response } from '../../common/utils/ApiResponse';

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
};

const OWNER_ROLE_CODE = 'OWNER';
const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const PASSWORD_RESET_EMAIL_TIMEOUT_MS = 10_000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Membership)
    private membershipRepo: Repository<Membership>,
  ) {}

  async forgotPassword(email: string): Promise<ApiResponse<null>> {
    const genericResponse = () =>
      Response(
        200,
        'If an account exists, a password reset request has been received.',
        null,
      );
    const startedAt = Date.now();
    this.logger.log('PASSWORD_RESET_REQUEST_STARTED');
    const normalizedEmail = email.trim().toLowerCase();
    let matchingUsers: User[];
    try {
      matchingUsers = await this.userRepo
        .createQueryBuilder('user')
        .where('LOWER(user.email) = :email', { email: normalizedEmail })
        .andWhere('user.isDelete = :isDelete', { isDelete: false })
        .take(2)
        .getMany();
    } catch (error) {
      this.logger.error(
        `PASSWORD_RESET_DATABASE_LOOKUP_FAILED:code=${this.getSafeErrorCode(error)}:elapsedMs=${Date.now() - startedAt}`,
      );
      throw new ServiceUnavailableException('PASSWORD_RESET_UNAVAILABLE');
    }
    this.logger.log(
      `PASSWORD_RESET_ACCOUNT_LOOKUP_COMPLETE:elapsedMs=${Date.now() - startedAt}`,
    );

    // A case-insensitive duplicate must never make the reset target ambiguous.
    if (matchingUsers.length !== 1) {
      this.logger.log(
        `PASSWORD_RESET_REQUEST_FINISHED:stage=ACCOUNT_LOOKUP:elapsedMs=${Date.now() - startedAt}`,
      );
      return genericResponse();
    }

    const frontendUrl = process.env.FE_URL?.trim();
    if (!frontendUrl) {
      this.logger.error('Password reset email unavailable: FE_URL is missing');
      return genericResponse();
    }

    let resetUrl: URL;
    try {
      resetUrl = new URL('/reset-password', frontendUrl);
    } catch {
      this.logger.error('Password reset email unavailable: FE_URL is invalid');
      return genericResponse();
    }

    if (
      process.env.NODE_ENV === 'production' &&
      (resetUrl.protocol !== 'https:' ||
        ['localhost', '127.0.0.1', '::1'].includes(
          resetUrl.hostname.toLowerCase().replace(/^\[|\]$/g, ''),
        ) ||
        resetUrl.hostname.toLowerCase().endsWith('.vercel.app'))
    ) {
      this.logger.error(
        'Password reset email unavailable: FE_URL is not a valid production frontend URL',
      );
      return genericResponse();
    }

    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    const mailFrom = process.env.MAIL_FROM?.trim();
    if (!resendApiKey || !mailFrom) {
      this.logger.error(
        `PASSWORD_RESET_EMAIL_CONFIG_MISSING:RESEND_API_KEY=${Boolean(resendApiKey)}:MAIL_FROM=${Boolean(mailFrom)}`,
      );
      return genericResponse();
    }

    const user = matchingUsers[0];
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashPasswordResetToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const previousTokenHash = user.passwordResetTokenHash;
    const previousExpiresAt = user.passwordResetExpiresAt;
    resetUrl.searchParams.set('token', token);

    try {
      const result = await this.userRepo.update(user.id, {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
      });
      if (!result.affected) {
        throw new Error('PASSWORD_RESET_TOKEN_NOT_STORED');
      }
    } catch (error) {
      this.logger.error(
        `PASSWORD_RESET_DATABASE_WRITE_FAILED:code=${this.getSafeErrorCode(error)}:elapsedMs=${Date.now() - startedAt}`,
      );
      throw new ServiceUnavailableException('PASSWORD_RESET_UNAVAILABLE');
    }

    this.logger.log(
      `PASSWORD_RESET_TOKEN_STORED:elapsedMs=${Date.now() - startedAt}`,
    );
    try {
      this.logger.log(
        `PASSWORD_RESET_EMAIL_PROVIDER_REQUEST_STARTED:provider=resend:elapsedMs=${Date.now() - startedAt}`,
      );
      await this.sendPasswordResetEmail(
        user.email,
        resetUrl,
        resendApiKey,
        mailFrom,
      );
    } catch (error) {
      try {
        await this.userRepo.update(
          { id: user.id, passwordResetTokenHash: tokenHash },
          {
            passwordResetTokenHash:
              previousExpiresAt && previousExpiresAt.getTime() > Date.now()
                ? previousTokenHash
                : null,
            passwordResetExpiresAt:
              previousExpiresAt && previousExpiresAt.getTime() > Date.now()
                ? previousExpiresAt
                : null,
          },
        );
      } catch {
        this.logger.error('PASSWORD_RESET_TOKEN_CLEANUP_FAILED');
      }
      this.logger.error(
        `PASSWORD_RESET_EMAIL_DELIVERY_FAILED:provider=resend:category=${this.classifyEmailProviderError(error)}:elapsedMs=${Date.now() - startedAt}`,
      );
      return genericResponse();
    }

    this.logger.log(
      `PASSWORD_RESET_EMAIL_PROVIDER_ACCEPTED:provider=resend:elapsedMs=${Date.now() - startedAt}`,
    );
    return genericResponse();
  }

  private async sendPasswordResetEmail(
    to: string,
    resetUrl: URL,
    apiKey: string,
    from: string,
  ): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      PASSWORD_RESET_EMAIL_TIMEOUT_MS,
    );

    try {
      const response = await fetch(RESEND_EMAILS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: 'Reset your Eventix password',
          html: `<p>A password reset was requested for your Eventix account.</p><p><a href="${resetUrl.toString()}">Reset password</a></p><p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>`,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const code =
          response.status === 401 || response.status === 403
            ? 'EMAIL_PROVIDER_AUTH_FAILED'
            : response.status === 429
              ? 'EMAIL_PROVIDER_RATE_LIMITED'
              : response.status === 408
                ? 'EMAIL_PROVIDER_TIMEOUT'
                : response.status >= 500
                  ? 'EMAIL_PROVIDER_UNAVAILABLE'
                  : 'EMAIL_PROVIDER_REJECTED';
        throw Object.assign(new Error(code), { code });
      }

      const payload = (await response.json().catch(() => null)) as {
        id?: unknown;
      } | null;
      if (!payload || typeof payload.id !== 'string' || !payload.id) {
        throw Object.assign(new Error('EMAIL_PROVIDER_INVALID_RESPONSE'), {
          code: 'EMAIL_PROVIDER_INVALID_RESPONSE',
        });
      }
    } catch (error) {
      if (controller.signal.aborted) {
        throw Object.assign(new Error('EMAIL_PROVIDER_TIMEOUT'), {
          code: 'EMAIL_PROVIDER_TIMEOUT',
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private getSafeErrorCode(error: unknown): string {
    if (!error || typeof error !== 'object' || !('code' in error)) {
      return 'UNKNOWN';
    }
    const code = String((error as { code?: unknown }).code);
    return /^[A-Z0-9_-]{1,32}$/i.test(code) ? code : 'UNKNOWN';
  }

  private classifyEmailProviderError(error: unknown): string {
    const code = this.getSafeErrorCode(error).toUpperCase();
    if (code.startsWith('EMAIL_PROVIDER_')) return code;
    if (error instanceof TypeError) return 'EMAIL_PROVIDER_NETWORK_ERROR';
    return 'EMAIL_PROVIDER_REQUEST_FAILED';
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<ApiResponse<null>> {
    const tokenHash = this.hashPasswordResetToken(token);
    const user = await this.userRepo.findOne({
      where: { passwordResetTokenHash: tokenHash },
    });
    const now = new Date();
    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() <= now.getTime()
    ) {
      throw new BadRequestException('INVALID_OR_EXPIRED_RESET_TOKEN');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const result = await this.userRepo.update(
      {
        id: user.id,
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: MoreThan(now),
      },
      {
        password: passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        refreshToken: null,
      },
    );
    if (!result.affected) {
      throw new BadRequestException('INVALID_OR_EXPIRED_RESET_TOKEN');
    }

    return Response(200, 'Password reset successfully', null);
  }

  private hashPasswordResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async register(registerDto: RegisterDto): Promise<ApiResponse<any>> {
    const existUser = await this.userRepo.findOne({
      where: { email: registerDto.email },
    });

    if (existUser) {
      throw new BadRequestException('Email already exists');
    }

    const user = this.userRepo.create({
      email: registerDto.email,
      password: await bcrypt.hash(registerDto.password, 10),
      fullName: registerDto.fullName,
      phoneNumber: registerDto.phoneNumber,
    });

    const savedUser = await this.userRepo.save(user);
    await this.createGuestMembership(savedUser);

    const userWithRelations = await this.findUserWithAuthRelations(
      savedUser.id,
    );
    const tokens = await this.getTokens(
      savedUser.id,
      userWithRelations,
      registerDto.rememberMe,
    );

    await this.userRepo.update(savedUser.id, {
      refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
    });

    return {
      statusCode: 201,
      message: 'Register successful',
      data: tokens,
    };
  }

  async login(loginDto: LoginDto): Promise<ApiResponse<any>> {
    const { email, password } = loginDto;
    const user = await this.userRepo.findOne({
      where: { email },
      relations: [
        'memberships',
        'memberships.organization',
        'memberships.role',
        'memberships.role.permissions',
      ],
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new BadRequestException('Wrong password');
    }

    const userWithRelations = await this.findUserWithAuthRelations(user.id);
    const tokens = await this.getTokens(
      user.id,
      userWithRelations,
      loginDto.rememberMe,
    );

    await this.userRepo.update(user.id, {
      refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
    });

    return {
      statusCode: 200,
      message: 'Login successful',
      data: {
        ...tokens,
      },
    };
  }

  async googleOAuth(googleOAuthDto: GoogleOAuthDto): Promise<ApiResponse<any>> {
    const googleUser = await this.verifyGoogleIdToken(googleOAuthDto.idToken);
    const email = googleUser.email;

    if (!email) {
      throw new UnauthorizedException('Google account email is missing');
    }

    const isEmailVerified =
      googleUser.email_verified === true ||
      googleUser.email_verified === 'true';

    if (!isEmailVerified) {
      throw new UnauthorizedException('Google email is not verified');
    }

    let user = await this.userRepo.findOne({
      where: { email },
    });

    if (!user) {
      user = this.userRepo.create({
        email,
        fullName: googleUser.name || email.split('@')[0],
        password: await bcrypt.hash(randomUUID(), 10),
      });
      user = await this.userRepo.save(user);
      await this.createGuestMembership(user);
    }

    const userWithRelations = await this.findUserWithAuthRelations(user.id);
    const tokens = await this.getTokens(
      user.id,
      userWithRelations,
      googleOAuthDto.rememberMe,
    );

    await this.userRepo.update(user.id, {
      refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
    });

    return {
      statusCode: 200,
      message: 'Google login successful',
      data: tokens,
    };
  }

  async getTokens(userId: string, user: User, rememberMe?: boolean) {
    const payload = {
      sub: userId,
      email: user.email,
      fullName: user.fullName,
      role: await this.buildRolePayload(user),
    };
    const accessTokenExpiresIn = (
      rememberMe
        ? process.env.JWT_REMEMBER_EXPIRES_IN ||
          process.env.JWT_EXPIRES_IN ||
          '1h'
        : process.env.JWT_EXPIRES_IN || '5m'
    ) as JwtSignOptions['expiresIn'];
    const refreshTokenExpiresIn = (
      rememberMe
        ? process.env.REFRESH_JWT_REMEMBER_EXPIRES_IN ||
          process.env.REFRESH_JWT_EXPIRES_IN ||
          '30d'
        : process.env.REFRESH_JWT_EXPIRES_IN || '7d'
    ) as JwtSignOptions['expiresIn'];

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: accessTokenExpiresIn,
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.REFRESH_JWT_SECRET,
      expiresIn: refreshTokenExpiresIn,
    });
    return {
      accessToken,
      refreshToken,
      role: payload.role,
      memberships: this.buildMembershipPayload(user),
    };
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<any>> {
    try {
      // 1. Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.REFRESH_JWT_SECRET,
      });
      // 2. Tìm user
      const user = await this.userRepo.findOne({
        where: { id: payload.sub },
        relations: [
          'memberships',
          'memberships.organization',
          'memberships.role',
          'memberships.role.permissions',
        ],
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // 3. So sánh refresh token (đã hash)
      const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);

      if (!isMatch) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const userWithRelations = await this.findUserWithAuthRelations(user.id);
      const tokens = await this.getTokens(user.id, userWithRelations, false);

      // 4. Tạo token mới
      // const newAccessToken = this.jwtService.sign(
      //   { sub: user.id },
      //   {
      //     secret: process.env.JWT_ACCESS_SECRET,
      //     expiresIn: '30s',
      //   },
      // );

      // const newRefreshToken = this.jwtService.sign(
      //   { sub: user.id },
      //   {
      //     secret: process.env.JWT_REFRESH_SECRET,
      //     expiresIn: '7d',
      //   },
      // );

      // 5. Lưu refresh token mới (rotate)
      user.refreshToken = await bcrypt.hash(tokens.refreshToken, 10);
      await this.userRepo.save(user);

      return {
        statusCode: 200,
        message: 'Token refreshed successfully',
        data: {
          ...tokens,
        },
      };
    } catch (err) {
      throw new UnauthorizedException('Refresh token expired');
    }
  }

  private async buildRolePayload(user: User) {
    const memberships = (user.memberships || []).filter(
      (membership) => membership.isActive && membership.role,
    );
    const isSuperAdmin = memberships.some(
      (membership) => membership.role.role_code === 'SUPER_ADMIN',
    );

    return {
      isSuperAdmin,
      permissions: isSuperAdmin
        ? ['*']
        : [
            ...new Set(
              memberships.flatMap((membership) =>
                this.getPermissionCodes(membership.role.permissions || []),
              ),
            ),
          ],
    };
  }

  private getPermissionCodes(
    permissions: { permission_code: string }[],
  ): string[] {
    return [
      ...new Set(permissions.map((permission) => permission.permission_code)),
    ];
  }

  private buildMembershipPayload(user: User) {
    return (user.memberships || [])
      .filter((membership) => membership.isActive && membership.role)
      .map((membership) => {
        const isSuperAdminRole = this.isSuperAdminRoleCode(
          membership.role.role_code,
        );

        return {
          membershipId: membership.id,
          roleId: membership.role.id,
          role_name: membership.role.role_name,
          role_code: membership.role.role_code,
          organizationId: isSuperAdminRole
            ? null
            : (membership.organization?.id ?? null),
          orgName: isSuperAdminRole
            ? null
            : (membership.organization?.name ?? null),
          slug: isSuperAdminRole
            ? null
            : (membership.organization?.slug ?? null),
          isVerified: isSuperAdminRole
            ? null
            : (membership.organization?.isVerified ?? false),
        };
      });
  }

  private isSuperAdminRoleCode(roleCode?: string): boolean {
    return roleCode?.trim().toUpperCase() === 'SUPER_ADMIN';
  }

  private async verifyGoogleIdToken(idToken: string): Promise<GoogleTokenInfo> {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
    );

    if (!response.ok) {
      throw new UnauthorizedException('Invalid Google id token');
    }

    const googleUser = (await response.json()) as GoogleTokenInfo;
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!googleClientId) {
      throw new BadRequestException('Google client is not configured');
    }

    if (!googleClientSecret) {
      throw new BadRequestException('Google client secret is not configured');
    }

    if (googleUser.aud !== googleClientId) {
      throw new UnauthorizedException('Invalid Google client');
    }

    return googleUser;
  }

  private async createGuestMembership(user: User): Promise<void> {
    const guestOrg = await this.orgRepo.findOne({
      where: { slug: 'guest-organization' },
    });

    if (!guestOrg) {
      return;
    }

    const guestRole = await this.roleRepo.findOne({
      where: {
        role_name: 'GUEST',
        organization: {
          id: guestOrg.id,
        },
      },
    });

    if (!guestRole) {
      return;
    }

    const membership = this.membershipRepo.create({
      user,
      organization: guestOrg,
      role: guestRole,
      isActive: true,
    });

    await this.membershipRepo.save(membership);
  }

  private async findUserWithAuthRelations(userId: string): Promise<User> {
    await this.syncOwnerMemberships(userId);

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: [
        'memberships',
        'memberships.organization',
        'memberships.role',
        'memberships.role.permissions',
      ],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private async syncOwnerMemberships(userId: string): Promise<void> {
    const ownedOrganizations = await this.orgRepo.find({
      where: { owner: { id: userId } },
    });

    if (!ownedOrganizations.length) {
      return;
    }

    const ownerRole = await this.roleRepo.findOne({
      where: {
        role_code: OWNER_ROLE_CODE,
        organization: IsNull(),
        deletedAt: IsNull(),
      },
    });

    if (!ownerRole) {
      throw new BadRequestException('OWNER role not found');
    }

    const existingMemberships = await this.membershipRepo.find({
      where: { user: { id: userId } },
      relations: ['organization', 'role'],
    });
    const existingOwnerOrgIds = new Set(
      existingMemberships
        .filter(
          (membership) =>
            membership.organization &&
            membership.role?.role_code === OWNER_ROLE_CODE,
        )
        .map((membership) => membership.organization.id),
    );

    const missingMemberships = ownedOrganizations
      .filter((organization) => !existingOwnerOrgIds.has(organization.id))
      .map((organization) =>
        this.membershipRepo.create({
          user: { id: userId } as User,
          organization,
          role: ownerRole,
          isActive: true,
        }),
      );

    if (missingMemberships.length) {
      await this.membershipRepo.save(missingMemberships);
    }
  }
}
