import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ImagePromptGenerationResult,
  ImagePromptGeneratorService,
} from './image-prompt-generator.service';

@Injectable()
export class AiPromptService {
  constructor(
    private readonly imagePromptGeneratorService: ImagePromptGeneratorService,
  ) {}

  generateImagePrompt(
    description: string,
    ratio?: string,
  ): Promise<ImagePromptGenerationResult> {
    return this.imagePromptGeneratorService.generateImagePrompt(
      description,
      ratio,
    );
  }

  async generateReadyImagePrompt(
    description: string,
    ratio?: string,
  ): Promise<string> {
    const result = await this.generateImagePrompt(description, ratio);
    if (result.type === 'NEED_MORE_INFORMATION') {
      throw new BadRequestException({
        code: 'NEED_MORE_INFORMATION',
        questions: result.questions,
        missingFields: result.missingFields,
      });
    }

    const prompt = [result.prompt, result.negativePrompt]
      .filter(Boolean)
      .join('\n\nNegative prompt: ');
    const maxCharacters = Math.max(
      Number(process.env.CLOUDFLARE_IMAGE_GENERATION_MAX_PROMPT_CHARS ?? 2048),
      1,
    );
    if (prompt.length <= maxCharacters) {
      return prompt;
    }

    return this.imagePromptGeneratorService.fitPromptToProviderLimit(
      prompt,
      maxCharacters,
    );
  }

  generateImageEditInstruction(
    description: string,
    ratio?: string,
  ): Promise<string> {
    return this.imagePromptGeneratorService.generateEditInstruction(
      description,
      ratio,
    );
  }
}
