import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { ChatService } from './chat.service';

@ApiTags('Chat')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('image/presets')
  @ApiOperation({ summary: 'Get AI image action presets for chatbox' })
  @ApiOkResponse({
    description: 'List image actions supported by chatbox.',
    schema: {
      example: {
        statusCode: 200,
        message: 'Get chat image presets successfully',
        data: [
          {
            label: 'Fit event banner',
            action: 'fit_event_banner',
            size: '1536x1024',
            requiresImage: true,
            background: 'opaque',
            defaultPrompt:
              'Transform this image into a clean horizontal event banner...',
          },
          {
            label: 'Create image from prompt',
            action: 'create_image_from_prompt',
            size: '1536x1024',
            requiresImage: false,
            background: 'opaque',
            defaultPrompt:
              'Create a polished horizontal event banner image suitable for an event listing page.',
          },
        ],
      },
    },
  })
  getImagePresets() {
    return this.chatService.getImagePresets();
  }
}
