import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import { database }    from '@/db/database';
import AppNavigator    from '@/navigation/AppNavigator';
import { modelExists } from '@/utils/modelPaths';
import { initModel }   from '@/services/llamaService';
import { MODEL_PATH }  from '@/utils/modelPaths';
import { useSettingsStore } from '@/stores/settingsStore';

export default function App() {
  const [initialRoute, setInitialRoute] = useState<'Library' | 'ModelDownload' | null>(null);
  const setModelLoaded = useSettingsStore((s) => s.setModelLoaded);

  useEffect(() => {
    async function checkModel() {
      const exists = await modelExists();
      if (!exists) {
        setInitialRoute('ModelDownload');
        return;
      }
      try {
        await initModel(MODEL_PATH);
        setModelLoaded(true);
        setInitialRoute('Library');
      } catch {
        // Model file exists but corrupt — go to download screen
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
    <DatabaseProvider database={database}>
      <AppNavigator initialRoute={initialRoute} />
    </DatabaseProvider>
  );
}