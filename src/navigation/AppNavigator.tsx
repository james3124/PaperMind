import React, {Suspense} from 'react';
import {View, StyleSheet, ActivityIndicator} from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import LibraryScreen from '@/screens/LibraryScreen';
import ModelDownloadBanner from '@/components/ModelDownloadBanner';
import {useTheme} from '@/theme/theme';
import type {SourceKey, SourcePaper} from '@/services/literatureSearch';

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
    sources?: SourcePaper[];
    enabledSources?: SourceKey[];
  };
  CitationReview: {
    topic: string;
    citationStyle: string;
    citationEdition: string;
    researchType: string;
    academicLevel: string;
    paperLength: string;
    context?: string;
  };
  Editor: {documentId: string};
  Settings: undefined;
  ModelDownload: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Lazy-load every non-startup screen so heavy native modules
// (llama.rn, webview, document-picker, share…) are never evaluated
// during first paint — a broken optional module can't blank the app.
// React.lazy + Suspense avoids the blank-frame flash caused by mutating
// a closure variable during render.
const GenerateScreen = React.lazy(() => import('@/screens/GenerateScreen'));
const CitationReviewScreen = React.lazy(
  () => import('@/screens/CitationReviewScreen'),
);
const ProgressScreen = React.lazy(() => import('@/screens/ProgressScreen'));
const EditorScreen = React.lazy(() => import('@/screens/EditorScreen'));
const SettingsScreen = React.lazy(() => import('@/screens/SettingsScreen'));
const ModelDownloadScreen = React.lazy(
  () => import('@/screens/ModelDownloadScreen'),
);

function ScreenFallback() {
  const {palette} = useTheme();
  return (
    <View style={[styles.fallback, {backgroundColor: palette.bg}]}>
      <ActivityIndicator size="small" color={palette.accent} />
    </View>
  );
}

interface Props {
  initialRoute: 'Library';
}

export default function AppNavigator({initialRoute}: Props) {
  const {palette, isDark} = useTheme();

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    dark: isDark,
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      primary: palette.accent,
      background: palette.bg,
      card: palette.surface,
      text: palette.text,
      border: palette.border,
      notification: palette.accent,
    },
  };

  return (
    <View style={styles.root}>
      <NavigationContainer theme={navTheme}>
        <Suspense fallback={<ScreenFallback />}>
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{
              headerStyle: {backgroundColor: palette.bg},
              headerTintColor: palette.text,
              headerTitleStyle: {
                fontWeight: '700',
                fontSize: 17,
                color: palette.text,
              },
              headerShadowVisible: false,
              headerBackTitleVisible: false,
              contentStyle: {backgroundColor: palette.bg},
            }}>
            <Stack.Screen
              name="Library"
              component={LibraryScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="Generate"
              component={GenerateScreen}
              options={{title: 'New Paper'}}
            />
            <Stack.Screen
              name="CitationReview"
              component={CitationReviewScreen}
              options={{title: 'Review Sources'}}
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
        </Suspense>
      </NavigationContainer>

      {/* Background download progress — floats above all screens */}
      <ModelDownloadBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  fallback: {flex: 1, justifyContent: 'center', alignItems: 'center'},
});
