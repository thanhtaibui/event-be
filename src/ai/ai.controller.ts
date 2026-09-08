import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { AiChatDto, AiChatResponseDto } from './dto/ai-chat.dto';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
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
          message: 'Tạo ý tưởng khai trương cửa hàng điện thoại',
        },
      },
      eventCopy: {
        summary: 'Ask for event description',
        value: {
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
        message:
          'Bạn có thể tổ chức concept khai trương công nghệ với khu trải nghiệm sản phẩm...',
      },
    },
  })
  async chat(@Body() dto: AiChatDto): Promise<AiChatResponseDto> {
    return this.aiService.chat(dto.message);
  }
}
