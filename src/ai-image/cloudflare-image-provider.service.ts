import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AiImageBuffer,
  AiImageProvider,
  EditImageInput,
  GenerateImageInput,
  InpaintImageInput,
} from './interfaces/ai-image-provider.interface';

const CLOUDFLARE_TIMEOUT_MS = Math.max(
  Number(process.env.CLOUDFLARE_AI_TIMEOUT_MS ?? 90000),
  90000,
);
const CLOUDFLARE_MAX_RETRIES = 2;

@Injectable()
export class CloudflareImageProvider implements AiImageProvider {
  private readonly logger = new Logger(CloudflareImageProvider.name);

  async generate(input: GenerateImageInput): Promise<AiImageBuffer> {
    const model = this.getModel(
      'CLOUDFLARE_IMAGE_GENERATION_MODEL',
      '@cf/black-forest-labs/flux-1-schnell',
    );
    const payload = {
      prompt: input.prompt,
    };

    const maxPromptLength = Math.max(
      Number(process.env.CLOUDFLARE_IMAGE_GENERATION_MAX_PROMPT_CHARS ?? 2048),
      1,
    );
    if (input.prompt.length > maxPromptLength) {
      throw new BadRequestException('AI_IMAGE_PROMPT_TOO_LONG');
    }

    this.logger.log(`AI_IMAGE_GENERATE:cloudflare:${model}`);
    this.logger.log(
      `AI_IMAGE_GENERATE_PAYLOAD_KEYS:${Object.keys(payload).join(',')}`,
    );
    return this.callCloudflare(model, payload);
  }

  async edit(input: EditImageInput): Promise<AiImageBuffer> {
    const model = this.getModel(
      'CLOUDFLARE_IMAGE_EDIT_MODEL',
      '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    );
    const size = this.getSize(input.ratio);

    this.logger.log(`AI_IMAGE_EDIT:cloudflare:${model}`);
    return this.callCloudflare(model, {
      prompt: input.instruction,
      image: input.image.buffer.toString('base64'),
      strength: input.strength ?? 0.65,
      width: size.width,
      height: size.height,
    });
  }

  async inpaint(input: InpaintImageInput): Promise<AiImageBuffer> {
    const model = this.getModel(
      'CLOUDFLARE_IMAGE_INPAINT_MODEL',
      '@cf/runwayml/stable-diffusion-v1-5-inpainting',
    );
    const size = this.getSize(input.ratio);

    this.logger.log(`AI_IMAGE_INPAINT:cloudflare:${model}`);
    return this.callCloudflare(model, {
      prompt: input.instruction,
      image: input.image.buffer.toString('base64'),
      mask: input.mask.buffer.toString('base64'),
      width: size.width,
      height: size.height,
    });
  }

  private async callCloudflare(
    model: string,
    payload: Record<string, unknown>,
  ): Promise<AiImageBuffer> {
    const accountId = this.getRequiredEnv('CLOUDFLARE_ACCOUNT_ID');
    const apiToken = this.getRequiredEnv('CLOUDFLARE_API_TOKEN');
    const modelPath = this.encodeModelPath(model);
    const cloudflareUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelPath}`;

    this.logger.log(
      `AI_IMAGE_PROVIDER_REQUEST:cloudflare:path=/client/v4/accounts/<account>/ai/run/${modelPath}:model=${model}:payloadKeys=${Object.keys(payload).join(',')}`,
    );

    for (let attempt = 0; attempt <= CLOUDFLARE_MAX_RETRIES; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        CLOUDFLARE_TIMEOUT_MS,
      );
      try {
        const response = await fetch(cloudflareUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          const error = await this.normalizeCloudflareError(response);
          if (this.isRetryable(error) && attempt < CLOUDFLARE_MAX_RETRIES) {
            this.logger.warn(
              `AI_IMAGE_PROVIDER_RETRY:cloudflare:model=${model}:attempt=${attempt + 1}:status=${error.getStatus()}`,
            );
            await this.delay(500 * (attempt + 1));
            continue;
          }
          throw error;
        }

        return await this.normalizeImageResponse(response);
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }

        const retryable =
          (error instanceof Error && error.name === 'AbortError') ||
          error instanceof TypeError;
        const normalized =
          error instanceof Error && error.name === 'AbortError'
            ? new GatewayTimeoutException('AI_PROVIDER_TIMEOUT')
            : new ServiceUnavailableException('AI_PROVIDER_UNAVAILABLE');

        if (retryable && attempt < CLOUDFLARE_MAX_RETRIES) {
          this.logger.warn(
            `AI_IMAGE_PROVIDER_RETRY:cloudflare:model=${model}:attempt=${attempt + 1}:reason=${normalized.message}`,
          );
          await this.delay(500 * (attempt + 1));
          continue;
        }
        throw normalized;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new ServiceUnavailableException('AI_PROVIDER_UNAVAILABLE');
  }

  private async normalizeImageResponse(
    response: Response,
  ): Promise<AiImageBuffer> {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.startsWith('image/')) {
      return {
        buffer: Buffer.from(await response.arrayBuffer()),
        mimeType: contentType,
      };
    }

    const data = await response.json().catch(() => null);
    const imageValue = this.extractImageValue(data);
    if (!imageValue) {
      throw new BadGatewayException('IMAGE_PROCESSING_FAILED');
    }

    if (typeof imageValue === 'string' && imageValue.startsWith('http')) {
      return this.downloadImage(imageValue);
    }

    return this.base64ToImage(imageValue);
  }

  private extractImageValue(data: unknown): string | undefined {
    if (!data || typeof data !== 'object') {
      return undefined;
    }

    const root = data as Record<string, any>;
    const result = root.result;
    const candidates = [
      root.image,
      root.image_url,
      root.url,
      root.b64_json,
      root.data?.[0]?.b64_json,
      root.data?.[0]?.image,
      result?.image,
      result?.image_url,
      result?.url,
      result?.b64_json,
      result?.images?.[0],
      result?.data?.[0]?.b64_json,
      result?.data?.[0]?.image,
    ];

    return candidates.find((value) => typeof value === 'string');
  }

  private async downloadImage(imageUrl: string): Promise<AiImageBuffer> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new BadGatewayException('IMAGE_PROCESSING_FAILED');
    }

    const mimeType = response.headers.get('content-type') || 'image/png';
    if (!mimeType.startsWith('image/')) {
      throw new BadGatewayException('IMAGE_PROCESSING_FAILED');
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType,
    };
  }

  private base64ToImage(value: string): AiImageBuffer {
    const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    const mimeType = match?.[1] || 'image/png';
    const base64 = match?.[2] || value;

    try {
      return {
        buffer: Buffer.from(base64, 'base64'),
        mimeType,
      };
    } catch {
      throw new BadGatewayException('IMAGE_PROCESSING_FAILED');
    }
  }

  private async normalizeCloudflareError(
    response: Response,
  ): Promise<HttpException> {
    const body = await response.text().catch(() => '');
    const normalizedBody = body.toLowerCase();

    this.logger.error(
      `AI_IMAGE_PROVIDER_ERROR:cloudflare:${response.status}:${this.truncateLogBody(body)}`,
    );

    if (
      normalizedBody.includes('quota') ||
      normalizedBody.includes('neuron') ||
      normalizedBody.includes('daily') ||
      normalizedBody.includes('allocation')
    ) {
      return new HttpException(
        "AI image generation has reached today's free usage limit. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (response.status === HttpStatus.REQUEST_TIMEOUT) {
      return new GatewayTimeoutException('AI_PROVIDER_TIMEOUT');
    }

    if (response.status === HttpStatus.TOO_MANY_REQUESTS) {
      return new ServiceUnavailableException('AI_PROVIDER_BUSY');
    }

    if (
      response.status === HttpStatus.UNAUTHORIZED ||
      response.status === HttpStatus.FORBIDDEN
    ) {
      return new ServiceUnavailableException('AI_PROVIDER_CONFIGURATION_ERROR');
    }

    if (
      response.status === HttpStatus.NOT_FOUND ||
      (normalizedBody.includes('model') &&
        (normalizedBody.includes('not found') ||
          normalizedBody.includes('not available') ||
          normalizedBody.includes('does not exist')))
    ) {
      return new BadRequestException('AI_MODEL_UNAVAILABLE');
    }

    if (
      response.status === HttpStatus.BAD_REQUEST ||
      normalizedBody.includes('invalid image')
    ) {
      return new BadRequestException('IMAGE_PROCESSING_FAILED');
    }

    if (response.status >= 500) {
      return new ServiceUnavailableException('AI_PROVIDER_UNAVAILABLE');
    }

    return new BadGatewayException('AI_REQUEST_FAILED');
  }

  private isRetryable(error: HttpException): boolean {
    if (error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
      return error.message === 'AI_PROVIDER_BUSY';
    }
    return [
      HttpStatus.REQUEST_TIMEOUT,
      HttpStatus.BAD_GATEWAY,
      HttpStatus.SERVICE_UNAVAILABLE,
      HttpStatus.GATEWAY_TIMEOUT,
    ].includes(error.getStatus());
  }

  private async delay(milliseconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private getRequiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
      this.logger.warn(`AI_IMAGE_CONFIG_MISSING:${name}`);
      throw new ServiceUnavailableException(
        `AI_PROVIDER_CONFIGURATION_ERROR: ${name} is missing`,
      );
    }

    return value;
  }

  private getModel(envName: string, fallback: string): string {
    return process.env[envName]?.trim() || fallback;
  }

  private encodeModelPath(model: string): string {
    return model
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }

  private truncateLogBody(body: string): string {
    if (!body) {
      return '<empty body>';
    }

    const sanitized = body
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
      .replace(
        /("(?:token|api_key|authorization)"\s*:\s*")[^"]+/gi,
        '$1[REDACTED]',
      )
      .replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED_API_KEY]');
    return sanitized.length > 2000
      ? `${sanitized.slice(0, 2000)}...<truncated>`
      : sanitized;
  }

  private getSize(ratio?: string): { width: number; height: number } {
    if (ratio === '1:1') {
      return { width: 1024, height: 1024 };
    }
    if (ratio === '9:16') {
      return { width: 576, height: 1024 };
    }

    return { width: 1024, height: 576 };
  }
}
