import { Module } from '@nestjs/common';
import { UploadModule } from '../upload/upload.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [UploadModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
