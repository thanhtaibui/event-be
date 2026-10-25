import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateOrgVerificationDto {
  @ApiProperty({
    example: 'b46ed74d-4a79-40a7-a2a1-723be34d951b',
    description: 'Organization cần gửi xác thực',
  })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({
    example: '0312345678',
    description: 'Mã số thuế hoặc số giấy phép đăng ký kinh doanh',
  })
  @IsString()
  @IsNotEmpty()
  taxIdNumber: string;

  @ApiProperty({
    example: 'org-verification/b46ed74d-4a79-40a7-a2a1-723be34d951b/uuid.pdf',
    description: 'Private R2 documentKey returned by the upload API',
  })
  @IsString()
  @IsNotEmpty()
  documentKey: string;
}
