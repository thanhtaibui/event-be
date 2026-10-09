import {
  BadRequestException,
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiClientService } from './ai-client.service';
import { AiService } from './ai.service';

describe('AiService', () => {
  it('rejects empty prompt with 400', async () => {
    const client = { chat: jest.fn() };
    const service = new AiService(client as unknown as AiClientService);

    await expect(service.chat('   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(client.chat).not.toHaveBeenCalled();
  });
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

  it('calls Groq and returns normalized chat text', async () => {
    mockFetchResponse(200, {
      choices: [{ message: { content: 'Xin chao Anh Tai Bui' } }],
    });

    const service = new AiClientService();
    const result = await service.chat('Hello');

    expect(result).toBe('Xin chao Anh Tai Bui');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-groq-key',
          'Content-Type': 'application/json',
        }),
      }),
    );

    const [, request] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(request.body);
    expect(body.model).toBe('llama-test-model');
    expect(body.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({ role: 'user', content: 'Hello' }),
      ]),
    );
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

    const service = new AiClientService();

    await expect(service.chat('Hello')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('normalizes empty provider response', async () => {
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
