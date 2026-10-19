import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

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
}
