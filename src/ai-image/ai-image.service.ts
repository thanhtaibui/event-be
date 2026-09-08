import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InferenceClient } from '@huggingface/inference';
import { UploadService } from 'src/modules/upload/upload.service';
import {
  EditImageDto,
  EnhanceImageDto,
  GenerateImageDto,
  ImageEnhanceAction,
} from './dto/ai-image.dto';
import { AiPromptService } from './ai-prompt.service';
import {
  AiImageBuffer,
  AiImageProvider,
  EditImageInput,
  EnhanceImageInput,
  GenerateImageInput,
} from './interfaces/ai-image-provider.interface';

type UploadedImageResult = {
  secure_url: string;
  public_id: string;
};

@Injectable()
export class AiImageService {
  private readonly logger = new Logger(AiImageService.name);

  constructor(
    private readonly uploadService: UploadService,
    private readonly aiPromptService: AiPromptService,
  ) {}

  async generate(dto: GenerateImageDto) {
    const timer = 'POST_AI_IMAGE_GENERATE';
    console.time(timer);
    try {
      const provider = this.getGenerationProvider();
      const prompt = await this.aiPromptService.generateImagePrompt(
        dto.description,
        dto.ratio,
      );
      const image = await provider.generate({
        prompt,
        ratio: dto.ratio,
      });
      const uploaded = await this.uploadResult(image, 'ai-generated-image');

      return this.toImageResponse(uploaded);
    } finally {
      console.timeEnd(timer);
    }
  }

  async edit(dto: EditImageDto) {
    const timer = 'POST_AI_IMAGE_EDIT';
    console.time(timer);
    try {
      const sourceImage = await this.fetchImageFromUrl(dto.imageUrl);
      const provider = this.getEditProvider();
      const instruction =
        await this.aiPromptService.generateImageEditInstruction(
          dto.description,
          dto.ratio,
        );
      const image = await provider.edit({
        image: sourceImage,
        imageUrl: dto.imageUrl,
        instruction,
        ratio: dto.ratio,
      });
      const uploaded = await this.uploadResult(image, 'ai-edited-image');

      return this.toImageResponse(uploaded);
    } finally {
      console.timeEnd(timer);
    }
  }

  async enhance(dto: EnhanceImageDto) {
    const timer = `POST_AI_IMAGE_ENHANCE:${dto.action}`;
    console.time(timer);
    try {
      const sourceImage = await this.fetchImageFromUrl(dto.imageUrl);
      const provider = this.getEnhanceProvider();
      const image = await provider.enhance({
        image: sourceImage,
        action: dto.action,
      });
      const uploaded = await this.uploadResult(image, `ai-${dto.action}`);

      return this.toImageResponse(uploaded);
    } finally {
      console.timeEnd(timer);
    }
  }

  private getGenerationProvider(): AiImageProvider {
    return this.createProvider(
      process.env.IMAGE_GENERATION_PROVIDER,
      process.env.IMAGE_GENERATION_MODEL,
      'IMAGE_GENERATION_PROVIDER',
      'IMAGE_GENERATION_MODEL',
    );
  }

  private getEditProvider(): AiImageProvider {
    return this.createProvider(
      process.env.IMAGE_EDIT_PROVIDER,
      process.env.IMAGE_EDIT_MODEL,
      'IMAGE_EDIT_PROVIDER',
      'IMAGE_EDIT_MODEL',
    );
  }

  private getEnhanceProvider(): AiImageProvider {
    return new HuggingFaceImageProvider(this.getHfToken(), this.logger);
  }

  private createProvider(
    providerName: string | undefined,
    model: string | undefined,
    providerEnvName: string,
    modelEnvName: string,
  ): AiImageProvider {
    if (!providerName) {
      throw new BadRequestException(`${providerEnvName} is missing`);
    }
    if (!model) {
      throw new BadRequestException(`${modelEnvName} is missing`);
    }

    const provider = providerName.toLowerCase();
    if (provider === 'huggingface' || provider === 'hf') {
      return new HuggingFaceImageProvider(this.getHfToken(), this.logger, model);
    }
    if (provider === 'http' || provider === 'workflow') {
      return new HttpImageProvider(model, this.logger);
    }

    throw new BadRequestException(`Unsupported AI image provider: ${providerName}`);
  }

  private getHfToken(): string {
    const token = process.env.HF_TOKEN;
    if (!token) {
      throw new BadRequestException('HF_TOKEN is missing');
    }

    return token;
  }

  private async fetchImageFromUrl(imageUrl: string): Promise<AiImageBuffer> {
    let response: globalThis.Response;
    try {
      response = await fetch(imageUrl);
    } catch {
      throw new BadRequestException('Cannot download image from imageUrl');
    }

    if (!response.ok) {
      throw new BadRequestException('Cannot download image from imageUrl');
    }

    const mimeType = response.headers.get('content-type') || 'image/png';
    if (!mimeType.startsWith('image/')) {
      throw new BadRequestException('imageUrl must point to an image file');
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType,
    };
  }

  private async uploadResult(
    image: AiImageBuffer,
    fileNamePrefix: string,
  ): Promise<UploadedImageResult> {
    const extension = this.getExtensionFromMimeType(image.mimeType);
    const uploaded = await this.uploadService.uploadFile(
      {
        fieldname: 'file',
        originalname: `${fileNamePrefix}.${extension}`,
        encoding: '7bit',
        mimetype: image.mimeType,
        buffer: image.buffer,
        size: image.buffer.length,
      } as Express.Multer.File,
      'ai/images',
    );

    return uploaded.data!;
  }

  private toImageResponse(uploaded: UploadedImageResult) {
    return {
      imageUrl: uploaded.secure_url,
    };
  }

  private getExtensionFromMimeType(mimeType: string): string {
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      return 'jpg';
    }
    if (mimeType.includes('webp')) {
      return 'webp';
    }
    return 'png';
  }
}

class HuggingFaceImageProvider implements AiImageProvider {
  private readonly client: InferenceClient;

  constructor(
    private readonly token: string,
    private readonly logger: Logger,
    private readonly model?: string,
  ) {
    this.client = new InferenceClient(token);
  }

  async generate(input: GenerateImageInput): Promise<AiImageBuffer> {
    if (!this.model) {
      throw new BadRequestException('IMAGE_GENERATION_MODEL is missing');
    }

    this.logger.log(`AI_IMAGE_GENERATE:huggingface:${this.model}`);
    const blob = await this.client.textToImage(
      {
        model: this.model,
        inputs: this.withRatio(input.prompt, input.ratio),
      },
      { outputType: 'blob' },
    );

    return this.blobToBuffer(blob);
  }

  async edit(input: EditImageInput): Promise<AiImageBuffer> {
    if (!this.model) {
      throw new BadRequestException('IMAGE_EDIT_MODEL is missing');
    }

    this.logger.log(`AI_IMAGE_EDIT:huggingface:${this.model}`);
    const blob = await this.client.imageToImage({
      model: this.model,
      inputs: input.image.buffer,
      parameters: {
        prompt: this.withRatio(input.instruction, input.ratio),
      },
    } as any);

    return this.blobToBuffer(blob);
  }

  async enhance(input: EnhanceImageInput): Promise<AiImageBuffer> {
    const model =
      input.action === ImageEnhanceAction.REMOVE_BACKGROUND
        ? 'briaai/RMBG-1.4'
        : 'ai-forever/Real-ESRGAN';

    this.logger.log(`AI_IMAGE_ENHANCE:huggingface:${model}`);
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': input.image.mimeType,
          Accept: 'image/png, image/jpeg, application/json',
        },
        body: new Uint8Array(input.image.buffer),
      },
    );

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || contentType.includes('application/json')) {
      const errorText = await response.text();
      throw new InternalServerErrorException(
        `Failed to enhance image: ${errorText || response.statusText}`,
      );
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType: contentType.startsWith('image/') ? contentType : 'image/png',
    };
  }

  private async blobToBuffer(blob: Blob): Promise<AiImageBuffer> {
    return {
      buffer: Buffer.from(await blob.arrayBuffer()),
      mimeType: blob.type || 'image/png',
    };
  }

  private withRatio(prompt: string, ratio?: string): string {
    if (!ratio) {
      return prompt;
    }

    return `${prompt}\nAspect ratio: ${ratio}`;
  }
}

class HttpImageProvider implements AiImageProvider {
  constructor(
    private readonly endpointUrl: string,
    private readonly logger: Logger,
  ) {}

  async generate(input: GenerateImageInput): Promise<AiImageBuffer> {
    return this.callWorkflow('generate', input);
  }

  async edit(input: EditImageInput): Promise<AiImageBuffer> {
    return this.callWorkflow('edit', {
      imageUrl: input.imageUrl,
      instruction: input.instruction,
      ratio: input.ratio,
      imageBase64: `data:${input.image.mimeType};base64,${input.image.buffer.toString('base64')}`,
    });
  }

  async enhance(input: EnhanceImageInput): Promise<AiImageBuffer> {
    return this.callWorkflow('enhance', {
      action: input.action,
      imageBase64: `data:${input.image.mimeType};base64,${input.image.buffer.toString('base64')}`,
    });
  }

  private async callWorkflow(
    action: 'generate' | 'edit' | 'enhance',
    payload: Record<string, unknown>,
  ): Promise<AiImageBuffer> {
    this.logger.log(`AI_IMAGE_${action.toUpperCase()}:http:${this.endpointUrl}`);
    const response = await fetch(this.endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Image workflow failed: ${await response.text()}`,
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.startsWith('image/')) {
      return {
        buffer: Buffer.from(await response.arrayBuffer()),
        mimeType: contentType,
      };
    }

    const data = await response.json();
    const resultImageUrl = data.imageUrl || data.resultImageUrl || data.url;
    if (!resultImageUrl) {
      throw new InternalServerErrorException(
        'Image workflow response must include imageUrl',
      );
    }

    const imageResponse = await fetch(resultImageUrl);
    if (!imageResponse.ok) {
      throw new InternalServerErrorException(
        'Cannot download image from workflow response',
      );
    }

    return {
      buffer: Buffer.from(await imageResponse.arrayBuffer()),
      mimeType: imageResponse.headers.get('content-type') || 'image/png',
    };
  }
}
