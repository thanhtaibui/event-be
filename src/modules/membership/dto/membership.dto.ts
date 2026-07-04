// import { RoleDto } from "../../role/dto/role.dto";
export class MembershipDto {
  userId: string;

  organizationId: string;

  roleId: string;

  isActive: boolean;
}

export class OrganizationMembershipDto {
  createdAt: Date;

  userName: string;

  isActive: boolean;

  role: string | null;
}
