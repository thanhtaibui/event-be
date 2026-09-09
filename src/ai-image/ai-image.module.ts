import { Module } from '@nestjs/common';
import { UploadModule } from 'src/modules/upload/upload.module';
import { AiImageController } from './ai-image.controller';
import { AiPromptService } from './ai-prompt.service';
import { AiImageService } from './ai-image.service';
import { ImageStorageService } from './image-storage.service';

@Module({
  imports: [UploadModule],
  controllers: [AiImageController],
  providers: [AiImageService, AiPromptService, ImageStorageService],
  exports: [AiImageService],
})
export class AiImageModule {}
