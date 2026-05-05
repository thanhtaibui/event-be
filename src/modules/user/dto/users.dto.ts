import { RoleUserDto } from "src/modules/role/dto/role-user.dto";
import { Expose, Type } from 'class-transformer';

export class UserResponseDto {
  @Expose()
  id: string;
  @Expose()
  email: string;
  @Expose()
  fullName: string;
  @Expose()
  phoneNumber: string;
  @Expose()
  isActive: boolean;
  @Expose()
  @Type(() => RoleUserDto)
  role?: RoleUserDto[];

  // memberships: string;

  // orders: string;

  // reports: string;

  // feedbacks: string;

  // refreshToken: string;
}
