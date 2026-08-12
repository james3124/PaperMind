export function buildQuillHtml(initialContent: string): string {
  // Escape content for injection into JS string
  const escaped = initialContent
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <link href="https://cdn.jsdelivr.net/npm/quill@2/dist/quill.snow.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/quill@2/dist/quill.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; background: #fff; }
    #editor-container { height: 100vh; overflow-y: auto; }
    .ql-container { font-family: 'Georgia', serif; font-size: 14px; border: none !important; }
    .ql-editor { padding: 20px 24px; min-height: 100vh; line-height: 1.8; }
    .ql-editor h1 { font-size: 22px; margin-bottom: 12px; }
    .ql-editor h2 { font-size: 18px; margin-bottom: 10px; }
    .ql-editor h3 { font-size: 15px; margin-bottom: 8px; }
    .ql-editor p  { margin-bottom: 8px; }
    .ql-toolbar  { display: none; }    /* We use our own RN toolbar */
  </style>
</head>
<body>
  <div id="editor-container">
    <div id="editor"></div>
  </div>
  <script>
    const quill = new Quill('#editor', {
      theme: 'snow',
      modules: { toolbar: false, history: { delay: 1000, maxStack: 200 } },
    });

    // Load initial content
    const initialText = \`${escaped}\`;
    if (initialText.startsWith('{') && initialText.includes('"ops"')) {
      try {
        quill.setContents(JSON.parse(initialText));
      } catch {
        quill.setText(initialText);
      }
    } else if (initialText.trim()) {
      quill.setText(initialText);
    }

    // Post content changes to React Native
    let saveTimer = null;
    quill.on('text-change', () => {
      clearTimeout(saveTimer);
      const delta  = JSON.stringify(quill.getContents());
      const text   = quill.getText();
      const words  = text.trim().split(/\\s+/).filter(Boolean).length;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'content-change', delta, wordCount: words,
      }));

      // Post format state for toolbar sync
      saveTimer = setTimeout(() => {
        const selection = quill.getSelection();
        if (selection) postFormat(selection.index);
      }, 100);
    });

    // Post format at cursor to sync toolbar state
    // Also post selected text so RN can open the AI panel
    quill.on('selection-change', (range) => {
      if (!range) return;
      postFormat(range.index);
      if (range.length > 0) {
        const selected = quill.getText(range.index, range.length).trim();
        if (selected) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'selection-text', text: selected,
          }));
        }
      } else {
        // Deselect — close AI panel
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'selection-text', text: '',
        }));
      }
    });

    function postFormat(index) {
      const format = quill.getFormat(index);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'format-change', format,
      }));
    }

    // Listen for commands from React Native
    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);

    function handleMessage(event) {
      try {
        const msg = JSON.parse(event.data);
        executeCommand(msg);
      } catch {}
    }

    function executeCommand(msg) {
      switch (msg.cmd) {
        case 'format':
          quill.format(msg.key, msg.value);
          break;
        case 'insertText':
          quill.focus();
          const sel = quill.getSelection(true);
          quill.insertText(sel.index, msg.text);
          break;
        case 'getContent':
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'content', delta: JSON.stringify(quill.getContents()),
          }));
          break;
        case 'findReplace': {
          const text = quill.getText();
          const find = msg.find;
          const replace = msg.replace;
          if (!find) break;
          let idx = 0, count = 0;
          while ((idx = text.indexOf(find, idx)) !== -1) {
            quill.deleteText(idx, find.length);
            quill.insertText(idx, replace || '');
            idx += (replace || '').length;
            count++;
          }
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'replace-done', count,
          }));
          break;
        }
        case 'getHeadings': {
          const delta = quill.getContents();
          const headings = [];
          let pos = 0;
          delta.ops.forEach(op => {
            if (typeof op.insert === 'string') {
              const lines = op.insert.split('\\n');
              lines.forEach((line, li) => {
                if (op.attributes && op.attributes.header) {
                  headings.push({ level: op.attributes.header, text: line, index: pos });
                }
                pos += line.length + (li < lines.length - 1 ? 1 : 0);
              });
            }
          });
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'headings', headings,
          }));
          break;
        }
        case 'scrollTo':
          quill.setSelection(msg.index, 0);
          break;
        case 'undo':
          quill.history.undo();
          break;
        case 'redo':
          quill.history.redo();
          break;
      }
    }

    // Signal ready
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  </script>
</body>
</html>`;
}