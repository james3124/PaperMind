import React from 'react';
import {View, StyleSheet} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import LibraryScreen from '@/screens/LibraryScreen';
import ModelDownloadBanner from '@/components/ModelDownloadBanner';

export type RootStackParamList = {
  Library: undefined;
  Generate: undefined;
  Progress: {
    topic: string;
    citationStyle: string;
    citationEdition: string;
    researchType: string;
    academicLevel: string;
    paperLength: string;
  };
  Editor: {documentId: string};
  Settings: undefined;
  ModelDownload: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Lazy-load every non-startup screen so heavy native modules
// (llama.rn, webview, document-picker, share…) are never evaluated
// during first paint — a broken optional module can't blank the app.
function lazyScreen(loader: () => {default: React.ComponentType<any>}) {
  let Comp: React.ComponentType<any> | null = null;
  return function LazyScreen(props: any) {
    if (!Comp) {
      Comp = loader().default;
    }
    return <Comp {...props} />;
  };
}

const GenerateScreen = lazyScreen(() => require('@/screens/GenerateScreen'));
const ProgressScreen = lazyScreen(() => require('@/screens/ProgressScreen'));
const EditorScreen = lazyScreen(() => require('@/screens/EditorScreen'));
const SettingsScreen = lazyScreen(() => require('@/screens/SettingsScreen'));
const ModelDownloadScreen = lazyScreen(() =>
  require('@/screens/ModelDownloadScreen'),
);

interface Props {
  initialRoute: 'Library';
}

export default function AppNavigator({initialRoute}: Props) {
  return (
    <View style={styles.root}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRoute}>
          <Stack.Screen
            name="Library"
            component={LibraryScreen}
            options={{title: 'PaperMind'}}
          />
          <Stack.Screen
            name="Generate"
            component={GenerateScreen}
            options={{title: 'New Paper'}}
          />
          <Stack.Screen
            name="Progress"
            component={ProgressScreen}
            options={{title: 'Generating…', headerBackVisible: false}}
          />
          <Stack.Screen
            name="Editor"
            component={EditorScreen}
            options={{headerShown: false}}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{title: 'Settings'}}
          />
          <Stack.Screen
            name="ModelDownload"
            component={ModelDownloadScreen}
            options={{headerShown: false}}
          />
        </Stack.Navigator>
      </NavigationContainer>

      {/* Background download progress — floats above all screens */}
      <ModelDownloadBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
});
