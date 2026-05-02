import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsUUID } from "class-validator";

export class DeleteSort {
  @ApiProperty({
    example: ['id', 'id'],
  })
  @IsArray()
  @IsUUID("4", { each: true })
  ids: string[];
}