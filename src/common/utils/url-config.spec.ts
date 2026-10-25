import { parseCorsOrigins, parseUrlList } from './url-config';

describe('URL environment configuration', () => {
  it('parses comma-separated frontend URLs, trims whitespace and removes trailing slashes', () => {
    expect(
      parseUrlList(
        ' https://event-fe.example.workers.dev/ , http://localhost:5173/ , http://127.0.0.1:5173/ ',
      ),
    ).toEqual([
      'https://event-fe.example.workers.dev',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]);
  });

  it('returns each configured frontend as a distinct normalized CORS origin', () => {
    expect(
      parseCorsOrigins(undefined, [
        'https://event-fe.example.workers.dev/,http://localhost:5173/,http://127.0.0.1:5173/',
      ]),
    ).toEqual([
      'https://event-fe.example.workers.dev',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]);
  });

  it('uses CORS_ORIGIN when explicitly configured', () => {
    expect(
      parseCorsOrigins(
        'https://admin.example.com/, https://user.example.com/',
        ['https://ignored.example.com'],
      ),
    ).toEqual(['https://admin.example.com', 'https://user.example.com']);
  });

  it('rejects an invalid URL rather than silently accepting malformed configuration', () => {
    expect(() => parseUrlList('https://valid.example.com,not-a-url')).toThrow(
      'Invalid URL in comma-separated list at position 2',
    );
  });
});
