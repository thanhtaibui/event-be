import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateOrganizationInvitationDto {
  @ApiProperty({ example: 'user@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'MEMBER' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  role: string;
}
