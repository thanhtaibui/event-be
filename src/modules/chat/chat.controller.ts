import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { ChatService } from './chat.service';
import {
  ChatImageAction,
  ChatImageResultDto,
  ProcessChatImageDto,
} from './dto/process-chat-image.dto';

@ApiTags('Chat')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('image/presets')
  @ApiOperation({ summary: 'Get AI image action presets for chatbox' })
  getImagePresets() {
    return this.chatService.getImagePresets();
  }

  @Post('image/process')
  @ApiOperation({
    summary: 'Create or edit image with AI, then upload result to S3',
  })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: {
          type: 'string',
          enum: Object.values(ChatImageAction),
          example: ChatImageAction.FIT_EVENT_BANNER,
        },
        prompt: {
          type: 'string',
          example:
            'Crop this image for a music event banner, keep the stage visible.',
        },
        fileNamePrefix: {
          type: 'string',
          example: 'music-event-banner',
        },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async processImage(
    @Body() dto: ProcessChatImageDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<ApiResponse<ChatImageResultDto>> {
    if (!dto.action) {
      throw new BadRequestException('Image action is required');
    }

    return this.chatService.processImage(dto, file);
  }
}
