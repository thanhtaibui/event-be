import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpsertOrganizationPaymentAccountDto {
  @ApiProperty({
    example: '970422',
    description: 'BIN ngân hàng NAPAS gồm 6 chữ số',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^\d{6}$/)
  bankBin: string;

  @ApiProperty({ example: '10087387466' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^\d{6,19}$/)
  accountNumber: string;

  @ApiProperty({
    example: 'NGUYEN VAN A',
    description: 'Tên chủ tài khoản để Backend đối chiếu với kết quả VietQR',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  accountName: string;

  @ApiPropertyOptional({
    description:
      'Legacy compatibility only. Save always performs a fresh server-side lookup.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  verificationToken?: string;
}
