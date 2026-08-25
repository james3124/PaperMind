import React, {useEffect, Component, ReactNode, useState} from 'react';
import {View, Text, StyleSheet, ActivityIndicator} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {DatabaseProvider} from '@nozbe/watermelondb/DatabaseProvider';
import {database} from '@/db/database';
import AppNavigator from '@/navigation/AppNavigator';
import {useModelDownloadStore} from '@/stores/modelDownloadStore';
import {useSettingsStore} from '@/stores/settingsStore';
import {ThemeProvider} from '@/theme/theme';
import {modelExists, getModelPath} from '@/utils/modelPaths';

interface EBState {
  hasError: boolean;
  error?: Error;
}
class ErrorBoundary extends Component<{children: ReactNode}, EBState> {
  state: EBState = {hasError: false};
  static getDerivedStateFromError(error: Error): EBState {
    return {hasError: true, error};
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMsg}>{this.state.error?.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function Wordmark() {
  return (
    <Text style={styles.wordmark}>
      Paper<Text style={styles.wordmarkAccent}>Mind</Text>
    </Text>
  );
}

export default function App() {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const themePreference = useSettingsStore(s => s.theme);

  useEffect(() => {
    let cancelled = false;
    // Safety: never gate first paint longer than 4s, whatever happens.
    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        setIsBootstrapping(false);
      }
    }, 4000);

    async function init() {
      try {
        if (await modelExists()) {
          useModelDownloadStore.getState().setModelReady(true);
          // Load model quietly in the background — never block first paint.
          // Lazy require keeps llama.rn's native module away from startup.
          try {
            const {initModel} =
              require('@/services/llamaService') as typeof import('@/services/llamaService');
            void initModel(getModelPath()).catch(() => {});
          } catch (e) {
            console.warn('Model background init unavailable:', e);
          }
        } else {
          // No model — start background download
          void useModelDownloadStore.getState().bootstrap();
        }
      } catch (e) {
        // Never leave the app stuck — log and show UI anyway
        console.warn('Bootstrap failed:', e);
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    }
    init();
    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, []);

  if (isBootstrapping) {
    return (
      <View style={styles.splash}>
        <Wordmark />
        <ActivityIndicator
          size="small"
          color="#58b4a5"
          style={styles.splashSpinner}
        />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider preference={themePreference}>
          <DatabaseProvider database={database}>
            <AppNavigator initialRoute="Library" />
          </DatabaseProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#141311',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordmark: {
    fontSize: 32,
    fontWeight: '300',
    color: '#ece9e0',
    letterSpacing: -0.6,
  },
  wordmarkAccent: {fontWeight: '800', color: '#58b4a5'},
  splashSpinner: {marginTop: 24},
  errorContainer: {
    flex: 1,
    backgroundColor: '#141311',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#e8897d',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  errorMsg: {
    color: '#b3ada0',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
