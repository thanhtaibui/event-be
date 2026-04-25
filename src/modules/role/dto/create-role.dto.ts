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

  @IsArray()
  @ArrayNotEmpty()
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