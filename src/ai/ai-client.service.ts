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
const GROQ_MAX_OUTPUT_TOKENS = Number(process.env.GROQ_MAX_OUTPUT_TOKENS ?? 1200);
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

type ImageCreationInfo = {
  eventName?: string;
  organization?: string;
  theme?: string;
  audience?: string;
  style?: string;
  colors?: string;
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
    const language = this.detectLanguage(message);

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
    const imageCreationInfo = this.extractImageCreationInfo(message);
    const missingImageInfo =
      this.getMissingImageCreationFields(imageCreationInfo);

    if (missingImageInfo.length > 0) {
      return this.buildNeedMoreInformationResponse(
        this.getImageCreationQuestions(missingImageInfo, language),
        missingImageInfo,
        language,
      );
    }

    const reply = await this.callGroq({
      message,
      history,
      systemPrompt: this.getImagePromptBuilderSystemPrompt(language),
      temperature: 0.2,
      logScope: 'image_prompt_builder',
    });

    return this.normalizeImagePromptReply(reply, imageCreationInfo, language);
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
      const timeout = setTimeout(() => controller.abort(), GROQ_CHAT_TIMEOUT_MS);

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
    return messages.reduce((total, message) => total + message.content.length, 0);
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
  ): string {
    return [
      'You are Eventix AI Creative Assistant.',
      'Mode: IMAGE_PROMPT_BUILDER.',
      'Your job is to create production-ready image prompts, not tutorials or design lessons.',
      'Use the design guide below as private system knowledge only. Do not send it to the image model as a separate document.',
      '',
      'Required output must be compact valid JSON only:',
      '{"mode":"image_prompt_ready","summary":{"eventName":"","organization":"","theme":"","audience":"","style":"","colors":""},"prompt":"","negativePrompt":""}',
      '',
      'Rules:',
      `- prompt and negativePrompt must be written in ${language === 'vi' ? 'Vietnamese' : 'English'}.`,
      '- prompt must be directly usable by image generation.',
      '- prompt must include image type, event name, organization, theme, audience, style, colors, visual direction, composition, and quality requirements.',
      '- negativePrompt must be short, clear, and aligned with the same language.',
      '- Do not return markdown tables.',
      '- Do not return tutorials.',
      `Display language for all user-facing fields: ${language === 'vi' ? 'Vietnamese' : 'English'}.`,
      '',
      'IMAGE DESIGN GUIDE:',
      this.getImageDesignGuide(),
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
    imageCreationInfo: ImageCreationInfo,
    language: ResponseLanguage,
  ): AiChatResponseDto {
    const parsed = this.tryParseJson(reply);
    if (!parsed || parsed.mode !== 'image_prompt_ready') {
      return this.buildImagePromptReadyResponseFromInfo(
        imageCreationInfo,
        language,
      );
    }

    const summary = this.normalizeSummary(parsed.summary, imageCreationInfo);
    const imagePrompt = String(parsed.prompt || parsed.imagePrompt || '').trim();
    const negativePrompt = String(parsed.negativePrompt || '').trim();

    if (!imagePrompt) {
      return this.buildImagePromptReadyResponseFromInfo(
        imageCreationInfo,
        language,
      );
    }

    return {
      type: 'text',
      mode: 'image_prompt_ready',
      locale: language,
      language,
      summary,
      prompt: imagePrompt,
      imagePrompt,
      negativePrompt:
        negativePrompt || this.getDefaultNegativePrompt(language),
      canUseForCreate: true,
      display: this.getImagePromptDisplay(language),
      actions: ['COPY_PROMPT', 'USE_IN_CREATE'],
      content: this.buildImagePromptReadyMessage(
        summary,
        imagePrompt,
        negativePrompt || this.getDefaultNegativePrompt(language),
        language,
      ),
      message: this.buildImagePromptReadyMessage(
        summary,
        imagePrompt,
        negativePrompt || this.getDefaultNegativePrompt(language),
        language,
      ),
    };
  }

  private extractImageCreationInfo(message: string): ImageCreationInfo {
    const info = {
      eventName: this.extractFieldValueByLabels(message, [
        'event name',
        'tên sự kiện',
        'sự kiện',
      ]),
      organization: this.extractFieldValueByLabels(message, [
        'organization',
        'organizer',
        'tổ chức',
        'đơn vị tổ chức',
      ]),
      theme: this.extractFieldValueByLabels(message, [
        'theme',
        'chủ đề',
        'chủ đề chính',
      ]),
      audience: this.extractFieldValueByLabels(message, [
        'target audience',
        'audience',
        'đối tượng',
        'đối tượng tham gia',
        'khán giả',
        'khách chính',
      ]),
      style: this.extractFieldValueByLabels(message, [
        'preferred style',
        'style',
        'phong cách',
      ]),
      colors: this.extractFieldValueByLabels(message, [
        'preferred colors',
        'color',
        'colors',
        'màu',
        'màu sắc',
        'màu chủ đạo',
      ]),
    };

    return this.normalizeImageCreationInfo({
      eventName: info.eventName || this.extractNaturalField(message, 'eventName'),
      organization:
        info.organization || this.extractNaturalField(message, 'organization'),
      theme: info.theme || this.extractNaturalField(message, 'theme'),
      audience: info.audience || this.extractNaturalField(message, 'audience'),
      style: info.style || this.extractNaturalField(message, 'style'),
      colors: info.colors || this.extractNaturalField(message, 'colors'),
    });
  }

  private extractFieldValueByLabels(
    message: string,
    labels: string[],
  ): string | undefined {
    const lines = message.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      for (const label of labels) {
        const pattern = new RegExp(
          `^\\s*${this.escapeRegExp(label)}\\s*[:：]\\s*(.+)$`,
          'i',
        );
        const match = line.match(pattern);
        if (match?.[1]?.trim()) {
          return match[1].trim();
        }

        const labelOnlyPattern = new RegExp(
          `^\\s*${this.escapeRegExp(label)}\\s*[:：]\\s*$`,
          'i',
        );
        if (labelOnlyPattern.test(line)) {
          const nextValue = this.findNextNonEmptyLine(lines, index + 1);
          if (nextValue) {
            return nextValue;
          }
        }
      }
    }

    return undefined;
  }

  private extractNaturalField(
    message: string,
    field: keyof ImageCreationInfo,
  ): string | undefined {
    const patternsByField: Record<keyof ImageCreationInfo, RegExp[]> = {
      eventName: [
        /(?:tên\s+)?sự kiện(?:\s+của tôi)?\s+(?:là|tên là)\s+([^.\n]+)/i,
        /(?:my\s+)?event(?:\s+name)?\s+(?:is|called)\s+([^.\n]+)/i,
      ],
      organization: [
        /([^.\n]+?)\s+(?:tổ chức|là đơn vị tổ chức)(?:[.\n]|$)/i,
        /(?:đơn vị tổ chức|tổ chức)\s+(?:là|:)?\s*([^.\n]+)/i,
        /([^.\n]+?)\s+(?:organizes|is organizing|is the organizer)(?:[.\n]|$)/i,
        /(?:organization|organizer)\s+(?:is|:)?\s*([^.\n]+)/i,
      ],
      theme: [
        /(?:chủ đề|chủ đề chính)\s+(?:về|là|:)\s*([^.\n]+)/i,
        /theme\s+(?:is|about|:)\s*([^.\n]+)/i,
      ],
      audience: [
        /(?:khách chính|đối tượng(?: tham gia)?|khán giả)\s+(?:là|:)\s*([^.\n]+)/i,
        /(?:target audience|audience)\s+(?:is|are|:)\s*([^.\n]+)/i,
      ],
      style: [
        /(?:muốn|mong muốn)?\s*phong cách\s+(?:là|:)?\s*([^.\n]+)/i,
        /style\s+(?:is|:)\s*([^.\n]+)/i,
      ],
      colors: [
        /(?:màu|màu sắc|màu chủ đạo)\s+(?:là|:)?\s*([^.\n]+)/i,
        /colors?\s+(?:is|are|:)\s*([^.\n]+)/i,
      ],
    };

    for (const pattern of patternsByField[field]) {
      const match = message.match(pattern);
      const value = this.cleanExtractedValue(match?.[1]);
      if (value) {
        return value;
      }
    }

    return undefined;
  }

  private normalizeImageCreationInfo(info: ImageCreationInfo): ImageCreationInfo {
    return {
      eventName: this.cleanExtractedValue(info.eventName),
      organization: this.cleanExtractedValue(info.organization),
      theme: this.cleanExtractedValue(info.theme),
      audience: this.cleanExtractedValue(info.audience),
      style: this.cleanExtractedValue(info.style),
      colors: this.cleanExtractedValue(info.colors),
    };
  }

  private cleanExtractedValue(value?: string): string | undefined {
    const normalized = value
      ?.trim()
      .replace(/^[\s:：,-]+/, '')
      .replace(/[\s.。]+$/, '')
      .trim();

    return normalized || undefined;
  }

  private findNextNonEmptyLine(
    lines: string[],
    startIndex: number,
  ): string | undefined {
    for (let index = startIndex; index < lines.length; index += 1) {
      const value = lines[index].trim();
      if (value) {
        return value;
      }
    }

    return undefined;
  }

  private getMissingImageCreationFields(info: ImageCreationInfo): string[] {
    const checks: Array<[string, string | undefined]> = [
      ['eventName', info.eventName],
      ['organization', info.organization],
      ['theme', info.theme],
      ['audience', info.audience],
      ['style', info.style],
      ['colors', info.colors],
    ];

    return checks.filter(([, value]) => !value).map(([field]) => field);
  }

  private getImageCreationQuestions(
    missingFields: string[],
    language: ResponseLanguage,
  ): string[] {
    const englishQuestionByField: Record<string, string> = {
      eventName: 'Event name?',
      organization: 'Organization?',
      theme: 'Theme?',
      audience: 'Target audience?',
      style: 'Preferred style?',
      colors: 'Preferred colors?',
    };
    const vietnameseQuestionByField: Record<string, string> = {
      eventName: 'Tên sự kiện là gì?',
      organization: 'Đơn vị tổ chức là ai?',
      theme: 'Chủ đề chính của sự kiện là gì?',
      audience: 'Đối tượng tham gia là ai?',
      style: 'Phong cách mong muốn là gì?',
      colors: 'Màu chủ đạo mong muốn là gì?',
    };
    const questionByField =
      language === 'vi' ? vietnameseQuestionByField : englishQuestionByField;

    return missingFields
      .map((field) => questionByField[field])
      .filter(Boolean)
      .slice(0, 5);
  }

  private buildNeedMoreInformationResponse(
    questions: string[],
    missingFields: string[],
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

  private buildImagePromptReadyResponseFromInfo(
    info: ImageCreationInfo,
    language: ResponseLanguage,
  ): AiChatResponseDto {
    const summary = {
      eventName: info.eventName,
      organization: info.organization,
      theme: info.theme,
      audience: info.audience,
      style: info.style,
      colors: info.colors,
    };
    const imagePrompt = this.buildLocalizedFallbackPrompt(info, language);
    const negativePrompt = this.getDefaultNegativePrompt(language);

    return {
      type: 'text',
      mode: 'image_prompt_ready',
      locale: language,
      language,
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
      ),
      message: this.buildImagePromptReadyMessage(
        summary,
        imagePrompt,
        negativePrompt,
        language,
      ),
    };
  }

  private tryParseJson(reply: string): Record<string, any> | null {
    const cleaned = reply.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch?.[0] || cleaned;

    try {
      return JSON.parse(jsonText);
    } catch {
      return null;
    }
  }

  private normalizeSummary(
    summary: unknown,
    fallback: ImageCreationInfo,
  ): AiChatResponseDto['summary'] {
    const value = summary && typeof summary === 'object' ? summary : {};
    const source = value as Record<string, unknown>;

    return {
      eventName: this.asOptionalString(source.eventName) || fallback.eventName,
      organization:
        this.asOptionalString(source.organization) || fallback.organization,
      theme: this.asOptionalString(source.theme) || fallback.theme,
      audience: this.asOptionalString(source.audience) || fallback.audience,
      style: this.asOptionalString(source.style) || fallback.style,
      colors: this.asOptionalString(source.colors) || fallback.colors,
    };
  }

  private buildImagePromptReadyMessage(
    summary: AiChatResponseDto['summary'],
    imagePrompt: string,
    negativePrompt: string,
    language: ResponseLanguage,
  ): string {
    const display = this.getImagePromptDisplay(language);
    const labels =
      language === 'vi'
        ? {
            eventName: 'Tên sự kiện',
            organization: 'Đơn vị tổ chức',
            theme: 'Chủ đề',
            audience: 'Đối tượng',
            style: 'Phong cách',
            colors: 'Màu sắc',
          }
        : {
            eventName: 'Event name',
            organization: 'Organization',
            theme: 'Theme',
            audience: 'Audience',
            style: 'Style',
            colors: 'Colors',
          };

    return [
      `${display.summaryTitle}:`,
      `- ${labels.eventName}: ${summary?.eventName || 'N/A'}`,
      `- ${labels.organization}: ${summary?.organization || 'N/A'}`,
      `- ${labels.theme}: ${summary?.theme || 'N/A'}`,
      `- ${labels.audience}: ${summary?.audience || 'N/A'}`,
      `- ${labels.style}: ${summary?.style || 'N/A'}`,
      `- ${labels.colors}: ${summary?.colors || 'N/A'}`,
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
    info: ImageCreationInfo,
    language: ResponseLanguage,
  ): string {
    if (language === 'vi') {
      return [
        `Tạo banner sự kiện khổ ngang chuyên nghiệp cho "${info.eventName}" do "${info.organization}" tổ chức.`,
        `Chủ đề: ${info.theme}.`,
        `Đối tượng mục tiêu: ${info.audience}.`,
        `Phong cách: ${info.style}.`,
        `Màu sắc: ${info.colors}.`,
        'Định hướng hình ảnh: không khí sự kiện cao cấp, chuyên nghiệp, chân thực, bố cục rõ ràng, phù hợp cho truyền thông sự kiện.',
        'Bố cục: banner ngang, có khoảng trống sạch để đặt tiêu đề, ánh sáng cân bằng, chủ thể chính nổi bật và bối cảnh liên quan đến sự kiện.',
        'Yêu cầu chất lượng: hình ảnh sắc nét, hiện đại, đáng tin cậy, không giống ảnh mẫu đại trà, không thêm chữ giả khó đọc trong ảnh.',
      ].join('\n');
    }

    return [
      `Create a professional horizontal event banner for "${info.eventName}" organized by "${info.organization}".`,
      `Theme: ${info.theme}.`,
      `Target audience: ${info.audience}.`,
      `Style direction: ${info.style}.`,
      `Color palette: ${info.colors}.`,
      'Visual direction: premium, professional, realistic event atmosphere with clear hierarchy and strong marketing quality.',
      'Composition: wide banner layout with clean space for title overlay, balanced lighting, a strong main subject, and a relevant event environment.',
      'Quality requirements: sharp, modern, trustworthy, non-generic, no unreadable fake text inside the image.',
    ].join('\n');
  }

  private asOptionalString(value: unknown): string | undefined {
    const normalized = String(value || '').trim();
    return normalized || undefined;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

    if (response.status === HttpStatus.TOO_MANY_REQUESTS) {
      return new HttpException('AI_RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (
      response.status === HttpStatus.UNAUTHORIZED ||
      response.status === HttpStatus.FORBIDDEN
    ) {
      return new ServiceUnavailableException(
        'AI_PROVIDER_CONFIGURATION_ERROR',
      );
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
