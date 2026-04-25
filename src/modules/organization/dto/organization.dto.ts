import { UserResponseDto } from "../../user/dto/users.dto"
import { EventDto } from "../../event/dto/event.dto"
import { MembershipDto } from "../../membership/dto/membership.dto"
import { OrgRequestStatus } from 'src/shared/enum/enum';

export class OrganizationDto {
  id?: string;

  name: string;

  bio: string;

  isActive: boolean;

  owner: UserResponseDto;

  memberCount?: number;

  memberships?: MembershipDto[];

  status: OrgRequestStatus;
}