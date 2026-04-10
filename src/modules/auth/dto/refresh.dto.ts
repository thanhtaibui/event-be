import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class RefreshTokenDto {
  @IsNotEmpty()
  refreshToken: string;
}