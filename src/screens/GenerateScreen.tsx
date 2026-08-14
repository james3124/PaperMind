import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useSettingsStore } from '@/stores/settingsStore';
import {modelExists} from '@/utils/modelPaths';
import CitationSheet, { CitationChoice } from '@/components/generate/CitationSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'Generate'>;

const RESEARCH_TYPES = [
  { id: 'quantitative',     label: 'Quantitative' },
  { id: 'qualitative',      label: 'Qualitative' },
  { id: 'mixed',            label: 'Mixed Methods' },
  { id: 'literature-review',label: 'Literature Review' },
] as const;

const ACADEMIC_LEVELS = [
  { id: 'shs',           label: 'SHS' },
  { id: 'undergraduate', label: 'Undergraduate' },
  { id: 'graduate',      label: 'Graduate' },
] as const;

const PAPER_LENGTHS = [
  { id: 'short',    label: 'Short',    sub: '3–5 pages' },
  { id: 'standard', label: 'Standard', sub: '8–12 pages' },
  { id: 'long',     label: 'Long',     sub: '15–20 pages' },
] as const;

type ResearchType   = typeof RESEARCH_TYPES[number]['id'];
type AcademicLevel  = typeof ACADEMIC_LEVELS[number]['id'];
type PaperLength    = typeof PAPER_LENGTHS[number]['id'];

export default function GenerateScreen({ navigation }: Props) {
  const settings = useSettingsStore();

  const [topic,         setTopic]        = useState('');
  const [context,       setContext]      = useState('');
  const [researchType,  setResearchType] = useState<ResearchType>('quantitative');
  const [academicLevel, setLevel]        = useState<AcademicLevel>('shs');
  const [paperLength,   setLength]       = useState<PaperLength>('standard');
  const [showCitation,  setShowCitation] = useState(false);
  const [modelMissing, setModelMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const exists = await modelExists();
      if (!cancelled) setModelMissing(!exists);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [citation,      setCitation]     = useState<CitationChoice>({
    style:   settings.defaultCitationStyle,
    edition: settings.defaultCitationEdition,
  });

  async function handleGenerate() {
    if (!topic.trim()) return;
    if (!(await modelExists())) {
      navigation.navigate('ModelDownload');
      return;
    }
    setShowCitation(true);
  }

  function handleCitationConfirm(choice: CitationChoice) {
    setCitation(choice);
    setShowCitation(false);

    navigation.navigate('Progress', {
      topic:           context.trim() ? `${topic.trim()}\n\nAdditional context: ${context.trim()}` : topic.trim(),
      citationStyle:   choice.style,
      citationEdition: choice.edition,
      researchType,
      academicLevel,
      paperLength,
    });
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.heading}>New Paper</Text>
        <Text style={styles.subheading}>
          Describe your research topic and PaperMind will generate a complete academic paper.
        </Text>

        {/* Topic */}
        <Label text="Research Topic" required />
        <TextInput
          style={[styles.input, styles.topicInput]}
          value={topic}
          onChangeText={setTopic}
          placeholder="e.g. Relationship between daily mobile game playtime and academic performance of Grade 11 students"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Context */}
        <Label text="Additional Context" />
        <TextInput
          style={[styles.input, styles.contextInput]}
          value={context}
          onChangeText={setContext}
          placeholder="Any specific focus, institution, or constraints (optional)"
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />

        {/* Research type */}
        <Label text="Research Type" />
        <View style={styles.chipRow}>
          {RESEARCH_TYPES.map((rt) => (
            <TouchableOpacity
              key={rt.id}
              style={[styles.chip, researchType === rt.id && styles.chipSelected]}
              onPress={() => setResearchType(rt.id)}
            >
              <Text style={[styles.chipText, researchType === rt.id && styles.chipTextSelected]}>
                {rt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Academic level */}
        <Label text="Academic Level" />
        <View style={styles.chipRow}>
          {ACADEMIC_LEVELS.map((al) => (
            <TouchableOpacity
              key={al.id}
              style={[styles.chip, academicLevel === al.id && styles.chipSelected]}
              onPress={() => setLevel(al.id)}
            >
              <Text style={[styles.chipText, academicLevel === al.id && styles.chipTextSelected]}>
                {al.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Paper length */}
        <Label text="Paper Length" />
        <View style={styles.chipRow}>
          {PAPER_LENGTHS.map((pl) => (
            <TouchableOpacity
              key={pl.id}
              style={[styles.chip, paperLength === pl.id && styles.chipSelected]}
              onPress={() => setLength(pl.id)}
            >
              <View style={styles.chipInner}>
                <Text style={[styles.chipText, paperLength === pl.id && styles.chipTextSelected]}>
                  {pl.label}
                </Text>
                <Text style={[styles.chipSub, paperLength === pl.id && styles.chipTextSelected]}>
                  {pl.sub}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Generate button */}
        <TouchableOpacity
          style={[styles.generateButton, !topic.trim() && styles.generateButtonDisabled]}
          onPress={handleGenerate}
          disabled={!topic.trim()}
        >
          <Text style={styles.generateText}>Generate Paper</Text>
        </TouchableOpacity>

        {modelMissing && (
          <Text style={styles.noKeyWarning}>
            ⚠️ AI model not loaded — tap "Generate Paper" to download it first.
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

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <Text style={labelStyles.text}>
      {text}{required ? <Text style={labelStyles.required}> *</Text> : null}
    </Text>
  );
}

const labelStyles = StyleSheet.create({
  text:     { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 6 },
  required: { color: '#ef4444' },
});

const styles = StyleSheet.create({
  flex:                   { flex: 1, backgroundColor: '#fff' },
  scroll:                 { flex: 1 },
  content:                { padding: 20, paddingBottom: 40 },
  heading:                { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 6 },
  subheading:             { fontSize: 14, color: '#6b7280', marginBottom: 8, lineHeight: 20 },
  input:                  { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: '#fff' },
  topicInput:             { minHeight: 80 },
  contextInput:           { minHeight: 60 },
  chipRow:                { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:                   { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  chipSelected:           { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipInner:              { alignItems: 'center' },
  chipText:               { fontSize: 13, color: '#374151', fontWeight: '500' },
  chipTextSelected:       { color: '#fff' },
  chipSub:                { fontSize: 10, color: '#9ca3af', marginTop: 1 },
  generateButton:         { backgroundColor: '#6366f1', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 28 },
  generateButtonDisabled: { opacity: 0.4 },
  generateText:           { color: '#fff', fontWeight: '700', fontSize: 16 },
  noKeyWarning:           { fontSize: 13, color: '#f59e0b', textAlign: 'center', marginTop: 12 },
});