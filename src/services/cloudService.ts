import {CompletionMessage} from './llamaService';
import {useSettingsStore} from '@/stores/settingsStore';

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
    // Non-streaming fallback.
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
    });
    if (!res.ok) {
      return {ok: false, error: `HTTP ${res.status}`};
    }
    await res.json();
    return {ok: true, latencyMs: Date.now() - start};
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
