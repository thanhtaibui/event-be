import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateTicketTypeDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Standard Ticket' })
  name: string;

  @IsNumber()
  @Min(0)
  @ApiProperty({ example: 50.0 })
  price: number;

  @IsNumber()
  @Min(1)
  @ApiProperty({ example: 100 })
  quantity: number;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'uuid' })
  eventId: string;
}
