import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {Appearance} from 'react-native';
import {
  darkPalette,
  elevation,
  lightPalette,
  radius,
  spacing,
  type,
  Palette,
} from './tokens';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeValue {
  palette: Palette;
  isDark: boolean;
  spacing: typeof spacing;
  radius: typeof radius;
  type: typeof type;
  elevation: typeof elevation;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function useSystemScheme(): 'light' | 'dark' {
  const [scheme, setScheme] = useState(Appearance.getColorScheme());
  useEffect(() => {
    const sub = Appearance.addChangeListener(({colorScheme}) =>
      setScheme(colorScheme),
    );
    return () => sub.remove();
  }, []);
  return scheme === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({
  preference,
  children,
}: {
  preference: ThemePreference;
  children: React.ReactNode;
}) {
  const systemScheme = useSystemScheme();

  const value = useMemo<ThemeValue>(() => {
    const isDark =
      preference === 'system' ? systemScheme === 'dark' : preference === 'dark';
    return {
      palette: isDark ? darkPalette : lightPalette,
      isDark,
      spacing,
      radius,
      type,
      elevation,
    };
  }, [preference, systemScheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}
