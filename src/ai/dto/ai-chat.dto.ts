import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export enum AiChatMode {
  CHAT = 'chat',
  IMAGE_PROMPT_BUILDER = 'image_prompt_builder',
}

export class AiChatHistoryMessageDto {
  @ApiProperty({
    enum: ['system', 'user', 'assistant'],
    example: 'user',
  })
  @IsString()
  @IsIn(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant';

  @ApiProperty({
    example: 'xin chào',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  content: string;
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

  @ApiProperty({
    required: false,
    type: [AiChatHistoryMessageDto],
    description:
      'Optional chat history. Backend sanitizes and keeps only the last 10 valid messages.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiChatHistoryMessageDto)
  history?: AiChatHistoryMessageDto[];
}

export class AiChatResponseDto {
  type: 'text';
  message: string;
  content?: string;
  mode?: 'chat' | 'image_prompt_ready' | 'need_more_information';
  locale?: 'vi' | 'en';
  language?: 'vi' | 'en';
  summary?: {
    eventName?: string;
    organization?: string;
    theme?: string;
    audience?: string;
    style?: string;
    colors?: string;
  };
  prompt?: string;
  imagePrompt?: string;
  negativePrompt?: string;
  display?: {
    summaryTitle: string;
    promptTitle: string;
    negativePromptTitle: string;
    hint: string;
  };
  canUseForCreate?: boolean;
  questions?: string[];
  missingFields?: string[];
  actions?: Array<'COPY_PROMPT' | 'USE_IN_CREATE'>;
}
