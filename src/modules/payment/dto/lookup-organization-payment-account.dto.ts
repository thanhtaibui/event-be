import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class LookupOrganizationPaymentAccountDto {
  @ApiProperty({ example: '970415', description: 'VietinBank BIN' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^\d{6}$/)
  bankBin: string;

  @ApiProperty({ example: '10087387466' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^\d{6,19}$/)
  accountNumber: string;

  @ApiPropertyOptional({
    example: 'NGUYEN VAN A',
    description: 'Tên chủ tài khoản; giữ để tương thích client cũ',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  accountName?: string;

  @ApiPropertyOptional({
    example: 'NGUYEN VAN A',
    description: 'Tên chủ tài khoản do Organization Owner nhập',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  accountHolderName?: string;
}
