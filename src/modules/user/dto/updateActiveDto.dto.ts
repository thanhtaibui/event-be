import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateActiveDto {
  @ApiProperty({
    example: true,
    description: 'active'
  })
  @IsBoolean()
  active: boolean;
}