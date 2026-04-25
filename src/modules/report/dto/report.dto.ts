import { ReportStatus } from "../../../shared/enum/enum"

class UserMinInfo {
  id: string;

  fullName: string;

  email: string;
}

class OrganizationMinInfo {
  id: string;

  name: string;
}

export class ReportDto {
  user: UserMinInfo;

  organization: OrganizationMinInfo;

  reason: string;

  status: ReportStatus;

  createAt: Date;
}