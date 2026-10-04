import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { IsEmail, IsString } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/password-policy';

export class CreateUserDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @ApiProperty({ example: 'buitaia9@gmail.com' })
  email: string;

  @IsString({ message: 'Password must be a string' })
  @IsStrongPassword()
  @ApiProperty({ example: 'Buithanhtai9#' })
  password: string;

  @IsString({ message: 'Full name must be a string' })
  @ApiProperty({ example: 'Bui Tai A' })
  fullName: string;

  @IsOptional()
  @IsString({ message: 'Phone number must be a string' })
  @ApiProperty({ example: '0123456789', required: false })
  phoneNumber?: string;

  // @IsOptional()
  // @ApiProperty({ example: "roleName", required: false })
  // role: string;
}
