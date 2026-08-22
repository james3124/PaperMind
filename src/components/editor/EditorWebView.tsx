import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {StyleSheet, Platform} from 'react-native';
import WebView, {WebViewMessageEvent} from 'react-native-webview';
import {buildQuillHtml} from './quillHtml';
import type {PaperSize} from '@/stores/settingsStore';

export interface EditorRef {
  format: (key: string, value: unknown) => void;
  insertText: (text: string) => void;
  insertDelta: (deltaJson: string) => void; // ← NEW
  insertImage: (dataUrl: string) => void;
  insertTable: (rows: number, cols: number) => void;
  insertPageBreak: () => void;
  addTableRow: () => void;
  addTableColumn: () => void;
  deleteTableRow: () => void;
  deleteTableColumn: () => void;
  deleteTable: () => void;
  findReplace: (find: string, replace: string) => void;
  getHeadings: () => void;
  scrollTo: (index: number) => void;
  undo: () => void;
  redo: () => void;
  setPaperSize: (paperSize: PaperSize) => void;
  getContent: (onContent: (delta: string) => void) => void;
  replaceCitationMarkers: (
    index: number,
    oldMarker: string,
    newMarker: string,
  ) => void;
  replaceReferences: (entries: string[]) => void;
  insertToc: () => void;
  insertFootnote: (text: string) => void;
}

interface Props {
  initialContent: string;
  paperSize: PaperSize;
  onContentChange: (delta: string, wordCount: number) => void;
  onFormatChange: (format: Record<string, unknown>) => void;
  onHeadings: (
    headings: {level: number; text: string; index: number}[],
  ) => void;
  onReplaceResult: (count: number) => void;
  onSelectionText?: (text: string) => void;
  onReady: () => void;
  onSaveStateChange?: (state: 'dirty' | 'saved') => void;
  dark?: boolean;
}

const EditorWebView = forwardRef<EditorRef, Props>((props, ref) => {
  const webviewRef = useRef<any>(null);
  const html = useMemo(
    () =>
      buildQuillHtml(props.initialContent, props.paperSize, {
        dark: props.dark,
      }),
    [props.initialContent, props.paperSize, props.dark],
  );
  const source = useMemo(() => ({html}), [html]);
  const pendingGetContent = useRef<((delta: string) => void) | null>(null);

  function postCmd(cmd: Record<string, unknown>) {
    webviewRef.current?.injectJavaScript(
      `(function(){ handleMessage({ data: ${JSON.stringify(
        JSON.stringify(cmd),
      )} }); })(); true;`,
    );
  }

  useImperativeHandle(ref, () => ({
    format: (key, value) => postCmd({cmd: 'format', key, value}),
    insertText: text => postCmd({cmd: 'insertText', text}),
    insertDelta: deltaJson => postCmd({cmd: 'insertDelta', delta: deltaJson}), // ← NEW
    insertImage: dataUrl => postCmd({cmd: 'insertImage', dataUrl}),
    insertTable: (rows, cols) => postCmd({cmd: 'insertTable', rows, cols}),
    insertPageBreak: () => postCmd({cmd: 'insertPageBreak'}),
    addTableRow: () => postCmd({cmd: 'addTableRow'}),
    addTableColumn: () => postCmd({cmd: 'addTableColumn'}),
    deleteTableRow: () => postCmd({cmd: 'deleteTableRow'}),
    deleteTableColumn: () => postCmd({cmd: 'deleteTableColumn'}),
    deleteTable: () => postCmd({cmd: 'deleteTable'}),
    findReplace: (find, replace) =>
      postCmd({cmd: 'findReplace', find, replace}),
    getHeadings: () => postCmd({cmd: 'getHeadings'}),
    scrollTo: index => postCmd({cmd: 'scrollTo', index}),
    undo: () => postCmd({cmd: 'undo'}),
    redo: () => postCmd({cmd: 'redo'}),
    setPaperSize: paperSize => postCmd({cmd: 'setPaperSize', paperSize}),
    getContent: onContent => {
      pendingGetContent.current = onContent;
      postCmd({cmd: 'getContent'});
    },
    replaceCitationMarkers: (index, oldMarker, newMarker) =>
      postCmd({cmd: 'replaceCitationMarkers', index, oldMarker, newMarker}),
    replaceReferences: entries => postCmd({cmd: 'replaceReferences', entries}),
    insertToc: () => postCmd({cmd: 'insertToc'}),
    insertFootnote: text => postCmd({cmd: 'insertFootnote', text}),
  }));

  function onMessage(event: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      switch (msg.type) {
        case 'content-change':
          props.onContentChange(msg.delta, msg.wordCount);
          break;
        case 'format-change':
          props.onFormatChange(msg.format);
          break;
        case 'headings':
          props.onHeadings(msg.headings);
          break;
        case 'replace-done':
          props.onReplaceResult(msg.count);
          break;
        case 'selection-text':
          props.onSelectionText?.(msg.text ?? '');
          break;
        case 'error':
          console.warn(
            `[EditorWebView] WebView script error: ${msg.message} (${msg.source}:${msg.line}:${msg.col})`,
          );
          break;
        case 'content':
          pendingGetContent.current?.(msg.delta ?? '');
          pendingGetContent.current = null;
          break;
        case 'ready':
          props.onReady();
          break;
        case 'save-state':
          props.onSaveStateChange?.(
            msg.state === 'saved' ? 'saved' : 'dirty',
          );
          break;
      }
    } catch {}
  }

  return (
    <WebView
      ref={webviewRef}
      source={source}
      style={styles.webview}
      originWhitelist={['*']}
      onMessage={onMessage}
      keyboardDisplayRequiresUserAction={false}
      scalesPageToFit={Platform.OS === 'ios'}
      scrollEnabled={true}
      allowsInlineMediaPlayback
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      textZoom={100}
      setBuiltInZoomControls={true}
      setDisplayZoomControls={false}
      minimumZoomScale={0.5}
      maximumZoomScale={2.5}
    />
  );
});

EditorWebView.displayName = 'EditorWebView';
export default EditorWebView;

const styles = StyleSheet.create({
  webview: {flex: 1, backgroundColor: '#fff'},
});
