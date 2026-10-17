import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class UpsertOrganizationPaymentAccountDto {
  @ApiProperty({
    example: '970422',
    description: 'BIN ngân hàng NAPAS gồm 6 chữ số',
  })
  @IsString()
  @Matches(/^\d{6}$/)
  bankBin: string;

  @ApiProperty({ example: 'MBBank' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  bankName: string;

  @ApiProperty({ example: 'NGUYEN VAN A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  accountName: string;

  @ApiProperty({ example: '0123456789' })
  @IsString()
  @Matches(/^\d{6,19}$/)
  accountNumber: string;
}
