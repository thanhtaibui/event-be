import { Expose, Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { OrganizationStatus } from 'src/shared/enum/enum';

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
  isVerified: boolean;

  @Expose()
  status: OrganizationStatus;

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

export class OrganizationMembersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
