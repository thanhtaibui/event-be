import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

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
    example: 'https://res.cloudinary.com/demo/image/upload/license.jpg',
    description: 'Link giấy phép kinh doanh hoặc giấy tờ xác minh hợp lệ',
  })
  @IsUrl()
  @IsNotEmpty()
  documentUrl: string;
}
