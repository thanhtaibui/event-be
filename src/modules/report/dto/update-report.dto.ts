import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { OrgRequestStatus, ReportStatus } from 'src/shared/enum/enum';

export class UpdateReportDto {
  @ApiProperty({
    enum: ReportStatus,
    example: ReportStatus.RESOLVED,
    required: false,
  })
  @IsEnum(ReportStatus)
  @IsOptional()
  status?: ReportStatus;

  @ApiProperty({
    enum: OrgRequestStatus,
    example: OrgRequestStatus.SUSPENDED,
    required: false,
    description: 'Không gửi field này nếu muốn giữ nguyên trạng thái organization',
  })
  @IsEnum(OrgRequestStatus)
  @IsOptional()
  organizationStatus?: OrgRequestStatus;
}
