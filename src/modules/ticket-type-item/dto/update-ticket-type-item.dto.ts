import { PartialType } from '@nestjs/swagger';
import { CreateTicketTypeItemDto } from './create-ticket-type-item.dto';

export class UpdateTicketTypeItemDto extends PartialType(
  CreateTicketTypeItemDto,
) {}
