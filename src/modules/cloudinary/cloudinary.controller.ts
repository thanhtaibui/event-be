import {
  Body,
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  UploadService,
  createUploadInterceptorOptions,
} from '../upload/upload.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionCode } from 'src/common/constants/permission-codes';

@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('cloudinary')
export class CloudinaryController {
  constructor(private readonly uploadService: UploadService) {}
  @Post('upload')
  @Permissions(PermissionCode.UPLOAD_CREATE)
  @ApiOperation({ summary: 'Upload', operationId: 'upload' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      ...createUploadInterceptorOptions(),
      storage: multer.memoryStorage(),
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder: string,
  ): Promise<ApiResponse<{ secure_url: string; public_id: string }>> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return await this.uploadService.uploadFile(file, folder);
  }
}
