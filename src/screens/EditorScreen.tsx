import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { documentRepository } from '@/db/DocumentRepository';
import { complete, isModelLoaded } from '@/services/llamaService';
import EditorWebView, { EditorRef } from '@/components/editor/EditorWebView';
import TabToolbar    from '@/components/editor/TabToolbar';
import StyleBar      from '@/components/editor/StyleBar';
import OutlinePanel  from '@/components/editor/OutlinePanel';
import FindReplaceBar from '@/components/editor/FindReplaceBar';
import AiPanel       from '@/components/editor/AiPanel';

type Props = NativeStackScreenProps<RootStackParamList, 'Editor'>;

type SaveStatus = 'saved' | 'saving' | 'unsaved';

export default function EditorScreen({ route, navigation }: Props) {
  const { documentId } = route.params;
  const editorRef   = useRef<EditorRef>(null);
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [title,       setTitle]       = useState('');
  const [content,     setContent]     = useState('');
  const [wordCount,   setWordCount]   = useState(0);
  const [saveStatus,  setSaveStatus]  = useState<SaveStatus>('saved');
  const [format,      setFormat]      = useState<Record<string, unknown>>({});
  const [headings,    setHeadings]    = useState<{ level: number; text: string; index: number }[]>([]);
  const [replaceCount, setReplaceCount] = useState<number | undefined>();
  const [editorReady, setEditorReady] = useState(false);

  const [showOutline,    setShowOutline]    = useState(false);
  const [showFind,       setShowFind]       = useState(false);
  const [showAi,         setShowAi]         = useState(false);
  const [selectedText,   setSelectedText]   = useState('');
  const [aiLoading,      setAiLoading]      = useState(false);

  // Load document on mount
  useEffect(() => {
    documentRepository.getById(documentId).then((doc) => {
      if (doc) {
        setTitle(doc.title);
        setContent(doc.content);
        setWordCount(doc.wordCount);
      }
    });
  }, [documentId]);

  // Auto-save
  const onContentChange = useCallback((delta: string, wc: number) => {
    setSaveStatus('unsaved');
    setWordCount(wc);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      await documentRepository.update(documentId, { content: delta, wordCount: wc });
      setSaveStatus('saved');
    }, 2000);
  }, [documentId]);

  const onFormatChange = useCallback((f: Record<string, unknown>) => {
    setFormat(f);
  }, []);

  const onHeadings = useCallback((h: { level: number; text: string; index: number }[]) => {
    setHeadings(h);
  }, []);

  const onReplaceResult = useCallback((count: number) => {
    setReplaceCount(count);
  }, []);

  const handleOutline = useCallback(() => {
    editorRef.current?.getHeadings();
    setShowOutline((v) => !v);
  }, []);

  const handleAiAction = useCallback(async (prompt: string, text: string) => {
    if (!isModelLoaded()) {
      Alert.alert('Model Not Ready', 'The AI model is still loading. Please wait.');
      return;
    }
    setAiLoading(true);
    try {
      const result = await complete(
        [
          { role: 'system', content: 'You are PaperMind, an expert academic editor. Output only the edited text, no commentary.' },
          { role: 'user',   content: `${prompt}\n\n${text}` },
        ],
        0.7,
        1024,
      );
      editorRef.current?.insertText(result);
    } catch (e: unknown) {
      Alert.alert('AI Error', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setAiLoading(false);
    }
  }, []);

  const estimatedPages = Math.max(1, Math.ceil(wordCount / 250));
  const readMinutes    = Math.max(1, Math.ceil(wordCount / 200));

  const saveIndicator = saveStatus === 'saved'   ? '✓ Saved'
                      : saveStatus === 'saving'  ? 'Saving…'
                      : '●';

  return (
    <SafeAreaView style={styles.safe}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
        <Text style={styles.saveStatus}>{saveIndicator}</Text>
        <TouchableOpacity onPress={() => { setShowFind((v) => !v); setShowOutline(false); }}>
          <Text style={styles.iconBtn}>🔍</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleOutline}>
          <Text style={styles.iconBtn}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* Find & Replace */}
      {showFind && (
        <FindReplaceBar
          onFindReplace={(find, replace) => editorRef.current?.findReplace(find, replace)}
          onClose={() => setShowFind(false)}
          lastCount={replaceCount}
        />
      )}

      {/* Style bar */}
      <StyleBar onStyle={(key, value) => editorRef.current?.format(key, value)} />

      {/* Main content */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.flex}>
          {editorReady ? null : (
            <View style={styles.loading}>
              <Text style={styles.loadingText}>Loading editor…</Text>
            </View>
          )}
          <EditorWebView
            ref={editorRef}
            initialContent={content}
            onContentChange={onContentChange}
            onFormatChange={onFormatChange}
            onHeadings={onHeadings}
            onReplaceResult={onReplaceResult}
            onSelectionText={(text) => {
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
              onJump={(index) => editorRef.current?.scrollTo(index)}
              onClose={() => setShowOutline(false)}
            />
          )}
        </View>

        {/* Tab toolbar */}
        <TabToolbar
          currentFormat={format}
          onFormat={(key, value) => editorRef.current?.format(key, value)}
          onInsert={(text) => editorRef.current?.insertText(text)}
          onUndo={() => editorRef.current?.undo()}
          onRedo={() => editorRef.current?.redo()}
          onFindReplace={() => { setShowFind((v) => !v); setShowOutline(false); }}
          onOutline={handleOutline}
          wordCount={wordCount}
        />
      </KeyboardAvoidingView>

      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          {wordCount} words · ~{estimatedPages} {estimatedPages === 1 ? 'page' : 'pages'} · {readMinutes} min read
        </Text>
      </View>

      {/* AI Panel */}
      <AiPanel
        visible={showAi}
        selectedText={selectedText}
        onAction={handleAiAction}
        onDismiss={() => setShowAi(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#fff' },
  flex:        { flex: 1 },
  appBar:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', gap: 8 },
  backBtn:     { paddingRight: 4 },
  backText:    { fontSize: 28, color: '#6366f1', lineHeight: 28 },
  titleText:   { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  saveStatus:  { fontSize: 12, color: '#9ca3af' },
  iconBtn:     { fontSize: 20, paddingHorizontal: 4 },
  loading:     { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', zIndex: 10 },
  loadingText: { color: '#9ca3af', fontSize: 14 },
  statusBar:   { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#f9fafb', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  statusText:  { fontSize: 11, color: '#9ca3af' },
});