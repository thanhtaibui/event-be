import { OwnerResponseDto } from "./organization.dto";

export class OrganizationResDto {
  id: string;

  name: string;

  bio?: string;

  owner: OwnerResponseDto;

  slug: string;

  legalName?: string;

  industry?: string;

  email?: string;

  phone?: string;

  website?: string;

  address?: string;

  bannerUrl?: string;

  logoUrl?: string;
}
