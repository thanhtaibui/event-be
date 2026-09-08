import { Module } from '@nestjs/common';
import { UploadModule } from 'src/modules/upload/upload.module';
import { AiImageController } from './ai-image.controller';
import { AiImageService } from './ai-image.service';

@Module({
  imports: [UploadModule],
  controllers: [AiImageController],
  providers: [AiImageService],
  exports: [AiImageService],
})
export class AiImageModule {}
