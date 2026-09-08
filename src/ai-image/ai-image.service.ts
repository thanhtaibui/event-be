import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InferenceClient } from '@huggingface/inference';
import { Response } from 'src/common/utils/ApiResponse';
import { UploadService } from 'src/modules/upload/upload.service';
import {
  AiImageAction,
  AnalyzeImageDto,
  AnalyzeImageResponseDto,
  ImageUrlDto,
  ProcessAiImageDto,
} from './dto/ai-image.dto';

type ImageBuffer = {
  buffer: Buffer;
  mimeType: string;
};

type UploadedImageResult = {
  secure_url: string;
  public_id: string;
};

@Injectable()
export class AiImageService {
  private readonly logger = new Logger(AiImageService.name);
  private readonly analysisModel =
    process.env.HF_ANALYSIS_MODEL || 'Qwen/Qwen2.5-VL-7B-Instruct';
  private readonly removeBackgroundModel =
    process.env.HF_REMOVE_BACKGROUND_MODEL || 'briaai/RMBG-1.4';
  private readonly upscaleModel =
    process.env.HF_UPSCALE_MODEL || 'ai-forever/Real-ESRGAN';
  private readonly imageModel =
    process.env.HF_IMAGE_MODEL || 'stabilityai/stable-diffusion-2';

  constructor(private readonly uploadService: UploadService) {}

  async analyze(dto: AnalyzeImageDto): Promise<AnalyzeImageResponseDto> {
    const timer = 'POST_CHAT_IMAGE_ANALYZE';
    console.time(timer);
    try {
      const image = await this.fetchImageFromUrl(dto.imageUrl);
      const client = this.getHfClient();
      const imageDataUrl = `data:${image.mimeType};base64,${image.buffer.toString('base64')}`;

      const result = await client.chatCompletion({
        model: this.analysisModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  'Analyze the image for an event image assistant. Return JSON only with keys: description, product, style, prompt, suggestedAction. ' +
                  `User message: ${dto.message || ''}`,
              },
              {
                type: 'image_url',
                image_url: { url: imageDataUrl },
              },
            ],
          },
        ],
        temperature: 0.2,
        max_tokens: 700,
      } as any);

      const content = result.choices?.[0]?.message?.content || '';
      return this.parseAnalyzeResponse(content, dto.message);
    } catch (error) {
      this.handleKnownError(error);
      this.logger.error('Analyze image failed', error);
      throw new InternalServerErrorException(
        Response(500, 'Analyze image failed', null),
      );
    } finally {
      console.timeEnd(timer);
    }
  }

  async removeBackground(dto: ImageUrlDto) {
    const timer = 'POST_CHAT_IMAGE_REMOVE_BACKGROUND';
    console.time(timer);
    try {
      const image = await this.fetchImageFromUrl(dto.imageUrl);
      const result = await this.callHfImageModel(
        this.removeBackgroundModel,
        image,
        'remove background',
      );
      const uploaded = await this.uploadResult(
        result.buffer,
        result.mimeType || 'image/png',
        'remove-background',
      );

      return {
        resultImageUrl: uploaded.secure_url,
        public_id: uploaded.public_id,
        mimeType: result.mimeType,
      };
    } catch (error) {
      this.handleKnownError(error);
      this.logger.error('Remove background failed', error);
      throw new InternalServerErrorException(
        Response(500, 'Remove background failed', null),
      );
    } finally {
      console.timeEnd(timer);
    }
  }

  async upscale(dto: ImageUrlDto) {
    const timer = 'POST_CHAT_IMAGE_UPSCALE';
    console.time(timer);
    try {
      const image = await this.fetchImageFromUrl(dto.imageUrl);
      const result = await this.callHfImageModel(
        this.upscaleModel,
        image,
        'upscale image',
      );
      const uploaded = await this.uploadResult(
        result.buffer,
        result.mimeType || 'image/png',
        'upscale',
      );

      return {
        resultImageUrl: uploaded.secure_url,
        public_id: uploaded.public_id,
        mimeType: result.mimeType,
      };
    } catch (error) {
      this.handleKnownError(error);
      this.logger.error('Upscale image failed', error);
      throw new InternalServerErrorException(
        Response(500, 'Upscale image failed', null),
      );
    } finally {
      console.timeEnd(timer);
    }
  }

  async process(dto: ProcessAiImageDto, file?: Express.Multer.File) {
    const timer = `POST_CHAT_IMAGE_PROCESS:${dto.action}`;
    console.time(timer);
    try {
      const action = this.normalizeAction(dto.action);

      if (action === AiImageAction.ANALYZE) {
        if (!dto.imageUrl) {
          throw new BadRequestException(
            Response(400, 'imageUrl is required for analyze', null),
          );
        }
        return this.analyze({ imageUrl: dto.imageUrl, message: dto.prompt });
      }

      if (action === AiImageAction.REMOVE_BACKGROUND) {
        const image = await this.getImageInput(dto.imageUrl, file);
        const result = await this.callHfImageModel(
          this.removeBackgroundModel,
          image,
          'remove background',
        );
        return this.toProcessResult(
          await this.uploadResult(result.buffer, result.mimeType, dto.fileNamePrefix || 'remove-background'),
          dto.action,
          result.mimeType,
        );
      }

      if (action === AiImageAction.UPSCALE) {
        const image = await this.getImageInput(dto.imageUrl, file);
        const result = await this.callHfImageModel(
          this.upscaleModel,
          image,
          'upscale image',
        );
        return this.toProcessResult(
          await this.uploadResult(result.buffer, result.mimeType, dto.fileNamePrefix || 'upscale'),
          dto.action,
          result.mimeType,
        );
      }

      if (action === AiImageAction.GENERATE) {
        const result = await this.generateOrWorkflow(dto);
        return this.toProcessResult(
          await this.uploadResult(result.buffer, result.mimeType, dto.fileNamePrefix || 'generated-image'),
          dto.action,
          result.mimeType,
        );
      }

      const image = await this.getImageInput(dto.imageUrl, file);
      const result = await this.callImageWorkflow(dto, image);
      return this.toProcessResult(
        await this.uploadResult(result.buffer, result.mimeType, dto.fileNamePrefix || action),
        dto.action,
        result.mimeType,
      );
    } finally {
      console.timeEnd(timer);
    }
  }

  private getHfClient(): InferenceClient {
    const token = process.env.HF_TOKEN;
    if (!token) {
      throw new BadRequestException(
        Response(400, 'HF_TOKEN environment variable is missing', null),
      );
    }

    return new InferenceClient(token);
  }

  private async fetchImageFromUrl(imageUrl: string): Promise<ImageBuffer> {
    let response: globalThis.Response;
    try {
      response = await fetch(imageUrl);
    } catch {
      throw new BadRequestException(
        Response(400, 'Cannot download image from imageUrl', null),
      );
    }

    if (!response.ok) {
      throw new BadRequestException(
        Response(400, 'Cannot download image from imageUrl', null),
      );
    }

    const mimeType = response.headers.get('content-type') || 'image/png';
    if (!mimeType.startsWith('image/')) {
      throw new BadRequestException(
        Response(400, 'imageUrl must point to an image file', null),
      );
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType,
    };
  }

  private async getImageInput(
    imageUrl?: string,
    file?: Express.Multer.File,
  ): Promise<ImageBuffer> {
    if (file) {
      if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException(
          Response(400, 'Only image files are allowed', null),
        );
      }
      return {
        buffer: file.buffer,
        mimeType: file.mimetype,
      };
    }

    if (imageUrl) {
      return this.fetchImageFromUrl(imageUrl);
    }

    throw new BadRequestException(
      Response(400, 'imageUrl or image file is required for this action', null),
    );
  }

  private async callHfImageModel(
    model: string,
    image: ImageBuffer,
    taskName: string,
  ): Promise<ImageBuffer> {
    this.getHfClient();
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          'Content-Type': image.mimeType,
          Accept: 'image/png, image/jpeg, application/json',
        },
        body: new Uint8Array(image.buffer),
      },
    );

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || contentType.includes('application/json')) {
      const errorText = await response.text();
      throw new BadRequestException(
        Response(
          400,
          `Hugging Face ${taskName} failed: ${errorText || response.statusText}`,
          null,
        ),
      );
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType: contentType.startsWith('image/') ? contentType : 'image/png',
    };
  }

  private async generateOrWorkflow(dto: ProcessAiImageDto): Promise<ImageBuffer> {
    const prompt = dto.prompt?.trim();
    if (!prompt) {
      throw new BadRequestException(
        Response(400, 'prompt is required for generate', null),
      );
    }

    const workflowResult = await this.callOptionalImageWorkflow(dto);
    if (workflowResult) {
      return workflowResult;
    }

    const client = this.getHfClient();
    const blob = await client.textToImage(
      {
        model: this.imageModel,
        inputs: prompt,
      },
      {
        outputType: 'blob',
      },
    );

    return this.blobToImageBuffer(blob);
  }

  private async callImageWorkflow(
    dto: ProcessAiImageDto,
    image: ImageBuffer,
  ): Promise<ImageBuffer> {
    const result = await this.callOptionalImageWorkflow(dto, image);
    if (!result) {
      throw new BadRequestException(
        Response(
          400,
          'IMAGE_GENERATION_URL is required for image edit/banner/poster workflow',
          null,
        ),
      );
    }

    return result;
  }

  private async callOptionalImageWorkflow(
    dto: ProcessAiImageDto,
    image?: ImageBuffer,
  ): Promise<ImageBuffer | null> {
    const workflowUrl = process.env.IMAGE_GENERATION_URL;
    if (!workflowUrl) {
      return null;
    }

    const body = {
      action: this.normalizeAction(dto.action),
      prompt: dto.prompt,
      imageUrl: dto.imageUrl,
      imageBase64: image
        ? `data:${image.mimeType};base64,${image.buffer.toString('base64')}`
        : undefined,
    };

    const response = await fetch(workflowUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new BadRequestException(
        Response(400, `Image workflow failed: ${await response.text()}`, null),
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
    const resultImageUrl = data.resultImageUrl || data.imageUrl || data.url;
    if (!resultImageUrl) {
      throw new BadRequestException(
        Response(400, 'Image workflow response must include resultImageUrl', null),
      );
    }

    return this.fetchImageFromUrl(resultImageUrl);
  }

  private async uploadResult(
    buffer: Buffer,
    mimeType: string,
    fileNamePrefix: string,
  ): Promise<UploadedImageResult> {
    const extension = this.getExtensionFromMimeType(mimeType);
    const uploaded = await this.uploadService.uploadFile(
      {
        fieldname: 'file',
        originalname: `${this.normalizeFileName(fileNamePrefix)}.${extension}`,
        encoding: '7bit',
        mimetype: mimeType,
        buffer,
        size: buffer.length,
      } as Express.Multer.File,
      'chat/images',
    );

    return uploaded.data!;
  }

  private async blobToImageBuffer(blob: Blob): Promise<ImageBuffer> {
    return {
      buffer: Buffer.from(await blob.arrayBuffer()),
      mimeType: blob.type || 'image/png',
    };
  }

  private normalizeAction(action: string): AiImageAction {
    const actionMap: Record<string, AiImageAction> = {
      [AiImageAction.FIT_EVENT_BANNER]: AiImageAction.CREATE_BANNER,
      [AiImageAction.FIT_EVENT_POSTER]: AiImageAction.CREATE_POSTER,
      [AiImageAction.FIT_ORGANIZATION_LOGO]: AiImageAction.EDIT_IMAGE,
      [AiImageAction.UPSCALE_IMAGE]: AiImageAction.UPSCALE,
      [AiImageAction.CREATE_IMAGE_FROM_PROMPT]: AiImageAction.GENERATE,
    };

    return actionMap[action] || (action as AiImageAction);
  }

  private parseAnalyzeResponse(
    content: string,
    message?: string,
  ): AnalyzeImageResponseDto {
    const cleaned = content.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          description: parsed.description || '',
          product: parsed.product || '',
          style: parsed.style || '',
          prompt: parsed.prompt || '',
          suggestedAction:
            parsed.suggestedAction || this.detectSuggestedAction(message || cleaned),
        };
      } catch {
        this.logger.warn('Cannot parse analysis JSON response');
      }
    }

    return {
      description: cleaned,
      product: '',
      style: '',
      prompt: cleaned,
      suggestedAction: this.detectSuggestedAction(message || cleaned),
    };
  }

  private detectSuggestedAction(text: string): string {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('nền') || lowerText.includes('background')) {
      return AiImageAction.REMOVE_BACKGROUND;
    }
    if (lowerText.includes('nét') || lowerText.includes('upscale')) {
      return AiImageAction.UPSCALE;
    }
    if (lowerText.includes('poster')) {
      return AiImageAction.CREATE_POSTER;
    }
    if (lowerText.includes('banner')) {
      return AiImageAction.CREATE_BANNER;
    }

    return AiImageAction.EDIT_IMAGE;
  }

  private toProcessResult(
    uploaded: UploadedImageResult,
    action: string,
    mimeType: string,
  ) {
    return {
      secure_url: uploaded.secure_url,
      resultImageUrl: uploaded.secure_url,
      public_id: uploaded.public_id,
      action,
      mimeType,
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

  private normalizeFileName(fileName: string): string {
    return fileName
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private handleKnownError(error: unknown): void {
    if (
      error instanceof BadRequestException ||
      error instanceof InternalServerErrorException
    ) {
      throw error;
    }
  }
}
