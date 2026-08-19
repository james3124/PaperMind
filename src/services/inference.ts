import {CompletionMessage} from './llamaService';
import * as llamaService from './llamaService';
import {completeCloud, isCloudConfigured} from './cloudService';
import {useSettingsStore} from '@/stores/settingsStore';

export function resolveProvider(): 'cloud' | 'local' {
  const s = useSettingsStore.getState();
  if (s.provider === 'cloud' && isCloudConfigured()) {
    return 'cloud';
  }
  return 'local';
}

export async function complete(
  messages: CompletionMessage[],
  temperature: number = 0.7,
  maxTokens: number = 1024,
): Promise<string> {
  const s = useSettingsStore.getState();
  if (s.provider === 'cloud' && isCloudConfigured()) {
    try {
      return await completeCloud(messages, {temperature, maxTokens});
    } catch (e) {
      if (!s.cloudFallbackEnabled) {
        throw e;
      }
      console.warn('[inference] cloud failed, falling back to local:', e);
    }
  }
  return await llamaService.complete(messages, temperature, maxTokens);
}

export async function stream(
  messages: CompletionMessage[],
  onToken: (token: string) => void,
  temperature: number = 0.7,
  maxTokens: number = 1024,
): Promise<void> {
  const s = useSettingsStore.getState();
  if (s.provider === 'cloud' && isCloudConfigured()) {
    try {
      await completeCloud(messages, {temperature, maxTokens, onToken});
      return;
    } catch (e) {
      if (!s.cloudFallbackEnabled) {
        throw e;
      }
      console.warn(
        '[inference] cloud stream failed, falling back to local:',
        e,
      );
    }
  }
  await llamaService.stream(messages, onToken, temperature, maxTokens);
}
