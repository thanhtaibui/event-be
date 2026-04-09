import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class RefreshTokenDto {
  @IsNotEmpty()
  @ApiProperty({ example: 'refreshToken' })
  refreshToken: string;
}