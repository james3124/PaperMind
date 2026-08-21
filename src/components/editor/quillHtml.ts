import {QUILL_CSS, QUILL_JS} from './vendor/quillAssets';

export type PaperSizeKey = 'a4' | 'letter' | 'a5' | 'a3';

export const PAPER_RATIOS: Record<PaperSizeKey, number> = {
  a4: 1.0,
  letter: 1.03,
  a5: 0.7,
  a3: 1.41,
};

const DARK_CSS = `
    html, body { background: #111827; }
    #editor { background: #1f2937; }
    .ql-editor, .ql-editor h1, .ql-editor h2, .ql-editor h3 { color: #e5e7eb; }
    table.ql-paper-table td {
      border: 1px solid #374151;
    }
    table.ql-paper-table td[contenteditable="true"]:focus { outline: 2px solid #818cf8; outline-offset: -2px; }
    hr.ql-page-break { border-top-color: #4b5563; }
    hr.ql-paper-hr { border-top-color: #9ca3af; }
  `;

export function buildQuillHtml(
  initialContent: string,
  paperSize: PaperSizeKey = 'a4',
  opts?: {dark?: boolean},
): string {
  const dark = opts?.dark === true;
  // Escape backslash/backtick/dollar for the JS template literal, and
  // `</script` last so user content can never terminate the inline script
  // early (`<\/script` inside the template literal evaluates back to
  // `</script` at runtime).
  const escaped = initialContent
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/<\/script/gi, '<\\/script');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>${QUILL_CSS}</style>
  <script>
    window.onerror = function (msg, src, line, col) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error', message: String(msg), source: String(src), line: line, col: col,
        }));
      } catch {}
      return false;
    };
  </script>
  <script>${QUILL_JS}</script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; background: #d9d9d9; }
    #editor-container { height: 100vh; overflow-y: auto; padding: 16px 8px; }
    #editor { background: #fff; margin: 0 auto; box-shadow: 0 2px 12px rgba(0,0,0,0.18); }
    .ql-container { font-family: 'Georgia', serif; font-size: 16px; border: none !important; }
    .ql-editor { padding: 24px 28px; min-height: 100vh; line-height: 1.8; font-size: 16px; }
    .ql-editor h1 { font-size: 22px; margin-bottom: 12px; }
    .ql-editor h2 { font-size: 18px; margin-bottom: 10px; }
    .ql-editor h3 { font-size: 15px; margin-bottom: 8px; }
    .ql-editor p  { margin-bottom: 8px; }
    .ql-toolbar  { display: none; }
    /* PaperMind custom table */
    table.ql-paper-table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    table.ql-paper-table td {
      border: 1px solid #cbd5e1; padding: 6px 8px; min-width: 40px;
      vertical-align: top; font-size: 15px; line-height: 1.5;
    }
    table.ql-paper-table td[contenteditable="true"]:focus { outline: 2px solid #6366f1; outline-offset: -2px; }
    /* PaperMind page break */
    hr.ql-page-break { border: none; border-top: 2px dashed #9ca3af; margin: 20px 0; page-break-after: always; break-after: page; }
    /* PaperMind horizontal rule */
    hr.ql-paper-hr { border: none; border-top: 1px solid #374151; margin: 16px 0; }
  </style>
  <style>${dark ? DARK_CSS : ''}</style>
</head>
<body>
  <div id="editor-container">
    <div id="editor"></div>
  </div>
  <script>
    // ── Custom blots & formats ──────────────────────────────────────────────
    const BlockEmbed = Quill.import('blots/block/embed');
    const BlockStyle = Quill.import('attributors/style/block');

    class PaperTableBlot extends BlockEmbed {
      static create(value) {
        const node = super.create(value);
        const rows = value && value.rows ? value.rows : 3;
        const cols = value && value.cols ? value.cols : 3;
        node.innerHTML = (value && value.html) || buildTableHtml(rows, cols);
        node.setAttribute('contenteditable', 'true');
        return node;
      }
      static value(node) {
        return { html: node.innerHTML, rows: node.rows.length, cols: (node.rows[0] ? node.rows[0].cells.length : 0) };
      }
    }
    PaperTableBlot.blotName = 'paper-table';
    PaperTableBlot.tagName = 'table';
    PaperTableBlot.className = 'ql-paper-table';

    function buildTableHtml(rows, cols) {
      let html = '<tbody>';
      for (let r = 0; r < rows; r++) {
        html += '<tr>';
        for (let c = 0; c < cols; c++) {
          html += '<td contenteditable="true"><br></td>';
        }
        html += '</tr>';
      }
      return html + '</tbody>';
    }

    class PageBreakBlot extends BlockEmbed {
      static create(value) { return super.create(value); }
      static value() { return true; }
    }
    PageBreakBlot.blotName = 'page-break';
    PageBreakBlot.tagName = 'hr';
    PageBreakBlot.className = 'ql-page-break';

    const SpacingAttributor = new BlockStyle('spacing', 'line-height');

    // Font size: reuse Quill v2's built-in style size attributor ("size" →
    // font-size). Its default whitelist is ['10px','18px','32px']; override it
    // with the sizes StyleBar offers (values are px strings because Quill
    // writes them straight into inline styles).
    const FontSize = Quill.import('attributors/style/size');
    FontSize.whitelist = ['14px', '16px', '18px', '20px'];
    const FONT_SIZE_VALUES = [14, 16, 18, 20];
    Quill.register(FontSize, true);

    Quill.register(PaperTableBlot, true);
    Quill.register(PageBreakBlot, true);
    Quill.register(SpacingAttributor, true);

    const Delta = Quill.import('delta');

    const quill = new Quill('#editor', {
      theme: 'snow',
      modules: { toolbar: false, history: { delay: 1000, maxStack: 200 } },
    });

    function applyPaperSize(paperSize) {
      const ratios = { a4: 1.0, letter: 1.03, a5: 0.7, a3: 1.41 };
      const ratio = ratios[paperSize] || 1.0;
      const screenWidth = window.innerWidth;
      const base = Math.min(screenWidth - 24, 640);
      document.getElementById('editor').style.maxWidth = Math.round(base * ratio) + 'px';
    }

    // Load initial content — supports Delta JSON or plain text
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

    applyPaperSize('${paperSize}');

    // ── Content change → React Native ───────────────────────────────────────
    // Trailing debounce (250ms): typing fires many text-change events; we only
    // serialise quill.getContents()/getText() at send time so rapid keystrokes
    // produce one post with the final state instead of one per keystroke.
    let saveTimer = null;
    let contentDirty = false;
    // When true, text-change events only mark dirty without scheduling a send
    // (used by findReplace to batch many edits into one update).
    let suppressChangePosts = false;
    // Set once per burst when the debounce schedules a pending send, so the
    // 'save-state: dirty' message is posted once per burst, not per keystroke.
    let saveStateNotifiedDirty = false;

    function postSaveState(state) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'save-state', state,
      }));
    }

    function postContentChangeNow() {
      clearTimeout(saveTimer);
      saveTimer = null;
      if (!contentDirty) return;
      contentDirty = false;
      const delta = JSON.stringify(quill.getContents());
      const text  = quill.getText();
      const words = text.trim().split(/\\s+/).filter(Boolean).length;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'content-change', delta, wordCount: words,
      }));
      saveStateNotifiedDirty = false;
      postSaveState('saved');
      saveTimer = setTimeout(() => {
        const selection = quill.getSelection();
        if (selection) postFormat(selection.index);
      }, 100);
    }

    function postContentChange() {
      contentDirty = true;
      if (suppressChangePosts) return;
      if (!saveStateNotifiedDirty) {
        saveStateNotifiedDirty = true;
        postSaveState('dirty');
      }
      clearTimeout(saveTimer);
      saveTimer = setTimeout(postContentChangeNow, 250);
    }

    quill.on('text-change', postContentChange);
    document.getElementById('editor').addEventListener('input', (e) => {
      const table = e.target.closest('table.ql-paper-table');
      if (table) postContentChange();
    });

    // ── Markdown input shortcuts ─────────────────────────────────────────────
    // Fires only for real typing (source === 'user') when a single trailing
    // space completes one of the prefixes below at the start of the current
    // line. The prefix characters are deleted and the line format applied.
    quill.on('text-change', function (delta, oldDelta, source) {
      if (source !== 'user') return;
      const ops = delta.ops || [];
      const lastOp = ops[ops.length - 1];
      if (!lastOp || lastOp.insert !== ' ') return;
      let idx = 0;
      for (let i = 0; i < ops.length - 1; i++) {
        const op = ops[i];
        if (op.delete != null) return; // deletions involved — not plain typing
        idx += typeof op.insert === 'string' ? op.insert.length : (op.retain != null ? op.retain : 0);
      }
      const sel = quill.getSelection();
      if (!sel) return;               // no selection: skip conservatively
      if (getTableAtSelection()) return; // never reformat inside table cells
      const cursor = sel.index;
      if (idx !== cursor - 1) return;  // the space must land right at the cursor
      const lineStart = quill.getText(0, cursor).lastIndexOf('\\n') + 1;
      const lineText = quill.getText(lineStart, cursor - lineStart);
      const rules = [
        { prefix: '### ', format: { header: 3 } },
        { prefix: '## ', format: { header: 2 } },
        { prefix: '# ', format: { header: 1 } },
        { prefix: '- ', format: { list: 'bullet' } },
        { prefix: '* ', format: { list: 'bullet' } },
        { prefix: '1. ', format: { list: 'ordered' } },
        { prefix: '> ', format: { blockquote: true } },
      ];
      for (let r = 0; r < rules.length; r++) {
        if (lineText === rules[r].prefix) {
          quill.deleteText(lineStart, rules[r].prefix.length, 'user');
          quill.formatLine(lineStart, 0, rules[r].format, 'user');
          break;
        }
      }
    });

    // Flush pending content immediately on unload so nothing is lost.
    window.addEventListener('beforeunload', () => {
      contentDirty ? postContentChangeNow() : clearTimeout(saveTimer);
    });

    quill.on('selection-change', (range) => {
      if (!range) {
        // Blur: flush pending debounced content before the editor loses focus.
        postContentChangeNow();
        return;
      }
      postFormat(range.index);
      if (range.length > 0) {
        const selected = quill.getText(range.index, range.length).trim();
        if (selected) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'selection-text', text: selected,
          }));
        }
      } else {
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

    // ── Table helpers ───────────────────────────────────────────────────────
    function getTableAtSelection() {
      const range = quill.getSelection();
      if (!range) return null;
      const leaf = quill.getLeaf(range.index)[0];
      let node = leaf && leaf.domNode;
      while (node && node !== document.getElementById('editor')) {
        if (node.tagName === 'TABLE' && node.classList.contains('ql-paper-table')) return node;
        node = node.parentNode;
      }
      return null;
    }

    function addTableRow() {
      const table = getTableAtSelection();
      if (!table) return;
      const cols = table.rows[0] ? table.rows[0].cells.length : 1;
      const tr = document.createElement('tr');
      for (let c = 0; c < cols; c++) {
        const td = document.createElement('td');
        td.setAttribute('contenteditable', 'true');
        td.innerHTML = '<br>';
        tr.appendChild(td);
      }
      table.querySelector('tbody').appendChild(tr);
      postContentChange();
    }

    function addTableColumn() {
      const table = getTableAtSelection();
      if (!table) return;
      Array.prototype.slice.call(table.querySelectorAll('tr')).forEach((tr) => {
        const td = document.createElement('td');
        td.setAttribute('contenteditable', 'true');
        td.innerHTML = '<br>';
        tr.appendChild(td);
      });
      postContentChange();
    }

    function deleteTableRow() {
      const table = getTableAtSelection();
      if (!table) return;
      const tr = document.querySelector('.ql-editor .ql-paper-table tr:focus-within');
      if (tr && tr.parentNode && tr.parentNode.tagName === 'TBODY') tr.parentNode.removeChild(tr);
      postContentChange();
    }

    function deleteTableColumn() {
      const table = getTableAtSelection();
      if (!table) return;
      const td = document.querySelector('.ql-editor .ql-paper-table td:focus-within');
      if (!td) return;
      const idx = td.cellIndex;
      Array.prototype.slice.call(table.querySelectorAll('tr')).forEach((tr) => {
        if (tr.cells[idx]) tr.removeChild(tr.cells[idx]);
      });
      postContentChange();
    }

    function deleteTable() {
      const table = getTableAtSelection();
      if (!table) return;
      // Resolve the blot from the table DOM node and delete at its document
      // index — deleting 1 char from the cursor range would eat an adjacent
      // character instead of removing the table embed.
      const blot = Quill.find(table);
      if (blot) {
        const index = quill.getIndex(blot);
        quill.deleteText(index, 1);
      } else if (table.parentNode) {
        table.parentNode.removeChild(table);
      }
      postContentChange();
    }

    // ── Command dispatcher ───────────────────────────────────────────────────
    // Both listeners are needed: Android fires 'message' on document while iOS
    // fires it on window. On platforms where BOTH fire for one injected
    // command, the identical payload would execute twice (e.g. double text
    // insertion) — the dedupe guard below makes each payload run only once.
    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);

    let lastExecuted = '';
    let lastExecutedAt = 0;

    function handleMessage(event) {
      const payload = event && event.data != null ? String(event.data) : '';
      const now = Date.now();
      if (payload === lastExecuted && now - lastExecutedAt < 50) return;
      lastExecuted = payload;
      lastExecutedAt = now;
      try { executeCommand(JSON.parse(payload)); } catch {}
    }

    function executeCommand(msg) {
      switch (msg.cmd) {
        case 'format':
          quill.format(msg.key, msg.value);
          break;

        case 'setFontSize': {
          if (FONT_SIZE_VALUES.indexOf(msg.size) === -1) break;
          quill.format('size', msg.size + 'px');
          break;
        }

        case 'insertText': {
          quill.focus();
          const sel = quill.getSelection(true);
          quill.insertText(sel.index, msg.text);
          break;
        }

        // ── NEW: insert a Quill Delta at the current cursor position ─────────
        case 'insertDelta': {
          quill.focus();
          const sel = quill.getSelection(true) || { index: quill.getLength(), length: 0 };
          if (sel.length > 0) quill.deleteText(sel.index, sel.length, 'user');
          try {
            const parsed = JSON.parse(msg.delta);
            const ops    = Array.isArray(parsed) ? parsed : (parsed.ops || []);
            const incoming = new Delta(ops);
            const update   = new Delta().retain(sel.index).concat(incoming);
            quill.updateContents(update, 'user');
          } catch {}
          break;
        }

        case 'insertImage': {
          quill.focus();
          const imgSel = quill.getSelection(true);
          quill.insertEmbed(imgSel.index, 'image', msg.dataUrl, 'user');
          break;
        }

        case 'insertTable': {
          quill.focus();
          const tblSel = quill.getSelection(true);
          quill.insertEmbed(tblSel.index, 'paper-table', { rows: msg.rows, cols: msg.cols }, 'user');
          break;
        }

        case 'insertPageBreak': {
          quill.focus();
          const pbSel = quill.getSelection(true);
          quill.insertEmbed(pbSel.index, 'page-break', true, 'user');
          break;
        }

        case 'addTableRow':    addTableRow();    break;
        case 'addTableColumn': addTableColumn(); break;
        case 'deleteTableRow': deleteTableRow(); break;
        case 'deleteTableColumn': deleteTableColumn(); break;
        case 'deleteTable':    deleteTable();    break;

        case 'replaceCitationMarkers': {
          const text = quill.getText();
          let idx = 0;
          while ((idx = text.indexOf(msg.oldMarker, idx)) !== -1) {
            quill.deleteText(idx, msg.oldMarker.length);
            quill.insertText(idx, msg.newMarker);
            idx += msg.newMarker.length;
          }
          break;
        }

        case 'replaceReferences': {
          const delta = quill.getContents();
          let refPos = -1;
          let pos = 0;
          delta.ops.forEach(op => {
            if (typeof op.insert === 'string') {
              const lines = op.insert.split('\\n');
              lines.forEach((line, li) => {
                if (
                  line.trim().toLowerCase() === 'references' &&
                  op.attributes && op.attributes.header
                ) {
                  refPos = pos;
                }
                pos += line.length + (li < lines.length - 1 ? 1 : 0);
              });
            } else {
              pos += 1;
            }
          });
          if (refPos === -1) break;
          const afterHeader = refPos + 'References'.length + 1;
          const total = quill.getLength();
          if (afterHeader < total) {
            quill.deleteText(afterHeader, total - afterHeader);
          }
          quill.insertText(
            afterHeader,
            '\\n' + (Array.isArray(msg.entries) ? msg.entries : []).join('\\n'),
          );
          break;
        }

        case 'setPaperSize':
          applyPaperSize(msg.paperSize);
          break;

        case 'getContent':
          // Flush any debounced pending change so the response reflects the
          // latest state.
          postContentChangeNow();
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
          // Suppress per-match text-change posts while batch-replacing:
          // each delete/insert pair would otherwise trigger a full
          // serialise + post and add N undo history entries.
          suppressChangePosts = true;
          try {
            while ((idx = text.indexOf(find, idx)) !== -1) {
              quill.deleteText(idx, find.length);
              quill.insertText(idx, replace || '');
              idx += (replace || '').length;
              count++;
            }
          } finally {
            suppressChangePosts = false;
          }
          if (count > 0) postContentChangeNow();
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
            } else if (op.insert && typeof op.insert === 'object') {
              pos += 1;
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

    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  </script>
</body>
</html>`;
}
