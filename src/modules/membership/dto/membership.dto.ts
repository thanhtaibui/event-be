import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

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

export class LookupMembershipUserQueryDto {
  @ApiProperty({ example: 'user@email.com' })
  @IsNotEmpty({ message: 'Email is required.' })
  @IsEmail({}, { message: 'Invalid email format.' })
  email: string;
}

export class LookupMembershipUserDto {
  id: string;

  email: string;

  name: string;
}
