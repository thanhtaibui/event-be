import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateMembershipDto {
  @IsOptional()
  @IsUUID('all', { message: 'Invalid UUID format.' })
  @ApiProperty({ example: 'userId', required: true })
  userId?: string;

  @IsNotEmpty({ message: 'Role ID is required.' })
  @IsUUID('all', { message: 'Invalid  UUID format.' })
  @ApiProperty({ example: 'roleId', required: false })
  roleId: string;

  @IsNotEmpty({ message: 'Organization ID is required.' })
  @IsUUID('all', { message: 'Invalid  UUID format.' })
  @ApiProperty({ example: 'OrgId', required: true })
  orgId: string;
}
