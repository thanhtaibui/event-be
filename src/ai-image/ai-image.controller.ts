import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { AiImageService } from './ai-image.service';
import {
  EditImageDto,
  EnhanceImageDto,
  GenerateImageDto,
  ImageResponseDto,
} from './dto/ai-image.dto';

@ApiTags('AI Image')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard)
@Controller('ai/image')
export class AiImageController {
  constructor(private readonly aiImageService: AiImageService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a new image from natural description' })
  @ApiBody({
    type: GenerateImageDto,
    examples: {
      grandOpeningPoster: {
        summary: 'Generate event image',
        value: {
          description:
            'Tạo poster khai trương cửa hàng điện thoại phong cách điện máy Việt Nam',
          ratio: '16:9',
        },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      example: {
        imageUrl:
          'https://bucket-name.s3.ap-southeast-1.amazonaws.com/ai/images/ai-generated-image.png',
      },
    },
  })
  async generate(@Body() dto: GenerateImageDto): Promise<ImageResponseDto> {
    return this.aiImageService.generate(dto);
  }

  @Post('edit')
  @ApiOperation({ summary: 'Edit an image from imageUrl and natural description' })
  @ApiBody({
    type: EditImageDto,
    examples: {
      saleBackground: {
        summary: 'Edit product image',
        value: {
          imageUrl:
            'https://event-management-uploads.s3.ap-southeast-1.amazonaws.com/ai/images/iphone.jpg',
          description:
            'Đổi nền thành showroom, thêm chữ SALE 9.9, giữ nguyên sản phẩm',
          ratio: '16:9',
        },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      example: {
        imageUrl:
          'https://bucket-name.s3.ap-southeast-1.amazonaws.com/ai/images/ai-edited-image.png',
      },
    },
  })
  async edit(@Body() dto: EditImageDto): Promise<ImageResponseDto> {
    return this.aiImageService.edit(dto);
  }

  @Post('enhance')
  @ApiOperation({ summary: 'Enhance image by removing background or upscaling' })
  @ApiBody({
    type: EnhanceImageDto,
    examples: {
      removeBackground: {
        summary: 'Remove background',
        value: {
          imageUrl:
            'https://event-management-uploads.s3.ap-southeast-1.amazonaws.com/ai/images/product.png',
          action: 'remove_background',
        },
      },
      upscale: {
        summary: 'Upscale image',
        value: {
          imageUrl:
            'https://event-management-uploads.s3.ap-southeast-1.amazonaws.com/ai/images/product.png',
          action: 'upscale',
        },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      example: {
        imageUrl:
          'https://bucket-name.s3.ap-southeast-1.amazonaws.com/ai/images/ai-remove-background.png',
      },
    },
  })
  async enhance(@Body() dto: EnhanceImageDto): Promise<ImageResponseDto> {
    return this.aiImageService.enhance(dto);
  }
}
