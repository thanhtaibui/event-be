import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export enum AiChatMode {
  CHAT = 'chat',
  IMAGE_PROMPT_BUILDER = 'image_prompt_builder',
}

export class AiChatDto {
  @ApiProperty({
    example: 'Tạo ý tưởng khai trương cửa hàng điện thoại',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  message: string;

  @ApiProperty({
    enum: AiChatMode,
    required: false,
    default: AiChatMode.CHAT,
    example: AiChatMode.CHAT,
    description:
      'chat for normal assistant replies, image_prompt_builder for event image prompt generation.',
  })
  @IsOptional()
  @IsEnum(AiChatMode)
  mode?: AiChatMode;
}

export class AiChatResponseDto {
  type: 'text';
  message: string;
  mode?: 'chat' | 'image_prompt_ready' | 'need_more_information';
  language?: 'vi' | 'en';
  summary?: {
    eventName?: string;
    organization?: string;
    theme?: string;
    audience?: string;
    style?: string;
    colors?: string;
  };
  imagePrompt?: string;
  negativePrompt?: string;
  canUseForCreate?: boolean;
  questions?: string[];
  missingFields?: string[];
  actions?: Array<'COPY_PROMPT' | 'USE_IN_CREATE'>;
}
