import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/AppNavigator';
import {
  searchLiterature,
  SourceKey,
  SourcePaper,
} from '@/services/literatureSearch';
import {useSettingsStore} from '@/stores/settingsStore';

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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Sources</Text>
      <Text style={styles.subheading}>
        Choose which literature sources to search, review the papers, then
        generate. Tap any paper to select it — it becomes a citation.
      </Text>

      {/* Source toggles */}
      <Text style={styles.label}>Search sources</Text>
      <View style={styles.chipRow}>
        {SOURCE_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.chip,
              enabled.includes(opt.key) && styles.chipSelected,
            ]}
            onPress={() => toggleSource(opt.key)}>
            <Text
              style={[
                styles.chipText,
                enabled.includes(opt.key) && styles.chipTextSelected,
              ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Refine query */}
      <Text style={styles.label}>Refine query (optional)</Text>
      <TextInput
        style={styles.input}
        value={refine}
        onChangeText={setRefine}
        placeholder="e.g. focus on 2020–2025 studies"
      />

      <TouchableOpacity
        style={styles.searchButton}
        onPress={handleSearch}
        disabled={searching}>
        {searching ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.searchButtonText}>Search & Review</Text>
        )}
      </TouchableOpacity>

      {error && <Text style={styles.error}>{error}</Text>}

      {/* Selected papers */}
      {selected.length > 0 && (
        <>
          <Text style={styles.label}>
            Selected ({selected.length}) — citation order
          </Text>
          {selected.map((p, i) => (
            <View key={`${p.title}-${i}`} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>[{i + 1}]</Text>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {p.title}
                </Text>
              </View>
              <Text style={styles.cardMeta}>
                {p.authors.slice(0, 3).join(', ')} ({p.year}) · {p.source}
              </Text>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  onPress={() => move(i, -1)}
                  disabled={i === 0}>
                  <Text style={styles.actionBtn}>↑</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => move(i, 1)}
                  disabled={i === selected.length - 1}>
                  <Text style={styles.actionBtn}>↓</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removePaper(i)}>
                  <Text style={[styles.actionBtn, styles.removeBtn]}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Search results */}
      {results && (
        <>
          <Text style={styles.label}>Results ({results.length})</Text>
          {results.map((p, i) => (
            <TouchableOpacity
              key={`${p.title}-${i}`}
              style={styles.resultRow}
              onPress={() => addPaper(p)}>
              <Text style={styles.resultTitle} numberOfLines={2}>
                {p.title}
              </Text>
              <Text style={styles.resultMeta}>
                {p.authors.slice(0, 3).join(', ')} ({p.year}) · {p.source}
              </Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      <TouchableOpacity
        style={[
          styles.generateButton,
          selected.length === 0 && styles.generateButtonDisabled,
        ]}
        onPress={handleGenerate}
        disabled={selected.length === 0}>
        <Text style={styles.generateText}>
          Generate Paper with {selected.length} Sources
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1, backgroundColor: '#fff'},
  content: {padding: 20, paddingBottom: 40},
  heading: {fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 6},
  subheading: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 6,
  },
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
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
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  searchButton: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  searchButtonText: {color: '#fff', fontWeight: '700', fontSize: 16},
  error: {fontSize: 13, color: '#ef4444', marginTop: 12},
  card: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  cardHeader: {flexDirection: 'row', alignItems: 'flex-start', gap: 8},
  cardIndex: {fontSize: 13, fontWeight: '700', color: '#6366f1'},
  cardTitle: {flex: 1, fontSize: 14, fontWeight: '600', color: '#111827'},
  cardMeta: {fontSize: 12, color: '#6b7280', marginTop: 4},
  cardActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    justifyContent: 'flex-end',
  },
  actionBtn: {fontSize: 16, color: '#6366f1', fontWeight: '700'},
  removeBtn: {color: '#ef4444'},
  resultRow: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  resultTitle: {fontSize: 14, fontWeight: '600', color: '#111827'},
  resultMeta: {fontSize: 12, color: '#6b7280', marginTop: 4},
  generateButton: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 28,
  },
  generateButtonDisabled: {opacity: 0.4},
  generateText: {color: '#fff', fontWeight: '700', fontSize: 16},
});
