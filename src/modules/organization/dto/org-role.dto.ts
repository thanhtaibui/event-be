import { Expose } from "class-transformer";

export class OrgRoleDto {
  @Expose()
  id: string;
  @Expose()
  name: string;

}