export type AiImageBuffer = {
  buffer: Buffer;
  mimeType: string;
};

export type GenerateImageInput = {
  prompt: string;
  ratio?: string;
};

export type EditImageInput = {
  image: AiImageBuffer;
  imageUrl: string;
  instruction: string;
  ratio?: string;
};

export type EnhanceImageInput = {
  image: AiImageBuffer;
  action: 'remove_background' | 'upscale';
};

export interface AiImageProvider {
  generate(input: GenerateImageInput): Promise<AiImageBuffer>;
  edit(input: EditImageInput): Promise<AiImageBuffer>;
  enhance(input: EnhanceImageInput): Promise<AiImageBuffer>;
}
