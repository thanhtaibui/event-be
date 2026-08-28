import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { OrganizationStatus, ReportStatus } from 'src/shared/enum/enum';

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
    enum: OrganizationStatus,
    example: OrganizationStatus.SUSPENDED,
    required: false,
    description: 'Không gửi field này nếu muốn giữ nguyên trạng thái organization',
  })
  @IsEnum(OrganizationStatus)
  @IsOptional()
  organizationStatus?: OrganizationStatus;
}
