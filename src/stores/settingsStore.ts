import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getModelPath} from '@/utils/modelPaths';

export type PaperSize = 'a4' | 'letter' | 'a5' | 'a3';

export interface SettingsState {
  modelPath: string;
  modelLoaded: boolean;
  defaultCitationStyle: string;
  defaultCitationEdition: string;
  theme: 'light' | 'dark' | 'system';
  paperSize: PaperSize;
  // Actions
  setModelPath: (p: string) => void;
  setModelLoaded: (loaded: boolean) => void;
  setDefaultCitationStyle: (s: string) => void;
  setDefaultCitationEdition: (e: string) => void;
  setTheme: (t: 'light' | 'dark' | 'system') => void;
  setPaperSize: (p: PaperSize) => void;
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
      setModelPath: modelPath => set({modelPath}),
      setModelLoaded: modelLoaded => set({modelLoaded}),
      setDefaultCitationStyle: defaultCitationStyle =>
        set({defaultCitationStyle}),
      setDefaultCitationEdition: defaultCitationEdition =>
        set({defaultCitationEdition}),
      setTheme: theme => set({theme}),
      setPaperSize: paperSize => set({paperSize}),
    }),
    {
      name: 'papermind-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
