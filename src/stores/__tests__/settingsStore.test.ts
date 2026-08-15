import { getModelPath } from '../../utils/modelPaths';

// Mock RNFS
jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/data/user/0/com.papermind/files',
  exists: jest.fn().mockResolvedValue(false),
  mkdir:  jest.fn().mockResolvedValue(undefined),
}));

describe('settingsStore defaults', () => {
  it('default citation style is apa', () => {
    const { useSettingsStore } = require('../settingsStore');
    const state = useSettingsStore.getState();
    expect(state.defaultCitationStyle).toBe('apa');
  });

  it('default citation edition is 7th', () => {
    const { useSettingsStore } = require('../settingsStore');
    const state = useSettingsStore.getState();
    expect(state.defaultCitationEdition).toBe('7th');
  });

  it('modelLoaded defaults to false', () => {
    const { useSettingsStore } = require('../settingsStore');
    const state = useSettingsStore.getState();
    expect(state.modelLoaded).toBe(false);
  });

  it('theme defaults to system', () => {
    const { useSettingsStore } = require('../settingsStore');
    const state = useSettingsStore.getState();
    expect(state.theme).toBe('system');
  });
});

describe('modelPaths', () => {
  it('getModelPath includes model filename', () => {
    expect(getModelPath()).toContain('qwen2.5-0.5b-instruct-q8_0.gguf');
  });
});
