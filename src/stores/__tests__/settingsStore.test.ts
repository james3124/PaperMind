import { PROVIDERS, getProviderConfig } from '../settingsStore';

describe('PROVIDERS', () => {
  it('has 7 providers', () => {
    expect(PROVIDERS).toHaveLength(7);
  });

  it('all providers have required fields', () => {
    PROVIDERS.forEach(p => {
      expect(p.id).toBeTruthy();
      expect(p.displayName).toBeTruthy();
      expect(p.keyHint).toBeTruthy();
    });
  });

  it('custom provider has empty baseUrl', () => {
    const custom = PROVIDERS.find(p => p.id === 'custom');
    expect(custom?.baseUrl).toBe('');
  });
});

describe('getProviderConfig', () => {
  it('returns correct provider for openai', () => {
    const p = getProviderConfig('openai');
    expect(p.displayName).toBe('OpenAI');
    expect(p.baseUrl).toBe('https://api.openai.com/v1');
  });

  it('falls back to first provider for unknown id', () => {
    // @ts-expect-error testing invalid id
    const p = getProviderConfig('unknown');
    expect(p.id).toBe('openai');
  });
});
