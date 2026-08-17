import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/AppNavigator';
import {
  runPipeline,
  STAGE_LABELS,
  PipelineConfig,
} from '@/services/pipelineService';
import {modelExists} from '@/utils/modelPaths';
import StageList from '@/components/generate/StageList';

type Props = NativeStackScreenProps<RootStackParamList, 'Progress'>;

export default function ProgressScreen({route, navigation}: Props) {
  const params = route.params;

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
    };

    let cancelled = false;

    async function run() {
      if (!(await modelExists())) {
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
  ]);

  if (fatalError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Generation Failed</Text>
        <Text style={styles.errorMessage}>{fatalError}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, {width: `${progress * 100}%`}]} />
      </View>

      {/* Stage counter */}
      <View style={styles.counterRow}>
        <Text style={styles.counterText}>
          {completedCount} / {STAGE_LABELS.length} stages complete
        </Text>
        {sourcesFound !== null && (
          <Text style={styles.sourcesText}>
            📚 {sourcesFound} sources found
          </Text>
        )}
      </View>

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
        <View style={styles.warningsContainer}>
          {errors.map((e, i) => (
            <Text key={i} style={styles.warningText}>
              ⚠️ {e}
            </Text>
          ))}
        </View>
      )}

      {/* Live stream preview */}
      {streamText.length > 0 && !completed && (
        <View style={styles.streamContainer}>
          <Text style={styles.streamLabel}>Writing…</Text>
          <ScrollView style={styles.streamScroll}>
            <Text style={styles.streamText}>{streamText.slice(-400)}</Text>
          </ScrollView>
        </View>
      )}

      {/* Completion actions */}
      {completed && documentId && (
        <View style={styles.completionContainer}>
          <Text style={styles.completionTitle}>✓ Paper Ready!</Text>
          <TouchableOpacity
            style={styles.openButton}
            onPress={() => navigation.replace('Editor', {documentId})}>
            <Text style={styles.openButtonText}>Open in Editor</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.libraryButton}
            onPress={() => navigation.navigate('Library')}>
            <Text style={styles.libraryButtonText}>Back to Library</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff', padding: 20},
  progressBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {height: '100%', backgroundColor: '#6366f1', borderRadius: 3},
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  counterText: {fontSize: 13, color: '#6b7280'},
  sourcesText: {fontSize: 13, color: '#6b7280'},
  stageListContainer: {flex: 1},
  warningsContainer: {
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  warningText: {fontSize: 12, color: '#92400e', marginBottom: 2},
  streamContainer: {
    height: 100,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  streamLabel: {fontSize: 11, color: '#6b7280', marginBottom: 4},
  streamScroll: {flex: 1},
  streamText: {fontSize: 12, color: '#374151', lineHeight: 18},
  completionContainer: {padding: 16, alignItems: 'center', gap: 12},
  completionTitle: {fontSize: 20, fontWeight: '700', color: '#22c55e'},
  openButton: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  openButtonText: {color: '#fff', fontWeight: '700', fontSize: 16},
  libraryButton: {padding: 14, width: '100%', alignItems: 'center'},
  libraryButtonText: {color: '#6366f1', fontWeight: '600', fontSize: 15},
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ef4444',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {backgroundColor: '#f3f4f6', padding: 14, borderRadius: 10},
  retryText: {fontWeight: '600', color: '#374151'},
});
