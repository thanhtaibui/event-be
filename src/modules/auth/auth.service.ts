import { Injectable } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Repository } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenDto } from './dto/refresh.dto';
@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService, @InjectRepository(User) private userRepo: Repository<User>) { }
  async login(loginDto: LoginDto): Promise<ApiResponse<any>> {
    const { email, password } = loginDto;
    const user = await this.userRepo.findOne({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new BadRequestException('Wrong password');
    }

    const tokens = await this.getTokens(user.id, user.email, loginDto.rememberMe);

    await this.userRepo.update(user.id, {
      refreshToken: await bcrypt.hash(tokens.refreshToken, 10),
    });

    return {
      statusCode: 200,
      message: 'Login successful',
      data: {
        ...tokens,
      }
    };
  }
  async getTokens(userId: string, email: string, rememberMe?: boolean) {
    const payload = { sub: userId, email };

    const accessToken = this.jwtService.sign(payload, { expiresIn: rememberMe ? '1h' : '5m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: rememberMe ? '30d' : '7d' });

    return {
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<ApiResponse<any>> {
    try {
      // 1. Verify refresh token
      const payload = this.jwtService.verify(refreshTokenDto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      // 2. Tìm user
      const user = await this.userRepo.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // 3. So sánh refresh token (đã hash)
      const isMatch = await bcrypt.compare(
        refreshTokenDto.refreshToken,
        user.refreshToken,
      );

      if (!isMatch) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // 4. Tạo token mới
      const newAccessToken = this.jwtService.sign(
        { sub: user.id },
        {
          secret: process.env.JWT_ACCESS_SECRET,
          expiresIn: '5m',
        },
      );

      const newRefreshToken = this.jwtService.sign(
        { sub: user.id },
        {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: '7d',
        },
      );

      // 5. Lưu refresh token mới (rotate)
      user.refreshToken = await bcrypt.hash(newRefreshToken, 10);
      await this.userRepo.save(user);

      return {
        statusCode: 200,
        message: 'Token refreshed successfully',
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      };
    } catch (err) {
      throw new UnauthorizedException('Refresh token expired');
    }
  }
}
