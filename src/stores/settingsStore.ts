import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getModelPath} from '@/utils/modelPaths';
import {SourceKey} from '@/services/literatureSearch';

export type PaperSize = 'a4' | 'letter' | 'a5' | 'a3';

export interface SettingsState {
  modelPath: string;
  modelLoaded: boolean;
  defaultCitationStyle: string;
  defaultCitationEdition: string;
  theme: 'light' | 'dark' | 'system';
  paperSize: PaperSize;
  provider: 'local' | 'cloud';
  cloudBaseUrl: string;
  cloudApiKey: string;
  cloudModel: string;
  cloudFallbackEnabled: boolean;
  enabledSources: SourceKey[];
  wordGoal?: number;
  // Actions
  setModelPath: (p: string) => void;
  setModelLoaded: (loaded: boolean) => void;
  setDefaultCitationStyle: (s: string) => void;
  setDefaultCitationEdition: (e: string) => void;
  setTheme: (t: 'light' | 'dark' | 'system') => void;
  setPaperSize: (p: PaperSize) => void;
  setProvider: (p: 'local' | 'cloud') => void;
  setCloudBaseUrl: (u: string) => void;
  setCloudApiKey: (k: string) => void;
  setCloudModel: (m: string) => void;
  setCloudFallbackEnabled: (v: boolean) => void;
  setEnabledSources: (s: SourceKey[]) => void;
  setWordGoal: (g: number | undefined) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      modelPath: getModelPath(),
      modelLoaded: false,
      defaultCitationStyle: 'apa',
      defaultCitationEdition: '7th',
      theme: 'system',
      paperSize: 'a4',
      provider: 'local',
      cloudBaseUrl: 'https://api.openai.com/v1',
      cloudApiKey: '',
      cloudModel: 'gpt-4o-mini',
      cloudFallbackEnabled: true,
      enabledSources: ['crossref', 'openalex', 'semanticscholar', 'arxiv'],
      setModelPath: modelPath => set({modelPath}),
      setModelLoaded: modelLoaded => set({modelLoaded}),
      setDefaultCitationStyle: defaultCitationStyle =>
        set({defaultCitationStyle}),
      setDefaultCitationEdition: defaultCitationEdition =>
        set({defaultCitationEdition}),
      setTheme: theme => set({theme}),
      setPaperSize: paperSize => set({paperSize}),
      setProvider: provider => set({provider}),
      setCloudBaseUrl: cloudBaseUrl => set({cloudBaseUrl}),
      setCloudApiKey: cloudApiKey => set({cloudApiKey}),
      setCloudModel: cloudModel => set({cloudModel}),
      setCloudFallbackEnabled: cloudFallbackEnabled =>
        set({cloudFallbackEnabled}),
      setEnabledSources: enabledSources => set({enabledSources}),
      setWordGoal: wordGoal => set({wordGoal}),
    }),
    {
      name: 'papermind-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
