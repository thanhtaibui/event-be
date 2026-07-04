import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { VerificationStatus } from 'src/shared/enum/enum';

export class UpdateOrgVerificationDto {
  @ApiProperty({
    enum: [VerificationStatus.APPROVED, VerificationStatus.REJECTED],
    example: VerificationStatus.APPROVED,
    description: 'Super admin duyệt hoặc từ chối yêu cầu xác thực',
  })
  @IsEnum(VerificationStatus)
  status: VerificationStatus.APPROVED | VerificationStatus.REJECTED;

  @ApiProperty({
    example: 'Thông tin hợp lệ',
    required: false,
    description: 'Ghi chú của admin, bắt buộc nên nhập khi từ chối',
  })
  @IsString()
  @IsOptional()
  adminNote?: string;
}
