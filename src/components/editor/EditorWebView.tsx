import React, {forwardRef, useEffect, useImperativeHandle, useRef} from 'react';
import {StyleSheet, Platform, Linking} from 'react-native';
import WebView, {WebViewMessageEvent} from 'react-native-webview';
import {loadPaperDocx} from '@/services/paperFileStore';
import type {PaperSize} from '@/stores/settingsStore';

const EDITOR_URL = 'file:///android_asset/superdoc/index.html';
// Everything the editor shell may load itself (assets, blob workers,
// data URLs) stays inside the WebView; any other navigation — e.g. a
// hyperlink planted in an imported DOCX — is handed to the OS instead of
// replacing the trusted file:// page.
const ALLOWED_PREFIX = 'file:///android_asset/superdoc/';

export interface EditorRef {
  format: (key: string, value: unknown) => void;
  insertText: (text: string) => void;
  insertMarkdown: (md: string) => void;
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
  getContent: (onContent: (b64: string) => void) => void;
  reloadWith: (b64: string) => void;
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
  initialContentPath: string | null;
  blankMode?: boolean;
  onContentChange: (delta: string, wordCount: number) => void;
  onFormatChange: (format: Record<string, unknown>) => void;
  onHeadings: (
    headings: {level: number; text: string; index: number}[],
  ) => void;
  onReplaceResult: (count: number) => void;
  onSelectionText?: (text: string) => void;
  onReady: () => void;
  onSaveStateChange?: (state: 'dirty' | 'saved') => void;
  onAutosave?: (b64: string) => void;
  dark?: boolean;
  paperSize?: PaperSize;
}

const EditorWebView = forwardRef<EditorRef, Props>((props, ref) => {
  const webviewRef = useRef<any>(null);
  const readyRef = useRef(false);
  const initialB64Ref = useRef<string | null>(null);
  const pendingGetContent = useRef<Map<string, (b64: string) => void>>(
    new Map(),
  );
  const requestSeq = useRef(0);
  const queueRef = useRef<Record<string, unknown>[]>([]);
  const blankBootstrappedRef = useRef(false);

  function postCmd(cmd: Record<string, unknown>) {
    if (!readyRef.current && cmd.cmd !== 'load' && cmd.cmd !== 'loadBlank') {
      queueRef.current.push(cmd);
      return;
    }
    // The bridge defines window.__handleMessage as soon as superdoc.js runs.
    // injectJavaScript can race page load, so retry briefly until it exists.
    const payload = JSON.stringify(JSON.stringify(cmd));
    webviewRef.current?.injectJavaScript(
      `(function(){var d=${payload},n=0;(function r(){if(window.__handleMessage){window.__handleMessage(d);}else if(n++<120){setTimeout(r,50);}})();})(); true;`,
    );
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let b64: string | null = null;
      if (props.initialContentPath?.startsWith('papers/')) {
        try {
          b64 = await loadPaperDocx(
            props.initialContentPath
              .replace(/^papers\//, '')
              .replace(/\.docx$/, ''),
          );
        } catch (e: unknown) {
          console.warn(
            `[EditorWebView] failed to load ${props.initialContentPath}: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        }
      }
      if (!cancelled && b64) {
        initialB64Ref.current = b64;
        postCmd({cmd: 'load', b64});
      }
      if (!cancelled) {
        props.onReady();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Blank mode: nothing was loaded from disk, so bootstrap a blank DOCX as
  // soon as the bridge script exists — otherwise SuperDoc never mounts and
  // 'ready' (plus the queued-command replay) never happens.
  function handleLoadEnd() {
    if (
      !blankBootstrappedRef.current &&
      props.blankMode &&
      initialB64Ref.current == null
    ) {
      blankBootstrappedRef.current = true;
      postCmd({cmd: 'loadBlank'});
    }
  }

  // Dark mode: push theme to the bridge whenever it changes. Before 'ready'
  // postCmd queues the command, so it also replays once on ready — covering
  // a dark-mode app that mounts the editor directly.
  const dark = props.dark === true;
  useEffect(() => {
    postCmd({cmd: 'setTheme', dark});
  }, [dark]);

  // Paper size: same pattern as dark mode, so a persisted Letter/A5/A3 is
  // applied on every fresh editor session (the shell defaults to A4) and
  // toolbar changes stay idempotent through this one effect.
  useEffect(() => {
    if (props.paperSize) {
      postCmd({cmd: 'setPaperSize', paperSize: props.paperSize});
    }
  }, [props.paperSize]);

  useImperativeHandle(ref, () => ({
    format: (key, value) => postCmd({cmd: 'format', key, value}),
    insertText: text => postCmd({cmd: 'insertText', text}),
    insertMarkdown: md => postCmd({cmd: 'insertMarkdown', md}),
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
      const requestId = String(++requestSeq.current);
      pendingGetContent.current.set(requestId, onContent);
      postCmd({cmd: 'exportNow', requestId});
    },
    reloadWith: b64 => postCmd({cmd: 'load', b64}),
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
          props.onContentChange(msg.delta ?? '', msg.wordCount ?? 0);
          break;
        case 'format-change':
          props.onFormatChange(msg.format ?? {});
          break;
        case 'headings':
          props.onHeadings(msg.headings ?? []);
          break;
        case 'replace-done':
          props.onReplaceResult(msg.count ?? 0);
          break;
        case 'selection-text':
          props.onSelectionText?.(msg.text ?? '');
          break;
        case 'error':
          console.warn(`[EditorWebView] bridge error: ${msg.message}`);
          break;
        case 'engine-debug':
          console.warn(`[EditorWebView] ${msg.message}`);
          break;
        case 'docx-autosave':
          props.onAutosave?.(msg.b64);
          break;
        case 'docx': {
          const cb = pendingGetContent.current.get(msg.requestId);
          pendingGetContent.current.delete(msg.requestId);
          cb?.(msg.b64 ?? '');
          break;
        }
        case 'cmd-error': {
          if (msg.cmd === 'exportNow' && msg.requestId != null) {
            const cb = pendingGetContent.current.get(msg.requestId);
            pendingGetContent.current.delete(msg.requestId);
            cb?.('');
          }
          console.warn(
            `[EditorWebView] cmd-error: ${msg.cmd}${
              msg.message ? ` (${msg.message})` : ''
            }`,
          );
          break;
        }
        case 'ready':
          readyRef.current = true;
          if (
            !blankBootstrappedRef.current &&
            initialB64Ref.current == null &&
            props.blankMode
          ) {
            // Fallback in case onLoadEnd raced the bridge script load.
            blankBootstrappedRef.current = true;
            postCmd({cmd: 'loadBlank'});
          }
          queueRef.current.forEach(postCmd);
          queueRef.current = [];
          props.onReady();
          break;
        case 'save-state':
          props.onSaveStateChange?.(msg.state === 'saved' ? 'saved' : 'dirty');
          break;
      }
    } catch {}
  }

  return (
    <WebView
      ref={webviewRef}
      source={{uri: EDITOR_URL}}
      originWhitelist={['*']}
      allowFileAccess={true}
      // The editor shell fetches its DOCX-engine worker script from the same
      // file:// asset tree; without these Android settings the fetch is
      // blocked and the engine falls back to an empty stub.
      allowFileAccessFromFileURLs={true}
      allowUniversalAccessFromFileURLs={true}
      onlyArchivedExtension={false}
      onMessage={onMessage}
      onLoadEnd={handleLoadEnd}
      onShouldStartLoadWithRequest={req => {
        if (req.url.startsWith(ALLOWED_PREFIX) || req.url === EDITOR_URL) {
          return true;
        }
        Linking.openURL(req.url).catch(() => {});
        return false;
      }}
      keyboardDisplayRequiresUserAction={true}
      scalesPageToFit={Platform.OS === 'ios'}
      scrollEnabled={true}
      allowsInlineMediaPlayback
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      textZoom={100}
      setBuiltInZoomControls={true}
      setDisplayZoomControls={false}
      minimumZoomScale={0.25}
      maximumZoomScale={3.0}
      backgroundColor={dark ? '#111827' : '#ffffff'}
      androidLayerType="hardware"
      style={[styles.webview, {backgroundColor: dark ? '#111827' : '#ffffff'}]}
    />
  );
});

EditorWebView.displayName = 'EditorWebView';
export default EditorWebView;

const styles = StyleSheet.create({
  webview: {flex: 1, backgroundColor: '#ffffff'},
});
