import { OrgRoleDto } from "src/modules/organization/dto/org-role.dto";
// import { TicketTypeDto } from "src/modules/ticket-type/dto/ticket-type.dto";
import { EventStatus } from "src/shared/enum/enum";

export class EventDto {

  title: string;

  eventPoster: string;

  // description: string

  // place: string;

  startDateTime: Date;

  endDateTime: Date;

  registrationEndDate: Date;

  capacity: number;

  soldTickets?: number;
  // isPublic: boolean;

  status: EventStatus;

  organization: OrgRoleDto;

  // ticketTypes: TicketTypeDto[];

}