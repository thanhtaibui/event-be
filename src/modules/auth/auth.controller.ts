import { Controller, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Body } from '@nestjs/common';
import { GoogleOAuthDto, LoginDto, RegisterDto } from './dto/login.dto';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { ApiOperation } from '@nestjs/swagger';
import { Res, Req } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import type { Request } from 'express';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getRefreshCookieOptions(rememberMe?: boolean): CookieOptions {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE
        ? process.env.COOKIE_SECURE === 'true'
        : isProduction,
      sameSite: process.env.COOKIE_SAME_SITE
        ? (process.env.COOKIE_SAME_SITE as CookieOptions['sameSite'])
        : isProduction
          ? 'none'
          : 'lax',
      path: '/',
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
    };
  }

  @Post('login')
  @ApiOperation({ operationId: 'login' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<any>> {
    const tokens = await this.authService.login(loginDto);

    res.cookie(
      'refreshToken',
      tokens.data.refreshToken,
      this.getRefreshCookieOptions(loginDto.rememberMe),
    );

    return {
      statusCode: 200,
      message: 'Login successful',
      data: {
        accessToken: tokens.data.accessToken,
      },
    };
  }

  @Post('register')
  @ApiOperation({ operationId: 'register' })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<any>> {
    const tokens = await this.authService.register(registerDto);

    res.cookie(
      'refreshToken',
      tokens.data.refreshToken,
      this.getRefreshCookieOptions(registerDto.rememberMe),
    );

    return {
      statusCode: 201,
      message: 'Register successful',
      data: {
        accessToken: tokens.data.accessToken,
      },
    };
  }

  @Post('google')
  @ApiOperation({ operationId: 'googleOAuth' })
  async googleOAuth(
    @Body() googleOAuthDto: GoogleOAuthDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<any>> {
    const tokens = await this.authService.googleOAuth(googleOAuthDto);

    res.cookie(
      'refreshToken',
      tokens.data.refreshToken,
      this.getRefreshCookieOptions(googleOAuthDto.rememberMe),
    );

    return {
      statusCode: 200,
      message: 'Google login successful',
      data: {
        accessToken: tokens.data.accessToken,
      },
    };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token cookie is missing');
    }

    const tokens = await this.authService.refreshToken(refreshToken);
    res.cookie(
      'refreshToken',
      tokens.data.refreshToken,
      this.getRefreshCookieOptions(),
    );
    return {
      statusCode: 200,
      message: 'Token refreshed successfully',
      data: {
        accessToken: tokens.data.accessToken,
      },
    };
  }
}
