import { BadRequestException, Injectable } from '@nestjs/common';
import { AiClientService } from './ai-client.service';
import { AiChatResponseDto } from './dto/ai-chat.dto';

@Injectable()
export class AiService {
  constructor(private readonly aiClientService: AiClientService) {}

  async chat(prompt: string): Promise<AiChatResponseDto> {
    const message = prompt?.trim();
    if (!message) {
      throw new BadRequestException('Message is required');
    }

    return {
      type: 'text',
      message: await this.aiClientService.chat(message),
    };
  }
}
