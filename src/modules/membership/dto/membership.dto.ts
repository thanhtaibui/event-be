// import { RoleDto } from "../../role/dto/role.dto";
export class MembershipDto {
  userId: string;

  organizationId: string;

  roleId: string;

  isActive: boolean;
}

export class OrganizationMembershipDto {
  id: string;

  userId: string;

  createdAt: Date;

  userName: string;

  email: string;

  isActive: boolean;

  role: string | null;
}
