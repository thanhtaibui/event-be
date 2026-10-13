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
  mode?:
    | 'chat'
    | 'image_prompt_ready'
    | 'need_more_information'
    | 'image_prompt_collecting'
    | 'image_type_selecting';
  locale?: 'vi' | 'en';
  language?: 'vi' | 'en';
  imageIntent?: 'EVENT_BANNER' | 'ORG_COVER' | 'SQUARE_POST' | 'POSTER_STORY';
  summary?: Record<string, string | undefined>;
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
  options?: Array<{
    label: string;
    value: 'EVENT_BANNER' | 'ORG_COVER' | 'SQUARE_POST' | 'POSTER_STORY';
  }>;
  actions?: Array<'COPY_PROMPT' | 'USE_IN_CREATE'>;
}
