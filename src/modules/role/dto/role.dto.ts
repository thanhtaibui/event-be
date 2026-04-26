// import { MembershipDto } from "src/modules/membership/dto/membership.dto";
import { OrgRoleDto } from "src/modules/organization/dto/org-role.dto";
import { PermissionDto, PermissionTreeDto } from "src/modules/permission/dto/permission.dto";

export class RoleDto {
  id: string;

  role_name: string;

  role_code: string;

  permissions: PermissionDto[];

  colorKey?: string

  org: OrgRoleDto;

}
export class RoleResDto {
  id: string;

  role_name: string;

  role_code: string;

  permissions: PermissionTreeDto[];

  colorKey?: string

  org: OrgRoleDto;

}