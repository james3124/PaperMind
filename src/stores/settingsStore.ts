import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MODEL_PATH } from '@/utils/modelPaths';

export interface SettingsState {
  modelPath:              string;
  modelLoaded:            boolean;
  defaultCitationStyle:   string;
  defaultCitationEdition: string;
  theme:                  'light' | 'dark' | 'system';
  // Actions
  setModelPath:              (p: string) => void;
  setModelLoaded:            (loaded: boolean) => void;
  setDefaultCitationStyle:   (s: string) => void;
  setDefaultCitationEdition: (e: string) => void;
  setTheme:                  (t: 'light' | 'dark' | 'system') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      modelPath:              MODEL_PATH,
      modelLoaded:            false,
      defaultCitationStyle:   'apa',
      defaultCitationEdition: '7th',
      theme:                  'system',
      setModelPath:              (modelPath) => set({ modelPath }),
      setModelLoaded:            (modelLoaded) => set({ modelLoaded }),
      setDefaultCitationStyle:   (defaultCitationStyle) => set({ defaultCitationStyle }),
      setDefaultCitationEdition: (defaultCitationEdition) => set({ defaultCitationEdition }),
      setTheme:                  (theme) => set({ theme }),
    }),
    {
      name:    'papermind-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
