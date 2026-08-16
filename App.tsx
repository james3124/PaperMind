import React, { useEffect, Component, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import { database }    from '@/db/database';
import AppNavigator    from '@/navigation/AppNavigator';
import { useModelDownloadStore } from '@/stores/modelDownloadStore';
import { modelExists, getModelPath } from '@/utils/modelPaths';
import { initModel }   from '@/services/llamaService';

interface EBState { hasError: boolean; error?: Error }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
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
  const bootstrap = useModelDownloadStore(s => s.bootstrap);
  const setModelReady = useModelDownloadStore(s => s.setModelReady);

  useEffect(() => {
    async function init() {
      // If model already on disk, init llama quietly in background
      if (await modelExists()) {
        setModelReady(true);
        try { await initModel(getModelPath()); } catch { /* non-fatal */ }
        return;
      }
      // No model — start background download
      bootstrap();
    }
    init();
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <DatabaseProvider database={database}>
          {/* Always go straight to Library — banner handles download state */}
          <AppNavigator initialRoute="Library" />
        </DatabaseProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1, backgroundColor: '#0f172a',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  errorTitle: { color: '#f87171', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  errorMsg:   { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
});
