import { Expose } from 'class-transformer';

export class TicketTypeDto {
  @Expose()
  id: string;

  @Expose()
  name: string; // VIP, STANDARD

  @Expose()
  price: number;

  @Expose()
  quantity: number;

  event: Event;

  // tickets: Ticket[];

  // order: string;
}
