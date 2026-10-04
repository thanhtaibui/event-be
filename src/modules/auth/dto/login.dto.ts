import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../../../common/validators/password-policy';

export class LoginDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  @ApiProperty({ example: 'buitaia9@gmail.com' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @ApiProperty({ example: 'OldPassword123' })
  password: string;

  @IsBoolean()
  @ApiProperty({ example: false })
  rememberMe?: boolean;
}

export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  @ApiProperty({ example: 'buitaia9@gmail.com' })
  email: string;

  @IsString()
  @IsStrongPassword()
  @IsNotEmpty({ message: 'Password is required' })
  @ApiProperty({ example: 'Buithanhtai9#' })
  password: string;

  @IsString({ message: 'Full name must be a string' })
  @IsNotEmpty({ message: 'Full name is required' })
  @ApiProperty({ example: 'Bui Tai A' })
  fullName: string;

  @IsOptional()
  @IsString({ message: 'Phone number must be a string' })
  @ApiProperty({ example: '0123456789', required: false })
  phoneNumber?: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ example: false, required: false })
  rememberMe?: boolean;
}

export class GoogleOAuthDto {
  @IsString()
  @IsNotEmpty({ message: 'Google idToken is required' })
  @ApiProperty({ example: 'google-id-token' })
  idToken: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ example: false, required: false })
  rememberMe?: boolean;
}
