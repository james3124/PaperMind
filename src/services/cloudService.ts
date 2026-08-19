import {CompletionMessage} from './llamaService';
import {useSettingsStore} from '@/stores/settingsStore';

const TIMEOUT_MS = 30_000;

function withTimeout(): {signal: AbortSignal; clear: () => void} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

export function getCloudConfig() {
  const s = useSettingsStore.getState();
  return {
    baseUrl: (s.cloudBaseUrl || 'https://api.openai.com/v1').replace(
      /\/+$/,
      '',
    ),
    apiKey: s.cloudApiKey || '',
    model: s.cloudModel || 'gpt-4o-mini',
  };
}

export function isCloudConfigured(): boolean {
  const {apiKey, baseUrl} = getCloudConfig();
  return apiKey.length > 0 && baseUrl.length > 0;
}

export async function completeCloud(
  messages: CompletionMessage[],
  opts: {
    temperature?: number;
    maxTokens?: number;
    onToken?: (token: string) => void;
  } = {},
): Promise<string> {
  const {baseUrl, apiKey, model} = getCloudConfig();
  const {temperature = 0.7, maxTokens = 1024, onToken} = opts;

  let fullText = '';
  const streaming = withTimeout();
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: streaming.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const {done, value} = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, {stream: true});
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) {
          continue;
        }
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') {
          continue;
        }
        try {
          const json = JSON.parse(payload);
          const content: string | undefined = json.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            onToken?.(content);
          }
        } catch {
          // ignore malformed chunk
        }
      }
    }
  } catch (e) {
    if (streaming.signal.aborted) {
      throw new Error('Request timed out (30s)');
    }
    // Non-streaming fallback.
    const fallback = withTimeout();
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: fallback.signal,
      });
      if (!res.ok) {
        throw new Error(
          `Cloud request failed (HTTP ${res.status})${
            e instanceof Error ? `: ${e.message}` : ''
          }`,
        );
      }
      const data = (await res.json()) as {
        choices?: {message?: {content?: string}}[];
      };
      fullText = (data.choices?.[0]?.message?.content ?? '').trim();
    } catch (e2) {
      if (fallback.signal.aborted) {
        throw new Error('Request timed out (30s)');
      }
      throw e2;
    } finally {
      fallback.clear();
    }
  } finally {
    streaming.clear();
  }
  return fullText;
}

export async function testConnection(): Promise<{
  ok: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const {baseUrl, apiKey, model} = getCloudConfig();
  const start = Date.now();
  const {signal, clear} = withTimeout();
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{role: 'user', content: 'ping'}],
        stream: false,
        max_tokens: 1,
      }),
      signal,
    });
    if (!res.ok) {
      return {ok: false, error: `HTTP ${res.status}`};
    }
    await res.json();
    return {ok: true, latencyMs: Date.now() - start};
  } catch (e) {
    if (signal.aborted) {
      return {ok: false, error: 'Request timed out (30s)'};
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clear();
  }
}
