import { Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Body } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { ApiResponse } from 'src/common/utils/ApiResponse';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }
  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<ApiResponse<any>> {
    return this.authService.login(loginDto);
  }

}
