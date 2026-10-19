import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class UpsertOrganizationPaymentAccountDto {
  @ApiProperty({
    example: '970422',
    description: 'BIN ngân hàng NAPAS gồm 6 chữ số',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^\d{6}$/)
  bankBin: string;

  @ApiProperty({ example: 'MBBank' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Bank name must not be blank' })
  @MaxLength(100)
  bankName: string;

  @ApiProperty({ example: 'NGUYEN VAN A' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Account name must not be blank' })
  @MaxLength(100)
  accountName: string;

  @ApiProperty({ example: '0123456789' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^\d{6,19}$/)
  accountNumber: string;
}
