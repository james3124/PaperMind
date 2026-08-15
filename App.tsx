import React, { useEffect, useState, Component, ReactNode } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import { database }    from '@/db/database';
import AppNavigator    from '@/navigation/AppNavigator';
import { modelExists, bundledModelExists, copyBundledModel, getModelPath } from '@/utils/modelPaths';
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
  const [initialRoute, setInitialRoute] = useState<'Library' | 'ModelDownload' | null>(null);

  useEffect(() => {
    async function checkModel() {
      // Already downloaded to internal storage — load straight away.
      if (await modelExists()) {
        await tryInitModel('Library');
        return;
      }

      // Not in storage yet. If a model is bundled in the APK assets, copy it
      // into storage once, then load. No download screen needed.
      if (await bundledModelExists()) {
        await copyBundledModel();
        await tryInitModel('Library');
        return;
      }

      // No local model — full download flow.
      setInitialRoute('ModelDownload');
    }

    async function tryInitModel(route: 'Library') {
      try {
        await initModel(getModelPath());
        setInitialRoute(route);
      } catch {
        setInitialRoute('ModelDownload');
      }
    }

    checkModel();
  }, []);

  if (!initialRoute) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Starting PaperMind…</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <DatabaseProvider database={database}>
          <AppNavigator initialRoute={initialRoute} />
        </DatabaseProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { color: '#94a3b8', fontSize: 14 },
  errorContainer: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorTitle: { color: '#f87171', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  errorMsg: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
});