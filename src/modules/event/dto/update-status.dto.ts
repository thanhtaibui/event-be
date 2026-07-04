import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EventStatus } from 'src/shared/enum/enum';

export class UpdateStatusDto {
  @ApiProperty({
    example: true,
    description: 'status',
    enum: EventStatus,
  })
  @IsEnum(EventStatus)
  status: EventStatus;
}
