import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { buildQuillHtml } from './quillHtml';

export interface EditorRef {
  format:      (key: string, value: unknown) => void;
  insertText:  (text: string) => void;
  findReplace: (find: string, replace: string) => void;
  getHeadings: () => void;
  scrollTo:    (index: number) => void;
  undo:        () => void;
  redo:        () => void;
}

interface Props {
  initialContent:  string;
  onContentChange: (delta: string, wordCount: number) => void;
  onFormatChange:  (format: Record<string, unknown>) => void;
  onHeadings:      (headings: { level: number; text: string; index: number }[]) => void;
  onReplaceResult: (count: number) => void;
  onReady:         () => void;
}

const EditorWebView = forwardRef<EditorRef, Props>((props, ref) => {
  const webviewRef = useRef<WebView>(null);
  const html = buildQuillHtml(props.initialContent);

  function postCmd(cmd: Record<string, unknown>) {
    webviewRef.current?.injectJavaScript(
      `(function(){ handleMessage({ data: ${JSON.stringify(JSON.stringify(cmd))} }); })(); true;`
    );
  }

  useImperativeHandle(ref, () => ({
    format:      (key, value) => postCmd({ cmd: 'format', key, value }),
    insertText:  (text)       => postCmd({ cmd: 'insertText', text }),
    findReplace: (find, replace) => postCmd({ cmd: 'findReplace', find, replace }),
    getHeadings: ()           => postCmd({ cmd: 'getHeadings' }),
    scrollTo:    (index)      => postCmd({ cmd: 'scrollTo', index }),
    undo:        ()           => postCmd({ cmd: 'undo' }),
    redo:        ()           => postCmd({ cmd: 'redo' }),
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
        case 'ready':
          props.onReady();
          break;
      }
    } catch {}
  }

  return (
    <WebView
      ref={webviewRef}
      source={{ html }}
      style={styles.webview}
      originWhitelist={['*']}
      onMessage={onMessage}
      keyboardDisplayRequiresUserAction={false}
      scalesPageToFit={false}
      scrollEnabled={true}
      allowsInlineMediaPlayback
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
    />
  );
});

EditorWebView.displayName = 'EditorWebView';

export default EditorWebView;

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: '#fff' },
});