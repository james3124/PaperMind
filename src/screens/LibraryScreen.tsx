import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type {RootStackParamList} from '@/navigation/AppNavigator';
import {database} from '@/db/database';
import Document from '@/db/models/Document';
import {documentRepository} from '@/db/DocumentRepository';
import {importDocxFromUri} from '@/services/paperFileStore';
import {shareExistingDocx} from '@/services/exportContent';
import {useTheme} from '@/theme/theme';
import Button from '@/components/ui/Button';
import DocumentCard from '@/components/library/DocumentCard';
import DocumentPicker from 'react-native-document-picker';

function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {signal: controller.signal}).finally(() =>
    clearTimeout(timer),
  );
}

type Props = NativeStackScreenProps<RootStackParamList, 'Library'>;

type SortOption = 'lastEdited' | 'dateCreated' | 'wordCount' | 'titleAz';

const SORT_LABELS: Record<SortOption, string> = {
  lastEdited: 'Last edited',
  dateCreated: 'Date created',
  wordCount: 'Word count',
  titleAz: 'Title A–Z',
};

export default function LibraryScreen({navigation}: Props) {
  const {palette, elevation} = useTheme();
  const insets = useSafeAreaInsets();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [query, setQuery] = useState('');
  const [starredOnly, setStarredOnly] = useState(false);
  const [sort, setSort] = useState<SortOption>('lastEdited');
  const [importing, setImporting] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  // Subscribe to WatermelonDB changes
  useEffect(() => {
    const subscription = database
      .get<Document>('documents')
      .query()
      .observe()
      .subscribe(docs => setDocuments(docs));
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
    .filter(d => {
      if (starredOnly && !d.starred) {
        return false;
      }
      if (query && !d.title.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sort) {
        case 'lastEdited':
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        case 'dateCreated':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'wordCount':
          return b.wordCount - a.wordCount;
        case 'titleAz':
          return a.title.localeCompare(b.title);
      }
    });

  async function handleImport() {
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.doc, DocumentPicker.types.docx],
        copyTo: 'cachesDirectory',
      });

      setImporting(true);
      const sourceUri = result.fileCopyUri ?? result.uri;
      const title = (result.name ?? 'Imported Document').replace(
        /\.docx?$/i,
        '',
      );
      // The row's content points at papers/<id>.docx from the start; the
      // picked file replaces the blank template provisioned by create().
      const doc = await documentRepository.create(title);
      try {
        await importDocxFromUri(sourceUri, doc.id);
      } catch (copyErr: unknown) {
        // No orphan blank row when the file copy fails.
        try {
          await documentRepository.delete(doc.id);
        } catch {}
        throw copyErr;
      }
      navigation.navigate('Editor', {documentId: doc.id});
    } catch (e: unknown) {
      if (!DocumentPicker.isCancel(e)) {
        Alert.alert(
          'Import failed',
          e instanceof Error ? e.message : 'Unknown error',
        );
      }
    } finally {
      setImporting(false);
    }
  }

  async function handleNewPaper() {
    setFabOpen(false);
    navigation.navigate('Generate');
  }

  // create() provisions the blank docx (copyBlankTemplate) and points the row
  // at papers/<id>.docx, so no extra file work is needed here.
  async function createBlankDocument() {
    setFabOpen(false);
    try {
      const doc = await documentRepository.create('Untitled document');
      navigation.navigate('Editor', {documentId: doc.id});
    } catch (e: unknown) {
      Alert.alert(
        'Could not create document',
        e instanceof Error ? e.message : 'Unknown error',
      );
    }
  }

  async function handleExport(doc: Document) {
    if (exportingId) {
      return;
    }
    setExportingId(doc.id);
    try {
      await shareExistingDocx({id: doc.id, title: doc.title});
    } catch (e: unknown) {
      Alert.alert(
        'Export failed',
        e instanceof Error ? e.message : 'Unknown error',
      );
    } finally {
      setExportingId(null);
    }
  }

  const busy = importing || exportingId !== null;

  return (
    <View style={[styles.container, {backgroundColor: palette.bg}]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: palette.bg,
            paddingTop: insets.top + 10,
            borderBottomColor: palette.border,
          },
        ]}>
        <Text style={[styles.appName, {color: palette.text}]}>
          Paper<Text style={{color: palette.accent}}>Mind</Text>
        </Text>
        <View style={styles.headerActions}>
          {busy && <ActivityIndicator size="small" color={palette.accent} />}
          <TouchableOpacity
            onPress={handleImport}
            style={styles.headerBtn}
            accessibilityLabel="Import DOCX">
            <Ionicons name="share-outline" size={21} color={palette.textSoft} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowSortMenu(v => !v)}
            style={styles.headerBtn}
            accessibilityLabel="Sort papers">
            <Ionicons name="swap-vertical" size={21} color={palette.textSoft} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.headerBtn}
            accessibilityLabel="Settings">
            <Ionicons
              name="settings-outline"
              size={21}
              color={palette.textSoft}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sort menu — Modal so tap-outside dismisses it */}
      <Modal
        visible={showSortMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortMenu(false)}>
        <TouchableWithoutFeedback onPress={() => setShowSortMenu(false)}>
          <View style={[styles.backdrop, {backgroundColor: palette.scrim}]} />
        </TouchableWithoutFeedback>
        <View
          style={[
            styles.menu,
            styles.sortMenu,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              marginTop: insets.top + 52,
            },
            elevation.raised(palette.shadow),
          ]}>
          <Text style={[styles.menuTitle, {color: palette.textMuted}]}>
            Sort by
          </Text>
          {(Object.keys(SORT_LABELS) as SortOption[]).map(s => (
            <TouchableOpacity
              key={s}
              style={styles.menuItem}
              onPress={() => {
                setSort(s);
                setShowSortMenu(false);
              }}>
              <Text
                style={[
                  styles.menuItemText,
                  {color: palette.text},
                  sort === s && [
                    styles.menuItemTextActive,
                    {color: palette.accent},
                  ],
                ]}>
                {SORT_LABELS[s]}
              </Text>
              {sort === s && (
                <Ionicons name="checkmark" size={17} color={palette.accent} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* Offline banner */}
      {isOffline && (
        <View
          style={[
            styles.offlineBanner,
            {
              backgroundColor: palette.warningSubtle,
              borderBottomColor: palette.border,
            },
          ]}>
          <Ionicons
            name="cloud-offline-outline"
            size={15}
            color={palette.warning}
          />
          <Text style={[styles.offlineText, {color: palette.warning}]}>
            Offline — literature search unavailable
          </Text>
          <TouchableOpacity
            onPress={() => {
              fetchWithTimeout('https://api.crossref.org', 3000)
                .then(() => setIsOffline(false))
                .catch(() => {});
            }}>
            <Text style={[styles.retryText, {color: palette.accent}]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search + filter */}
      <View style={styles.searchRow}>
        <View
          style={[styles.searchField, {backgroundColor: palette.surfaceAlt}]}>
          <Ionicons
            name="search"
            size={17}
            color={palette.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, {color: palette.text}]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search papers…"
            placeholderTextColor={palette.textMuted}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Ionicons
                name="close-circle"
                size={16}
                color={palette.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.filterBtn,
            {
              backgroundColor: starredOnly
                ? palette.accentSubtle
                : palette.surfaceAlt,
              borderColor: starredOnly ? palette.accent : 'transparent',
            },
          ]}
          onPress={() => setStarredOnly(v => !v)}
          accessibilityLabel="Show starred only"
          activeOpacity={0.7}>
          <Ionicons
            name={starredOnly ? 'star' : 'star-outline'}
            size={18}
            color={starredOnly ? palette.star : palette.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* Document list */}
      <FlatList
        data={visible}
        keyExtractor={d => d.id}
        contentContainerStyle={
          visible.length === 0 ? styles.emptyContainer : styles.listContent
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View
              style={[
                styles.emptyIconWrap,
                {backgroundColor: palette.accentSubtle},
              ]}>
              <Ionicons
                name="document-text-outline"
                size={30}
                color={palette.accent}
              />
            </View>
            <Text style={[styles.emptyTitle, {color: palette.text}]}>
              No papers yet
            </Text>
            <Text style={[styles.emptySubtitle, {color: palette.textMuted}]}>
              Generate a full research paper with on-device AI, or start from a
              blank page.
            </Text>
            <Button
              label="Generate with AI"
              onPress={handleNewPaper}
              style={styles.emptyCta}
            />
            <Button
              label="Start blank document"
              variant="ghost"
              onPress={createBlankDocument}
            />
          </View>
        }
        renderItem={({item}) => (
          <DocumentCard
            document={item}
            onTap={() => navigation.navigate('Editor', {documentId: item.id})}
            onStar={() =>
              documentRepository.update(item.id, {starred: !item.starred})
            }
            onDuplicate={() => documentRepository.duplicate(item.id)}
            onMarkFinal={() =>
              documentRepository.update(item.id, {status: 'finalDraft'})
            }
            onExport={() => handleExport(item)}
            onDelete={() => documentRepository.delete(item.id)}
          />
        )}
      />

      {/* FAB choice sheet — Modal so tap-outside dismisses it */}
      <Modal
        visible={fabOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFabOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setFabOpen(false)}>
          <View style={[styles.backdrop, {backgroundColor: palette.scrim}]} />
        </TouchableWithoutFeedback>
        <View
          style={[
            styles.menu,
            styles.fabMenu,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              marginBottom: insets.bottom + 96,
            },
            elevation.raised(palette.shadow),
          ]}>
          <Text style={[styles.menuTitle, {color: palette.textMuted}]}>
            New document
          </Text>
          <TouchableOpacity style={styles.menuItem} onPress={handleNewPaper}>
            <Ionicons
              name="sparkles-outline"
              size={18}
              color={palette.accent}
            />
            <Text style={[styles.menuItemText, {color: palette.text}]}>
              Generate with AI
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={createBlankDocument}>
            <Ionicons
              name="create-outline"
              size={18}
              color={palette.textSoft}
            />
            <Text style={[styles.menuItemText, {color: palette.text}]}>
              New blank document
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* FAB */}
      <TouchableOpacity
        style={[
          styles.fab,
          {backgroundColor: palette.accent},
          elevation.floating(palette.shadow),
        ]}
        onPress={() => setFabOpen(v => !v)}
        activeOpacity={0.85}
        accessibilityLabel="New document">
        <Ionicons
          name={fabOpen ? 'close' : 'add'}
          size={28}
          color={palette.onAccent}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, zIndex: 0},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appName: {fontSize: 26, fontWeight: '300', letterSpacing: -0.5},
  headerActions: {flexDirection: 'row', alignItems: 'center', gap: 4},
  headerBtn: {padding: 8},
  backdrop: {...StyleSheet.absoluteFillObject},
  menu: {
    position: 'absolute',
    right: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 210,
    overflow: 'hidden',
    paddingVertical: 6,
  },
  sortMenu: {},
  fabMenu: {bottom: 0},
  menuTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  menuItemText: {fontSize: 15},
  menuItemTextActive: {fontWeight: '600'},
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  offlineText: {fontSize: 13, flex: 1},
  retryText: {fontSize: 13, fontWeight: '600'},
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {marginRight: 8},
  searchInput: {flex: 1, fontSize: 14, paddingVertical: 0},
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {paddingBottom: 96},
  emptyContainer: {flexGrow: 1},
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {fontSize: 19, fontWeight: '700'},
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyCta: {alignSelf: 'stretch', marginBottom: 4},
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
