import { UserResponseDto } from "../../user/dto/users.dto"
import { EventDto } from "../../event/dto/event.dto"
import { MembershipDto } from "../../membership/dto/membership.dto"
import { OrgRequestStatus } from 'src/shared/enum/enum';

export class OrganizationDto {
  id: string;

  name: string;

  bio: string | null;

  slug: string;

  isActive: boolean;

  status: OrgRequestStatus;

  createdAt: Date;

  owner: OwnerResponseDto | null;

  totalMembers: number;

  totalEvents?: number;
}
export class OwnerResponseDto {

  id: string;

  fullName: string;

  email: string;
}