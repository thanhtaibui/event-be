import { Injectable } from '@nestjs/common';
import { GoogleOAuthDto, LoginDto, RegisterDto } from './dto/login.dto';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Repository } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { Organization } from '../organization/entities/organization.entity';
import { Role } from '../role/entities/role.entity';
import { Membership } from '../membership/entities/membership.entity';
import { randomUUID } from 'crypto';

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
};

@Injectable()
export class AuthService {
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

    const tokens = await this.getTokens(user.id, user, loginDto.rememberMe);

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

      // 3. So sánh refresh token (đã hash)
      const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);

      if (!isMatch) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const tokens = await this.getTokens(user.id, user, false);

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

  private async verifyGoogleIdToken(
    idToken: string,
  ): Promise<GoogleTokenInfo> {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
    );

    if (!response.ok) {
      throw new UnauthorizedException('Invalid Google id token');
    }

    const googleUser = (await response.json()) as GoogleTokenInfo;
    const googleClientId = process.env.GOOGLE_CLIENT_ID;

    if (!googleClientId) {
      throw new BadRequestException('Google client is not configured');
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
}
