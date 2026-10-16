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
      { edit: jest.fn() } as any,
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
      { edit: jest.fn() } as any,
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
      undefined,
    );
  });

  it('edits the latest supplied preview and returns the replacement image', async () => {
    const client = {
      chat: jest
        .fn()
        .mockResolvedValueOnce({
          type: 'text',
          mode: 'image_edit_ready',
          locale: 'vi',
          sourceImageUrl: 'https://example.com/image-a.png',
          editInstruction: 'Cho sân khấu lớn hơn',
        })
        .mockResolvedValueOnce({
          type: 'text',
          mode: 'image_edit_ready',
          locale: 'vi',
          sourceImageUrl: 'https://example.com/image-b.png',
          editInstruction: 'Thêm laser',
        }),
    };
    const imageService = {
      edit: jest
        .fn()
        .mockResolvedValueOnce({
          imageUrl: 'https://example.com/image-b.png',
          status: 'preview',
        })
        .mockResolvedValueOnce({
          imageUrl: 'https://example.com/image-c.png',
          status: 'preview',
        }),
    };
    const service = new AiService(
      client as unknown as AiClientService,
      imageService as any,
      mockUserRepo({
        id: 'user-1',
        email: 'tai@example.com',
        fullName: 'Anh Tài Bùi',
        memberships: [],
      }) as any,
    );

    const response = await service.chat(
      'Cho sân khấu lớn hơn',
      AiChatMode.IMAGE_PROMPT_BUILDER,
      { userId: 'user-1' },
      [],
      { currentImageUrl: 'https://example.com/image-a.png', ratio: '16:9' },
    );

    expect(imageService.edit).toHaveBeenCalledWith({
      imageUrl: 'https://example.com/image-a.png',
      description: 'Cho sân khấu lớn hơn',
      ratio: '16:9',
    });
    expect(response).toMatchObject({
      mode: 'image_edit_completed',
      imageResult: {
        imageUrl: 'https://example.com/image-b.png',
        status: 'preview',
      },
    });

    await service.chat(
      'Thêm laser',
      AiChatMode.IMAGE_PROMPT_BUILDER,
      { userId: 'user-1' },
      [],
      { currentImageUrl: 'https://example.com/image-b.png', ratio: '16:9' },
    );
    expect(imageService.edit).toHaveBeenLastCalledWith({
      imageUrl: 'https://example.com/image-b.png',
      description: 'Thêm laser',
      ratio: '16:9',
    });
  });

  it('does not execute edit without an authenticated user', async () => {
    const client = {
      chat: jest.fn().mockResolvedValue({
        type: 'text',
        mode: 'image_edit_ready',
        locale: 'en',
        sourceImageUrl: 'https://example.com/image.png',
        editInstruction: 'Make it brighter',
      }),
    };
    const imageService = { edit: jest.fn() };
    const service = new AiService(
      client as unknown as AiClientService,
      imageService as any,
      mockUserRepo() as any,
    );

    const response = await service.chat(
      'Make it brighter',
      AiChatMode.IMAGE_PROMPT_BUILDER,
      undefined,
      [],
      { currentImageUrl: 'https://example.com/image.png' },
    );

    expect(response.mode).toBe('image_edit_authentication_required');
    expect(imageService.edit).not.toHaveBeenCalled();
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
      locale: 'en',
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

  it('asks for image type when semantic intent is ambiguous', async () => {
    mockSemanticResult('UNKNOWN', {}, 'CREATE');

    const result = await new AiClientService().chat(
      'Cho tôi cái ảnh đẹp đẹp',
      AiChatMode.IMAGE_PROMPT_BUILDER,
    );

    expect(result.mode).toBe('image_type_selecting');
    expect(result.missingFields).toEqual(['imageIntent']);
    expect(result.options).toHaveLength(4);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('routes an edit request to the latest supplied image preview', async () => {
    mockSemanticResult('EVENT_BANNER', {}, 'EDIT');
    const result = await new AiClientService().chat(
      'Cho sân khấu lớn hơn trong ảnh vừa rồi',
      AiChatMode.IMAGE_PROMPT_BUILDER,
      undefined,
      [],
      {
        currentImageUrl: 'https://event-be.onrender.com/tmp/latest.png',
        imageType: 'EVENT_BANNER',
        currentPrompt: 'A concert banner',
      },
    );

    expect(result).toMatchObject({
      mode: 'image_edit_ready',
      intent: 'EDIT',
      sourceImageUrl: 'https://event-be.onrender.com/tmp/latest.png',
      editInstruction: 'Cho sân khấu lớn hơn trong ảnh vừa rồi',
    });
  });

  it('requires a current image before editing', async () => {
    mockSemanticResult('EVENT_BANNER', {}, 'EDIT');
    const result = await new AiClientService().chat(
      'Sửa ảnh này cho sáng hơn',
      AiChatMode.IMAGE_PROMPT_BUILDER,
    );

    expect(result.mode).toBe('image_edit_context_required');
    expect(result.intent).toBe('EDIT');
  });

  it('asks whether an ambiguous request means create or edit', async () => {
    mockSemanticResult('UNKNOWN', {}, 'CLARIFY');
    const result = await new AiClientService().chat(
      'Làm lại đẹp hơn',
      AiChatMode.IMAGE_PROMPT_BUILDER,
      undefined,
      [],
      { currentImageUrl: 'https://event-be.onrender.com/tmp/latest.png' },
    );

    expect(result.mode).toBe('image_action_clarifying');
    expect(result.intent).toBe('CLARIFY');
  });

  it.each([
    'event banner',
    'banner',
    'ảnh banner',
    'tạo banner cho sự kiện',
    'banner sự kiện',
  ])('accepts semantic EVENT_BANNER classification for "%s"', async (input) => {
    mockSemanticResult('EVENT_BANNER', {});

    const result = await new AiClientService().chat(
      input,
      AiChatMode.IMAGE_PROMPT_BUILDER,
    );

    expect(result.mode).toBe('image_prompt_collecting');
    expect(result.imageIntent).toBe('EVENT_BANNER');
    expect(result.missingFields).toContain('eventName');
    const semanticBody = getFetchBody(0);
    expect(semanticBody.messages.at(-1)?.content).toBe(input);
  });

  it('extracts multiple natural-language fields and asks only missing fields', async () => {
    mockSemanticResult('EVENT_BANNER', {
      eventName: 'Saigon Night Fest',
      dateTime: '21/11',
      location: 'SECC',
      theme: 'neon',
    });

    const result = await new AiClientService().chat(
      'Tôi muốn làm banner Saigon Night Fest, ngày 21/11 tại SECC, concept neon.',
      AiChatMode.IMAGE_PROMPT_BUILDER,
    );

    expect(result.mode).toBe('image_prompt_collecting');
    expect(result.missingFields).toEqual([
      'organizer',
      'audience',
      'style',
      'colors',
    ]);
    expect(result.missingFields).not.toContain('eventName');
    expect(result.missingFields).not.toContain('dateTime');
    expect(result.missingFields).not.toContain('location');
    expect(result.missingFields).not.toContain('theme');
  });

  it('keeps image type and prior fields across conversation turns', async () => {
    mockSemanticResult('EVENT_BANNER', {
      eventName: 'Saigon Night Fest 2026',
      organizer: 'Eventix Entertainment',
      dateTime: '21/11/2026, 18:00-23:00',
      location: 'SECC, Quận 7',
      theme: 'Modern Electronic Music Festival',
    });
    const history = [
      {
        role: 'user' as const,
        content: 'Tôi muốn tạo ảnh cho Saigon Night Fest 2026',
      },
      { role: 'assistant' as const, content: 'Bạn muốn tạo loại ảnh nào?' },
      { role: 'user' as const, content: 'banner' },
    ];

    const result = await new AiClientService().chat(
      'Eventix Entertainment tổ chức, ngày 21/11 ở SECC, concept nhạc điện tử.',
      AiChatMode.IMAGE_PROMPT_BUILDER,
      undefined,
      history,
    );

    expect(result.imageIntent).toBe('EVENT_BANNER');
    expect(result.mode).toBe('image_prompt_collecting');
    expect(result.missingFields).not.toContain('eventName');
    expect(result.missingFields).not.toContain('organizer');
    expect(result.missingFields).not.toContain('imageIntent');
    const semanticBody = getFetchBody(0);
    expect(
      semanticBody.messages.map((item: { content: string }) => item.content),
    ).toEqual(expect.arrayContaining(['banner']));
  });

  it('filters unknown fields and validates required fields with TS schema', async () => {
    mockSemanticResult('EVENT_BANNER', {
      eventName: 'Saigon Night Fest 2026',
      organizer: 'Eventix Entertainment',
      unsupportedField: 'must not leak',
    });

    const result = await new AiClientService().chat(
      'Thông tin tiếp theo',
      AiChatMode.IMAGE_PROMPT_BUILDER,
    );

    expect(result.mode).toBe('image_prompt_collecting');
    expect(result.missingFields).toContain('theme');
    expect(result.missingFields).not.toContain('eventName');
    expect(result.missingFields).not.toContain('organizer');
    expect(result.message).not.toContain('unsupportedField');
  });

  it('rejects an image type outside the TS rule engine', async () => {
    mockSemanticResult('WEBSITE_HERO', { title: 'Unknown type' });

    const result = await new AiClientService().chat(
      'Tạo hero website',
      AiChatMode.IMAGE_PROMPT_BUILDER,
    );

    expect(result.mode).toBe('image_type_selecting');
    expect(result.imageIntent).toBeUndefined();
  });

  it('prepares final prompt when semantic state contains all required fields', async () => {
    const extractedData = {
      eventName: 'Saigon Night Fest 2026',
      organizer: 'Eventix Entertainment',
      theme: 'Modern Electronic Music Festival',
      dateTime: 'November 21, 2026, 18:00-23:00',
      location: 'SECC, District 7, Ho Chi Minh City',
      audience: 'Gen Z music fans',
      style: 'Neon, energetic, modern',
      colors: 'Electric blue and magenta',
    };
    mockSemanticResult('EVENT_BANNER', extractedData);
    mockImagePromptResult({
      summary: extractedData,
      prompt: 'Create a professional event banner for Saigon Night Fest 2026.',
      negativePrompt: 'no watermark, no distorted text',
    });

    const result = await new AiClientService().chat(
      'Tôi đã cung cấp đủ thông tin ở trên.',
      AiChatMode.IMAGE_PROMPT_BUILDER,
    );

    expect(result.mode).toBe('image_prompt_ready');
    expect(result.canUseForCreate).toBe(true);
    expect(result.imageIntent).toBe('EVENT_BANNER');
    expect(result.summary).toEqual(extractedData);
    expect(result.prompt).toContain('Saigon Night Fest 2026');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const promptBody = getFetchBody(1);
    expect(promptBody.messages[0].content).toContain('IMAGE DESIGN GUIDE');
    expect(JSON.parse(promptBody.messages.at(-1)?.content || '')).toEqual({
      imageType: 'EVENT_BANNER',
      extractedData,
    });
  });

  it('uses the current schema for organization cover semantic data', async () => {
    const extractedData = {
      organizationName: 'Green Future Community',
      industry: 'Môi trường',
      slogan: 'Grow green together',
      brandMessage: 'Truyền cảm hứng sống xanh',
      targetAudience: 'Gia đình và sinh viên',
      brandColors: 'Xanh lá và be',
      visualStyle: 'Tự nhiên, thân thiện môi trường',
    };
    mockSemanticResult('ORG_COVER', extractedData);
    mockImagePromptResult({ summary: extractedData });

    const result = await new AiClientService().chat(
      'Tạo cover cho tổ chức',
      AiChatMode.IMAGE_PROMPT_BUILDER,
    );

    expect(result.mode).toBe('image_prompt_ready');
    expect(result.imageIntent).toBe('ORG_COVER');
    expect(result.summary).toEqual(extractedData);
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

  function mockSemanticResult(
    imageType: string,
    extractedData: object,
    action?: 'CREATE' | 'EDIT' | 'CLARIFY',
  ) {
    mockFetchResponse(200, {
      choices: [
        {
          message: {
            content: JSON.stringify({
              intent: imageType === 'UNKNOWN' ? 'UNKNOWN' : 'IMAGE_CREATION',
              action,
              imageType,
              extractedData,
            }),
          },
        },
      ],
    });
  }

  function mockImagePromptResult(
    result: {
      summary?: object;
      prompt?: string;
      negativePrompt?: string;
    } = {},
  ) {
    mockFetchResponse(200, {
      choices: [
        {
          message: {
            content: JSON.stringify({
              mode: 'image_prompt_ready',
              summary: result.summary || {},
              prompt: result.prompt || 'Generated image prompt.',
              negativePrompt: result.negativePrompt || 'No watermark.',
            }),
          },
        },
      ],
    });
  }

  function getFetchBody(index: number): {
    messages: Array<{ role: string; content: string }>;
  } {
    const [, request] = (global.fetch as jest.Mock).mock.calls[index];
    return JSON.parse(request.body);
  }

  function mockFetchResponse(status: number, body: unknown) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: jest.fn().mockResolvedValue(body),
      text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    });
  }
});
