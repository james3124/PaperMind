jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/data/user/0/com.papermind/files',
  exists: jest.fn().mockResolvedValue(false),
  mkdir: jest.fn().mockResolvedValue(undefined),
}));

import {complete, stream} from '../inference';
import {useSettingsStore} from '@/stores/settingsStore';
import * as cloudService from '../cloudService';
import * as llamaService from '../llamaService';

jest.mock('../cloudService', () => ({
  completeCloud: jest.fn().mockResolvedValue('cloud answer'),
  isCloudConfigured: jest.fn().mockReturnValue(true),
}));
jest.mock('../llamaService', () => ({
  complete: jest.fn().mockResolvedValue('local answer'),
  stream: jest.fn().mockImplementation(async (_m, onToken) => {
    onToken('local ');
    onToken('tokens');
  }),
}));

const cloud = cloudService as jest.Mocked<typeof cloudService>;
const llama = llamaService as jest.Mocked<typeof llamaService>;

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({provider: 'local'});
  cloud.isCloudConfigured.mockReturnValue(true);
  cloud.completeCloud.mockResolvedValue('cloud answer');
});

it('routes to local when provider is local', async () => {
  const result = await complete([{role: 'user', content: 'x'}]);
  expect(result).toBe('local answer');
  expect(cloud.completeCloud).not.toHaveBeenCalled();
});

it('routes to cloud when provider is cloud and configured', async () => {
  useSettingsStore.setState({provider: 'cloud'});
  cloud.isCloudConfigured.mockReturnValue(true);
  const result = await complete([{role: 'user', content: 'x'}]);
  expect(result).toBe('cloud answer');
  expect(llama.complete).not.toHaveBeenCalled();
});

it('falls back to local when provider is cloud but unconfigured', async () => {
  useSettingsStore.setState({provider: 'cloud'});
  cloud.isCloudConfigured.mockReturnValue(false);
  const result = await complete([{role: 'user', content: 'x'}]);
  expect(result).toBe('local answer');
});

it('stream routes through cloud and local', async () => {
  useSettingsStore.setState({provider: 'cloud'});
  const tokens: string[] = [];
  await stream([{role: 'user', content: 'x'}], t => tokens.push(t));
  expect(cloud.completeCloud).toHaveBeenCalled();
  useSettingsStore.setState({provider: 'local'});
  const localTokens: string[] = [];
  await stream([{role: 'user', content: 'x'}], t => localTokens.push(t));
  expect(localTokens.join('')).toBe('local tokens');
});

it('cloud stream failure falls back to local when fallback enabled', async () => {
  useSettingsStore.setState({provider: 'cloud', cloudFallbackEnabled: true});
  cloud.completeCloud.mockRejectedValue(new Error('boom'));
  const result = await complete([{role: 'user', content: 'x'}]);
  expect(result).toBe('local answer');
});

it('cloud stream failure rethrows when fallback disabled', async () => {
  useSettingsStore.setState({
    provider: 'cloud',
    cloudFallbackEnabled: false,
  });
  cloud.completeCloud.mockRejectedValue(new Error('boom'));
  await expect(complete([{role: 'user', content: 'x'}])).rejects.toThrow(
    'boom',
  );
});

it('stream: cloud failure falls back to local when fallback enabled', async () => {
  useSettingsStore.setState({provider: 'cloud', cloudFallbackEnabled: true});
  cloud.completeCloud.mockRejectedValue(new Error('boom'));
  const tokens: string[] = [];
  await stream([{role: 'user', content: 'x'}], t => tokens.push(t));
  expect(tokens.join('')).toBe('local tokens');
});

it('stream: cloud failure rethrows when fallback disabled', async () => {
  useSettingsStore.setState({
    provider: 'cloud',
    cloudFallbackEnabled: false,
  });
  cloud.completeCloud.mockRejectedValue(new Error('boom'));
  await expect(
    stream([{role: 'user', content: 'x'}], () => undefined),
  ).rejects.toThrow('boom');
});
