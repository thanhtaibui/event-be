import { PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsUUID } from 'class-validator';
import { CreateMembershipDto } from './create-membership.dto';

export class UpdateMembershipDto extends PartialType(CreateMembershipDto) {}

export class UpdateMembershipStatusDto {
  @ApiProperty({ example: true, description: 'Membership active status' })
  @IsBoolean()
  active: boolean;
}

export class UpdateMembershipRoleDto {
  @ApiProperty({ example: 'roleId', required: true })
  @IsNotEmpty({ message: 'Role ID is required.' })
  @IsUUID('all', { message: 'Invalid UUID format.' })
  roleId: string;
}
