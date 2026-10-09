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
  strength?: number;
};

export type InpaintImageInput = EditImageInput & {
  mask: AiImageBuffer;
};

export type EnhanceImageInput = {
  image: AiImageBuffer;
  action:
    | 'remove_background'
    | 'upscale'
    | 'crop'
    | 'resize'
    | 'rotate'
    | 'compress'
    | 'convert';
  factor?: 2 | 4;
  ratio?: string;
  width?: number;
  height?: number;
  angle?: number;
  quality?: number;
  format?: 'png' | 'jpeg' | 'webp';
};

export interface AiImageProvider {
  generate(input: GenerateImageInput): Promise<AiImageBuffer>;
  edit(input: EditImageInput): Promise<AiImageBuffer>;
  inpaint(input: InpaintImageInput): Promise<AiImageBuffer>;
}
