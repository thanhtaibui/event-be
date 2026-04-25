import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsUUID } from "class-validator";

export class CreateMembershipDto {
  // @IsOptional()
  // // @ApiProperty({ example: "userId", required: false })
  // @IsUUID('all', { message: 'Invalid  UUID format.' })
  // userId: string;

  @IsNotEmpty({ message: 'Role ID is required.' })
  @IsUUID('all', { message: 'Invalid  UUID format.' })
  @ApiProperty({ example: "roleId", required: false })
  roleId: string;

  @IsNotEmpty({ message: 'Organization ID is required.' })
  @IsUUID('all', { message: 'Invalid  UUID format.' })
  @ApiProperty({ example: "OrgId", required: true })
  orgId: string;

}
