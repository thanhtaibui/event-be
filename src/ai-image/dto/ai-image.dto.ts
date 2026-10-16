import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum ImageEnhanceAction {
  REMOVE_BACKGROUND = 'remove_background',
  UPSCALE = 'upscale',
  CROP = 'crop',
  RESIZE = 'resize',
  ROTATE = 'rotate',
  COMPRESS = 'compress',
  CONVERT = 'convert',
}

export const IMAGE_RATIOS = ['1:1', '16:9', '9:16'] as const;
export const IMAGE_OUTPUT_FORMATS = ['png', 'jpeg', 'webp'] as const;

export class GenerateImageDto {
  @ApiPropertyOptional({
    example:
      'Create a professional wide banner for Green Future Agriculture Expo 2026...',
    description:
      'Final render-ready prompt. Sent directly to the image provider when within its limit.',
  })
  @IsString()
  @MaxLength(10000)
  @IsOptional()
  prompt?: string;

  @ApiPropertyOptional({
    example:
      'Tạo poster khai trương cửa hàng điện thoại phong cách điện máy Việt Nam',
    description: 'Legacy alias accepted for existing Create Image clients.',
  })
  @IsString()
  @MaxLength(10000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: 'no watermark, no random text',
    description:
      'Optional restrictions; merged into the provider prompt because FLUX accepts a single prompt field.',
  })
  @IsString()
  @MaxLength(3000)
  @IsOptional()
  negativePrompt?: string;

  @ApiPropertyOptional({
    enum: IMAGE_RATIOS,
    example: '16:9',
  })
  @IsIn(IMAGE_RATIOS)
  @IsOptional()
  ratio?: string;
}

export class EditImageDto {
  @ApiPropertyOptional({
    example:
      'https://event-management-uploads.s3.ap-southeast-1.amazonaws.com/ai/images/iphone.jpg',
    description:
      'Public HTTP/HTTPS image URL. Use either imageUrl or imageData.',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...',
    description:
      'Data URL or base64 image data from a generated image preview. Use either imageUrl or imageData.',
  })
  @IsString()
  @MaxLength(20_000_000)
  @IsOptional()
  imageData?: string;

  @ApiPropertyOptional({
    example: 'Đổi nền thành showroom, thêm chữ SALE 9.9, giữ nguyên sản phẩm',
  })
  @IsString()
  @MaxLength(3000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: 'make it simpler',
    description: 'Alias for description. Kept for generated image edit flow.',
  })
  @IsString()
  @MaxLength(3000)
  @IsOptional()
  prompt?: string;

  @ApiPropertyOptional({
    enum: IMAGE_RATIOS,
    example: '16:9',
  })
  @IsIn(IMAGE_RATIOS)
  @IsOptional()
  ratio?: string;

  @ApiPropertyOptional({
    example:
      'https://event-be.onrender.com/tmp/ai-images/ai-mask-1710000000000.png',
    description: 'When supplied, edit uses inpainting instead of img2img.',
  })
  @IsUrl({ require_tld: false })
  @IsOptional()
  maskImageUrl?: string;

  @ApiPropertyOptional({
    example: 0.65,
    description: 'Optional img2img strength from 0.1 to 1.',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(1)
  @IsOptional()
  strength?: number;
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

  @ApiPropertyOptional({
    example: 2,
    description: 'Upscale factor. Supported: 2 or 4.',
  })
  @Type(() => Number)
  @IsIn([2, 4])
  @IsOptional()
  factor?: 2 | 4;

  @ApiPropertyOptional({ enum: IMAGE_RATIOS, example: '1:1' })
  @IsIn(IMAGE_RATIOS)
  @IsOptional()
  ratio?: string;

  @ApiPropertyOptional({ example: 1024 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4096)
  @IsOptional()
  width?: number;

  @ApiPropertyOptional({ example: 1024 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4096)
  @IsOptional()
  height?: number;

  @ApiPropertyOptional({ example: 90 })
  @Type(() => Number)
  @IsNumber()
  @Min(-360)
  @Max(360)
  @IsOptional()
  angle?: number;

  @ApiPropertyOptional({ example: 82 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  quality?: number;

  @ApiPropertyOptional({ enum: IMAGE_OUTPUT_FORMATS, example: 'webp' })
  @IsIn(IMAGE_OUTPUT_FORMATS)
  @IsOptional()
  format?: 'png' | 'jpeg' | 'webp';
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
