import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AiChatDto {
  @ApiProperty({
    example: 'Tạo ý tưởng khai trương cửa hàng điện thoại',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  message: string;
}

export class AiChatResponseDto {
  type: 'text';
  message: string;
  mode?: 'chat' | 'image_prompt_ready' | 'need_more_information';
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
}
