import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import {useSettingsStore} from '@/stores/settingsStore';
import {releaseModel, initModel} from '@/services/llamaService';
import {testConnection} from '@/services/cloudService';
import {getModelPath} from '@/utils/modelPaths';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({navigation}: Props) {
  const store = useSettingsStore();
  const modelLoaded = store.modelLoaded;

  const [testState, setTestState] = useState<
    'idle' | 'testing' | 'ok' | 'fail'
  >('idle');
  const [testMessage, setTestMessage] = useState('');

  async function handleReloadModel() {
    try {
      await releaseModel();
      await initModel(getModelPath());
      Alert.alert(
        'Model Reloaded',
        'The AI model has been reloaded successfully.',
      );
    } catch (e: unknown) {
      Alert.alert(
        'Error',
        e instanceof Error ? e.message : 'Failed to reload model',
      );
    }
  }

  async function handleRedownload() {
    Alert.alert(
      'Re-download Model?',
      'This will delete the current model and download it again (676 MB).',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Re-download',
          onPress: async () => {
            await releaseModel();
            store.setModelLoaded(false);
            navigation.navigate('ModelDownload');
          },
        },
      ],
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* ── AI Model ──────────────────────────────── */}
      <SectionHeader label="AI Model" />
      <View style={styles.modelCard}>
        <View style={styles.modelRow}>
          <Text style={styles.modelName}>Qwen2.5-0.5B-Instruct</Text>
          <View
            style={[
              styles.statusBadge,
              modelLoaded ? styles.statusOk : styles.statusOff,
            ]}>
            <Text style={styles.statusText}>
              {modelLoaded ? '✓ Ready' : '✗ Not loaded'}
            </Text>
          </View>
        </View>
        <Text style={styles.modelPath} numberOfLines={1}>
          {getModelPath()}
        </Text>
      </View>

      {modelLoaded && (
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={handleReloadModel}>
          <Text style={styles.secondaryBtnText}>Reload Model</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.secondaryBtn} onPress={handleRedownload}>
        <Text style={styles.secondaryBtnText}>Re-download Model</Text>
      </TouchableOpacity>

      {/* ── AI Provider ─────────────────────────────── */}
      <SectionHeader label="AI Provider" />
      <View style={styles.chipRow}>
        {[
          {id: 'local', label: 'On-device (offline)'},
          {id: 'cloud', label: 'Cloud (online)'},
        ].map(p => (
          <TouchableOpacity
            key={p.id}
            style={[
              styles.chip,
              store.provider === p.id && styles.chipSelected,
            ]}
            onPress={() => store.setProvider(p.id as 'local' | 'cloud')}>
            <Text
              style={[
                styles.chipText,
                store.provider === p.id && styles.chipTextSelected,
              ]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {store.provider === 'cloud' && (
        <View style={styles.cloudCard}>
          <Text style={styles.labelText}>Base URL</Text>
          <TextInput
            style={styles.textInput}
            value={store.cloudBaseUrl}
            onChangeText={store.setCloudBaseUrl}
            placeholder="https://api.openai.com/v1"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.labelText}>API Key</Text>
          <TextInput
            style={styles.textInput}
            value={store.cloudApiKey}
            onChangeText={store.setCloudApiKey}
            placeholder="sk-…"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.labelText}>Model</Text>
          <TextInput
            style={styles.textInput}
            value={store.cloudModel}
            onChangeText={store.setCloudModel}
            placeholder="gpt-4o-mini"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>
              Fall back to on-device if cloud fails
            </Text>
            <Switch
              value={store.cloudFallbackEnabled}
              onValueChange={store.setCloudFallbackEnabled}
            />
          </View>
          <TouchableOpacity
            style={styles.secondaryBtn}
            disabled={testState === 'testing'}
            onPress={async () => {
              setTestState('testing');
              setTestMessage('');
              const res = await testConnection();
              setTestState(res.ok ? 'ok' : 'fail');
              setTestMessage(
                res.ok
                  ? `Connected in ${res.latencyMs}ms`
                  : res.error ?? 'Connection failed',
              );
            }}>
            <Text style={styles.secondaryBtnText}>
              {testState === 'testing' ? 'Testing…' : 'Test connection'}
            </Text>
          </TouchableOpacity>
          {testMessage.length > 0 && (
            <Text
              style={[
                styles.testMessage,
                testState === 'ok' ? styles.testOk : styles.testFail,
              ]}>
              {testMessage}
            </Text>
          )}
        </View>
      )}

      {/* ── Citation Style ─────────────────────────── */}
      <SectionHeader label="Default Citation Style" />
      <Text style={styles.hint}>
        Applied automatically when generating a new paper.
      </Text>
      <View style={styles.chipRow}>
        {['apa', 'mla', 'ieee', 'chicago', 'harvard', 'vancouver'].map(s => (
          <TouchableOpacity
            key={s}
            style={[
              styles.chip,
              store.defaultCitationStyle === s && styles.chipSelected,
            ]}
            onPress={() => store.setDefaultCitationStyle(s)}>
            <Text
              style={[
                styles.chipText,
                store.defaultCitationStyle === s && styles.chipTextSelected,
              ]}>
              {s.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Appearance ─────────────────────────────── */}
      <SectionHeader label="Appearance" />
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Dark mode</Text>
        <Switch
          value={store.theme === 'dark'}
          onValueChange={v => store.setTheme(v ? 'dark' : 'system')}
        />
      </View>

      {/* ── Writing Goal ─────────────────────────── */}
      <SectionHeader label="Writing" />
      <Text style={styles.hint}>
        Daily word count target shown in the editor. Leave empty for none.
      </Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Word goal</Text>
        <TextInput
          style={[styles.textInput, styles.goalInput]}
          value={store.wordGoal !== undefined ? String(store.wordGoal) : ''}
          onChangeText={text => {
            const n = parseInt(text.replace(/[^0-9]/g, ''), 10);
            store.setWordGoal(Number.isNaN(n) || n <= 0 ? undefined : n);
          }}
          placeholder="e.g. 1500"
          keyboardType="numeric"
        />
      </View>

      {/* ── About ──────────────────────────────────── */}
      <SectionHeader label="About" />
      <View style={styles.row}>
        <Text style={styles.rowLabel}>PaperMind</Text>
        <Text style={styles.rowValue}>v1.0.0</Text>
      </View>
      <Text style={styles.tagline}>AI-powered academic paper editor</Text>
      <Text style={styles.tagline}>On-device AI · Optional cloud provider</Text>
    </ScrollView>
  );
}

function SectionHeader({label}: {label: string}) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

const styles = StyleSheet.create({
  scroll: {flex: 1, backgroundColor: '#fff'},
  content: {padding: 20, gap: 8},
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366f1',
    marginTop: 24,
    marginBottom: 8,
  },
  hint: {fontSize: 13, color: '#6b7280', marginBottom: 8},
  modelCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
  },
  modelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modelName: {fontSize: 15, fontWeight: '600', color: '#111827'},
  statusBadge: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12},
  statusOk: {backgroundColor: '#dcfce7'},
  statusOff: {backgroundColor: '#fee2e2'},
  statusText: {fontSize: 12, fontWeight: '600', color: '#374151'},
  modelPath: {fontSize: 11, color: '#9ca3af', fontFamily: 'monospace'},
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryBtnText: {fontSize: 14, color: '#374151', fontWeight: '500'},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4},
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipSelected: {backgroundColor: '#6366f1', borderColor: '#6366f1'},
  chipText: {fontSize: 13, color: '#374151', fontWeight: '500'},
  chipTextSelected: {color: '#fff'},
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowLabel: {fontSize: 15, color: '#111827'},
  rowValue: {fontSize: 14, color: '#6b7280'},
  cloudCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  goalInput: {width: 120, paddingVertical: 6, textAlign: 'right'},
  testMessage: {fontSize: 13, marginTop: 8},
  testOk: {color: '#16a34a'},
  testFail: {color: '#dc2626'},
  tagline: {fontSize: 13, color: '#9ca3af'},
});
