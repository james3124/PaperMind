jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/data/user/0/com.papermind/files',
  exists: jest.fn().mockResolvedValue(false),
  mkdir: jest.fn().mockResolvedValue(undefined),
}));

// Mock llama.rn — we test prompt formatting and service shape only
jest.mock('llama.rn', () => ({
  initLlama: jest.fn().mockResolvedValue({
    completion: jest.fn().mockResolvedValue({text: 'Mock response'}),
    release: jest.fn().mockResolvedValue(undefined),
  }),
}));

import {formatChatML, isModelLoaded, CompletionMessage} from '../llamaService';

describe('formatChatML', () => {
  it('formats a simple user message correctly', () => {
    const messages: CompletionMessage[] = [{role: 'user', content: 'Hello'}];
    const result = formatChatML(messages);
    expect(result).toContain('<|im_start|>user');
    expect(result).toContain('Hello');
    expect(result).toContain('<|im_end|>');
    expect(result.endsWith('<|im_start|>assistant\n')).toBe(true);
  });

  it('formats system + user message correctly', () => {
    const messages: CompletionMessage[] = [
      {role: 'system', content: 'You are a helpful assistant.'},
      {role: 'user', content: 'Write a paper.'},
    ];
    const result = formatChatML(messages);
    expect(result).toContain('<|im_start|>system');
    expect(result).toContain('You are a helpful assistant.');
    expect(result).toContain('<|im_start|>user');
    expect(result).toContain('Write a paper.');
  });

  it('always ends with assistant turn opener', () => {
    const messages: CompletionMessage[] = [{role: 'user', content: 'test'}];
    expect(formatChatML(messages).endsWith('<|im_start|>assistant\n')).toBe(
      true,
    );
  });

  it('handles empty messages array', () => {
    const result = formatChatML([]);
    expect(result).toBe('<|im_start|>assistant\n');
  });
});

describe('isModelLoaded', () => {
  it('returns false before initModel is called', () => {
    expect(isModelLoaded()).toBe(false);
  });
});

describe('llamaService exports', () => {
  it('exports complete function', () => {
    const {complete} = require('../llamaService');
    expect(typeof complete).toBe('function');
  });

  it('exports stream function', () => {
    const {stream} = require('../llamaService');
    expect(typeof stream).toBe('function');
  });

  it('exports initModel function', () => {
    const {initModel} = require('../llamaService');
    expect(typeof initModel).toBe('function');
  });

  it('exports releaseModel function', () => {
    const {releaseModel} = require('../llamaService');
    expect(typeof releaseModel).toBe('function');
  });
});

describe('idle timer', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    const {releaseModel} = require('../llamaService');
    await releaseModel();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('initModel arms a 3-minute timer that releases the context', async () => {
    const {initModel, isModelLoaded} = require('../llamaService');
    await initModel('/mock/model.gguf');
    expect(isModelLoaded()).toBe(true);
    jest.advanceTimersByTime(3 * 60 * 1000);
    await jest.runAllTicks();
    expect(isModelLoaded()).toBe(false);
  });

  it('complete() resets the idle timer', async () => {
    const {initModel, isModelLoaded, complete} = require('../llamaService');
    await initModel('/mock/model.gguf');
    jest.advanceTimersByTime(2 * 60 * 1000);
    await complete([{role: 'user', content: 'hi'}]);
    // 2 min elapsed + a fresh inference — still loaded after another 2 min
    jest.advanceTimersByTime(2 * 60 * 1000);
    await jest.runAllTicks();
    expect(isModelLoaded()).toBe(true);
    // crossing 3 min from the reset releases
    jest.advanceTimersByTime(60 * 1000);
    await jest.runAllTicks();
    expect(isModelLoaded()).toBe(false);
  });

  it('releases the model when idle expires and modelLoaded is set false', async () => {
    const {initModel} = require('../llamaService');
    const {useSettingsStore} = require('@/stores/settingsStore');
    useSettingsStore.setState({modelLoaded: true});
    await initModel('/mock/model.gguf');
    jest.advanceTimersByTime(3 * 60 * 1000);
    await jest.runAllTicks();
    expect(useSettingsStore.getState().modelLoaded).toBe(false);
  });

  it('complete() auto-reloads the model after idle release', async () => {
    const {initModel, complete, isModelLoaded} = require('../llamaService');
    const {initLlama} = require('llama.rn');
    (initLlama as jest.Mock).mockClear();
    await initModel('/mock/model.gguf');
    jest.advanceTimersByTime(3 * 60 * 1000);
    await jest.runAllTicks();
    expect(isModelLoaded()).toBe(false);
    const result = await complete([{role: 'user', content: 'hi'}]);
    expect(result).toBe('Mock response');
    expect(isModelLoaded()).toBe(true);
    expect(initLlama).toHaveBeenCalled();
  });

  it('releaseModel() clears the pending idle timer', async () => {
    const {initModel, releaseModel, isModelLoaded} = require('../llamaService');
    await initModel('/mock/model.gguf');
    await releaseModel();
    jest.advanceTimersByTime(3 * 60 * 1000);
    await jest.runAllTicks();
    expect(isModelLoaded()).toBe(false);
  });
});
