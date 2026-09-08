import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export enum AiImageAction {
  ANALYZE = 'analyze',
  REMOVE_BACKGROUND = 'remove_background',
  UPSCALE = 'upscale',
  GENERATE = 'generate',
  EDIT_IMAGE = 'edit_image',
  CREATE_BANNER = 'create_banner',
  CREATE_POSTER = 'create_poster',
  FIT_EVENT_BANNER = 'fit_event_banner',
  FIT_EVENT_POSTER = 'fit_event_poster',
  FIT_ORGANIZATION_LOGO = 'fit_organization_logo',
  UPSCALE_IMAGE = 'upscale_image',
  CREATE_IMAGE_FROM_PROMPT = 'create_image_from_prompt',
}

export const AI_IMAGE_ACTIONS = Object.values(AiImageAction);

export class AnalyzeImageDto {
  @ApiProperty({
    example:
      'https://event-management-uploads.s3.ap-southeast-1.amazonaws.com/chat/images/product.png',
  })
  @IsUrl({ require_tld: false })
  imageUrl: string;

  @ApiPropertyOptional({
    example: 'Phân tích ảnh này để tạo banner sự kiện.',
  })
  @IsString()
  @MaxLength(1500)
  @IsOptional()
  message?: string;
}

export class ImageUrlDto {
  @ApiProperty({
    example:
      'https://event-management-uploads.s3.ap-southeast-1.amazonaws.com/chat/images/product.png',
  })
  @IsUrl({ require_tld: false })
  imageUrl: string;
}

export class ProcessAiImageDto {
  @ApiProperty({
    enum: AI_IMAGE_ACTIONS,
    example: AiImageAction.REMOVE_BACKGROUND,
  })
  @IsString()
  @IsIn(AI_IMAGE_ACTIONS)
  action: AiImageAction;

  @ApiPropertyOptional({
    example:
      'https://event-management-uploads.s3.ap-southeast-1.amazonaws.com/chat/images/product.png',
  })
  @IsUrl({ require_tld: false })
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({
    example: 'Tạo banner ngang phong cách hiện đại cho sự kiện âm nhạc.',
  })
  @IsString()
  @MaxLength(1500)
  @IsOptional()
  prompt?: string;

  @ApiPropertyOptional({
    example: 'event-banner',
    description: 'Optional custom file name prefix for S3.',
  })
  @IsString()
  @MaxLength(80)
  @IsOptional()
  fileNamePrefix?: string;
}

export class AnalyzeImageResponseDto {
  description: string;
  product: string;
  style: string;
  prompt: string;
  suggestedAction: string;
}

export class AiImageResultDto {
  resultImageUrl: string;
  public_id?: string;
  action?: string;
  mimeType?: string;
}
