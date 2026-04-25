import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsUUID, MaxLength } from "class-validator";

export class CreateOrganizationDto {
  @IsNotEmpty()
  @ApiProperty({ description: 'Cty' })
  @MaxLength(255)
  name: string;

  @IsOptional()
  @ApiProperty({ description: 'bio' })
  @MaxLength(500)
  bio?: string;

  @IsNotEmpty()
  @IsUUID()
  @ApiProperty({ description: 'uuid' })
  ownerId: string;
}
