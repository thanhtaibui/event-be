import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ChatImageAction {
  FIT_EVENT_BANNER = 'fit_event_banner',
  FIT_EVENT_POSTER = 'fit_event_poster',
  FIT_ORGANIZATION_LOGO = 'fit_organization_logo',
  UPSCALE_IMAGE = 'upscale_image',
  REMOVE_BACKGROUND = 'remove_background',
  CREATE_IMAGE_FROM_PROMPT = 'create_image_from_prompt',
}

export class ProcessChatImageDto {
  @ApiProperty({
    enum: ChatImageAction,
    example: ChatImageAction.FIT_EVENT_BANNER,
  })
  @IsEnum(ChatImageAction)
  action: ChatImageAction;

  @ApiPropertyOptional({
    example:
      'Make this image suitable for an event banner, keep the main subject visible.',
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

export class ChatImageResultDto {
  secure_url: string;
  public_id: string;
  action: ChatImageAction;
  size: string;
  mimeType: string;
}
