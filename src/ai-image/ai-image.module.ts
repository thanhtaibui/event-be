import { Module } from '@nestjs/common';
import { UploadModule } from 'src/modules/upload/upload.module';
import { AiImageController } from './ai-image.controller';
import { AiPromptService } from './ai-prompt.service';
import { AiImageService } from './ai-image.service';
import { ImageStorageService } from './image-storage.service';
import { CloudflareImageProvider } from './cloudflare-image-provider.service';
import { SharpImageProcessor } from './sharp-image-processor.service';
import { ImagePromptGeneratorService } from './image-prompt-generator.service';

@Module({
  imports: [UploadModule],
  controllers: [AiImageController],
  providers: [
    AiImageService,
    AiPromptService,
    ImagePromptGeneratorService,
    ImageStorageService,
    CloudflareImageProvider,
    SharpImageProcessor,
  ],
  exports: [AiImageService],
})
export class AiImageModule {}
