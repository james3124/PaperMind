import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LibraryScreen      from '@/screens/LibraryScreen';
import GenerateScreen     from '@/screens/GenerateScreen';
import ProgressScreen     from '@/screens/ProgressScreen';
import EditorScreen       from '@/screens/EditorScreen';
import SettingsScreen     from '@/screens/SettingsScreen';
import ModelDownloadScreen from '@/screens/ModelDownloadScreen';
import ModelDownloadBanner from '@/components/ModelDownloadBanner';

export type RootStackParamList = {
  Library:  undefined;
  Generate: undefined;
  Progress: {
    topic:           string;
    citationStyle:   string;
    citationEdition: string;
    researchType:    string;
    academicLevel:   string;
    paperLength:     string;
  };
  Editor:        { documentId: string };
  Settings:      undefined;
  ModelDownload: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

interface Props {
  initialRoute: 'Library';
}

export default function AppNavigator({ initialRoute }: Props) {
  return (
    <View style={styles.root}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRoute}>
          <Stack.Screen name="Library"  component={LibraryScreen}  options={{ title: 'PaperMind' }} />
          <Stack.Screen name="Generate" component={GenerateScreen} options={{ title: 'New Paper' }} />
          <Stack.Screen name="Progress" component={ProgressScreen} options={{ title: 'Generating…', headerBackVisible: false }} />
          <Stack.Screen name="Editor"   component={EditorScreen}   options={{ headerShown: false }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
          <Stack.Screen
            name="ModelDownload"
            component={ModelDownloadScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>

      {/* Background download progress — floats above all screens */}
      <ModelDownloadBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
