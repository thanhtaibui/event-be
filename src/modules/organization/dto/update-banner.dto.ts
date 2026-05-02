import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUrl, IsUUID } from 'class-validator';

export class UpdateBannerDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  @ApiPropertyOptional({
    example: 'bannerUrl'
  })
  bannerUrl: string;
}