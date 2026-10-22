import { OwnerResponseDto } from './organization.dto';
import { OrganizationStatus } from 'src/shared/enum/enum';

export class OrganizationStatsDto {
  totalMembers: number;

  totalEvents: number;
}

export class OrganizationResDto {
  id: string;

  name: string;

  bio?: string;

  owner: OwnerResponseDto | null;

  slug: string;

  status?: OrganizationStatus;

  isVerified: boolean;

  legalName?: string;

  industry?: string;

  email?: string;

  phone?: string;

  website?: string;

  address?: string;

  bannerUrl?: string;

  logoUrl?: string;

  stats?: OrganizationStatsDto;
}
