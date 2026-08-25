import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type {RootStackParamList} from '@/navigation/AppNavigator';
import {
  searchLiterature,
  SourceKey,
  SourcePaper,
} from '@/services/literatureSearch';
import {useSettingsStore} from '@/stores/settingsStore';
import {useTheme} from '@/theme/theme';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';

type Props = NativeStackScreenProps<RootStackParamList, 'CitationReview'>;

const SOURCE_OPTIONS: {key: SourceKey; label: string}[] = [
  {key: 'crossref', label: 'CrossRef'},
  {key: 'openalex', label: 'OpenAlex'},
  {key: 'semanticscholar', label: 'Semantic Scholar'},
  {key: 'arxiv', label: 'arXiv'},
];

export default function CitationReviewScreen({route, navigation}: Props) {
  const {topic} = route.params;
  const settings = useSettingsStore();
  const {palette} = useTheme();
  const [enabled, setEnabled] = useState<SourceKey[]>(settings.enabledSources);
  const [refine, setRefine] = useState('');
  const [results, setResults] = useState<SourcePaper[] | null>(null);
  const [selected, setSelected] = useState<SourcePaper[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    setSearching(true);
    setError(null);
    try {
      const query = refine.trim() ? `${topic}\n${refine.trim()}` : topic;
      const found = await searchLiterature(query, [], enabled);
      setResults(
        found.filter(
          r => !selected.some(s => s.doi === r.doi && s.title === r.title),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  function toggleSource(key: SourceKey) {
    setEnabled(prev => {
      if (prev.includes(key)) {
        const next = prev.filter(k => k !== key);
        return next.length === 0 ? prev : next;
      }
      return [...prev, key];
    });
  }

  function addPaper(paper: SourcePaper) {
    setSelected(prev => [...prev, paper]);
    setResults(prev => (prev ? prev.filter(r => r !== paper) : prev));
  }

  function removePaper(index: number) {
    setSelected(prev => prev.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    setSelected(prev => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) {
        return prev;
      }
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleGenerate() {
    settings.setEnabledSources(enabled);
    navigation.navigate('Progress', {
      topic: route.params.topic,
      citationStyle: route.params.citationStyle,
      citationEdition: route.params.citationEdition,
      researchType: route.params.researchType,
      academicLevel: route.params.academicLevel,
      paperLength: route.params.paperLength,
      sources: selected,
      enabledSources: enabled,
    });
  }

  return (
    <ScrollView
      style={[styles.scroll, {backgroundColor: palette.bg}]}
      contentContainerStyle={styles.content}>
      <Text style={[styles.heading, {color: palette.text}]}>Sources</Text>
      <Text style={[styles.subheading, {color: palette.textSoft}]}>
        Choose which literature sources to search, review the papers, then
        generate. Tap any paper to select it — it becomes a citation.
      </Text>

      {/* Source toggles */}
      <Label text="Search sources" />
      <View style={styles.chipRow}>
        {SOURCE_OPTIONS.map(opt => (
          <Chip
            key={opt.key}
            label={opt.label}
            selected={enabled.includes(opt.key)}
            onPress={() => toggleSource(opt.key)}
          />
        ))}
      </View>

      {/* Refine query */}
      <Label text="Refine query (optional)" />
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            color: palette.text,
          },
        ]}
        value={refine}
        onChangeText={setRefine}
        placeholder="e.g. focus on 2020–2025 studies"
        placeholderTextColor={palette.textMuted}
      />

      <Button
        label={searching ? 'Searching…' : 'Search & review'}
        onPress={handleSearch}
        disabled={searching}
        style={styles.searchButton}
      />

      {error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={15} color={palette.danger} />
          <Text style={[styles.error, {color: palette.danger}]}>{error}</Text>
        </View>
      )}

      {/* Selected papers */}
      {selected.length > 0 && (
        <>
          <Label text={`Selected (${selected.length}) — citation order`} />
          {selected.map((p, i) => (
            <View
              key={`${p.title}-${i}`}
              style={[
                styles.card,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardIndex, {color: palette.accent}]}>
                  [{i + 1}]
                </Text>
                <Text
                  style={[styles.cardTitle, {color: palette.text}]}
                  numberOfLines={2}>
                  {p.title}
                </Text>
              </View>
              <Text style={[styles.cardMeta, {color: palette.textMuted}]}>
                {p.authors.slice(0, 3).join(', ')} ({p.year}) · {p.source}
              </Text>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  onPress={() => move(i, -1)}
                  disabled={i === 0}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <Ionicons
                    name="chevron-up"
                    size={19}
                    color={i === 0 ? palette.border : palette.accent}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => move(i, 1)}
                  disabled={i === selected.length - 1}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <Ionicons
                    name="chevron-down"
                    size={19}
                    color={
                      i === selected.length - 1
                        ? palette.border
                        : palette.accent
                    }
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => removePaper(i)}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <Ionicons name="close" size={18} color={palette.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Search results */}
      {results && (
        <>
          <Label text={`Results (${results.length})`} />
          {results.map((p, i) => (
            <TouchableOpacity
              key={`${p.title}-${i}`}
              style={[
                styles.resultRow,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
              onPress={() => addPaper(p)}
              activeOpacity={0.75}>
              <View style={styles.resultTextWrap}>
                <Text
                  style={[styles.resultTitle, {color: palette.text}]}
                  numberOfLines={2}>
                  {p.title}
                </Text>
                <Text style={[styles.resultMeta, {color: palette.textMuted}]}>
                  {p.authors.slice(0, 3).join(', ')} ({p.year}) · {p.source}
                </Text>
              </View>
              <Ionicons
                name="add-circle-outline"
                size={22}
                color={palette.accent}
              />
            </TouchableOpacity>
          ))}
        </>
      )}

      <Button
        label={`Generate paper with ${selected.length} sources`}
        onPress={handleGenerate}
        disabled={selected.length === 0}
        style={styles.generateButton}
      />
    </ScrollView>
  );
}

function Label({text}: {text: string}) {
  const {palette} = useTheme();
  return <Text style={[styles.label, {color: palette.textSoft}]}>{text}</Text>;
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  content: {paddingHorizontal: 20, paddingBottom: 40},
  heading: {fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 4},
  subheading: {fontSize: 14, lineHeight: 21, marginBottom: 8, marginTop: 6},
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
  },
  searchButton: {marginTop: 16},
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  error: {fontSize: 13, flex: 1},
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 13,
    marginBottom: 8,
  },
  cardHeader: {flexDirection: 'row', alignItems: 'flex-start', gap: 8},
  cardIndex: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  cardTitle: {flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20},
  cardMeta: {fontSize: 12, marginTop: 4},
  cardActions: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 10,
    justifyContent: 'flex-end',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 13,
    marginBottom: 8,
  },
  resultTextWrap: {flex: 1},
  resultTitle: {fontSize: 14, fontWeight: '600', lineHeight: 20},
  resultMeta: {fontSize: 12, marginTop: 4},
  generateButton: {marginTop: 28},
});
