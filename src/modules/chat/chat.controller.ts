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
  ApiOkResponse,
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

  @Post('image/process')
  @ApiOperation({
    summary: 'Create or edit image with AI, then upload result to S3',
  })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Use multipart/form-data. Attach file for actions that require an image.',
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
    examples: {
      fitEventBanner: {
        summary: 'Fit uploaded image to event banner',
        value: {
          action: 'fit_event_banner',
          prompt:
            'Crop this image for a music event banner, keep the stage visible.',
          fileNamePrefix: 'music-event-banner',
        },
      },
      createImageFromPrompt: {
        summary: 'Create image from text prompt',
        value: {
          action: 'create_image_from_prompt',
          prompt: 'Create a Mid-Autumn festival event banner with lanterns.',
          fileNamePrefix: 'mid-autumn-banner',
        },
      },
      removeBackground: {
        summary: 'Remove background from uploaded image',
        value: {
          action: 'remove_background',
          prompt: 'Remove the background and keep the subject sharp.',
          fileNamePrefix: 'clean-subject',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Processed image uploaded to storage.',
    schema: {
      example: {
        statusCode: 200,
        message: 'Chat image processed successfully',
        data: {
          secure_url:
            'https://bucket-name.s3.ap-southeast-1.amazonaws.com/chat/images/example.png',
          public_id: 'chat/images/example.png',
          action: 'fit_event_banner',
          size: '1536x1024',
          mimeType: 'image/png',
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
