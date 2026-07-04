import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { InvitationStatus } from 'src/shared/enum/enum';

export class UpdateInviteStatusDto {
  @ApiProperty({ enum: InvitationStatus, example: InvitationStatus.ACCEPTED })
  @IsEnum(InvitationStatus, {
    message: `Status must be one of: ${Object.values(InvitationStatus).join(', ')}`,
  })
  status: InvitationStatus;
}

export class InviteStatusResDto {
  status: InvitationStatus;

  event: EventInvite;
}
class EventInvite {
  name: string;
  date: string;
  location: string;
}
