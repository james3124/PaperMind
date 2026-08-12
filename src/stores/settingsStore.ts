import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ProviderId =
  | 'openai' | 'anthropic' | 'gemini'
  | 'mistral' | 'groq' | 'openrouter' | 'custom';

export interface ProviderConfig {
  id: ProviderId;
  displayName: string;
  baseUrl: string;
  keyHint: string;
}

export const PROVIDERS: ProviderConfig[] = [
  { id: 'openai',     displayName: 'OpenAI',        baseUrl: 'https://api.openai.com/v1',                              keyHint: 'Get your key from platform.openai.com' },
  { id: 'anthropic',  displayName: 'Anthropic',     baseUrl: 'https://api.anthropic.com/v1',                           keyHint: 'Get your key from console.anthropic.com' },
  { id: 'gemini',     displayName: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta',       keyHint: 'Get your key from aistudio.google.com' },
  { id: 'mistral',    displayName: 'Mistral',       baseUrl: 'https://api.mistral.ai/v1',                              keyHint: 'Get your key from console.mistral.ai' },
  { id: 'groq',       displayName: 'Groq',          baseUrl: 'https://api.groq.com/openai/v1',                         keyHint: 'Get your key from console.groq.com' },
  { id: 'openrouter', displayName: 'OpenRouter',    baseUrl: 'https://openrouter.ai/api/v1',                           keyHint: 'Get your key from openrouter.ai/keys' },
  { id: 'custom',     displayName: 'Custom',        baseUrl: '',                                                       keyHint: 'Enter the API key for your custom provider' },
];

export interface SettingsState {
  provider: ProviderId;
  apiKey: string;
  model: string;
  customProviderName: string;
  customBaseUrl: string;
  defaultCitationStyle: string;
  defaultCitationEdition: string;
  theme: 'light' | 'dark' | 'system';
  setProvider: (p: ProviderId) => void;
  setApiKey: (k: string) => void;
  setModel: (m: string) => void;
  setCustomProviderName: (n: string) => void;
  setCustomBaseUrl: (u: string) => void;
  setDefaultCitationStyle: (s: string) => void;
  setDefaultCitationEdition: (e: string) => void;
  setTheme: (t: 'light' | 'dark' | 'system') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      provider:               'openai',
      apiKey:                 '',
      model:                  'gpt-4o-mini',
      customProviderName:     '',
      customBaseUrl:          '',
      defaultCitationStyle:   'apa',
      defaultCitationEdition: '7th',
      theme:                  'system',
      setProvider:            (provider) => set({ provider, model: '', apiKey: '' }),
      setApiKey:              (apiKey) => set({ apiKey }),
      setModel:               (model) => set({ model }),
      setCustomProviderName:  (customProviderName) => set({ customProviderName }),
      setCustomBaseUrl:       (customBaseUrl) => set({ customBaseUrl }),
      setDefaultCitationStyle:   (defaultCitationStyle) => set({ defaultCitationStyle }),
      setDefaultCitationEdition: (defaultCitationEdition) => set({ defaultCitationEdition }),
      setTheme:               (theme) => set({ theme }),
    }),
    {
      name:    'papermind-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export const getProviderConfig = (id: ProviderId): ProviderConfig =>
  PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
