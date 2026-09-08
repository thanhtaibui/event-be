import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @ApiOperation({ operationId: 'aiChat' })
  @ApiBody({
    description: 'Send a text message to Hugging Face chat model.',
    schema: {
      type: 'object',
      required: ['message'],
      properties: {
        message: {
          type: 'string',
          example: 'Tạo ý tưởng poster trung thu cho sự kiện âm nhạc',
        },
      },
    },
    examples: {
      posterIdea: {
        summary: 'Ask for poster idea',
        value: {
          message: 'Gợi ý nội dung poster trung thu cho sự kiện âm nhạc',
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
    description: 'Chat reply from Hugging Face.',
    schema: {
      example: {
        reply:
          'Bạn có thể dùng concept đêm trăng, lồng đèn và sân khấu âm nhạc...',
      },
    },
  })
  async chat(@Body('message') message: string): Promise<{ reply: string }> {
    return {
      reply: await this.aiService.chat(message),
    };
  }
}
