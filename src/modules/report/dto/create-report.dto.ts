import { IsString, IsNotEmpty, IsEnum, ValidateNested, IsObject } from 'class-validator';
import { ReportStatus } from "../../../shared/enum/enum";
import { ApiProperty } from '@nestjs/swagger';
export class CreateReportDto {
  @IsNotEmpty({ message: 'User ID is required' })
  @ApiProperty({ example: "userId" })
  @IsString()
  userId: string;

  @IsNotEmpty({ message: 'Organization ID is required' })
  @ApiProperty({ example: "organizationId" })
  @IsString()
  organizationId: string;

  @IsString({ message: 'Reason must be a string' })
  @IsNotEmpty({ message: 'Reason cannot be empty' })
  @ApiProperty({ example: "Inappropriate content" })
  reason: string;

  @IsEnum(ReportStatus)
  @ApiProperty({ example: "pending" })
  status: ReportStatus;
}