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
import {complete, stream} from '@/services/inference';
import {useSettingsStore} from '@/stores/settingsStore';
import {useModelDownloadStore} from '@/stores/modelDownloadStore';
import {exportAndShareDocx} from '@/services/exportContent';
import {markdownToDeltaJson} from '@/utils/markdownToQuillDelta';
import EditorWebView, {EditorRef} from '@/components/editor/EditorWebView';
import TabToolbar from '@/components/editor/TabToolbar';
import StyleBar from '@/components/editor/StyleBar';
import OutlinePanel from '@/components/editor/OutlinePanel';
import FindReplaceBar from '@/components/editor/FindReplaceBar';
import AiPanel from '@/components/editor/AiPanel';
import ChatPanel from '@/components/editor/ChatPanel';
import CitationManagerModal from '@/components/editor/CitationManagerModal';
import CitationPickerModal from '@/components/editor/CitationPickerModal';
import {formatMarker} from '@/services/citationFormat';
import {
  ChatMessage,
  buildSystemPrompt,
  trimMessages,
} from '@/services/chatService';
import {buildReferencesEntries} from '@/services/referencesService';
import {SourcePaper, SourceKey} from '@/services/literatureSearch';
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

  const [sources, setSources] = useState<SourcePaper[]>([]);
  const [citationStyle, setCitationStyle] = useState('apa');
  const [citationEdition, setCitationEdition] = useState('7th');
  const [showCitations, setShowCitations] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatStreaming, setChatStreaming] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);

  const paperSize = useSettingsStore(s => s.paperSize);
  const setPaperSize = useSettingsStore(s => s.setPaperSize);
  const enabledSources = useSettingsStore(s => s.enabledSources);
  const modelReady = useModelDownloadStore(s => s.modelReady);

  useEffect(() => {
    documentRepository.getById(documentId).then(doc => {
      if (doc) {
        setTitle(doc.title);
        setContent(doc.content);
        setWordCount(doc.wordCount);
        try {
          setSources(JSON.parse(doc.sourcesJson || '[]'));
        } catch {
          setSources([]);
        }
        setCitationStyle(doc.citationStyle || 'apa');
        setCitationEdition(doc.citationEdition || '7th');
        try {
          const parsed = JSON.parse(doc.chatJson || '[]');
          if (Array.isArray(parsed)) {
            setChatMessages(parsed);
          }
        } catch {
          setChatMessages([]);
        }
      }
    });
  }, [documentId]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, []);

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

  const onFormatChange = useCallback(
    (f: Record<string, unknown>) => setFormat(f),
    [],
  );
  const onHeadings = useCallback(
    (h: {level: number; text: string; index: number}[]) => setHeadings(h),
    [],
  );
  const onReplaceResult = useCallback(
    (count: number) => setReplaceCount(count),
    [],
  );

  const handleOutline = useCallback(() => {
    editorRef.current?.getHeadings();
    setShowOutline(v => !v);
  }, []);

  const handleAiAction = useCallback(
    async (prompt: string, text: string) => {
      const provider = useSettingsStore.getState().provider;
      if (provider === 'local' && !modelReady) {
        Alert.alert(
          'Model not ready',
          'The AI model is still downloading. Please wait.',
        );
        return;
      }
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
        // Convert markdown output → Quill Delta and insert with proper formatting
        editorRef.current?.insertDelta(markdownToDeltaJson(result));
      } catch (e: unknown) {
        Alert.alert(
          'AI Error',
          e instanceof Error ? e.message : 'Unknown error',
        );
      }
    },
    [modelReady],
  );

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

  const handleSwapSource = useCallback(
    async (paper: SourcePaper) => {
      if (replaceIndex === null) {
        return;
      }
      const oldPaper = sources[replaceIndex];
      const next = [...sources];
      next[replaceIndex] = paper;
      setSources(next);
      setReplaceIndex(null);
      if (oldPaper) {
        editorRef.current?.replaceCitationMarkers(
          replaceIndex + 1,
          formatMarker(oldPaper, citationStyle, replaceIndex + 1),
          formatMarker(paper, citationStyle, replaceIndex + 1),
        );
      }
      editorRef.current?.replaceReferences(
        buildReferencesEntries(next, citationStyle, citationEdition),
      );
      await documentRepository.updateSources(documentId, next);
    },
    [replaceIndex, sources, citationStyle, citationEdition, documentId],
  );

  const saveChat = useCallback(
    (messages: ChatMessage[]) => {
      void documentRepository.updateChat(documentId, messages);
    },
    [documentId],
  );

  const handleChatSend = useCallback(
    (text: string) => {
      const userMsg: ChatMessage = {
        role: 'user',
        content: text,
        createdAt: Date.now(),
      };
      const next = [...chatMessages, userMsg];
      setChatMessages(next);
      saveChat(next);
      setChatStreaming('');
      setChatBusy(true);

      editorRef.current?.getContent(delta => {
        const paperText = extractPlainText(delta);
        const systemPrompt = buildSystemPrompt(
          paperText,
          sources,
          citationStyle,
          citationEdition,
        );
        const history = trimMessages(next);
        const messages = [
          {role: 'system' as const, content: systemPrompt},
          ...history.map(m => ({role: m.role, content: m.content})),
        ];
        stream(messages, token => {
          setChatStreaming(prev => prev + token);
        })
          .then(() => {
            setChatStreaming(current => {
              const assistantMsg: ChatMessage = {
                role: 'assistant',
                content: current,
                createdAt: Date.now(),
              };
              const withAssistant = [...next, assistantMsg];
              setChatMessages(withAssistant);
              saveChat(withAssistant);
              return '';
            });
            setChatBusy(false);
          })
          .catch(e => {
            setChatStreaming('');
            setChatBusy(false);
            Alert.alert(
              'Chat error',
              e instanceof Error ? e.message : 'Unknown error',
            );
          });
      });
    },
    [chatMessages, saveChat, sources, citationStyle, citationEdition],
  );

  const handleChatApply = useCallback(
    (message: ChatMessage) => {
      editorRef.current?.insertDelta(markdownToDeltaJson(message.content));
      const next = chatMessages.map(m =>
        m === message ? {...m, applied: true} : m,
      );
      setChatMessages(next);
      saveChat(next);
    },
    [chatMessages, saveChat],
  );

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

      {showFind && (
        <FindReplaceBar
          onFindReplace={(find, replace) =>
            editorRef.current?.findReplace(find, replace)
          }
          onClose={() => setShowFind(false)}
          lastCount={replaceCount}
        />
      )}

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
        onCitations={() => setShowCitations(true)}
        onChat={() => setShowChat(true)}
        wordCount={wordCount}
      />

      <StyleBar
        onStyle={(key, value) => editorRef.current?.format(key, value)}
      />

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
          {showOutline && (
            <OutlinePanel
              headings={headings}
              onJump={index => editorRef.current?.scrollTo(index)}
              onClose={() => setShowOutline(false)}
            />
          )}
        </View>
      </KeyboardAvoidingView>

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          {wordCount} words · ~{estimatedPages}{' '}
          {estimatedPages === 1 ? 'page' : 'pages'} · {readMinutes} min read
        </Text>
      </View>

      <AiPanel
        visible={showAi}
        selectedText={selectedText}
        onAction={handleAiAction}
        onDismiss={() => setShowAi(false)}
      />

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

      <LinkDialog
        visible={showLink}
        onApply={url => editorRef.current?.format('link', url)}
        onRemove={() => editorRef.current?.format('link', false)}
        onDismiss={() => setShowLink(false)}
      />

      <TableDialog
        visible={showTable}
        onInsert={(rows, cols) => editorRef.current?.insertTable(rows, cols)}
        onDismiss={() => setShowTable(false)}
      />

      <CitationManagerModal
        visible={showCitations}
        sources={sources}
        style={citationStyle}
        edition={citationEdition}
        onReplace={index => setReplaceIndex(index)}
        onDismiss={() => setShowCitations(false)}
      />

      <CitationPickerModal
        visible={replaceIndex !== null}
        current={sources[replaceIndex] ?? ({} as SourcePaper)}
        enabledSources={enabledSources}
        onToggleSource={(key: SourceKey) =>
          useSettingsStore
            .getState()
            .setEnabledSources(
              useSettingsStore.getState().enabledSources.includes(key)
                ? useSettingsStore
                    .getState()
                    .enabledSources.filter(k => k !== key)
                : [...useSettingsStore.getState().enabledSources, key],
            )
        }
        onPick={handleSwapSource}
        onDismiss={() => setReplaceIndex(null)}
      />

      <ChatPanel
        visible={showChat}
        messages={chatMessages}
        streamingText={chatStreaming}
        busy={chatBusy}
        onSend={handleChatSend}
        onApply={handleChatApply}
        onDismiss={() => setShowChat(false)}
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
            const table = (embed as {'paper-table': {html: string}})[
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
  } catch {}
  return deltaJson;
}
