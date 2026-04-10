import { Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Body } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { ApiOperation } from '@nestjs/swagger';
import { Res, Req } from '@nestjs/common';
import type { Response } from 'express';
import type { Request } from 'express';
import { Logger } from '@nestjs/common';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }
  @Post('login')
  @ApiOperation({ operationId: 'login' })
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<ApiResponse<any>> {
    const tokens = await this.authService.login(loginDto);

    // cookie nằm ở đây
    // có bảo mật không cho xem
    // res.cookie('refreshToken', tokens.data.refreshToken, {
    //   httpOnly: true,
    //   secure: true,
    //   sameSite: 'strict',
    // });
    // để test thì để secure: false, khi deploy thì đổi lại secure: true
    res.cookie('refreshToken', tokens.data.refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    });

    return {
      statusCode: 200,
      message: 'Login successful',
      data: {
        accessToken: tokens.data.accessToken
      }
    };
  }
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies.refreshToken;
    const tokens = await this.authService.refreshToken(refreshToken);
    res.cookie('refreshToken', tokens.data.refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    });
    return {
      statusCode: 200,
      message: 'Token refreshed successfully',
      data: {
        accessToken: tokens.data.accessToken
      }
    };
  }
}
