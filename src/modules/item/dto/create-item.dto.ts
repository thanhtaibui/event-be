import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsUUID, Min } from 'class-validator';

export class CreateItemDto {
  @ApiProperty({ example: 'Name' })
  @IsString()
  name: string;

  @ApiProperty({ example: "img" })
  @IsString()
  imageUrl: string;

  @ApiProperty({ example: 100000 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: 'uuid' })
  @IsUUID()
  eventId: string;
}