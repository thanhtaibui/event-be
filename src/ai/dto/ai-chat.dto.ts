import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  IsUrl,
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

export class AiImageContextDto {
  @ApiPropertyOptional({
    example:
      'https://event-be.onrender.com/tmp/ai-images/ai-generated-image.png',
    description:
      'Latest image preview URL. Send the most recent generated/edit result for follow-up edits.',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  currentImageUrl?: string;

  @ApiPropertyOptional({ example: 'EVENT_BANNER' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  imageType?: string;

  @ApiPropertyOptional({ example: 'Professional wide banner in neon style...' })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  currentPrompt?: string;

  @ApiPropertyOptional({ enum: ['1:1', '16:9', '9:16'], example: '16:9' })
  @IsOptional()
  @IsIn(['1:1', '16:9', '9:16'])
  ratio?: string;
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

  @ApiPropertyOptional({ type: AiImageContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AiImageContextDto)
  imageContext?: AiImageContextDto;
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
    | 'image_type_selecting'
    | 'image_action_clarifying'
    | 'image_edit_context_required'
    | 'image_edit_ready'
    | 'image_edit_completed'
    | 'image_edit_authentication_required';
  intent?: 'CREATE' | 'EDIT' | 'CLARIFY';
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
  sourceImageUrl?: string;
  editInstruction?: string;
  imageResult?: {
    imageUrl: string;
    status: 'preview' | 'saved';
  };
}
