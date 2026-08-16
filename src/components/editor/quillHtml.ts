export type PaperSizeKey = 'a4' | 'letter' | 'a5' | 'a3';

export const PAPER_RATIOS: Record<PaperSizeKey, number> = {
  a4: 1.0,
  letter: 1.03,
  a5: 0.7,
  a3: 1.41,
};

export function buildQuillHtml(
  initialContent: string,
  paperSize: PaperSizeKey = 'a4',
): string {
  const escaped = initialContent
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link href="https://cdn.jsdelivr.net/npm/quill@2/dist/quill.snow.css" rel="stylesheet" />
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
    function postContentChange() {
      clearTimeout(saveTimer);
      const delta = JSON.stringify(quill.getContents());
      const text  = quill.getText();
      const words = text.trim().split(/\\s+/).filter(Boolean).length;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'content-change', delta, wordCount: words,
      }));
      saveTimer = setTimeout(() => {
        const selection = quill.getSelection();
        if (selection) postFormat(selection.index);
      }, 100);
    }
    let saveTimer = null;
    quill.on('text-change', postContentChange);
    document.getElementById('editor').addEventListener('input', (e) => {
      const table = e.target.closest('table.ql-paper-table');
      if (table) postContentChange();
    });

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
      const range = quill.getSelection();
      if (range) { quill.deleteText(range.index, 1); }
      else if (table.parentNode) { table.parentNode.removeChild(table); }
      postContentChange();
    }

    // ── Command dispatcher ───────────────────────────────────────────────────
    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);

    function handleMessage(event) {
      try { executeCommand(JSON.parse(event.data)); } catch {}
    }

    function executeCommand(msg) {
      switch (msg.cmd) {
        case 'format':
          quill.format(msg.key, msg.value);
          break;

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

        case 'setPaperSize':
          applyPaperSize(msg.paperSize);
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
