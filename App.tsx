import React, {useEffect, Component, ReactNode, useState} from 'react';
import {View, Text, StyleSheet, ActivityIndicator} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {DatabaseProvider} from '@nozbe/watermelondb/DatabaseProvider';
import {database} from '@/db/database';
import AppNavigator from '@/navigation/AppNavigator';
import {useModelDownloadStore} from '@/stores/modelDownloadStore';
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

export default function App() {
  const [isBootstrapping, setIsBootstrapping] = useState(true);

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
      <View style={styles.errorContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <DatabaseProvider database={database}>
          <AppNavigator initialRoute="Library" />
        </DatabaseProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#f87171',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  errorMsg: {color: '#94a3b8', fontSize: 13, textAlign: 'center'},
});
