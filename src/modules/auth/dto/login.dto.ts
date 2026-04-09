import { IsEmail, IsString, Matches, IsNotEmpty, IsBoolean } from 'class-validator';
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