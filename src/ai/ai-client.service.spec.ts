import {
  BadRequestException,
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiClientService } from './ai-client.service';
import { AiService } from './ai.service';
import { AiChatMode } from './dto/ai-chat.dto';

describe('AiService', () => {
  it('rejects empty prompt with 400', async () => {
    const client = { chat: jest.fn() };
    const service = new AiService(
      client as unknown as AiClientService,
      mockUserRepo() as any,
    );

    await expect(service.chat('   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(client.chat).not.toHaveBeenCalled();
  });

  it('passes mode and user context to client', async () => {
    const client = {
      chat: jest.fn().mockResolvedValue({ type: 'text', message: 'ok' }),
    };
    const service = new AiService(
      client as unknown as AiClientService,
      mockUserRepo({
        id: 'user-1',
        email: 'tai@example.com',
        fullName: 'Anh Tài Bùi',
        memberships: [],
      }) as any,
    );
    const user = {
      userId: 'user-1',
      email: 'tai@example.com',
      fullName: 'Anh Tài Bùi',
    };

    const history = [{ role: 'user' as const, content: 'hello' }];

    await service.chat('Who am I?', AiChatMode.CHAT, user, history);

    expect(client.chat).toHaveBeenCalledWith(
      'Who am I?',
      AiChatMode.CHAT,
      expect.objectContaining({
        userId: 'user-1',
        email: 'tai@example.com',
        fullName: 'Anh Tài Bùi',
      }),
      history,
    );
  });

  function mockUserRepo(user?: unknown) {
    return {
      findOne: jest.fn().mockResolvedValue(user),
    };
  }
});

describe('AiClientService', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    process.env = {
      ...originalEnv,
      GROQ_API_KEY: 'test-groq-key',
      GROQ_CHAT_MODEL: 'llama-test-model',
    };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('uses chat mode for normal chat and injects safe user context', async () => {
    mockFetchResponse(200, {
      choices: [
        {
          message: {
            content: JSON.stringify({
              mode: 'chat',
              message: 'You are Anh Tài Bùi.',
            }),
          },
        },
      ],
    });

    const service = new AiClientService();
    const result = await service.chat('Who am I?', AiChatMode.CHAT, {
      userId: 'user-1',
      fullName: 'Anh Tài Bùi',
      email: 'tai@example.com',
      role: {
        isSuperAdmin: true,
        permissions: ['*'],
      },
    });

    expect(result).toEqual({
      type: 'text',
      message: 'You are Anh Tài Bùi.',
      content: 'You are Anh Tài Bùi.',
      mode: 'chat',
      language: 'en',
      canUseForCreate: false,
    });

    const [, request] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(request.body);
    expect(body.model).toBe('llama-test-model');
    expect(body.messages[0].content).toContain('Mode: CHAT.');
    expect(body.messages[0].content).toContain('Name: Anh Tài Bùi');
    expect(body.messages[0].content).not.toContain('IMAGE DESIGN GUIDE');
  });

  it('does not force image prompt mode when client sends chat', async () => {
    mockFetchResponse(200, {
      choices: [
        {
          message: {
            content: JSON.stringify({
              mode: 'chat',
              message: 'I can help you discuss the banner idea.',
            }),
          },
        },
      ],
    });

    const service = new AiClientService();
    const result = await service.chat(
      'I want to create an event banner',
      AiChatMode.CHAT,
    );

    expect(result.mode).toBe('chat');
    expect(result.message).toContain('banner idea');
    expect(global.fetch).toHaveBeenCalled();
  });

  it('sanitizes history and keeps only the last 10 valid conversation messages', async () => {
    mockFetchResponse(200, {
      choices: [
        {
          message: {
            content: JSON.stringify({
              mode: 'chat',
              message: 'ok',
            }),
          },
        },
      ],
    });

    const service = new AiClientService();
    await service.chat('current message', AiChatMode.CHAT, undefined, [
      { role: 'user', content: 'old-1' },
      { role: 'assistant', content: 'AI_REQUEST_FAILED' },
      { role: 'user', content: '' },
      ...Array.from({ length: 12 }, (_, index) => ({
        role: 'user' as const,
        content: `valid-${index + 1}`,
      })),
    ]);

    const [, request] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(request.body);

    expect(body.messages).toHaveLength(11);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].content).toBe('valid-4');
    expect(body.messages[10].content).toBe('current message');
    expect(
      body.messages.some((message: { content: string }) =>
        message.content.includes('AI_REQUEST_FAILED'),
      ),
    ).toBe(false);
  });

  it('retries once when Groq returns empty response and then succeeds', async () => {
    mockFetchResponse(200, { choices: [{ message: { content: '' } }] });
    mockFetchResponse(200, {
      choices: [
        {
          message: {
            content: JSON.stringify({
              mode: 'chat',
              message: 'Recovered response.',
            }),
          },
        },
      ],
    });

    const service = new AiClientService();
    const result = await service.chat('hello', AiChatMode.CHAT);

    expect(result.content).toBe('Recovered response.');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('supports Groq reasoning_content response fallback', async () => {
    mockFetchResponse(200, {
      choices: [
        {
          message: {
            content: '',
            reasoning_content: JSON.stringify({
              mode: 'chat',
              message: 'Hello from reasoning content.',
            }),
          },
        },
      ],
    });

    const service = new AiClientService();
    const result = await service.chat('hello', AiChatMode.CHAT);

    expect(result.mode).toBe('chat');
    expect(result.content).toBe('Hello from reasoning content.');
  });

  it('supports Groq text response fallback', async () => {
    mockFetchResponse(200, {
      choices: [
        {
          text: JSON.stringify({
            mode: 'chat',
            message: 'Hello from text fallback.',
          }),
        },
      ],
    });

    const service = new AiClientService();
    const result = await service.chat('hello', AiChatMode.CHAT);

    expect(result.mode).toBe('chat');
    expect(result.content).toBe('Hello from text fallback.');
  });

  it('handles 20 consecutive chat messages without provider failures', async () => {
    const messages = [
      'xin chào',
      'bạn có thể giúp gì',
      'tôi là ai',
      'tôi muốn tạo event',
      'gợi ý ý tưởng',
      'viết mô tả',
      'cảm ơn',
      'hello',
      'what can you do',
      'who are you',
      'help me plan',
      'write event content',
      'suggest agenda',
      'make it shorter',
      'translate to English',
      'add call to action',
      'give me 3 options',
      'explain ticket flow',
      'summarize',
      'thanks',
    ];

    for (const [index] of messages.entries()) {
      mockFetchResponse(200, {
        choices: [
          {
            message: {
              content: JSON.stringify({
                mode: 'chat',
                message: `ok-${index + 1}`,
              }),
            },
          },
        ],
      });
    }

    const service = new AiClientService();

    for (const [index, message] of messages.entries()) {
      const result = await service.chat(message, AiChatMode.CHAT);
      expect(result.content).toBe(`ok-${index + 1}`);
    }

    expect(global.fetch).toHaveBeenCalledTimes(20);
  });

  it('asks for missing information in image_prompt_builder mode', async () => {
    const service = new AiClientService();
    const result = await service.chat(
      'I need a banner for agriculture event',
      AiChatMode.IMAGE_PROMPT_BUILDER,
    );

    expect(result.mode).toBe('need_more_information');
    expect(result.canUseForCreate).toBe(false);
    expect(result.content).toContain(
      'I need some more information to create your event image:',
    );
    expect(result.language).toBe('en');
    expect(result.message).toContain(
      'I need some more information to create your event image:',
    );
    expect(result.questions).toEqual([
      'Event name?',
      'Organization?',
      'Theme?',
      'Target audience?',
      'Preferred style/color?',
    ]);
    expect(result.missingFields).toContain('eventName');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns image prompt ready structure in image_prompt_builder mode', async () => {
    mockFetchResponse(200, {
      choices: [
        {
          message: {
            content: JSON.stringify({
              mode: 'image_prompt_ready',
              summary: {
                eventName: 'Green Future Agriculture Expo 2026',
                organization: 'GreenFarm Vietnam',
                theme: 'Smart agriculture, IoT and sustainability',
                audience:
                  'Agricultural businesses, investors, technology experts',
                style: 'Natural premium, environmental technology',
                colors: 'Green and white',
              },
              imagePrompt:
                'Create a professional event banner for Green Future Agriculture Expo 2026. Organization: GreenFarm Vietnam. Theme: smart agriculture, IoT, sustainability. Target audience: agricultural businesses, investors, technology experts. Style: natural premium environmental technology. Color palette: green and white. Composition: wide event banner with clean space for title overlay.',
              negativePrompt:
                'no fake logo, no watermark, no random text, no Eventix branding, no distorted faces, no messy composition, no low quality text',
            }),
          },
        },
      ],
    });

    const service = new AiClientService();
    const result = await service.chat(
      [
        'Event name:',
        'Green Future Agriculture Expo 2026',
        '',
        'Organization:',
        'GreenFarm Vietnam',
        '',
        'Theme:',
        'Smart agriculture, IoT and sustainable development',
        '',
        'Target audience:',
        'Agricultural businesses, investors, technology experts',
        '',
        'Preferred style/color:',
        'Natural premium, environmental technology, green and white',
      ].join('\n'),
      AiChatMode.IMAGE_PROMPT_BUILDER,
    );

    expect(result.mode).toBe('image_prompt_ready');
    expect(result.canUseForCreate).toBe(true);
    expect(result.language).toBe('en');
    expect(result.actions).toEqual(['COPY_PROMPT', 'USE_IN_CREATE']);
    expect(result.summary?.eventName).toBe(
      'Green Future Agriculture Expo 2026',
    );
    expect(result.imagePrompt).toContain('Create a professional event banner');
    expect(result.negativePrompt).toContain('no Eventix branding');
    expect(result.content).toContain('IMAGE_PROMPT_READY:');
    expect(result.message).toContain('IMAGE_PROMPT_READY:');

    const [, request] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(request.body);
    expect(body.messages[0].content).toContain('Mode: IMAGE_PROMPT_BUILDER.');
    expect(body.messages[0].content).toContain('IMAGE DESIGN GUIDE');
  });

  it('falls back to structured prompt when image provider returns wrong mode', async () => {
    mockFetchResponse(200, {
      choices: [
        {
          message: {
            content: JSON.stringify({
              mode: 'chat',
              message: 'Here is a guide to creating banners...',
            }),
          },
        },
      ],
    });

    const service = new AiClientService();
    const result = await service.chat(
      [
        'Event name: Green Future Agriculture Expo 2026',
        'Organization: GreenFarm Vietnam',
        'Theme: Smart agriculture and IoT',
        'Audience: Agricultural businesses',
        'Style: Natural premium',
        'Colors: Green and white',
      ].join('\n'),
      AiChatMode.IMAGE_PROMPT_BUILDER,
    );

    expect(result.mode).toBe('image_prompt_ready');
    expect(result.canUseForCreate).toBe(true);
    expect(result.message).not.toContain('guide to creating banners');
    expect(result.message).toContain('IMAGE_PROMPT_READY:');
  });

  it('returns controlled error when GROQ_API_KEY is missing', async () => {
    delete process.env.GROQ_API_KEY;

    const service = new AiClientService();

    await expect(service.chat('Hello')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns controlled error when GROQ_CHAT_MODEL is missing', async () => {
    delete process.env.GROQ_CHAT_MODEL;

    const service = new AiClientService();

    await expect(service.chat('Hello')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('normalizes Groq rate limit errors', async () => {
    expect.assertions(3);
    mockFetchResponse(429, { error: { message: 'rate limit exceeded' } });
    mockFetchResponse(429, { error: { message: 'rate limit exceeded' } });
    mockFetchResponse(429, { error: { message: 'rate limit exceeded' } });

    const service = new AiClientService();

    await service.chat('Hello').catch((error: unknown) => {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as Error).message).toBe('AI_RATE_LIMITED');
    });
  });

  it('normalizes unavailable model errors', async () => {
    mockFetchResponse(400, { error: { message: 'model does not exist' } });

    const service = new AiClientService();

    await expect(service.chat('Hello')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('normalizes upstream unavailable errors', async () => {
    mockFetchResponse(503, { error: { message: 'service unavailable' } });
    mockFetchResponse(503, { error: { message: 'service unavailable' } });
    mockFetchResponse(503, { error: { message: 'service unavailable' } });

    const service = new AiClientService();

    await expect(service.chat('Hello')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('normalizes empty provider response', async () => {
    mockFetchResponse(200, { choices: [{ message: { content: '' } }] });
    mockFetchResponse(200, { choices: [{ message: { content: '' } }] });
    mockFetchResponse(200, { choices: [{ message: { content: '' } }] });

    const service = new AiClientService();

    await expect(service.chat('Hello')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('normalizes provider timeout', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    );
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    );
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    );

    const service = new AiClientService();

    await expect(service.chat('Hello')).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
  });

  function mockFetchResponse(status: number, body: unknown) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: jest.fn().mockResolvedValue(body),
      text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    });
  }
});
