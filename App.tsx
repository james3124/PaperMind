import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import { database }    from '@/db/database';
import AppNavigator    from '@/navigation/AppNavigator';
import { modelExists, bundledModelExists, copyBundledModel } from '@/utils/modelPaths';
import { initModel }   from '@/services/llamaService';
import { MODEL_PATH }  from '@/utils/modelPaths';

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
        await initModel(MODEL_PATH);
        setInitialRoute(route);
      } catch {
        setInitialRoute('ModelDownload');
      }
    }

    checkModel();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <DatabaseProvider database={database}>
        <AppNavigator initialRoute={initialRoute} />
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}