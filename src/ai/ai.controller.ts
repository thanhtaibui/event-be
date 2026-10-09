import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AiService } from './ai.service';
import { AiChatDto, AiChatMode, AiChatResponseDto } from './dto/ai-chat.dto';
import {
  AiAuthenticatedUser,
  OptionalJwtGuard,
} from './optional-jwt.guard';

type AiRequest = Request & {
  user?: AiAuthenticatedUser;
};

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({
    operationId: 'aiChat',
    summary: 'Chat with Event AI Assistant',
  })
  @ApiBody({
    type: AiChatDto,
    examples: {
      eventIdea: {
        summary: 'Ask for event idea',
        value: {
          mode: AiChatMode.CHAT,
          message: 'Tạo ý tưởng khai trương cửa hàng điện thoại',
        },
      },
      currentUser: {
        summary: 'Ask from authenticated context',
        value: {
          mode: AiChatMode.CHAT,
          message: 'Who am I?',
        },
      },
      imagePromptBuilder: {
        summary: 'Build an event image prompt',
        value: {
          mode: AiChatMode.IMAGE_PROMPT_BUILDER,
          message: 'I want to create an event banner',
        },
      },
      eventCopy: {
        summary: 'Ask for event description',
        value: {
          mode: AiChatMode.CHAT,
          message: 'Viết mô tả ngắn cho sự kiện workshop AI cuối tuần',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Chat reply from AI provider.',
    schema: {
      example: {
        type: 'text',
        mode: 'chat',
        language: 'vi',
        content:
          'Bạn có thể tổ chức concept khai trương công nghệ với khu trải nghiệm sản phẩm...',
        message:
          'Bạn có thể tổ chức concept khai trương công nghệ với khu trải nghiệm sản phẩm...',
      },
    },
  })
  async chat(
    @Body() dto: AiChatDto,
    @Req() request: AiRequest,
  ): Promise<AiChatResponseDto> {
    return this.aiService.chat(dto.message, dto.mode, request.user, dto.history);
  }
}
