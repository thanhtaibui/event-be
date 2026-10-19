import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';

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

  @ApiProperty({ description: 'Short-lived token returned by account lookup' })
  @IsString()
  @MaxLength(2048)
  verificationToken: string;
}
