jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/data/user/0/com.papermind/files',
  exists: jest.fn().mockResolvedValue(false),
  mkdir: jest.fn().mockResolvedValue(undefined),
}));

import {completeCloud, testConnection} from '../cloudService';
import {useSettingsStore} from '@/stores/settingsStore';

const sseChunks = [
  'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
  'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
  'data: [DONE]\n\n',
];

function sseBody() {
  return {
    getReader: () => {
      let i = 0;
      return {
        read: async () =>
          i < sseChunks.length
            ? {done: false, value: new TextEncoder().encode(sseChunks[i++])}
            : {done: true, value: undefined},
      };
    },
  };
}

function mockFetch(response: Partial<Response>) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: sseBody(),
    json: async () => ({}),
    ...response,
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({
    provider: 'cloud',
    cloudBaseUrl: 'https://api.example.com/v1',
    cloudApiKey: 'test-key',
    cloudModel: 'test-model',
  });
});

it('streams tokens from SSE and returns full text', async () => {
  mockFetch({});
  let received = '';
  const result = await completeCloud([{role: 'user', content: 'hi'}], {
    onToken: t => (received += t),
  });
  expect(received).toBe('Hello world');
  expect(result).toBe('Hello world');
});

it('posts correct OpenAI-compatible body and auth header', async () => {
  mockFetch({});
  await completeCloud([{role: 'user', content: 'hi'}], {temperature: 0.5});
  const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe('https://api.example.com/v1/chat/completions');
  expect(JSON.parse(init.body)).toEqual({
    model: 'test-model',
    messages: [{role: 'user', content: 'hi'}],
    stream: true,
    temperature: 0.5,
    max_tokens: 1024,
  });
  expect(init.headers.Authorization).toBe('Bearer test-key');
});

it('non-streaming fallback when streaming fails', async () => {
  mockFetch({});
  global.fetch = jest
    .fn()
    .mockRejectedValueOnce(new Error('stream failed'))
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{message: {content: 'fallback answer'}}],
      }),
    }) as unknown as typeof fetch;
  const result = await completeCloud([{role: 'user', content: 'hi'}]);
  expect(result).toBe('fallback answer');
});

it('testConnection reports ok with latency', async () => {
  mockFetch({});
  const res = await testConnection();
  expect(res.ok).toBe(true);
  expect(res.latencyMs).toBeGreaterThanOrEqual(0);
});

it('testConnection reports error on failure', async () => {
  global.fetch = jest
    .fn()
    .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
  const res = await testConnection();
  expect(res.ok).toBe(false);
  expect(res.error).toContain('network down');
});

describe('30s request timeout', () => {
  function hangingFetch(init?: RequestInit) {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  }

  function expectCloudTimeout(promise: Promise<string>): Promise<void> {
    return expect(promise).rejects.toThrow('Request timed out (30s)');
  }

  function expectConnectionTimeout(promise: Promise<unknown>): Promise<void> {
    return expect(promise).resolves.toEqual({
      ok: false,
      error: 'Request timed out (30s)',
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('completeCloud rejects with the timeout message when the request hangs', async () => {
    global.fetch = jest.fn((_url, init) =>
      hangingFetch(init as RequestInit),
    ) as unknown as typeof fetch;
    const promise = completeCloud([{role: 'user', content: 'hi'}]);
    const assertion = expectCloudTimeout(promise);
    await jest.advanceTimersByTimeAsync(30_000);
    await assertion;
  });

  it('completeCloud times out the non-streaming fallback fetch too', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('stream failed'))
      .mockImplementationOnce((_url, init) =>
        hangingFetch(init as RequestInit),
      ) as unknown as typeof fetch;
    const promise = completeCloud([{role: 'user', content: 'hi'}]);
    const assertion = expectCloudTimeout(promise);
    await jest.advanceTimersByTimeAsync(30_000);
    await assertion;
    const fallbackInit = (global.fetch as jest.Mock).mock.calls[1][1];
    expect(fallbackInit.signal).toBeInstanceOf(AbortSignal);
  });

  it('testConnection resolves with a timeout error instead of throwing when the request hangs', async () => {
    global.fetch = jest.fn((_url, init) =>
      hangingFetch(init as RequestInit),
    ) as unknown as typeof fetch;
    const promise = testConnection();
    const assertion = expectConnectionTimeout(promise);
    await jest.advanceTimersByTimeAsync(30_000);
    await assertion;
  });

  it('a fast response clears the timer and succeeds', async () => {
    mockFetch({});
    await expect(completeCloud([{role: 'user', content: 'hi'}])).resolves.toBe(
      'Hello world',
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('testConnection clears the timer on a fast success', async () => {
    mockFetch({});
    const res = await testConnection();
    expect(res.ok).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
});
