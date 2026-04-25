import { RoleUserDto } from "src/modules/role/dto/role-user.dto";

export class UserResponseDto {
  id: string;

  email: string;

  fullName: string;

  phoneNumber: string;

  isActive: boolean;

  role?: RoleUserDto[];

  // memberships: string;

  // orders: string;

  // reports: string;

  // feedbacks: string;

  // refreshToken: string;
}
