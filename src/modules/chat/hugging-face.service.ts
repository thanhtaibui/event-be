import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InferenceClient } from '@huggingface/inference';

type HuggingFaceImageResult = {
  buffer: Buffer;
  mimeType: string;
};

const DEFAULT_HF_IMAGE_MODEL = 'stabilityai/stable-diffusion-2';

@Injectable()
export class HuggingFaceService {
  private readonly logger = new Logger(HuggingFaceService.name);

  async generateImage(prompt: string): Promise<HuggingFaceImageResult> {
    const client = this.createClient();
    const model = this.getImageModel();
    this.logger.log(`HF_TEXT_TO_IMAGE:${model}`);

    const image = await client.textToImage({
      model,
      inputs: prompt,
    }, {
      outputType: 'blob',
    });

    return this.blobToImageResult(image);
  }

  async editImage(
    prompt: string,
    file: Express.Multer.File,
  ): Promise<HuggingFaceImageResult> {
    const client = this.createClient();
    const model = this.getImageToImageModel();
    this.logger.log(`HF_IMAGE_TO_IMAGE:${model}`);

    const image = await client.imageToImage({
      model,
      inputs: new Blob([new Uint8Array(file.buffer)], {
        type: file.mimetype,
      }),
      parameters: {
        prompt,
      },
    });

    return this.blobToImageResult(image);
  }

  private createClient(): InferenceClient {
    const token = process.env.HF_TOKEN;
    if (!token) {
      throw new BadRequestException('HF_TOKEN is missing');
    }

    return new InferenceClient(token);
  }

  private getImageModel(): string {
    return process.env.HF_IMAGE_MODEL?.trim() || DEFAULT_HF_IMAGE_MODEL;
  }

  private getImageToImageModel(): string {
    const model = process.env.HF_IMAGE_TO_IMAGE_MODEL?.trim();
    if (!model) {
      throw new BadRequestException('HF_IMAGE_TO_IMAGE_MODEL is missing');
    }

    return model;
  }

  private async blobToImageResult(
    image: Blob,
  ): Promise<HuggingFaceImageResult> {
    if (!image || image.size === 0) {
      throw new InternalServerErrorException(
        'Hugging Face did not return an image result',
      );
    }

    return {
      buffer: Buffer.from(await image.arrayBuffer()),
      mimeType: image.type || 'image/png',
    };
  }
}
