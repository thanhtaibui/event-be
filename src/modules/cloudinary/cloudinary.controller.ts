import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { ApiResponse } from 'src/common/utils/ApiResponse';

@Controller('cloudinary')
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) { }
  @Post('upload')
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
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File, @Body('folder') folder: string): Promise<ApiResponse<{ secure_url: string; public_id: string }>> {
    return await this.cloudinaryService.uploadFile(file, folder);
  }
}
