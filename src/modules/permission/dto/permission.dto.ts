
export class PermissionDto {

  permission_code: string;

  permission_name: string;

  children?: PermissionDto[];

  isAll?: boolean;
}
export class PermissionTreeDto {

  id: string;

  permission_name: string;

  children?: PermissionTreeDto[];

}