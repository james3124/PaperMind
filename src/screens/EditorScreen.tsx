import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/AppNavigator';
import {documentRepository} from '@/db/DocumentRepository';
import {complete} from '@/services/llamaService';
import {modelExists} from '@/utils/modelPaths';
import {useSettingsStore} from '@/stores/settingsStore';
import {exportAndShareDocx} from '@/services/exportContent';
import EditorWebView, {EditorRef} from '@/components/editor/EditorWebView';
import TabToolbar from '@/components/editor/TabToolbar';
import StyleBar from '@/components/editor/StyleBar';
import OutlinePanel from '@/components/editor/OutlinePanel';
import FindReplaceBar from '@/components/editor/FindReplaceBar';
import AiPanel from '@/components/editor/AiPanel';
import ColorPaletteModal, {
  ColorKind,
} from '@/components/editor/ColorPaletteModal';
import LinkDialog from '@/components/editor/LinkDialog';
import TableDialog from '@/components/editor/TableDialog';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';

type Props = NativeStackScreenProps<RootStackParamList, 'Editor'>;

type SaveStatus = 'saved' | 'saving' | 'unsaved';

export default function EditorScreen({route, navigation}: Props) {
  const {documentId} = route.params;
  const editorRef = useRef<EditorRef>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [format, setFormat] = useState<Record<string, unknown>>({});
  const [headings, setHeadings] = useState<
    {level: number; text: string; index: number}[]
  >([]);
  const [replaceCount, setReplaceCount] = useState<number | undefined>();
  const [editorReady, setEditorReady] = useState(false);

  const [showOutline, setShowOutline] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [exporting, setExporting] = useState(false);
  const [colorKind, setColorKind] = useState<ColorKind | null>(null);
  const [showLink, setShowLink] = useState(false);
  const [showTable, setShowTable] = useState(false);

  const paperSize = useSettingsStore(s => s.paperSize);
  const setPaperSize = useSettingsStore(s => s.setPaperSize);

  // Load document on mount
  useEffect(() => {
    documentRepository.getById(documentId).then(doc => {
      if (doc) {
        setTitle(doc.title);
        setContent(doc.content);
        setWordCount(doc.wordCount);
      }
    });
  }, [documentId]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);
  
  // Auto-save
  const onContentChange = useCallback(
    (delta: string, wc: number) => {
      setSaveStatus('unsaved');
      setWordCount(wc);

      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      saveTimer.current = setTimeout(async () => {
        setSaveStatus('saving');
        await documentRepository.update(documentId, {
          content: delta,
          wordCount: wc,
        });
        setSaveStatus('saved');
      }, 2000);
    },
    [documentId],
  );

  const onFormatChange = useCallback((f: Record<string, unknown>) => {
    setFormat(f);
  }, []);

  const onHeadings = useCallback(
    (h: {level: number; text: string; index: number}[]) => {
      setHeadings(h);
    },
    [],
  );

  const onReplaceResult = useCallback((count: number) => {
    setReplaceCount(count);
  }, []);

  const handleOutline = useCallback(() => {
    editorRef.current?.getHeadings();
    setShowOutline(v => !v);
  }, []);

  const handleAiAction = useCallback(async (prompt: string, text: string) => {
    try {
      const result = await complete(
        [
          {
            role: 'system',
            content:
              'You are PaperMind, an expert academic editor. Output only the edited text, no commentary.',
          },
          {role: 'user', content: `${prompt}\n\n${text}`},
        ],
        0.7,
        1024,
      );
      editorRef.current?.insertText(result);
    } catch (e: unknown) {
      Alert.alert('AI Error', e instanceof Error ? e.message : 'Unknown error');
    }
  }, []);

  const handleExport = useCallback(() => {
    if (exporting) {
      return;
    }
    setExporting(true);
    editorRef.current?.getContent(async delta => {
      try {
        const text = extractPlainText(delta);
        await exportAndShareDocx(title || 'Untitled', text);
      } catch (e: unknown) {
        Alert.alert(
          'Export failed',
          e instanceof Error ? e.message : 'Unknown error',
        );
      } finally {
        setExporting(false);
      }
    });
  }, [exporting, title]);

  const handleInsertImage = useCallback(async () => {
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.images],
        copyTo: 'cachesDirectory',
      });
      const filePath = result.fileCopyUri ?? result.uri;
      const base64 = await RNFS.readFile(
        filePath.replace('file://', ''),
        'base64',
      );
      const ext = (result.name?.split('.').pop() ?? 'png').toLowerCase();
      const mime =
        ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : ext === 'gif'
          ? 'image/gif'
          : ext === 'webp'
          ? 'image/webp'
          : 'image/png';
      editorRef.current?.insertImage(`data:${mime};base64,${base64}`);
    } catch (e: unknown) {
      if (!DocumentPicker.isCancel(e)) {
        Alert.alert(
          'Image failed',
          e instanceof Error ? e.message : 'Unknown error',
        );
      }
    }
  }, []);

  const estimatedPages = Math.max(1, Math.ceil(wordCount / 250));
  const readMinutes = Math.max(1, Math.ceil(wordCount / 200));

  const saveIndicator =
    saveStatus === 'saved'
      ? '✓ Saved'
      : saveStatus === 'saving'
      ? 'Saving…'
      : '●';

  return (
    <SafeAreaView style={styles.safe}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.titleText} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.saveStatus}>{saveIndicator}</Text>
        {exporting && <ActivityIndicator size="small" color="#6366f1" />}
        <TouchableOpacity onPress={handleExport} disabled={exporting}>
          <Text style={styles.iconBtn}>📤</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setShowFind(v => !v);
            setShowOutline(false);
          }}>
          <Text style={styles.iconBtn}>🔍</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleOutline}>
          <Text style={styles.iconBtn}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* Find & Replace */}
      {showFind && (
        <FindReplaceBar
          onFindReplace={(find, replace) =>
            editorRef.current?.findReplace(find, replace)
          }
          onClose={() => setShowFind(false)}
          lastCount={replaceCount}
        />
      )}

      {/* Ribbon (tab toolbar) at top, Word-style */}
      <TabToolbar
        currentFormat={format}
        paperSize={paperSize}
        onFormat={(key, value) => editorRef.current?.format(key, value)}
        onInsert={text => editorRef.current?.insertText(text)}
        onUndo={() => editorRef.current?.undo()}
        onRedo={() => editorRef.current?.redo()}
        onFindReplace={() => {
          setShowFind(v => !v);
          setShowOutline(false);
        }}
        onOutline={handleOutline}
        onPaperSize={size => {
          setPaperSize(size);
          editorRef.current?.setPaperSize(size);
        }}
        onOpenColor={kind => setColorKind(kind)}
        onSpacing={value =>
          editorRef.current?.format('spacing', value === false ? false : value)
        }
        onInsertTable={() => setShowTable(true)}
        onInsertImage={handleInsertImage}
        onInsertPageBreak={() => editorRef.current?.insertPageBreak()}
        onOpenLink={() => setShowLink(true)}
        onAiAction={() => setShowAi(true)}
        wordCount={wordCount}
      />

      {/* Style bar */}
      <StyleBar
        onStyle={(key, value) => editorRef.current?.format(key, value)}
      />

      {/* Main content */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <View style={styles.flex}>
          {editorReady ? null : (
            <View style={styles.loading}>
              <Text style={styles.loadingText}>Loading editor…</Text>
            </View>
          )}
          <EditorWebView
            ref={editorRef}
            initialContent={content}
            paperSize={paperSize}
            onContentChange={onContentChange}
            onFormatChange={onFormatChange}
            onHeadings={onHeadings}
            onReplaceResult={onReplaceResult}
            onSelectionText={text => {
              if (text.trim()) {
                setSelectedText(text);
                setShowAi(true);
              } else {
                setShowAi(false);
              }
            }}
            onReady={() => setEditorReady(true)}
          />

          {/* Outline panel overlay */}
          {showOutline && (
            <OutlinePanel
              headings={headings}
              onJump={index => editorRef.current?.scrollTo(index)}
              onClose={() => setShowOutline(false)}
            />
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          {wordCount} words · ~{estimatedPages}{' '}
          {estimatedPages === 1 ? 'page' : 'pages'} · {readMinutes} min read
        </Text>
      </View>

      {/* AI Panel */}
      <AiPanel
        visible={showAi}
        selectedText={selectedText}
        onAction={handleAiAction}
        onDismiss={() => setShowAi(false)}
      />

      {/* Color palette modal */}
      <ColorPaletteModal
        visible={colorKind !== null}
        kind={colorKind ?? 'color'}
        onSelect={hex =>
          editorRef.current?.format(
            colorKind === 'background' ? 'background' : 'color',
            hex,
          )
        }
        onClear={() =>
          editorRef.current?.format(
            colorKind === 'background' ? 'background' : 'color',
            false,
          )
        }
        onDismiss={() => setColorKind(null)}
      />

      {/* Link dialog */}
      <LinkDialog
        visible={showLink}
        onApply={url => editorRef.current?.format('link', url)}
        onRemove={() => editorRef.current?.format('link', false)}
        onDismiss={() => setShowLink(false)}
      />

      {/* Table dialog */}
      <TableDialog
        visible={showTable}
        onInsert={(rows, cols) => editorRef.current?.insertTable(rows, cols)}
        onDismiss={() => setShowTable(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#fff'},
  flex: {flex: 1},
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  backBtn: {paddingRight: 4},
  backText: {fontSize: 28, color: '#6366f1', lineHeight: 28},
  titleText: {flex: 1, fontSize: 15, fontWeight: '600', color: '#111827'},
  saveStatus: {fontSize: 12, color: '#9ca3af'},
  iconBtn: {fontSize: 20, paddingHorizontal: 4},
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 10,
  },
  loadingText: {color: '#9ca3af', fontSize: 14},
  statusBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  statusText: {fontSize: 11, color: '#9ca3af'},
});

function extractPlainText(deltaJson: string): string {
  try {
    const delta = JSON.parse(deltaJson);
    if (Array.isArray(delta.ops)) {
      return delta.ops
        .map((op: {insert: unknown}) => {
          if (typeof op.insert === 'string') {
            return op.insert;
          }
          const embed = op.insert as Record<string, unknown> | null;
          if (embed && 'paper-table' in embed) {
            const table = (embed as {['paper-table']: {html: string}})[
              'paper-table'
            ];
            return (table.html ?? '')
              .replace(/<t[dh][^>]*>/gi, ' ')
              .replace(/<\/t[dh]>/gi, '  ')
              .replace(/<[^>]+>/g, '')
              .replace(/&nbsp;/g, ' ')
              .trim();
          }
          if (embed && 'page-break' in embed) {
            return '\n\n';
          }
          if (embed && 'image' in embed) {
            return '[image] ';
          }
          return '';
        })
        .join('');
    }
  } catch {
    // not JSON — treat as raw text
  }
  return deltaJson;
}
