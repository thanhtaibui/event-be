import {
  IsEmail,
  IsString,
  Matches,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  @ApiProperty({ example: 'buitaia9@gmail.com' })
  email: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9]{6,}$/, {
    message:
      'Password must be at least 6 characters long and contain only letters and numbers',
  })
  @IsNotEmpty({ message: 'Password is required' })
  @ApiProperty({ example: 'Password123' })
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
  @Matches(/^[a-zA-Z0-9]{6,}$/, {
    message:
      'Password must be at least 6 characters long and contain only letters and numbers',
  })
  @IsNotEmpty({ message: 'Password is required' })
  @ApiProperty({ example: 'Password123' })
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
