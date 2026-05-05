import { Expose, Type } from 'class-transformer';
import { OrgRequestStatus } from 'src/shared/enum/enum';

export class OwnerResponseDto {
  @Expose()
  id: string;

  @Expose()
  fullName: string;

  @Expose()
  email: string;
}

export class OrganizationDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  bio: string | null;

  @Expose()
  slug: string;

  @Expose()
  isActive: boolean;

  @Expose()
  status: OrgRequestStatus;

  @Expose()
  createdAt: Date;

  @Expose()
  @Type(() => OwnerResponseDto)
  owner: OwnerResponseDto | null;

  @Expose()
  totalMembers: number;

  @Expose()
  totalEvents?: number;
}