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
  Modal,
  TextInput,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/AppNavigator';
import {documentRepository} from '@/db/DocumentRepository';
import {complete, stream} from '@/services/inference';
import {useSettingsStore} from '@/stores/settingsStore';
import {useModelDownloadStore} from '@/stores/modelDownloadStore';
import {exportAndShareDocx} from '@/services/exportContent';
import {exportPdf} from '@/services/pdfExport';
import Share from 'react-native-share';
import {markdownToDeltaJson} from '@/utils/markdownToQuillDelta';
import EditorWebView, {EditorRef} from '@/components/editor/EditorWebView';
import TabToolbar from '@/components/editor/TabToolbar';
import StyleBar from '@/components/editor/StyleBar';
import {DEFAULT_FONT_KEY} from '@/components/editor/fonts';
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
import SnapshotsModal, {SnapshotRow} from '@/components/editor/SnapshotsModal';
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
  const [fontSize, setFontSize] = useState(16);
  const [fontKey, setFontKey] = useState(DEFAULT_FONT_KEY);
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saved'>(
    'idle',
  );

  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [showFootnote, setShowFootnote] = useState(false);
  const [footnoteText, setFootnoteText] = useState('');

  const lastDeltaRef = useRef<string | null>(null);
  const lastSnapshottedContentRef = useRef<string | null>(null);
  const wordCountRef = useRef(0);

  const paperSize = useSettingsStore(s => s.paperSize);
  const setPaperSize = useSettingsStore(s => s.setPaperSize);
  const enabledSources = useSettingsStore(s => s.enabledSources);
  const theme = useSettingsStore(s => s.theme);
  const wordGoal = useSettingsStore(s => s.wordGoal);
  const isDark = theme === 'dark';
  const modelReady = useModelDownloadStore(s => s.modelReady);

  const loadDocument = useCallback(() => {
    setSaveState('idle');
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
    loadDocument();
  }, [loadDocument]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, []);

  const onContentChange = useCallback(
    (delta: string, wc: number) => {
      lastDeltaRef.current = delta;
      wordCountRef.current = wc;
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

  const refreshSnapshots = useCallback(async () => {
    try {
      const list = await documentRepository.listSnapshots(documentId);
      setSnapshots(
        list.map(r => ({
          id: r.id,
          wordCount: r.wordCount,
          createdAt: r.createdAt,
          label: r.label,
        })),
      );
    } catch {
      setSnapshots([]);
    }
  }, [documentId]);

  const openSnapshots = useCallback(() => {
    void refreshSnapshots();
    setShowSnapshots(true);
  }, [refreshSnapshots]);

  const handleSnapshotNow = useCallback(() => {
    if (snapshotBusy) {
      return;
    }
    setSnapshotBusy(true);
    editorRef.current?.getContent(delta => {
      void (async () => {
        try {
          await documentRepository.createSnapshot(
            documentId,
            delta,
            wordCountRef.current,
          );
          lastSnapshottedContentRef.current = delta;
          await refreshSnapshots();
        } catch (e: unknown) {
          Alert.alert(
            'Snapshot failed',
            e instanceof Error ? e.message : 'Unknown error',
          );
        } finally {
          setSnapshotBusy(false);
        }
      })();
    });
  }, [snapshotBusy, documentId, refreshSnapshots]);

  const handleRestoreSnapshot = useCallback(
    (revisionId: string) => {
      Alert.alert(
        'Restore this version?',
        'Current unsaved changes stay in the editor until reload.',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Restore',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  await documentRepository.restoreSnapshot(
                    documentId,
                    revisionId,
                  );
                  setShowSnapshots(false);
                  loadDocument();
                } catch (e: unknown) {
                  Alert.alert(
                    'Restore failed',
                    e instanceof Error ? e.message : 'Unknown error',
                  );
                }
              })();
            },
          },
        ],
      );
    },
    [documentId, loadDocument],
  );

  const handleDeleteSnapshot = useCallback(
    (revisionId: string) => {
      void (async () => {
        try {
          await documentRepository.deleteSnapshot(revisionId);
          await refreshSnapshots();
        } catch (e: unknown) {
          Alert.alert(
            'Delete failed',
            e instanceof Error ? e.message : 'Unknown error',
          );
        }
      })();
    },
    [refreshSnapshots],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const delta = lastDeltaRef.current;
      if (!delta || delta === lastSnapshottedContentRef.current) {
        return;
      }
      void documentRepository
        .createSnapshot(documentId, delta, wordCountRef.current)
        .then(() => {
          lastSnapshottedContentRef.current = delta;
        })
        .catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [documentId]);

  const handleInsertToc = useCallback(() => {
    editorRef.current?.insertToc();
  }, []);

  const applyFootnote = useCallback(() => {
    const text = footnoteText.trim();
    if (!text) {
      return;
    }
    editorRef.current?.insertFootnote(text);
    setFootnoteText('');
    setShowFootnote(false);
  }, [footnoteText]);

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

  const handleExportPdf = useCallback(() => {
    if (exporting) {
      return;
    }
    setExporting(true);
    editorRef.current?.getContent(async delta => {
      try {
        const filePath = await exportPdf(title || 'Untitled', delta);
        await Share.open({url: `file://${filePath}`, type: 'application/pdf'});
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
      try {
        await documentRepository.updateSources(documentId, next);
      } catch {
        Alert.alert(
          'Could not save sources',
          'The citation changed but the change could not be saved.',
        );
      }
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
        let accumulated = '';
        stream(messages, token => {
          accumulated += token;
          setChatStreaming(prev => prev + token);
        })
          .then(() => {
            const assistantMsg: ChatMessage = {
              role: 'assistant',
              content: accumulated,
              createdAt: Date.now(),
            };
            const withAssistant = [...next, assistantMsg];
            setChatMessages(withAssistant);
            saveChat(withAssistant);
            setChatStreaming('');
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
    <SafeAreaView style={[styles.safe, isDark && styles.darkBg]}>
      {/* App Bar */}
      <View style={[styles.appBar, isDark && styles.darkSurface]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.titleText, isDark && styles.darkText]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.saveStatus}>{saveIndicator}</Text>
        {exporting && <ActivityIndicator size="small" color="#6366f1" />}
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Export',
              title || 'Untitled',
              [
                {text: 'Word (.docx)', onPress: handleExport},
                {text: 'PDF', onPress: handleExportPdf},
                {text: 'Cancel', style: 'cancel'},
              ],
            );
          }}
          disabled={exporting}>
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
        <TouchableOpacity onPress={() => editorRef.current?.insertToc()}>
          <Text style={[styles.toolBtn, isDark && styles.darkText]}>TOC</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowFootnote(true)}>
          <Text style={[styles.toolBtn, isDark && styles.darkText]}>
            Footnote
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openSnapshots}>
          <Text style={styles.iconBtn}>🕘</Text>
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
        fontSize={fontSize}
        font={fontKey}
        onFontChange={key => {
          setFontKey(key);
          editorRef.current?.format('font', key);
        }}
        onFontSizeChange={s => {
          setFontSize(s);
          editorRef.current?.format('size', `${s}px`);
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <View style={styles.flex}>
          {editorReady ? null : (
            <View style={[styles.loading, isDark && styles.darkBg]}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingText}>Loading editor…</Text>
            </View>
          )}
          <EditorWebView
            ref={editorRef}
            initialContent={content}
            paperSize={paperSize}
            dark={isDark}
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
            onSaveStateChange={setSaveState}
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

      <View style={[styles.statusBar, isDark && styles.darkSurface]}>
        <Text
          style={[
            styles.statusText,
            wordGoal !== undefined && wordCount >= wordGoal && styles.goalMet,
          ]}>
          {wordCount} words{wordGoal !== undefined ? ` / ${wordGoal}` : ''} ·
          ~{estimatedPages} {estimatedPages === 1 ? 'page' : 'pages'} ·{' '}
          {readMinutes} min read
        </Text>
        {saveState !== 'idle' && (
          <View
            style={[
              styles.saveChip,
              saveState === 'saved' ? styles.saveChipSaved : styles.saveChipDirty,
            ]}>
            <Text style={styles.saveChipText}>
              {saveState === 'saved' ? 'Saved ✓' : 'Saving…'}
            </Text>
          </View>
        )}
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
        current={
          replaceIndex !== null
            ? sources[replaceIndex] ?? ({} as SourcePaper)
            : ({} as SourcePaper)
        }
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

      <SnapshotsModal
        visible={showSnapshots}
        snapshots={snapshots}
        busy={snapshotBusy}
        onSnapshotNow={handleSnapshotNow}
        onRestore={handleRestoreSnapshot}
        onDelete={handleDeleteSnapshot}
        onDismiss={() => setShowSnapshots(false)}
      />

      <Modal
        visible={showFootnote}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFootnote(false)}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowFootnote(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.footnoteSheet}>
              <Text style={styles.footnoteTitle}>Insert Footnote</Text>
              <TextInput
                style={styles.footnoteInput}
                value={footnoteText}
                onChangeText={setFootnoteText}
                placeholder="Footnote text"
                multiline
                autoFocus
              />
              <View style={styles.footnoteRow}>
                <View style={styles.flex} />
                <TouchableOpacity
                  style={styles.footnoteCancel}
                  onPress={() => setShowFootnote(false)}>
                  <Text style={styles.footnoteCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.footnoteApply}
                  onPress={applyFootnote}>
                  <Text style={styles.footnoteApplyText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  statusText: {fontSize: 11, color: '#9ca3af'},
  goalMet: {color: '#10b981'},
  saveChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    marginLeft: 8,
  },
  saveChipDirty: {backgroundColor: '#9ca3af'},
  saveChipSaved: {backgroundColor: '#10b981'},
  saveChipText: {color: '#fff', fontSize: 11, fontWeight: '600'},
  darkBg: {backgroundColor: '#111827'},
  toolBtn: {fontSize: 12, fontWeight: '600', color: '#6366f1'},
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  footnoteSheet: {width: 300, backgroundColor: '#fff', borderRadius: 16, padding: 16},
  footnoteTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  footnoteInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  footnoteRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  footnoteCancel: {paddingHorizontal: 12, paddingVertical: 8},
  footnoteCancelText: {fontSize: 13, color: '#6b7280'},
  footnoteApply: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  footnoteApplyText: {fontSize: 13, color: '#fff', fontWeight: '600'},
  darkSurface: {backgroundColor: '#1f2937', borderTopColor: '#374151', borderBottomColor: '#374151'},
  darkText: {color: '#e5e7eb'},
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
