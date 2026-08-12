// Mock llama.rn — we test prompt formatting and service shape only
jest.mock('llama.rn', () => ({
  initLlama: jest.fn().mockResolvedValue({
    completion: jest.fn().mockResolvedValue({ text: 'Mock response' }),
    release:    jest.fn().mockResolvedValue(undefined),
  }),
}));

import { formatChatML, isModelLoaded, CompletionMessage } from '../llamaService';

describe('formatChatML', () => {
  it('formats a simple user message correctly', () => {
    const messages: CompletionMessage[] = [
      { role: 'user', content: 'Hello' },
    ];
    const result = formatChatML(messages);
    expect(result).toContain('<|im_start|>user');
    expect(result).toContain('Hello');
    expect(result).toContain('<|im_end|>');
    expect(result.endsWith('<|im_start|>assistant\n')).toBe(true);
  });

  it('formats system + user message correctly', () => {
    const messages: CompletionMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user',   content: 'Write a paper.' },
    ];
    const result = formatChatML(messages);
    expect(result).toContain('<|im_start|>system');
    expect(result).toContain('You are a helpful assistant.');
    expect(result).toContain('<|im_start|>user');
    expect(result).toContain('Write a paper.');
  });

  it('always ends with assistant turn opener', () => {
    const messages: CompletionMessage[] = [
      { role: 'user', content: 'test' },
    ];
    expect(formatChatML(messages).endsWith('<|im_start|>assistant\n')).toBe(true);
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
    const { complete } = require('../llamaService');
    expect(typeof complete).toBe('function');
  });

  it('exports stream function', () => {
    const { stream } = require('../llamaService');
    expect(typeof stream).toBe('function');
  });

  it('exports initModel function', () => {
    const { initModel } = require('../llamaService');
    expect(typeof initModel).toBe('function');
  });

  it('exports releaseModel function', () => {
    const { releaseModel } = require('../llamaService');
    expect(typeof releaseModel).toBe('function');
  });
});
