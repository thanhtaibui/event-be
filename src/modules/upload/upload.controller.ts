
import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { ApiTags, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { ApiResponse } from '../../common/utils/ApiResponse';

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) { }

  @Post('image')
  @ApiOperation({ summary: 'Upload file lên AWS S3' })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File, @Body('folder') folder: string
  ): Promise<ApiResponse<{ secure_url: string; public_id: string }>> {
    if (!file) {
      throw new BadRequestException('No file uploaded!');
    }
    return await this.uploadService.uploadFile(file, folder);
  }

}
