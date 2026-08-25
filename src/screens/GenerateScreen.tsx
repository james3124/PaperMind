import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/AppNavigator';
import {useSettingsStore} from '@/stores/settingsStore';
import {modelExists} from '@/utils/modelPaths';
import {useTheme} from '@/theme/theme';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import CitationSheet, {
  CitationChoice,
} from '@/components/generate/CitationSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'Generate'>;

const RESEARCH_TYPES = [
  {id: 'quantitative', label: 'Quantitative'},
  {id: 'qualitative', label: 'Qualitative'},
  {id: 'mixed', label: 'Mixed Methods'},
  {id: 'literature-review', label: 'Literature Review'},
] as const;

const ACADEMIC_LEVELS = [
  {id: 'shs', label: 'SHS'},
  {id: 'undergraduate', label: 'Undergraduate'},
  {id: 'graduate', label: 'Graduate'},
] as const;

const PAPER_LENGTHS = [
  {id: 'short', label: 'Short', sub: '3–5 pages'},
  {id: 'standard', label: 'Standard', sub: '8–12 pages'},
  {id: 'long', label: 'Long', sub: '15–20 pages'},
] as const;

type ResearchType = (typeof RESEARCH_TYPES)[number]['id'];
type AcademicLevel = (typeof ACADEMIC_LEVELS)[number]['id'];
type PaperLength = (typeof PAPER_LENGTHS)[number]['id'];

export default function GenerateScreen({navigation}: Props) {
  const settings = useSettingsStore();
  const {palette} = useTheme();

  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [researchType, setResearchType] =
    useState<ResearchType>('quantitative');
  const [academicLevel, setLevel] = useState<AcademicLevel>('shs');
  const [paperLength, setLength] = useState<PaperLength>('standard');
  const [showCitation, setShowCitation] = useState(false);
  const [modelMissing, setModelMissing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const exists = await modelExists();
        if (!cancelled) {
          setModelMissing(!exists);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );
  const [citation, setCitation] = useState<CitationChoice>({
    style: settings.defaultCitationStyle,
    edition: settings.defaultCitationEdition,
  });

  async function handleGenerate() {
    if (!topic.trim()) {
      return;
    }
    const provider = useSettingsStore.getState().provider;
    if (provider === 'local' && !(await modelExists())) {
      navigation.navigate('ModelDownload');
      return;
    }
    setShowCitation(true);
  }

  function handleCitationConfirm(choice: CitationChoice) {
    setCitation(choice);
    setShowCitation(false);

    navigation.navigate('CitationReview', {
      topic: context.trim()
        ? `${topic.trim()}\n\nAdditional context: ${context.trim()}`
        : topic.trim(),
      citationStyle: choice.style,
      citationEdition: choice.edition,
      researchType,
      academicLevel,
      paperLength,
    });
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, {backgroundColor: palette.bg}]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Text style={[styles.heading, {color: palette.text}]}>New paper</Text>
        <Text style={[styles.subheading, {color: palette.textSoft}]}>
          Describe your research topic and PaperMind will plan, cite, and write
          a complete academic paper.
        </Text>

        {/* Topic */}
        <Label text="Research topic" required />
        <TextInput
          style={[
            styles.input,
            styles.topicInput,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              color: palette.text,
            },
          ]}
          value={topic}
          onChangeText={setTopic}
          placeholder="e.g. Relationship between daily mobile game playtime and academic performance of Grade 11 students"
          placeholderTextColor={palette.textMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Context */}
        <Label text="Additional context" />
        <TextInput
          style={[
            styles.input,
            styles.contextInput,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              color: palette.text,
            },
          ]}
          value={context}
          onChangeText={setContext}
          placeholder="Any specific focus, institution, or constraints (optional)"
          placeholderTextColor={palette.textMuted}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />

        {/* Research type */}
        <Label text="Research type" />
        <View style={styles.chipRow}>
          {RESEARCH_TYPES.map(rt => (
            <Chip
              key={rt.id}
              label={rt.label}
              selected={researchType === rt.id}
              onPress={() => setResearchType(rt.id)}
            />
          ))}
        </View>

        {/* Academic level */}
        <Label text="Academic level" />
        <View style={styles.chipRow}>
          {ACADEMIC_LEVELS.map(al => (
            <Chip
              key={al.id}
              label={al.label}
              selected={academicLevel === al.id}
              onPress={() => setLevel(al.id)}
            />
          ))}
        </View>

        {/* Paper length */}
        <Label text="Paper length" />
        <View style={styles.chipRow}>
          {PAPER_LENGTHS.map(pl => (
            <Chip
              key={pl.id}
              label={pl.label}
              sublabel={pl.sub}
              selected={paperLength === pl.id}
              onPress={() => setLength(pl.id)}
            />
          ))}
        </View>

        {/* Generate button */}
        <Button
          label="Generate paper"
          onPress={handleGenerate}
          disabled={!topic.trim()}
          style={styles.generateButton}
        />

        {modelMissing && (
          <Text style={[styles.noKeyWarning, {color: palette.warning}]}>
            AI model not loaded — tap "Generate paper" to download it first.
          </Text>
        )}
      </ScrollView>

      <CitationSheet
        visible={showCitation}
        initialStyle={citation.style}
        initialEdition={citation.edition}
        onConfirm={handleCitationConfirm}
        onDismiss={() => setShowCitation(false)}
      />
    </KeyboardAvoidingView>
  );
}

function Label({text, required}: {text: string; required?: boolean}) {
  const {palette} = useTheme();
  return (
    <Text style={[labelStyles.text, {color: palette.textSoft}]}>
      {text}
      {required ? <Text style={{color: palette.danger}}> *</Text> : null}
    </Text>
  );
}

const labelStyles = StyleSheet.create({
  text: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
});

const styles = StyleSheet.create({
  flex: {flex: 1},
  scroll: {flex: 1},
  content: {paddingHorizontal: 20, paddingBottom: 40},
  heading: {fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 4},
  subheading: {fontSize: 14, lineHeight: 21, marginBottom: 8, marginTop: 6},
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    lineHeight: 21,
  },
  topicInput: {minHeight: 88},
  contextInput: {minHeight: 60},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  generateButton: {marginTop: 28},
  noKeyWarning: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 12,
  },
});
