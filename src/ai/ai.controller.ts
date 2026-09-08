import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @ApiOperation({ operationId: 'aiChat' })
  @ApiBody({
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
  })
  async chat(@Body('message') message: string): Promise<{ reply: string }> {
    return {
      reply: await this.aiService.chat(message),
    };
  }
}
