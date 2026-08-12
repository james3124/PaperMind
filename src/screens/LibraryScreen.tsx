import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { database } from '@/db/database';
import Document from '@/db/models/Document';
import { documentRepository } from '@/db/DocumentRepository';
import { importDocx } from '@/services/docxImport';
import DocumentCard from '@/components/library/DocumentCard';
import DocumentPicker from 'react-native-document-picker';
import { Q } from '@nozbe/watermelondb';

function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

type Props = NativeStackScreenProps<RootStackParamList, 'Library'>;

type SortOption = 'lastEdited' | 'dateCreated' | 'wordCount' | 'titleAz';

const SORT_LABELS: Record<SortOption, string> = {
  lastEdited:  'Last edited',
  dateCreated: 'Date created',
  wordCount:   'Word count',
  titleAz:     'Title A–Z',
};

export default function LibraryScreen({ navigation }: Props) {
  const [documents,    setDocuments]    = useState<Document[]>([]);
  const [query,        setQuery]        = useState('');
  const [starredOnly,  setStarredOnly]  = useState(false);
  const [sort,         setSort]         = useState<SortOption>('lastEdited');
  const [importing,    setImporting]    = useState(false);
  const [isOffline,    setIsOffline]    = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Subscribe to WatermelonDB changes
  useEffect(() => {
    const subscription = database
      .get<Document>('documents')
      .query()
      .observe()
      .subscribe((docs) => setDocuments(docs));
    return () => subscription.unsubscribe();
  }, []);

  // Offline check
  useEffect(() => {
    fetchWithTimeout('https://api.crossref.org', 3000)
      .then(() => setIsOffline(false))
      .catch(() => setIsOffline(true));
  }, []);

  // Filter + sort
  const visible = documents
    .filter((d) => {
      if (starredOnly && !d.starred) return false;
      if (query && !d.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sort) {
        case 'lastEdited':  return b.updatedAt.getTime() - a.updatedAt.getTime();
        case 'dateCreated': return b.createdAt.getTime() - a.createdAt.getTime();
        case 'wordCount':   return b.wordCount - a.wordCount;
        case 'titleAz':     return a.title.localeCompare(b.title);
      }
    });

  async function handleImport() {
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.doc, DocumentPicker.types.docx],
        copyTo: 'cachesDirectory',
      });

      setImporting(true);
      const filePath = result.fileCopyUri ?? result.uri;
      const content  = await importDocx(filePath.replace('file://', ''));
      const title    = (result.name ?? 'Imported Document').replace(/\.docx?$/i, '');
      const doc      = await documentRepository.create(title);
      await documentRepository.update(doc.id, {
        content,
        wordCount: content.split(/\s+/).filter(Boolean).length,
      });
    } catch (e: unknown) {
      if (!DocumentPicker.isCancel(e)) {
        Alert.alert('Import failed', e instanceof Error ? e.message : 'Unknown error');
      }
    } finally {
      setImporting(false);
    }
  }

  async function handleNewPaper() {
    navigation.navigate('Generate');
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>PaperMind</Text>
        <View style={styles.headerActions}>
          {importing && <ActivityIndicator size="small" color="#6366f1" />}
          <TouchableOpacity onPress={handleImport} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>📂</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSortMenu((v) => !v)} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>⇅</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sort menu */}
      {showSortMenu && (
        <View style={styles.sortMenu}>
          {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.sortItem, sort === s && styles.sortItemActive]}
              onPress={() => { setSort(s); setShowSortMenu(false); }}
            >
              <Text style={[styles.sortItemText, sort === s && styles.sortItemTextActive]}>
                {SORT_LABELS[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Offline banner */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            📡 Offline — Literature search unavailable
          </Text>
          <TouchableOpacity onPress={() => {
            fetchWithTimeout('https://api.crossref.org', 3000)
              .then(() => setIsOffline(false))
              .catch(() => {});
          }}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search + filter */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search papers…"
          clearButtonMode="while-editing"
        />
        <TouchableOpacity
          style={[styles.filterBtn, starredOnly && styles.filterBtnActive]}
          onPress={() => setStarredOnly((v) => !v)}
        >
          <Text>⭐</Text>
        </TouchableOpacity>
      </View>

      {/* Document list */}
      <FlatList
        data={visible}
        keyExtractor={(d) => d.id}
        contentContainerStyle={visible.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyTitle}>No papers yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap + to generate your first research paper
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <DocumentCard
            document={item}
            onTap={() => navigation.navigate('Editor', { documentId: item.id })}
            onStar={() => documentRepository.update(item.id, { starred: !item.starred })}
            onDuplicate={() => documentRepository.duplicate(item.id)}
            onMarkFinal={() => documentRepository.update(item.id, { status: 'finalDraft' })}
            onDelete={() => documentRepository.delete(item.id)}
          />
        )}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleNewPaper}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#fafafa' },
  header:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  appName:           { fontSize: 22, fontWeight: '800', color: '#6366f1' },
  headerActions:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn:         { padding: 6 },
  headerBtnText:     { fontSize: 20 },
  sortMenu:          { position: 'absolute', top: 60, right: 16, zIndex: 100, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 6 },
  sortItem:          { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  sortItemActive:    { backgroundColor: '#eef2ff' },
  sortItemText:      { fontSize: 14, color: '#374151' },
  sortItemTextActive:{ color: '#6366f1', fontWeight: '600' },
  offlineBanner:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff7ed', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#fed7aa' },
  offlineText:       { fontSize: 13, color: '#92400e' },
  retryText:         { fontSize: 13, color: '#d97706', fontWeight: '600' },
  searchRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8, backgroundColor: '#fff' },
  searchInput:       { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, backgroundColor: '#f9fafb' },
  filterBtn:         { padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  filterBtnActive:   { backgroundColor: '#eef2ff', borderColor: '#6366f1' },
  listContent:       { paddingVertical: 8 },
  emptyContainer:    { flex: 1 },
  empty:             { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIcon:         { fontSize: 48 },
  emptyTitle:        { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptySubtitle:     { fontSize: 14, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 40 },
  fab:               { position: 'absolute', bottom: 24, right: 24, width: 58, height: 58, borderRadius: 29, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', elevation: 6 },
  fabText:           { fontSize: 28, color: '#fff', lineHeight: 32 },
});
