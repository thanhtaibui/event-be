import { Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Body } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
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
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies.refreshToken;
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
