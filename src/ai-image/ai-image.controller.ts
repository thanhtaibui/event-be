import {
  BadRequestException,
  Body,
  Controller,
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
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { Response } from 'src/common/utils/ApiResponse';
import { AiImageService } from './ai-image.service';
import {
  AiImageAction,
  AI_IMAGE_ACTIONS,
  AnalyzeImageDto,
  ImageUrlDto,
  ProcessAiImageDto,
} from './dto/ai-image.dto';

@ApiTags('AI Image')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard)
@Controller('chat/image')
export class AiImageController {
  constructor(private readonly aiImageService: AiImageService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze image by Hugging Face vision model' })
  @ApiBody({
    type: AnalyzeImageDto,
    examples: {
      analyzeProduct: {
        summary: 'Analyze product image',
        value: {
          imageUrl:
            'https://event-management-uploads.s3.ap-southeast-1.amazonaws.com/chat/images/product.png',
          message: 'Phân tích ảnh này để tạo banner sự kiện.',
        },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      example: {
        statusCode: 200,
        message: 'Analyze image successfully',
        data: {
          description: 'A product photo with clean lighting.',
          product: 'Product name or main subject',
          style: 'Modern event banner style',
          prompt: 'Create a clean horizontal event banner...',
          suggestedAction: 'create_banner',
        },
      },
    },
  })
  async analyze(@Body() dto: AnalyzeImageDto) {
    return Response(200, 'Analyze image successfully', await this.aiImageService.analyze(dto));
  }

  @Post('remove-background')
  @ApiOperation({ summary: 'Remove image background and upload result to S3' })
  @ApiBody({
    type: ImageUrlDto,
    examples: {
      removeBackground: {
        summary: 'Remove background',
        value: {
          imageUrl:
            'https://event-management-uploads.s3.ap-southeast-1.amazonaws.com/chat/images/product.png',
        },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      example: {
        statusCode: 200,
        message: 'Remove background successfully',
        data: {
          resultImageUrl:
            'https://bucket-name.s3.ap-southeast-1.amazonaws.com/chat/images/remove-background.png',
        },
      },
    },
  })
  async removeBackground(@Body() dto: ImageUrlDto) {
    return Response(
      200,
      'Remove background successfully',
      await this.aiImageService.removeBackground(dto),
    );
  }

  @Post('upscale')
  @ApiOperation({ summary: 'Upscale image and upload result to S3' })
  @ApiBody({
    type: ImageUrlDto,
    examples: {
      upscale: {
        summary: 'Upscale image',
        value: {
          imageUrl:
            'https://event-management-uploads.s3.ap-southeast-1.amazonaws.com/chat/images/product.png',
        },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      example: {
        statusCode: 200,
        message: 'Upscale image successfully',
        data: {
          resultImageUrl:
            'https://bucket-name.s3.ap-southeast-1.amazonaws.com/chat/images/upscale.png',
        },
      },
    },
  })
  async upscale(@Body() dto: ImageUrlDto) {
    return Response(200, 'Upscale image successfully', await this.aiImageService.upscale(dto));
  }

  @Post('process')
  @ApiOperation({
    summary: 'Process chat image action with Hugging Face or image workflow',
  })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    description:
      'Use JSON with imageUrl, or multipart/form-data with file for old FE flow.',
    schema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: {
          type: 'string',
          enum: AI_IMAGE_ACTIONS,
          example: AiImageAction.REMOVE_BACKGROUND,
        },
        imageUrl: {
          type: 'string',
          example:
            'https://event-management-uploads.s3.ap-southeast-1.amazonaws.com/chat/images/product.png',
        },
        prompt: {
          type: 'string',
          example: 'Tạo banner ngang phong cách hiện đại.',
        },
        fileNamePrefix: {
          type: 'string',
          example: 'event-banner',
        },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
    examples: {
      analyze: {
        summary: 'Analyze image by URL',
        value: {
          action: 'analyze',
          imageUrl:
            'https://event-management-uploads.s3.ap-southeast-1.amazonaws.com/chat/images/product.png',
          prompt: 'Phân tích ảnh này.',
        },
      },
      removeBackground: {
        summary: 'Remove background by URL',
        value: {
          action: 'remove_background',
          imageUrl:
            'https://event-management-uploads.s3.ap-southeast-1.amazonaws.com/chat/images/product.png',
        },
      },
      generate: {
        summary: 'Generate image from prompt',
        value: {
          action: 'generate',
          prompt: 'Create a Mid-Autumn festival event banner with lanterns.',
          fileNamePrefix: 'mid-autumn-banner',
        },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      example: {
        statusCode: 200,
        message: 'Chat image processed successfully',
        data: {
          secure_url:
            'https://bucket-name.s3.ap-southeast-1.amazonaws.com/chat/images/example.png',
          resultImageUrl:
            'https://bucket-name.s3.ap-southeast-1.amazonaws.com/chat/images/example.png',
          public_id: 'chat/images/example.png',
          action: 'remove_background',
          mimeType: 'image/png',
        },
      },
    },
  })
  async process(
    @Body() dto: ProcessAiImageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!dto.action) {
      throw new BadRequestException(Response(400, 'Image action is required', null));
    }

    return Response(
      200,
      'Chat image processed successfully',
      await this.aiImageService.process(dto, file),
    );
  }
}
