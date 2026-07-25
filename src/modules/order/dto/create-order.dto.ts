import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @ApiProperty({ example: 'uuid-ticket-type' })
  @IsUUID('4', { message: 'Ticket type ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Ticket type ID is required' })
  ticketTypeId: string;

  @ApiProperty({ example: 2 })
  @IsInt({ message: 'Quantity must be an integer' })
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'uuid-user' })
  @IsUUID('4', { message: 'User ID must be a valid UUID' })
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray({ message: 'Items must be an array' })
  @ArrayMinSize(1, { message: 'Order must have at least one item' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
