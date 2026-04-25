// import { MembershipDto } from "src/modules/membership/dto/membership.dto";
import { PermissionDto } from "src/modules/permission/dto/permission.dto";

export class RoleDto {
  id: string;

  role_name: string;

  role_code: string;

  permissions: PermissionDto[];

  colorKey?: string

  orgName: string;

}