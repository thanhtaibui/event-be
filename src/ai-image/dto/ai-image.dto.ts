import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export enum ImageEnhanceAction {
  REMOVE_BACKGROUND = 'remove_background',
  UPSCALE = 'upscale',
}

export const IMAGE_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16'] as const;

export class GenerateImageDto {
  @ApiProperty({
    example: 'Tạo poster khai trương cửa hàng điện thoại phong cách điện máy Việt Nam',
  })
  @IsString()
  @MaxLength(3000)
  description: string;

  @ApiPropertyOptional({
    enum: IMAGE_RATIOS,
    example: '16:9',
  })
  @IsIn(IMAGE_RATIOS)
  @IsOptional()
  ratio?: string;
}

export class EditImageDto {
  @ApiProperty({
    example:
      'https://event-management-uploads.s3.ap-southeast-1.amazonaws.com/ai/images/iphone.jpg',
  })
  @IsUrl({ require_tld: false })
  imageUrl: string;

  @ApiProperty({
    example: 'Đổi nền thành showroom, thêm chữ SALE 9.9, giữ nguyên sản phẩm',
  })
  @IsString()
  @MaxLength(3000)
  description: string;

  @ApiPropertyOptional({
    enum: IMAGE_RATIOS,
    example: '16:9',
  })
  @IsIn(IMAGE_RATIOS)
  @IsOptional()
  ratio?: string;
}

export class EnhanceImageDto {
  @ApiProperty({
    example:
      'https://event-management-uploads.s3.ap-southeast-1.amazonaws.com/ai/images/product.png',
  })
  @IsUrl({ require_tld: false })
  imageUrl: string;

  @ApiProperty({
    enum: ImageEnhanceAction,
    example: ImageEnhanceAction.REMOVE_BACKGROUND,
  })
  @IsIn(Object.values(ImageEnhanceAction))
  action: ImageEnhanceAction;
}

export class SaveImageDto {
  @ApiProperty({
    example:
      'https://event-be.onrender.com/tmp/ai-images/ai-generated-image-1710000000000.png',
  })
  @IsString()
  imageUrl: string;
}

export class ImageResponseDto {
  imageUrl: string;
  status: 'preview' | 'saved';
}
