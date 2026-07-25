import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({ example: 'uuid-user' })
  @IsUUID('4', { message: 'User ID must be a valid UUID' })
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;

  @ApiProperty({ example: 'uuid-ticket-type' })
  @IsUUID('4', { message: 'Ticket type ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Ticket type ID is required' })
  ticketTypeId: string;
}
