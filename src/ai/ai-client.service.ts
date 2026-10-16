import {
  BadRequestException,
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AiChatHistoryMessageDto,
  AiChatMode,
  AiChatResponseDto,
} from './dto/ai-chat.dto';
import { AiAuthenticatedUser } from './optional-jwt.guard';

const GROQ_CHAT_COMPLETIONS_URL =
  'https://api.groq.com/openai/v1/chat/completions';
const GROQ_CHAT_TIMEOUT_MS = Math.max(
  Number(process.env.GROQ_CHAT_TIMEOUT_MS ?? 30000),
  30000,
);
const GROQ_MAX_OUTPUT_TOKENS = Number(
  process.env.GROQ_MAX_OUTPUT_TOKENS ?? 1200,
);
const IMAGE_DESIGN_GUIDE_PATH = 'AI_EVENT_IMAGE_DESIGN_EXPERT_GUIDE.md';
const GROQ_MAX_RETRIES = 2;
const GROQ_RETRY_DELAY_MS = 1000;

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
      reasoning_content?: string;
      [key: string]: unknown;
    };
    text?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

type ResponseLanguage = 'vi' | 'en';
type GroqMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ImageIntent =
  | 'EVENT_BANNER'
  | 'ORG_COVER'
  | 'SQUARE_POST'
  | 'POSTER_STORY';

type ImagePromptInfo = Record<string, string | undefined>;

type ImageSemanticResult = {
  intent: 'IMAGE_CREATION' | 'UNKNOWN';
  imageType?: ImageIntent;
  extractedData: ImagePromptInfo;
};

type ImagePromptField = {
  key: string;
  question: Record<ResponseLanguage, string>;
  promptLabel: Record<ResponseLanguage, string>;
};

type ImagePromptSchema = {
  intent: ImageIntent;
  label: Record<ResponseLanguage, string>;
  promptSubject: Record<ResponseLanguage, string>;
  fields: ImagePromptField[];
};

const IMAGE_PROMPT_SCHEMAS: Record<ImageIntent, ImagePromptSchema> = {
  EVENT_BANNER: {
    intent: 'EVENT_BANNER',
    label: {
      vi: 'Banner sự kiện',
      en: 'Event banner',
    },
    promptSubject: {
      vi: 'banner sự kiện khổ ngang chuyên nghiệp',
      en: 'professional horizontal event banner',
    },
    fields: [
      {
        key: 'eventName',
        question: { vi: 'Tên sự kiện là gì?', en: 'Event name?' },
        promptLabel: { vi: 'Tên sự kiện', en: 'Event name' },
      },
      {
        key: 'organizer',
        question: { vi: 'Đơn vị tổ chức là ai?', en: 'Organizer?' },
        promptLabel: { vi: 'Đơn vị tổ chức', en: 'Organizer' },
      },
      {
        key: 'theme',
        question: { vi: 'Chủ đề chính của sự kiện là gì?', en: 'Theme?' },
        promptLabel: { vi: 'Chủ đề', en: 'Theme' },
      },
      {
        key: 'dateTime',
        question: { vi: 'Thời gian diễn ra là khi nào?', en: 'Date/time?' },
        promptLabel: { vi: 'Thời gian', en: 'Date/time' },
      },
      {
        key: 'location',
        question: { vi: 'Địa điểm tổ chức ở đâu?', en: 'Location?' },
        promptLabel: { vi: 'Địa điểm', en: 'Location' },
      },
      {
        key: 'audience',
        question: { vi: 'Đối tượng tham gia là ai?', en: 'Target audience?' },
        promptLabel: { vi: 'Đối tượng', en: 'Audience' },
      },
      {
        key: 'style',
        question: { vi: 'Phong cách mong muốn là gì?', en: 'Preferred style?' },
        promptLabel: { vi: 'Phong cách', en: 'Style' },
      },
      {
        key: 'colors',
        question: {
          vi: 'Màu chủ đạo mong muốn là gì?',
          en: 'Preferred colors?',
        },
        promptLabel: { vi: 'Màu sắc', en: 'Colors' },
      },
    ],
  },
  ORG_COVER: {
    intent: 'ORG_COVER',
    label: { vi: 'Cover tổ chức', en: 'Organization cover' },
    promptSubject: {
      vi: 'ảnh cover tổ chức chuyên nghiệp',
      en: 'professional organization cover image',
    },
    fields: [
      {
        key: 'organizationName',
        question: { vi: 'Tên tổ chức là gì?', en: 'Organization name?' },
        promptLabel: { vi: 'Tên tổ chức', en: 'Organization name' },
      },
      {
        key: 'industry',
        question: { vi: 'Tổ chức thuộc lĩnh vực nào?', en: 'Industry?' },
        promptLabel: { vi: 'Lĩnh vực', en: 'Industry' },
      },
      {
        key: 'slogan',
        question: { vi: 'Slogan hoặc tagline là gì?', en: 'Slogan/tagline?' },
        promptLabel: { vi: 'Slogan', en: 'Slogan' },
      },
      {
        key: 'brandMessage',
        question: {
          vi: 'Thông điệp thương hiệu muốn truyền tải là gì?',
          en: 'Brand message?',
        },
        promptLabel: { vi: 'Thông điệp thương hiệu', en: 'Brand message' },
      },
      {
        key: 'targetAudience',
        question: {
          vi: 'Đối tượng mục tiêu của tổ chức là ai?',
          en: 'Target audience?',
        },
        promptLabel: { vi: 'Đối tượng mục tiêu', en: 'Target audience' },
      },
      {
        key: 'brandColors',
        question: { vi: 'Màu thương hiệu là gì?', en: 'Brand colors?' },
        promptLabel: { vi: 'Màu thương hiệu', en: 'Brand colors' },
      },
      {
        key: 'visualStyle',
        question: {
          vi: 'Phong cách hình ảnh mong muốn là gì?',
          en: 'Visual style?',
        },
        promptLabel: { vi: 'Phong cách hình ảnh', en: 'Visual style' },
      },
    ],
  },
  SQUARE_POST: {
    intent: 'SQUARE_POST',
    label: { vi: 'Bài đăng vuông', en: 'Square post' },
    promptSubject: {
      vi: 'bài đăng vuông chuyên nghiệp cho mạng xã hội',
      en: 'professional square social media post',
    },
    fields: [
      {
        key: 'postPurpose',
        question: { vi: 'Mục đích bài đăng là gì?', en: 'Post purpose?' },
        promptLabel: { vi: 'Mục đích bài đăng', en: 'Post purpose' },
      },
      {
        key: 'headline',
        question: { vi: 'Tiêu đề chính là gì?', en: 'Headline?' },
        promptLabel: { vi: 'Tiêu đề', en: 'Headline' },
      },
      {
        key: 'content',
        question: {
          vi: 'Nội dung chính muốn truyền tải là gì?',
          en: 'Content?',
        },
        promptLabel: { vi: 'Nội dung', en: 'Content' },
      },
      {
        key: 'cta',
        question: { vi: 'CTA/kêu gọi hành động là gì?', en: 'CTA?' },
        promptLabel: { vi: 'CTA', en: 'CTA' },
      },
      {
        key: 'style',
        question: { vi: 'Phong cách mong muốn là gì?', en: 'Style?' },
        promptLabel: { vi: 'Phong cách', en: 'Style' },
      },
      {
        key: 'colors',
        question: { vi: 'Màu chủ đạo mong muốn là gì?', en: 'Colors?' },
        promptLabel: { vi: 'Màu sắc', en: 'Colors' },
      },
    ],
  },
  POSTER_STORY: {
    intent: 'POSTER_STORY',
    label: { vi: 'Poster / Story', en: 'Poster / Story' },
    promptSubject: {
      vi: 'poster hoặc story dọc chuyên nghiệp',
      en: 'professional vertical poster or story visual',
    },
    fields: [
      {
        key: 'title',
        question: { vi: 'Tiêu đề chính là gì?', en: 'Title?' },
        promptLabel: { vi: 'Tiêu đề', en: 'Title' },
      },
      {
        key: 'mainMessage',
        question: { vi: 'Thông điệp chính là gì?', en: 'Main message?' },
        promptLabel: { vi: 'Thông điệp chính', en: 'Main message' },
      },
      {
        key: 'cta',
        question: { vi: 'CTA/kêu gọi hành động là gì?', en: 'CTA?' },
        promptLabel: { vi: 'CTA', en: 'CTA' },
      },
      {
        key: 'audience',
        question: { vi: 'Đối tượng hướng tới là ai?', en: 'Audience?' },
        promptLabel: { vi: 'Đối tượng', en: 'Audience' },
      },
      {
        key: 'style',
        question: { vi: 'Phong cách mong muốn là gì?', en: 'Style?' },
        promptLabel: { vi: 'Phong cách', en: 'Style' },
      },
      {
        key: 'colors',
        question: { vi: 'Màu chủ đạo mong muốn là gì?', en: 'Colors?' },
        promptLabel: { vi: 'Màu sắc', en: 'Colors' },
      },
    ],
  },
};

@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);
  private imageDesignGuide?: string;

  async chat(
    message: string,
    mode: AiChatMode = AiChatMode.CHAT,
    user?: AiAuthenticatedUser,
    history?: AiChatHistoryMessageDto[],
  ): Promise<AiChatResponseDto> {
    const language = this.detectLanguage(
      mode === AiChatMode.IMAGE_PROMPT_BUILDER
        ? this.buildConversationText(message, history)
        : message,
    );

    if (mode === AiChatMode.IMAGE_PROMPT_BUILDER) {
      return this.buildImagePrompt(message, language, history);
    }

    return this.normalChat(message, language, user, history);
  }

  private async normalChat(
    message: string,
    language: ResponseLanguage,
    user?: AiAuthenticatedUser,
    history?: AiChatHistoryMessageDto[],
  ): Promise<AiChatResponseDto> {
    const reply = await this.callGroq({
      message,
      history,
      systemPrompt: this.getNormalChatSystemPrompt(language, user),
      temperature: 0.3,
      logScope: 'chat',
    });

    const parsed = this.tryParseJson(reply);
    const content =
      parsed && typeof parsed.message === 'string'
        ? parsed.message.trim()
        : reply;

    return {
      type: 'text',
      mode: 'chat',
      locale: language,
      language,
      content,
      message: content,
      canUseForCreate: false,
    };
  }

  private async buildImagePrompt(
    message: string,
    language: ResponseLanguage,
    history?: AiChatHistoryMessageDto[],
  ): Promise<AiChatResponseDto> {
    const semanticResult = await this.understandImageRequest(
      message,
      history,
      language,
    );
    const imageIntent = semanticResult.imageType;
    if (!imageIntent) {
      return this.buildImageTypeSelectionResponse(language);
    }

    const schema = IMAGE_PROMPT_SCHEMAS[imageIntent];
    const imageCreationInfo = this.normalizeExtractedImageData(
      semanticResult.extractedData,
      schema,
    );
    const missingImageInfo = this.getMissingImageCreationFields(
      imageCreationInfo,
      schema,
    );

    if (missingImageInfo.length > 0) {
      return this.buildNeedMoreInformationResponse(
        this.getImageCreationQuestions(missingImageInfo, schema, language),
        missingImageInfo,
        imageIntent,
        language,
      );
    }

    const reply = await this.callGroq({
      message: JSON.stringify({
        imageType: imageIntent,
        extractedData: imageCreationInfo,
      }),
      systemPrompt: this.getImagePromptBuilderSystemPrompt(language, schema),
      temperature: 0.2,
      logScope: 'image_prompt_builder',
    });

    return this.normalizeImagePromptReply(
      reply,
      imageCreationInfo,
      schema,
      language,
    );
  }

  private async understandImageRequest(
    message: string,
    history: AiChatHistoryMessageDto[] = [],
    language: ResponseLanguage,
  ): Promise<ImageSemanticResult> {
    const reply = await this.callGroq({
      message,
      history,
      systemPrompt: this.getImageSemanticUnderstandingSystemPrompt(language),
      temperature: 0,
      logScope: 'image_semantic_understanding',
    });
    const parsed = this.tryParseJson(reply);

    if (!parsed) {
      this.logger.warn('AI_IMAGE_SEMANTIC_INVALID_JSON');
      return { intent: 'UNKNOWN', extractedData: {} };
    }

    const imageType = this.asImageIntent(parsed.imageType);
    const extractedData =
      parsed.extractedData && typeof parsed.extractedData === 'object'
        ? (parsed.extractedData as Record<string, unknown>)
        : {};

    if (parsed.intent !== 'IMAGE_CREATION' || !imageType) {
      return { intent: 'UNKNOWN', extractedData: {} };
    }

    return {
      intent: 'IMAGE_CREATION',
      imageType,
      extractedData: Object.entries(extractedData).reduce<ImagePromptInfo>(
        (normalized, [key, value]) => {
          normalized[key] = this.asOptionalString(value);
          return normalized;
        },
        {},
      ),
    };
  }

  private async callGroq(params: {
    message: string;
    history?: AiChatHistoryMessageDto[];
    systemPrompt: string;
    temperature: number;
    logScope: string;
  }): Promise<string> {
    const apiKey = this.getGroqApiKey();
    const model = this.getGroqChatModel();
    const messages = this.buildGroqMessages(
      params.systemPrompt,
      params.message,
      params.history,
    );
    const totalCharacters = this.countMessageCharacters(messages);

    this.logger.log(
      `AI_CHAT_REQUEST:mode=${params.logScope}:provider=groq:model=${model}:messages=${messages.length}:chars=${totalCharacters}`,
    );

    for (let attempt = 0; attempt <= GROQ_MAX_RETRIES; attempt += 1) {
      const startedAt = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        GROQ_CHAT_TIMEOUT_MS,
      );

      try {
        const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages,
            temperature: params.temperature,
            max_tokens: GROQ_MAX_OUTPUT_TOKENS,
          }),
        });
        const latencyMs = Date.now() - startedAt;

        if (!response.ok) {
          throw await this.normalizeGroqError(
            response,
            params.logScope,
            model,
            latencyMs,
            attempt,
          );
        }

        const output = (await response.json()) as GroqChatResponse;
        this.logGroqResponseShape(output, params.logScope, model);
        const reply = this.extractGroqReply(output);

        this.logger.log(
          `AI_CHAT_RESPONSE:mode=${params.logScope}:provider=groq:model=${model}:attempt=${attempt + 1}:status=${response.status}:latency=${latencyMs}ms:length=${reply?.length ?? 0}`,
        );

        if (!reply) {
          const emptyError = new BadGatewayException('AI_REQUEST_FAILED');
          this.logger.error(
            `AI_CHAT_EMPTY_RESPONSE:mode=${params.logScope}:provider=groq:model=${model}:attempt=${attempt + 1}:shape=${this.getGroqResponseShape(output)}`,
            emptyError.stack,
          );

          if (attempt < GROQ_MAX_RETRIES) {
            await this.delay(GROQ_RETRY_DELAY_MS);
            continue;
          }

          throw emptyError;
        }

        return reply;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          const timeoutError = new GatewayTimeoutException(
            'AI_PROVIDER_TIMEOUT',
          );
          this.logger.error(
            `AI_CHAT_TIMEOUT:mode=${params.logScope}:provider=groq:model=${model}:attempt=${attempt + 1}:timeout=${GROQ_CHAT_TIMEOUT_MS}ms`,
            timeoutError.stack,
          );

          if (attempt < GROQ_MAX_RETRIES) {
            await this.delay(GROQ_RETRY_DELAY_MS);
            continue;
          }

          throw timeoutError;
        }

        if (error instanceof HttpException) {
          this.logger.error(
            `AI_CHAT_EXCEPTION:mode=${params.logScope}:provider=groq:model=${model}:attempt=${attempt + 1}:message=${error.message}`,
            error.stack,
          );

          if (this.isRetryableAiError(error) && attempt < GROQ_MAX_RETRIES) {
            await this.delay(GROQ_RETRY_DELAY_MS);
            continue;
          }

          throw error;
        }

        const errorMessage =
          error instanceof Error ? error.message : 'Groq request failed';
        this.logger.error(
          `AI_CHAT_FAILED:mode=${params.logScope}:provider=groq:model=${model}:attempt=${attempt + 1}:message=${errorMessage}`,
          error instanceof Error ? error.stack : undefined,
        );

        if (attempt < GROQ_MAX_RETRIES) {
          await this.delay(GROQ_RETRY_DELAY_MS);
          continue;
        }

        throw new ServiceUnavailableException('AI_PROVIDER_UNAVAILABLE');
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new ServiceUnavailableException('AI_PROVIDER_UNAVAILABLE');
  }

  private buildGroqMessages(
    systemPrompt: string,
    message: string,
    history: AiChatHistoryMessageDto[] = [],
  ): GroqMessage[] {
    const historyMessages = history
      .map((item) => this.normalizeGroqMessage(item))
      .filter((item): item is GroqMessage => Boolean(item));
    const currentMessage = this.normalizeGroqMessage({
      role: 'user',
      content: message,
    });
    const conversationMessages = [
      ...historyMessages,
      ...(currentMessage ? [currentMessage] : []),
    ].slice(-10);

    return [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...conversationMessages,
    ];
  }

  private normalizeGroqMessage(
    message: Pick<GroqMessage, 'role' | 'content'>,
  ): GroqMessage | undefined {
    const role = message.role;
    const content =
      typeof message.content === 'string' ? message.content.trim() : '';

    if (!['system', 'user', 'assistant'].includes(role) || !content) {
      return undefined;
    }

    if (this.isPreviousErrorMessage(content)) {
      return undefined;
    }

    return { role, content };
  }

  private isPreviousErrorMessage(content: string): boolean {
    const normalized = content.toUpperCase();
    return [
      'AI_REQUEST_FAILED',
      'AI_PROVIDER_TIMEOUT',
      'AI_CHAT_EMPTY_RESPONSE',
      'AI_PROVIDER_UNAVAILABLE',
      'AI_RATE_LIMITED',
    ].some((errorCode) => normalized.includes(errorCode));
  }

  private countMessageCharacters(messages: GroqMessage[]): number {
    return messages.reduce(
      (total, message) => total + message.content.length,
      0,
    );
  }

  private extractGroqReply(output: GroqChatResponse): string | undefined {
    const firstChoice = output.choices?.[0];
    const candidates = [
      firstChoice?.message?.content,
      firstChoice?.message?.reasoning_content,
      firstChoice?.text,
    ];

    return candidates
      .map((candidate) =>
        typeof candidate === 'string' ? candidate.trim() : '',
      )
      .find(Boolean);
  }

  private logGroqResponseShape(
    output: GroqChatResponse,
    mode: string,
    model: string,
  ): void {
    this.logger.debug(
      `AI_CHAT_RESPONSE_SHAPE:mode=${mode}:provider=groq:model=${model}:shape=${this.getGroqResponseShape(output)}`,
    );
  }

  private getGroqResponseShape(output: GroqChatResponse): string {
    const firstChoice = output.choices?.[0];
    const message =
      firstChoice?.message && typeof firstChoice.message === 'object'
        ? firstChoice.message
        : undefined;

    return JSON.stringify({
      responseKeys: Object.keys(output || {}),
      choicesLength: output.choices?.length ?? 0,
      firstChoiceKeys:
        firstChoice && typeof firstChoice === 'object'
          ? Object.keys(firstChoice)
          : [],
      messageKeys: message ? Object.keys(message) : [],
    });
  }

  private getGroqApiKey(): string {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      this.logger.warn('AI_CHAT_CONFIG_MISSING:GROQ_API_KEY');
      throw new ServiceUnavailableException(
        'AI_PROVIDER_CONFIGURATION_ERROR: GROQ_API_KEY is missing',
      );
    }

    return apiKey;
  }

  private getGroqChatModel(): string {
    const model = process.env.GROQ_CHAT_MODEL?.trim();
    if (!model) {
      this.logger.warn('AI_CHAT_CONFIG_MISSING:GROQ_CHAT_MODEL');
      throw new ServiceUnavailableException(
        'AI_PROVIDER_CONFIGURATION_ERROR: GROQ_CHAT_MODEL is missing',
      );
    }

    return model;
  }

  private getNormalChatSystemPrompt(
    language: ResponseLanguage,
    user?: AiAuthenticatedUser,
  ): string {
    return [
      'You are Eventix AI Event Assistant.',
      'Mode: CHAT.',
      'Help with general questions, event ideas, planning, content, scripts, reports, and product support.',
      'Do not generate image prompt structures in CHAT mode.',
      'Do not use or mention the Event Image Design Expert Guide in CHAT mode.',
      'Return compact valid JSON only: {"mode":"chat","message":"..."}',
      `Answer language: ${language === 'vi' ? 'Vietnamese' : 'English'}.`,
      '',
      this.buildSafeUserContext(user),
    ].join('\n');
  }

  private getImagePromptBuilderSystemPrompt(
    language: ResponseLanguage,
    schema: ImagePromptSchema,
  ): string {
    return [
      'You are Eventix AI Creative Assistant.',
      'Mode: IMAGE_PROMPT_BUILDER.',
      `Image intent: ${schema.intent} (${schema.label.en}).`,
      'Your job is to create production-ready image prompts, not tutorials or design lessons.',
      'Use the design guide below as private system knowledge only. Do not send it to the image model as a separate document.',
      '',
      'Required output must be compact valid JSON only:',
      `{"mode":"image_prompt_ready","imageIntent":"${schema.intent}","summary":{},"prompt":"","negativePrompt":""}`,
      '',
      'Rules:',
      `- prompt and negativePrompt must be written in ${language === 'vi' ? 'Vietnamese' : 'English'}.`,
      '- prompt must be directly usable by image generation.',
      `- prompt must be for ${schema.promptSubject.en}.`,
      `- summary must include these keys: ${schema.fields.map((field) => field.key).join(', ')}.`,
      '- prompt must include image type, all collected information, visual direction, composition, and quality requirements.',
      '- negativePrompt must be short, clear, and aligned with the same language.',
      '- Do not return markdown tables.',
      '- Do not return tutorials.',
      `Display language for all user-facing fields: ${language === 'vi' ? 'Vietnamese' : 'English'}.`,
      '',
      'IMAGE DESIGN GUIDE:',
      this.getImageDesignGuide(),
    ].join('\n');
  }

  private getImageSemanticUnderstandingSystemPrompt(
    language: ResponseLanguage,
  ): string {
    const schemas = Object.values(IMAGE_PROMPT_SCHEMAS).map((schema) => ({
      imageType: schema.intent,
      fields: schema.fields.map((field) => field.key),
    }));

    return [
      'You are the semantic understanding layer for Eventix image prompt conversations.',
      'Understand natural Vietnamese or English, short answers, synonyms, and fields supplied in any order.',
      'Read the complete conversation. Merge facts from earlier user turns with the latest user message.',
      'Never reset a previously established image type or field unless the user explicitly corrects it.',
      'Map the request to exactly one supported imageType only when the meaning is clear.',
      'A generic banner request in image creation mode means EVENT_BANNER.',
      'If the image type is ambiguous, return UNKNOWN. Do not guess.',
      'Extract every fact already provided. Preserve the user language and wording in field values.',
      'Do not invent missing values and do not add keys outside the selected schema.',
      `User-facing language context: ${language === 'vi' ? 'Vietnamese' : 'English'}.`,
      '',
      `Supported schemas: ${JSON.stringify(schemas)}`,
      '',
      'Return compact valid JSON only:',
      '{"intent":"IMAGE_CREATION|UNKNOWN","imageType":"EVENT_BANNER|ORG_COVER|SQUARE_POST|POSTER_STORY|UNKNOWN","extractedData":{}}',
    ].join('\n');
  }

  private buildSafeUserContext(user?: AiAuthenticatedUser): string {
    if (!user) {
      return 'Current authenticated user context: Not available.';
    }

    const role = user.role || {};
    const permissions = Array.isArray(user.permissions)
      ? user.permissions.join(', ')
      : Array.isArray(role.permissions)
        ? role.permissions.join(', ')
        : undefined;
    const organizations = Array.isArray(user.organizations)
      ? user.organizations
          .map((organization) =>
            [
              organization.name || 'N/A',
              organization.slug ? `slug: ${organization.slug}` : undefined,
              organization.roleName || organization.roleCode
                ? `role: ${organization.roleName || organization.roleCode}`
                : undefined,
            ]
              .filter(Boolean)
              .join(' | '),
          )
          .join('; ')
      : undefined;

    return [
      'Current authenticated user context:',
      `User ID: ${user.userId || 'N/A'}`,
      `Name: ${user.fullName || 'N/A'}`,
      `Email: ${user.email || 'N/A'}`,
      `Organization: ${organizations || 'N/A'}`,
      `Role: ${role.isSuperAdmin ? 'Super Admin' : 'See organization roles'}`,
      `Permissions: ${permissions || 'N/A'}`,
      'Never reveal secrets, tokens, raw JWT, or credentials.',
    ].join('\n');
  }

  private buildConversationText(
    message: string,
    history: AiChatHistoryMessageDto[] = [],
  ): string {
    return [
      ...history
        .filter((item) => item.role === 'user')
        .map((item) => item.content),
      message,
    ].join('\n');
  }

  private getImageIntentOptions(language: ResponseLanguage): Array<{
    label: string;
    value: ImageIntent;
  }> {
    return Object.values(IMAGE_PROMPT_SCHEMAS).map((schema) => ({
      label: schema.label[language],
      value: schema.intent,
    }));
  }

  private getImageDesignGuide(): string {
    if (this.imageDesignGuide !== undefined) {
      return this.imageDesignGuide;
    }

    const guidePath = join(process.cwd(), IMAGE_DESIGN_GUIDE_PATH);
    if (!existsSync(guidePath)) {
      this.logger.warn(`AI_IMAGE_GUIDE_MISSING:${IMAGE_DESIGN_GUIDE_PATH}`);
      this.imageDesignGuide = '';
      return this.imageDesignGuide;
    }

    this.imageDesignGuide = readFileSync(guidePath, 'utf8');
    return this.imageDesignGuide;
  }

  private normalizeImagePromptReply(
    reply: string,
    imageCreationInfo: ImagePromptInfo,
    schema: ImagePromptSchema,
    language: ResponseLanguage,
  ): AiChatResponseDto {
    const parsed = this.tryParseJson(reply);
    if (!parsed || parsed.mode !== 'image_prompt_ready') {
      return this.buildImagePromptReadyResponseFromInfo(
        imageCreationInfo,
        schema,
        language,
      );
    }

    const summary = this.normalizeSummary(
      parsed.summary,
      imageCreationInfo,
      schema,
    );
    const imagePrompt =
      this.asOptionalString(parsed.prompt) ||
      this.asOptionalString(parsed.imagePrompt) ||
      '';
    const negativePrompt = this.asOptionalString(parsed.negativePrompt) || '';

    if (!imagePrompt) {
      return this.buildImagePromptReadyResponseFromInfo(
        imageCreationInfo,
        schema,
        language,
      );
    }

    return {
      type: 'text',
      mode: 'image_prompt_ready',
      locale: language,
      language,
      imageIntent: schema.intent,
      summary,
      prompt: imagePrompt,
      imagePrompt,
      negativePrompt: negativePrompt || this.getDefaultNegativePrompt(language),
      canUseForCreate: true,
      display: this.getImagePromptDisplay(language),
      actions: ['COPY_PROMPT', 'USE_IN_CREATE'],
      content: this.buildImagePromptReadyMessage(
        summary,
        imagePrompt,
        negativePrompt || this.getDefaultNegativePrompt(language),
        language,
        schema,
      ),
      message: this.buildImagePromptReadyMessage(
        summary,
        imagePrompt,
        negativePrompt || this.getDefaultNegativePrompt(language),
        language,
        schema,
      ),
    };
  }

  private normalizeExtractedImageData(
    extractedData: ImagePromptInfo,
    schema: ImagePromptSchema,
  ): ImagePromptInfo {
    return schema.fields.reduce<ImagePromptInfo>((info, field) => {
      info[field.key] = this.cleanExtractedValue(extractedData[field.key]);
      return info;
    }, {});
  }

  private cleanExtractedValue(value?: string): string | undefined {
    const normalized = value
      ?.trim()
      .replace(/^[\s:：,-]+/, '')
      .replace(/[\s.。]+$/, '')
      .trim();

    return normalized || undefined;
  }

  private getMissingImageCreationFields(
    info: ImagePromptInfo,
    schema: ImagePromptSchema,
  ): string[] {
    return schema.fields
      .filter((field) => !info[field.key])
      .map((field) => field.key);
  }

  private getImageCreationQuestions(
    missingFields: string[],
    schema: ImagePromptSchema,
    language: ResponseLanguage,
  ): string[] {
    return missingFields
      .map(
        (field) =>
          schema.fields.find((schemaField) => schemaField.key === field)
            ?.question[language],
      )
      .filter((question): question is string => Boolean(question))
      .slice(0, 5);
  }

  private buildNeedMoreInformationResponse(
    questions: string[],
    missingFields: string[],
    imageIntent: ImageIntent,
    language: ResponseLanguage,
  ): AiChatResponseDto {
    const intro =
      language === 'vi'
        ? 'Mình cần thêm một vài thông tin để tạo hình ảnh sự kiện:'
        : 'I need some more information to create your event image:';

    return {
      type: 'text',
      mode: 'image_prompt_collecting',
      locale: language,
      language,
      imageIntent,
      canUseForCreate: false,
      questions,
      missingFields,
      content: [intro, ...questions.map((question) => `- ${question}`)].join(
        '\n',
      ),
      message: [intro, ...questions.map((question) => `- ${question}`)].join(
        '\n',
      ),
    };
  }

  private buildImageTypeSelectionResponse(
    language: ResponseLanguage,
  ): AiChatResponseDto {
    const options = this.getImageIntentOptions(language);
    const intro =
      language === 'vi'
        ? 'Bạn muốn tạo loại ảnh nào?'
        : 'Which image type do you want to create?';

    return {
      type: 'text',
      mode: 'image_type_selecting',
      locale: language,
      language,
      canUseForCreate: false,
      questions: [intro],
      missingFields: ['imageIntent'],
      options,
      content: [intro, ...options.map((option) => `- ${option.label}`)].join(
        '\n',
      ),
      message: [intro, ...options.map((option) => `- ${option.label}`)].join(
        '\n',
      ),
    };
  }

  private buildImagePromptReadyResponseFromInfo(
    info: ImagePromptInfo,
    schema: ImagePromptSchema,
    language: ResponseLanguage,
  ): AiChatResponseDto {
    const summary = this.normalizeSummary(info, info, schema);
    const imagePrompt = this.buildLocalizedFallbackPrompt(
      info,
      schema,
      language,
    );
    const negativePrompt = this.getDefaultNegativePrompt(language);

    return {
      type: 'text',
      mode: 'image_prompt_ready',
      locale: language,
      language,
      imageIntent: schema.intent,
      summary,
      prompt: imagePrompt,
      imagePrompt,
      negativePrompt,
      canUseForCreate: true,
      display: this.getImagePromptDisplay(language),
      actions: ['COPY_PROMPT', 'USE_IN_CREATE'],
      content: this.buildImagePromptReadyMessage(
        summary,
        imagePrompt,
        negativePrompt,
        language,
        schema,
      ),
      message: this.buildImagePromptReadyMessage(
        summary,
        imagePrompt,
        negativePrompt,
        language,
        schema,
      ),
    };
  }

  private tryParseJson(reply: string): Record<string, unknown> | null {
    const cleaned = reply.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch?.[0] || cleaned;

    try {
      const parsed: unknown = JSON.parse(jsonText);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  private normalizeSummary(
    summary: unknown,
    fallback: ImagePromptInfo,
    schema: ImagePromptSchema,
  ): AiChatResponseDto['summary'] {
    const value = summary && typeof summary === 'object' ? summary : {};
    const source = value as Record<string, unknown>;

    return schema.fields.reduce<Record<string, string | undefined>>(
      (normalized, field) => {
        normalized[field.key] =
          this.asOptionalString(source[field.key]) || fallback[field.key];
        return normalized;
      },
      {},
    );
  }

  private buildImagePromptReadyMessage(
    summary: AiChatResponseDto['summary'],
    imagePrompt: string,
    negativePrompt: string,
    language: ResponseLanguage,
    schema?: ImagePromptSchema,
  ): string {
    const display = this.getImagePromptDisplay(language);
    const fields = schema?.fields || [];
    const summaryLines = fields.map((field) => {
      const label = field.promptLabel[language];
      return `- ${label}: ${summary?.[field.key] || 'N/A'}`;
    });

    return [
      `${display.summaryTitle}:`,
      ...summaryLines,
      '',
      `${display.promptTitle}:`,
      imagePrompt,
      '',
      `${display.negativePromptTitle}:`,
      negativePrompt,
      '',
      display.hint,
    ].join('\n');
  }

  private detectLanguage(message: string): ResponseLanguage {
    const normalized = message.toLowerCase();
    if (
      normalized.includes('answer in english') ||
      normalized.includes('reply in english') ||
      normalized.includes('trả lời bằng tiếng anh') ||
      normalized.includes('tra loi bang tieng anh')
    ) {
      return 'en';
    }

    if (
      normalized.includes('trả lời tiếng việt') ||
      normalized.includes('trả lời bằng tiếng việt') ||
      normalized.includes('tra loi tieng viet')
    ) {
      return 'vi';
    }

    return /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(
      message,
    )
      ? 'vi'
      : 'en';
  }

  private getDefaultNegativePrompt(language: ResponseLanguage): string {
    if (language === 'vi') {
      return [
        'Không dùng logo website',
        'không dùng watermark',
        'không thêm chữ ngẫu nhiên',
        'không dùng thương hiệu Eventix',
        'không làm méo khuôn mặt',
        'không bố cục rối',
        'không chữ chất lượng thấp',
      ].join(', ');
    }

    return [
      'no website logo',
      'no watermark',
      'no random text',
      'no Eventix branding',
      'no distorted faces',
      'no messy composition',
      'no low quality text',
    ].join(', ');
  }

  private getImagePromptDisplay(language: ResponseLanguage) {
    if (language === 'vi') {
      return {
        summaryTitle: 'Tóm tắt thông tin',
        promptTitle: 'Prompt dùng cho Tạo ảnh',
        negativePromptTitle: 'Negative prompt',
        hint: 'Bạn có thể sao chép prompt bên dưới để dùng trong mục Tạo ảnh.',
      };
    }

    return {
      summaryTitle: 'Information summary',
      promptTitle: 'Prompt for Create Image',
      negativePromptTitle: 'Negative prompt',
      hint: 'You can copy the prompt below and use it in Create Image.',
    };
  }

  private buildLocalizedFallbackPrompt(
    info: ImagePromptInfo,
    schema: ImagePromptSchema,
    language: ResponseLanguage,
  ): string {
    const fieldLines = schema.fields.map(
      (field) => `${field.promptLabel[language]}: ${info[field.key]}.`,
    );

    if (language === 'vi') {
      return [
        `Tạo ${schema.promptSubject.vi}.`,
        ...fieldLines,
        'Định hướng hình ảnh: chuyên nghiệp, chân thực, bố cục rõ ràng, phù hợp cho mục tiêu truyền thông.',
        'Bố cục: có khoảng trống sạch để đặt tiêu đề hoặc nội dung chính, ánh sáng cân bằng, chủ thể nổi bật và bối cảnh liên quan.',
        'Yêu cầu chất lượng: hình ảnh sắc nét, hiện đại, đáng tin cậy, không giống ảnh mẫu đại trà, không thêm chữ giả khó đọc trong ảnh.',
      ].join('\n');
    }

    return [
      `Create a ${schema.promptSubject.en}.`,
      ...fieldLines,
      'Visual direction: premium, professional, realistic visual atmosphere with clear hierarchy and strong marketing quality.',
      'Composition: clean layout with space for title or key message, balanced lighting, a strong main subject, and relevant context.',
      'Quality requirements: sharp, modern, trustworthy, non-generic, no unreadable fake text inside the image.',
    ].join('\n');
  }

  private asOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string' && typeof value !== 'number') {
      return undefined;
    }

    const normalized = String(value).trim();
    return normalized || undefined;
  }

  private asImageIntent(value: unknown): ImageIntent | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();
    return Object.prototype.hasOwnProperty.call(
      IMAGE_PROMPT_SCHEMAS,
      normalized,
    )
      ? (normalized as ImageIntent)
      : undefined;
  }

  private async normalizeGroqError(
    response: Response,
    mode: string,
    model: string,
    latencyMs: number,
    attempt: number,
  ): Promise<HttpException> {
    const body = await response.text().catch(() => '');
    const normalizedBody = body.toLowerCase();
    const safeBody = this.sanitizeProviderErrorBody(body);

    this.logger.error(
      `AI_CHAT_PROVIDER_ERROR:mode=${mode}:provider=groq:model=${model}:attempt=${attempt + 1}:status=${response.status}:latency=${latencyMs}ms:body=${safeBody}`,
    );

    if (response.status === Number(HttpStatus.TOO_MANY_REQUESTS)) {
      return new HttpException('AI_RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (
      response.status === Number(HttpStatus.UNAUTHORIZED) ||
      response.status === Number(HttpStatus.FORBIDDEN)
    ) {
      return new ServiceUnavailableException('AI_PROVIDER_CONFIGURATION_ERROR');
    }

    if (
      normalizedBody.includes('model') &&
      (normalizedBody.includes('not found') ||
        normalizedBody.includes('decommissioned') ||
        normalizedBody.includes('does not exist') ||
        normalizedBody.includes('not available'))
    ) {
      return new BadRequestException('AI_MODEL_UNAVAILABLE');
    }

    if (response.status >= 500) {
      return new ServiceUnavailableException('AI_PROVIDER_UNAVAILABLE');
    }

    return new BadGatewayException('AI_REQUEST_FAILED');
  }

  private isRetryableAiError(error: HttpException): boolean {
    const status = error.getStatus();
    return [
      HttpStatus.REQUEST_TIMEOUT,
      HttpStatus.TOO_MANY_REQUESTS,
      HttpStatus.BAD_GATEWAY,
      HttpStatus.SERVICE_UNAVAILABLE,
      HttpStatus.GATEWAY_TIMEOUT,
    ].includes(status);
  }

  private sanitizeProviderErrorBody(body: string): string {
    return body
      .replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED_API_KEY]')
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
      .slice(0, 2000);
  }

  private async delay(milliseconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
