import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import {
  SourcePaper,
  SourceKey,
  searchLiterature,
} from '@/services/literatureSearch';

const SOURCE_KEYS: {key: SourceKey; label: string}[] = [
  {key: 'crossref', label: 'CrossRef'},
  {key: 'openalex', label: 'OpenAlex'},
  {key: 'semanticscholar', label: 'Semantic Scholar'},
  {key: 'arxiv', label: 'arXiv'},
];

interface Props {
  visible: boolean;
  current: SourcePaper;
  enabledSources: SourceKey[];
  onToggleSource: (key: SourceKey) => void;
  onPick: (paper: SourcePaper) => void;
  onDismiss: () => void;
}

export default function CitationPickerModal({
  visible,
  current,
  enabledSources,
  onToggleSource,
  onPick,
  onDismiss,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SourcePaper[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSamePaper = (paper: SourcePaper) =>
    (current.doi &&
      paper.doi &&
      current.doi.toLowerCase() === paper.doi.toLowerCase()) ||
    paper.title === current.title;

  const handleSearch = async () => {
    if (!query.trim() || searching) {
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const found = await searchLiterature(query.trim(), [], enabledSources);
      setResults(found.filter(p => !isSamePaper(p)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Search failed');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Swap Citation</Text>
            <TouchableOpacity onPress={onDismiss}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Search for a replacement source…"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <View style={styles.chips}>
            {SOURCE_KEYS.map(source => {
              const active = enabledSources.includes(source.key);
              return (
                <TouchableOpacity
                  key={source.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => onToggleSource(source.key)}>
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}>
                    {source.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={handleSearch}
            disabled={searching}>
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.searchText}>Search</Text>
            )}
          </TouchableOpacity>
          {error && <Text style={styles.error}>{error}</Text>}
          <ScrollView style={styles.list}>
            {results.map((paper, i) => (
              <TouchableOpacity
                key={i}
                style={styles.row}
                onPress={() => {
                  onPick(paper);
                  onDismiss();
                }}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {paper.title}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {paper.authors.join(', ') || 'Unknown author'} · {paper.year}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {fontSize: 18, fontWeight: '700'},
  close: {fontSize: 18, color: '#6b7280'},
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    marginBottom: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipActive: {backgroundColor: '#eef2ff', borderColor: '#6366f1'},
  chipText: {fontSize: 12, color: '#6b7280'},
  chipTextActive: {color: '#6366f1', fontWeight: '600'},
  searchBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 4,
  },
  searchText: {fontSize: 14, color: '#fff', fontWeight: '600'},
  error: {fontSize: 12, color: '#dc2626', marginVertical: 6},
  list: {flex: 1, marginTop: 6},
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowTitle: {fontSize: 14, color: '#111827', fontWeight: '500'},
  rowMeta: {fontSize: 12, color: '#6b7280', marginTop: 2},
});
