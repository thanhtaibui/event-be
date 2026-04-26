import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString, ArrayNotEmpty, IsUUID } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @ApiProperty({ example: "Staff" })
  @IsNotEmpty()
  role_name: string;

  @IsString()
  @ApiProperty({ example: "STAFF" })
  @IsNotEmpty()
  role_code: string;

  @IsArray({ message: 'Permissions must be an array' })
  @ArrayNotEmpty({ message: 'Permission list cannot be empty' })
  @IsString({ each: true, message: 'Each permission ID must be a string' })
  @ApiProperty({ example: ["uuid", "uuid"] })
  permissionIds: string[];

  @IsString()
  @ApiProperty({ example: "green" })
  @IsNotEmpty()
  colorKey: string;

  @IsUUID()
  @ApiProperty({ example: "uuid" })
  @IsNotEmpty()
  orgId: string;
}