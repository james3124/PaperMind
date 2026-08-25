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
import {useTheme} from '@/theme/theme';
import Chip from '@/components/ui/Chip';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({navigation}: Props) {
  const store = useSettingsStore();
  const modelLoaded = store.modelLoaded;
  const {palette, elevation, radius} = useTheme();

  const [testState, setTestState] = useState<
    'idle' | 'testing' | 'ok' | 'fail'
  >('idle');
  const [testMessage, setTestMessage] = useState('');

  async function handleReloadModel() {
    try {
      await releaseModel();
      await initModel(getModelPath());
      Alert.alert(
        'Model reloaded',
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
      'Re-download model?',
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
    <ScrollView
      style={[styles.scroll, {backgroundColor: palette.bg}]}
      contentContainerStyle={styles.content}>
      {/* ── AI Model ──────────────────────────────── */}
      <SectionLabel text="AI model" />
      <View
        style={[
          styles.card,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: radius.lg,
          },
        ]}>
        <View style={styles.modelRow}>
          <Text style={[styles.modelName, {color: palette.text}]}>
            Qwen2.5-0.5B-Instruct
          </Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: modelLoaded
                  ? palette.successSubtle
                  : palette.dangerSubtle,
              },
            ]}>
            <Text
              style={[
                styles.statusText,
                {color: modelLoaded ? palette.success : palette.danger},
              ]}>
              {modelLoaded ? 'Ready' : 'Not loaded'}
            </Text>
          </View>
        </View>
        <Text
          style={[styles.modelPath, {color: palette.textMuted}]}
          numberOfLines={1}>
          {getModelPath()}
        </Text>

        <View style={[styles.cardActionsRow, {borderTopColor: palette.border}]}>
          {modelLoaded && (
            <TouchableOpacity
              style={styles.cardAction}
              onPress={handleReloadModel}>
              <Text style={[styles.cardActionText, {color: palette.accent}]}>
                Reload model
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.cardAction}
            onPress={handleRedownload}>
            <Text style={[styles.cardActionText, {color: palette.accent}]}>
              Re-download model
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── AI Provider ─────────────────────────────── */}
      <SectionLabel text="AI provider" />
      <View
        style={[
          styles.card,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: radius.lg,
          },
        ]}>
        <View style={styles.chipWrap}>
          {[
            {id: 'local', label: 'On-device'},
            {id: 'cloud', label: 'Cloud'},
          ].map(p => (
            <Chip
              key={p.id}
              label={p.label}
              selected={store.provider === p.id}
              onPress={() => store.setProvider(p.id as 'local' | 'cloud')}
            />
          ))}
        </View>

        {store.provider === 'cloud' && (
          <View style={styles.cloudFields}>
            <FieldLabel text="Base URL" />
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: palette.surfaceAlt,
                  borderColor: palette.border,
                  color: palette.text,
                },
              ]}
              value={store.cloudBaseUrl}
              onChangeText={store.setCloudBaseUrl}
              placeholder="https://api.openai.com/v1"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <FieldLabel text="API key" />
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: palette.surfaceAlt,
                  borderColor: palette.border,
                  color: palette.text,
                },
              ]}
              value={store.cloudApiKey}
              onChangeText={store.setCloudApiKey}
              placeholder="sk-…"
              placeholderTextColor={palette.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <FieldLabel text="Model" />
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: palette.surfaceAlt,
                  borderColor: palette.border,
                  color: palette.text,
                },
              ]}
              value={store.cloudModel}
              onChangeText={store.setCloudModel}
              placeholder="gpt-4o-mini"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <SwitchRow
              label="Fall back to on-device if cloud fails"
              value={store.cloudFallbackEnabled}
              onValueChange={store.setCloudFallbackEnabled}
            />
            <TouchableOpacity
              style={[
                styles.testBtn,
                {borderColor: palette.accent},
                testState === 'testing' && styles.testBtnBusy,
              ]}
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
              <Text style={[styles.testBtnText, {color: palette.accent}]}>
                {testState === 'testing' ? 'Testing…' : 'Test connection'}
              </Text>
            </TouchableOpacity>
            {testMessage.length > 0 && (
              <Text
                style={[
                  styles.testMessage,
                  {
                    color:
                      testState === 'ok' ? palette.success : palette.danger,
                  },
                ]}>
                {testMessage}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* ── Citation Style ─────────────────────────── */}
      <SectionLabel text="Default citation style" />
      <View
        style={[
          styles.card,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: radius.lg,
          },
        ]}>
        <Text style={[styles.hint, {color: palette.textSoft}]}>
          Applied automatically when generating a new paper.
        </Text>
        <View style={styles.chipWrap}>
          {['apa', 'mla', 'ieee', 'chicago', 'harvard', 'vancouver'].map(s => (
            <Chip
              key={s}
              label={s.toUpperCase()}
              selected={store.defaultCitationStyle === s}
              onPress={() => store.setDefaultCitationStyle(s)}
            />
          ))}
        </View>
      </View>

      {/* ── Appearance ─────────────────────────────── */}
      <SectionLabel text="Appearance" />
      <View
        style={[
          styles.card,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: radius.lg,
          },
        ]}>
        {(['system', 'light', 'dark'] as const).map((mode, i) => (
          <React.Fragment key={mode}>
            {i > 0 && (
              <View
                style={[styles.modeDivider, {backgroundColor: palette.border}]}
              />
            )}
            <TouchableOpacity
              style={styles.modeOption}
              onPress={() => store.setTheme(mode)}>
              <Text style={[styles.modeLabel, {color: palette.text}]}>
                {mode === 'system'
                  ? 'Match system'
                  : mode === 'light'
                  ? 'Light'
                  : 'Dark'}
              </Text>
              <View
                style={[
                  styles.radioOuter,
                  {
                    borderColor:
                      store.theme === mode ? palette.accent : palette.border,
                  },
                ]}>
                {store.theme === mode && (
                  <View
                    style={[
                      styles.radioInner,
                      {backgroundColor: palette.accent},
                    ]}
                  />
                )}
              </View>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>

      {/* ── Writing Goal ─────────────────────────── */}
      <SectionLabel text="Writing" />
      <View
        style={[
          styles.card,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: radius.lg,
          },
        ]}>
        <Text style={[styles.hint, {color: palette.textSoft}]}>
          Daily word count target shown in the editor. Leave empty for none.
        </Text>
        <View style={styles.goalRow}>
          <Text style={[styles.modeLabel, {color: palette.text}]}>
            Word goal
          </Text>
          <TextInput
            style={[
              styles.textInput,
              styles.goalInput,
              {
                backgroundColor: palette.surfaceAlt,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            value={store.wordGoal !== undefined ? String(store.wordGoal) : ''}
            onChangeText={text => {
              const n = parseInt(text.replace(/[^0-9]/g, ''), 10);
              store.setWordGoal(Number.isNaN(n) || n <= 0 ? undefined : n);
            }}
            placeholder="e.g. 1500"
            placeholderTextColor={palette.textMuted}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* ── About ──────────────────────────────────── */}
      <SectionLabel text="About" />
      <View
        style={[
          styles.card,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: radius.lg,
          },
          elevation.card(palette.shadow),
        ]}>
        <View style={styles.aboutRow}>
          <Text style={[styles.aboutName, {color: palette.text}]}>
            Paper<Text style={{color: palette.accent}}>Mind</Text>
          </Text>
          <Text style={[styles.version, {color: palette.textMuted}]}>
            v1.0.0
          </Text>
        </View>
        <Text style={[styles.tagline, {color: palette.textSoft}]}>
          Write, generate, and edit academic papers — entirely on your device.
        </Text>
      </View>
    </ScrollView>
  );
}

function SectionLabel({text}: {text: string}) {
  const {palette} = useTheme();
  return (
    <Text style={[styles.sectionHeader, {color: palette.textMuted}]}>
      {text}
    </Text>
  );
}

function FieldLabel({text}: {text: string}) {
  const {palette} = useTheme();
  return (
    <Text style={[styles.fieldLabel, {color: palette.textSoft}]}>{text}</Text>
  );
}

function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const {palette, isDark} = useTheme();
  return (
    <View style={styles.switchRow}>
      <Text
        style={[styles.modeLabel, styles.modeLabelFlex, {color: palette.text}]}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: palette.surfaceAlt,
          true: isDark ? '#2e6b60' : palette.accent,
        }}
        thumbColor={value && !isDark ? '#ffffff' : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  content: {paddingHorizontal: 20, paddingBottom: 40},
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 8,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  modelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modelName: {fontSize: 15, fontWeight: '600'},
  statusBadge: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999},
  statusText: {fontSize: 12, fontWeight: '600'},
  modelPath: {fontSize: 11, fontFamily: 'monospace'},
  cardActionsRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: -16,
  },
  cardAction: {paddingHorizontal: 16, paddingVertical: 10},
  cardActionText: {fontSize: 14, fontWeight: '600'},
  chipWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  hint: {fontSize: 13, lineHeight: 19, marginBottom: 12},
  cloudFields: {marginTop: 16},
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  testBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 16,
  },
  testBtnBusy: {opacity: 0.5},
  testBtnText: {fontSize: 14, fontWeight: '600'},
  testMessage: {fontSize: 13, marginTop: 8},
  modeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
  },
  modeDivider: {height: StyleSheet.hairlineWidth},
  modeLabel: {fontSize: 15},
  modeLabelFlex: {flex: 1},
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {width: 10, height: 10, borderRadius: 5},
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalInput: {
    width: 120,
    textAlign: 'right',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  aboutName: {fontSize: 17, fontWeight: '300', letterSpacing: -0.3},
  version: {fontSize: 13, fontVariant: ['tabular-nums']},
  tagline: {fontSize: 13, lineHeight: 19},
});
