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
import { AiChatMode, AiChatResponseDto } from './dto/ai-chat.dto';
import { AiAuthenticatedUser } from './optional-jwt.guard';

const GROQ_CHAT_COMPLETIONS_URL =
  'https://api.groq.com/openai/v1/chat/completions';
const GROQ_CHAT_TIMEOUT_MS = Number(process.env.GROQ_CHAT_TIMEOUT_MS ?? 30000);
const GROQ_MAX_OUTPUT_TOKENS = Number(process.env.GROQ_MAX_OUTPUT_TOKENS ?? 1200);
const IMAGE_DESIGN_GUIDE_PATH = 'AI_EVENT_IMAGE_DESIGN_EXPERT_GUIDE.md';

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

type ImageCreationInfo = {
  eventName?: string;
  organization?: string;
  theme?: string;
  audience?: string;
  styleOrColor?: string;
};

@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);
  private imageDesignGuide?: string;

  async chat(
    message: string,
    mode: AiChatMode = AiChatMode.CHAT,
    user?: AiAuthenticatedUser,
  ): Promise<AiChatResponseDto> {
    const language = this.detectLanguage(message);

    if (mode === AiChatMode.IMAGE_PROMPT_BUILDER) {
      return this.buildImagePrompt(message, language);
    }

    return this.normalChat(message, language, user);
  }

  private async normalChat(
    message: string,
    language: ResponseLanguage,
    user?: AiAuthenticatedUser,
  ): Promise<AiChatResponseDto> {
    const reply = await this.callGroq({
      message,
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
      language,
      content,
      message: content,
      canUseForCreate: false,
    };
  }

  private async buildImagePrompt(
    message: string,
    language: ResponseLanguage,
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
      systemPrompt: this.getImagePromptBuilderSystemPrompt(language),
      temperature: 0.2,
      logScope: 'image_prompt_builder',
    });

    return this.normalizeImagePromptReply(reply, imageCreationInfo, language);
  }

  private async callGroq(params: {
    message: string;
    systemPrompt: string;
    temperature: number;
    logScope: string;
  }): Promise<string> {
    const apiKey = this.getGroqApiKey();
    const model = this.getGroqChatModel();
    this.logger.log(`AI_CHAT:${params.logScope}:groq:${model}`);

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
          messages: [
            {
              role: 'system',
              content: params.systemPrompt,
            },
            { role: 'user', content: params.message },
          ],
          temperature: params.temperature,
          max_tokens: GROQ_MAX_OUTPUT_TOKENS,
        }),
      });

      if (!response.ok) {
        throw await this.normalizeGroqError(
          response,
          params.logScope,
          model,
        );
      }

      const output = (await response.json()) as GroqChatResponse;
      this.logGroqResponseShape(output, params.logScope, model);
      const reply = this.extractGroqReply(output);

      if (!reply) {
        this.logger.error(
          `AI_CHAT_EMPTY_RESPONSE:mode=${params.logScope}:provider=groq:model=${model}:shape=${this.getGroqResponseShape(output)}`,
        );
        throw new BadGatewayException('AI_REQUEST_FAILED');
      }

      return reply;
    } catch (error) {
      if (error instanceof HttpException) {
        this.logger.error(
          `AI_CHAT_EXCEPTION:mode=${params.logScope}:provider=groq:model=${model}:message=${error.message}`,
          error.stack,
        );
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.error(`AI_CHAT_TIMEOUT:${params.logScope}:groq:${model}`);
        throw new GatewayTimeoutException('AI_PROVIDER_TIMEOUT');
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Groq request failed';
      this.logger.error(
        `AI_CHAT_FAILED:${params.logScope}:groq:${model}:${errorMessage}`,
      );

      throw new ServiceUnavailableException('AI_PROVIDER_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }
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
      '{"mode":"image_prompt_ready","summary":{"eventName":"","organization":"","theme":"","audience":"","style":"","colors":""},"imagePrompt":"","negativePrompt":""}',
      '',
      'Rules:',
      '- imagePrompt must be in English and directly usable by image generation.',
      '- imagePrompt must include image type, event name, organization, theme, audience, style, colors, visual direction, composition, and quality requirements.',
      '- negativePrompt must be short and include no fake logo, no watermark, no random text, no Eventix branding, no distorted faces, no messy composition, no low quality text.',
      '- Do not return markdown tables.',
      '- Do not return tutorials.',
      `Display language for summary text: ${language === 'vi' ? 'Vietnamese' : 'English'}.`,
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
    const imagePrompt = String(parsed.imagePrompt || '').trim();
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
      language,
      summary,
      imagePrompt,
      negativePrompt: negativePrompt || this.getDefaultNegativePrompt(),
      canUseForCreate: true,
      actions: ['COPY_PROMPT', 'USE_IN_CREATE'],
      content: this.buildImagePromptReadyMessage(
        summary,
        imagePrompt,
        negativePrompt || this.getDefaultNegativePrompt(),
        language,
      ),
      message: this.buildImagePromptReadyMessage(
        summary,
        imagePrompt,
        negativePrompt || this.getDefaultNegativePrompt(),
        language,
      ),
    };
  }

  private extractImageCreationInfo(message: string): ImageCreationInfo {
    return {
      eventName: this.extractFieldValue(message, [
        'event name',
        'tên sự kiện',
      ]),
      organization: this.extractFieldValue(message, [
        'organization',
        'organizer',
        'tổ chức',
        'đơn vị tổ chức',
      ]),
      theme: this.extractFieldValue(message, ['theme', 'chủ đề']),
      audience: this.extractFieldValue(message, [
        'target audience',
        'audience',
        'đối tượng',
        'khán giả',
      ]),
      styleOrColor: this.extractFieldValue(message, [
        'preferred style/color',
        'style/color',
        'style',
        'color',
        'colors',
        'phong cách',
        'màu',
        'màu sắc',
      ]),
    };
  }

  private extractFieldValue(
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
      ['styleOrColor', info.styleOrColor],
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
      styleOrColor: 'Preferred style/color?',
    };
    const vietnameseQuestionByField: Record<string, string> = {
      eventName: 'Tên sự kiện là gì?',
      organization: 'Đơn vị tổ chức là ai?',
      theme: 'Chủ đề chính của sự kiện là gì?',
      audience: 'Đối tượng tham gia là ai?',
      styleOrColor: 'Phong cách hoặc màu chủ đạo mong muốn là gì?',
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
      mode: 'need_more_information',
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
      style: info.styleOrColor,
      colors: this.extractColorText(info.styleOrColor),
    };
    const imagePrompt = [
      `Create a professional event banner for "${info.eventName}" organized by "${info.organization}".`,
      '',
      `Theme: ${info.theme}.`,
      '',
      `Target audience: ${info.audience}.`,
      '',
      `Style and color direction: ${info.styleOrColor}.`,
      '',
      'Visual direction: create a clean, professional, realistic event visual with a premium event atmosphere, believable environment, clear visual hierarchy, and strong commercial quality.',
      '',
      'Composition: wide event banner composition with clean space for title overlay, balanced lighting, main visual subject supported by a relevant event environment, suitable for Eventix frontend text overlay.',
      '',
      'Quality requirements: high-quality, realistic, professional event marketing image, clean layout, no tutorial-style graphic, no fake text inside the image.',
    ].join('\n');
    const negativePrompt = this.getDefaultNegativePrompt();

    return {
      type: 'text',
      mode: 'image_prompt_ready',
      language,
      summary,
      imagePrompt,
      negativePrompt,
      canUseForCreate: true,
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
      style: this.asOptionalString(source.style) || fallback.styleOrColor,
      colors:
        this.asOptionalString(source.colors) ||
        this.extractColorText(fallback.styleOrColor),
    };
  }

  private buildImagePromptReadyMessage(
    summary: AiChatResponseDto['summary'],
    imagePrompt: string,
    negativePrompt: string,
    language: ResponseLanguage,
  ): string {
    const summaryLabel = language === 'vi' ? 'TOM_TAT' : 'SUMMARY';

    return [
      `${summaryLabel}:`,
      `eventName: ${summary?.eventName || 'N/A'}`,
      `organization: ${summary?.organization || 'N/A'}`,
      `theme: ${summary?.theme || 'N/A'}`,
      `audience: ${summary?.audience || 'N/A'}`,
      `style: ${summary?.style || 'N/A'}`,
      `colors: ${summary?.colors || 'N/A'}`,
      '',
      'IMAGE_PROMPT_READY:',
      imagePrompt,
      '',
      'NEGATIVE_PROMPT:',
      negativePrompt,
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

  private getDefaultNegativePrompt(): string {
    return [
      'no fake logo',
      'no watermark',
      'no random text',
      'no Eventix branding',
      'no distorted faces',
      'no messy composition',
      'no low quality text',
    ].join(', ');
  }

  private asOptionalString(value: unknown): string | undefined {
    const normalized = String(value || '').trim();
    return normalized || undefined;
  }

  private extractColorText(styleOrColor?: string): string | undefined {
    if (!styleOrColor) {
      return undefined;
    }

    const colorMatch = styleOrColor.match(
      /(green|white|blue|red|gold|black|purple|yellow|orange|pink|gray|grey|màu[^,.;]*)[\w\s,/-]*/i,
    );

    return colorMatch?.[0]?.trim() || styleOrColor;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async normalizeGroqError(
    response: Response,
    mode: string,
    model: string,
  ): Promise<HttpException> {
    const body = await response.text().catch(() => '');
    const normalizedBody = body.toLowerCase();
    const safeBody = this.sanitizeProviderErrorBody(body);

    this.logger.error(
      `AI_CHAT_PROVIDER_ERROR:mode=${mode}:provider=groq:model=${model}:status=${response.status}:body=${safeBody}`,
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

  private sanitizeProviderErrorBody(body: string): string {
    return body
      .replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED_API_KEY]')
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
      .slice(0, 2000);
  }
}
