import { OrgRoleDto } from 'src/modules/organization/dto/org-role.dto';
// import { TicketTypeDto } from "src/modules/ticket-type/dto/ticket-type.dto";
import { EventStatus } from 'src/shared/enum/enum';
import { Expose, Type } from 'class-transformer';

export class EventDto {
  @Expose()
  id: string;

  @Expose()
  title: string;

  @Expose()
  eventPoster: string;

  @Expose()
  eventBanner: string;

  @Expose()
  description: string;

  @Expose()
  place: string;

  @Expose()
  @Type(() => Date)
  startDateTime: Date;

  @Expose()
  @Type(() => Date)
  endDateTime: Date;

  @Expose()
  @Type(() => Date)
  registrationEndDate: Date;

  @Expose()
  capacity: number;

  @Expose()
  soldTickets?: number;

  // isPublic: boolean;
  @Expose()
  status: EventStatus;

  @Expose()
  @Type(() => OrgRoleDto)
  organization: OrgRoleDto;

  @Expose()
  @Type(() => OrgRoleDto)
  categories: OrgRoleDto[];

  // ticketTypes: TicketTypeDto[];
}
