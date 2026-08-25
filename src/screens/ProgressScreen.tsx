import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/AppNavigator';
import {
  runPipeline,
  STAGE_LABELS,
  PipelineConfig,
} from '@/services/pipelineService';
import {modelExists} from '@/utils/modelPaths';
import {isCloudConfigured} from '@/services/cloudService';
import {useSettingsStore} from '@/stores/settingsStore';
import {useTheme} from '@/theme/theme';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';
import StageList from '@/components/generate/StageList';

type Props = NativeStackScreenProps<RootStackParamList, 'Progress'>;

export default function ProgressScreen({route, navigation}: Props) {
  const params = route.params;
  const {palette, elevation} = useTheme();

  const [currentStage, setCurrentStage] = useState(0);
  const [completedStages, setCompletedStages] = useState<Set<number>>(
    new Set(),
  );
  const [errorStages, setErrorStages] = useState<Set<number>>(new Set());
  const [streamText, setStreamText] = useState('');
  const [sourcesFound, setSourcesFound] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [failedWithCloud, setFailedWithCloud] = useState(false);

  const completedCount = completedStages.size;
  const progress = completedCount / STAGE_LABELS.length;

  useEffect(() => {
    const config: PipelineConfig = {
      topic: params.topic,
      researchType: params.researchType as PipelineConfig['researchType'],
      academicLevel: params.academicLevel as PipelineConfig['academicLevel'],
      paperLength: params.paperLength as PipelineConfig['paperLength'],
      citationStyle: params.citationStyle,
      citationEdition: params.citationEdition,
      sources: params.sources,
      enabledSources: params.enabledSources,
    };

    let cancelled = false;

    async function run() {
      setFatalError(null);
      setFailedWithCloud(false);
      setCompletedStages(new Set());
      setErrorStages(new Set());
      setStreamText('');
      setErrors([]);
      const provider = useSettingsStore.getState().provider;
      const needsLocal =
        provider === 'local' ||
        !isCloudConfigured() ||
        !useSettingsStore.getState().cloudFallbackEnabled;
      if (needsLocal && !(await modelExists())) {
        setFatalError('AI model is not loaded. Please restart the app.');
        return;
      }

      for await (const event of runPipeline(config)) {
        if (cancelled) {
          break;
        }

        switch (event.type) {
          case 'stage-start':
            setCurrentStage(event.stage!);
            break;

          case 'stage-complete':
            setCompletedStages(prev => new Set([...prev, event.stage!]));
            break;

          case 'token':
            setStreamText(prev => prev + (event.text ?? ''));
            break;

          case 'sources-found':
            setSourcesFound(event.count ?? 0);
            break;

          case 'error':
            if (event.fatal) {
              setFatalError(event.message ?? 'Unknown error');
              setFailedWithCloud(
                useSettingsStore.getState().provider === 'cloud' ||
                  (event.message ?? '').toLowerCase().includes('cloud'),
              );
              return;
            }
            setErrors(prev => [...prev, event.message ?? 'Unknown error']);
            if (event.stage) {
              setErrorStages(prev => new Set([...prev, event.stage!]));
            }
            break;

          case 'complete':
            setDocumentId(event.documentId ?? null);
            setCompleted(true);
            break;
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [
    params.topic,
    params.researchType,
    params.academicLevel,
    params.paperLength,
    params.citationStyle,
    params.citationEdition,
    params.sources,
    params.enabledSources,
    runKey,
  ]);

  if (fatalError) {
    return (
      <View style={[styles.errorContainer, {backgroundColor: palette.bg}]}>
        <View
          style={[
            styles.errorIconWrap,
            {backgroundColor: palette.dangerSubtle},
          ]}>
          <Ionicons name="alert-circle" size={30} color={palette.danger} />
        </View>
        <Text style={[styles.errorTitle, {color: palette.text}]}>
          Generation failed
        </Text>
        <Text style={[styles.errorMessage, {color: palette.textSoft}]}>
          {fatalError}
        </Text>
        <Button label="Retry" onPress={() => setRunKey(k => k + 1)} />
        {failedWithCloud && (
          <Button
            label="Use on-device model instead"
            variant="secondary"
            onPress={() => {
              useSettingsStore.getState().setProvider('local');
              setRunKey(k => k + 1);
            }}
          />
        )}
        <Button
          label="Go back"
          variant="ghost"
          onPress={() => navigation.goBack()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, {backgroundColor: palette.bg}]}>
      {/* Progress summary */}
      <View style={styles.summaryRow}>
        <Text style={[styles.counterText, {color: palette.textSoft}]}>
          <Text style={[styles.counterStrong, {color: palette.text}]}>
            {completedCount}
          </Text>
          {' / '}
          {STAGE_LABELS.length} stages complete
        </Text>
        {sourcesFound !== null && (
          <View
            style={[
              styles.sourcesChip,
              {backgroundColor: palette.accentSubtle},
            ]}>
            <Ionicons name="library-outline" size={13} color={palette.accent} />
            <Text style={[styles.sourcesText, {color: palette.accent}]}>
              {sourcesFound} sources
            </Text>
          </View>
        )}
      </View>

      <ProgressBar progress={progress} style={styles.progress} />

      {/* Stage list */}
      <View style={styles.stageListContainer}>
        <StageList
          stages={STAGE_LABELS}
          currentStage={currentStage}
          completedStages={completedStages}
          errorStages={errorStages}
        />
      </View>

      {/* Non-fatal errors */}
      {errors.length > 0 && (
        <View
          style={[
            styles.warningsContainer,
            {backgroundColor: palette.warningSubtle},
          ]}>
          {errors.map((e, i) => (
            <Text
              key={i}
              style={[styles.warningText, {color: palette.warning}]}>
              ⚠ {e}
            </Text>
          ))}
        </View>
      )}

      {/* Live stream preview */}
      {streamText.length > 0 && !completed && (
        <View
          style={[
            styles.streamContainer,
            {backgroundColor: palette.surfaceAlt},
          ]}>
          <View style={styles.streamLabelRow}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={[styles.streamLabel, {color: palette.textSoft}]}>
              Writing…
            </Text>
          </View>
          <ScrollView style={styles.streamScroll}>
            <Text style={[styles.streamText, {color: palette.textSoft}]}>
              {streamText.slice(-400)}
            </Text>
          </ScrollView>
        </View>
      )}

      {/* Completion actions */}
      {completed && documentId && (
        <View
          style={[
            styles.completionContainer,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
            elevation.raised(palette.shadow),
          ]}>
          <View style={styles.completionHeader}>
            <Ionicons
              name="checkmark-circle"
              size={26}
              color={palette.success}
            />
            <Text style={[styles.completionTitle, {color: palette.text}]}>
              Paper ready
            </Text>
          </View>
          <Button
            label="Open in editor"
            onPress={() => navigation.replace('Editor', {documentId})}
          />
          <Button
            label="Back to library"
            variant="ghost"
            onPress={() => navigation.navigate('Library')}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: 20},
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  counterText: {fontSize: 14},
  counterStrong: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sourcesChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  sourcesText: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  progress: {marginBottom: 16},
  stageListContainer: {flex: 1},
  warningsContainer: {
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  warningText: {fontSize: 12, marginBottom: 2},
  streamContainer: {
    height: 110,
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
  },
  streamLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 6,
  },
  streamLabel: {fontSize: 12, fontWeight: '600'},
  streamScroll: {flex: 1},
  streamText: {fontSize: 12, lineHeight: 18},
  completionContainer: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    alignItems: 'stretch',
    gap: 8,
    marginBottom: 8,
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 6,
  },
  completionTitle: {fontSize: 19, fontWeight: '700'},
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  errorIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  errorTitle: {fontSize: 22, fontWeight: '800', letterSpacing: -0.4},
  errorMessage: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 16,
  },
});
