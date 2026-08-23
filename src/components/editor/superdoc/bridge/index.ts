import {SuperDoc} from 'superdoc';
import 'superdoc/style.css';

import {blobToBase64} from './exporter';
import {applyFormat, currentFormats} from './formatCommands';
import {createSaveStateTracker} from './saveState';

const tracker = createSaveStateTracker();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const pendingExports = new Map<string, (b64: string) => void>();

function getEditor(): any {
  const sd = (window as any).__sd;
  return sd ? sd.activeEditor ?? sd.editor ?? sd.editors?.[0] : null;
}

async function serializeAndPost(
  kind: 'autosave' | 'reply',
  requestId?: string,
): Promise<void> {
  const sd = (window as any).__sd;
  if (!sd) {
    if (kind === 'reply' && requestId != null) {
      pendingExports.delete(requestId);
      post({type: 'cmd-error', cmd: 'exportNow', requestId});
    }
    return;
  }
  tracker.beginExport();
  let succeeded = false;
  try {
    const result = await sd.export({
      exportType: ['docx'],
      triggerDownload: false,
    });
    if (!(result instanceof Blob)) {
      throw new Error('export did not return a Blob');
    }
    const b64 = await blobToBase64(result);
    tracker.markSaved();
    if (kind === 'autosave') {
      post({type: 'docx-autosave', b64});
    } else {
      pendingExports.get(requestId!)?.(b64);
      pendingExports.delete(requestId!);
    }
    succeeded = true;
  } catch (e: unknown) {
    // failed export must never clear dirty state
    post({type: 'error', message: String(e)});
    if (kind === 'reply' && requestId != null) {
      // release the caller so it can retry cleanly instead of hanging
      pendingExports.delete(requestId);
      post({type: 'cmd-error', cmd: 'exportNow', requestId});
    }
  } finally {
    const stale = tracker.endExportStaleEdits();
    if (stale) {
      // edits raced with this export; surface dirty instead of a stale saved
      markDirty();
    } else if (succeeded) {
      post({type: 'save-state', state: 'saved'});
    }
  }
}

function markDirty(): void {
  const wasClean = !tracker.isDirty();
  tracker.edit();
  if (wasClean) {
    post({type: 'save-state', state: 'dirty'});
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => void serializeAndPost('autosave'), 2000);
}

function emitWordCount(ed: any): void {
  const text = ed.state.doc.textBetween(
    0,
    ed.state.doc.content.size,
    '\n',
    ' ',
  );
  post({
    type: 'content-change',
    wordCount: text.split(/\s+/).filter(Boolean).length,
  });
}

let listenersAttached = false;

function attachEditorListeners(attempt = 0): void {
  const ed = getEditor();
  if (!ed) {
    // editors register asynchronously on ready; poll briefly as a fallback
    if (attempt < 50) {
      setTimeout(() => attachEditorListeners(attempt + 1), 100);
    } else {
      post({type: 'error', message: 'editor listeners failed to attach'});
    }
    return;
  }
  if (listenersAttached) {
    return;
  }
  listenersAttached = true;
  ed.on('update', () => {
    markDirty();
    emitWordCount(ed);
  });
  // Toolbar state must track the caret/selection; also emit once right
  // after attach so StyleBar highlights are correct before any navigation.
  ed.on('selectionUpdate', () =>
    post({type: 'format-change', format: currentFormats(ed)}),
  );
  post({type: 'format-change', format: currentFormats(ed)});
}

export function post(msg: Record<string, unknown>): void {
  const rn = (window as any).ReactNativeWebView;
  if (rn) {
    rn.postMessage(JSON.stringify(msg));
  }
}

declare global {
  interface Window {
    __handleMessage?: (data: string) => void;
    __mount?: (b64?: string) => void;
  }
}

window.__mount = (b64?: string) => {
  if ((window as any).__sd) {
    return;
  }
  let docFile: Blob | undefined;
  if (typeof b64 === 'string') {
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    docFile = new Blob([bin], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }
  // With no document supplied, SuperDoc starts a blank DOCX.
  (window as any).__sd = new SuperDoc({
    selector: '#superdoc',
    toolbar: '#superdoc-toolbar',
    documentMode: 'editing',
    ...(docFile ? {document: docFile} : {}),
    onReady: () => {
      attachEditorListeners();
      const ed = getEditor();
      if (ed) {
        emitWordCount(ed);
      }
      post({type: 'ready'});
    },
    onContentError: ({error}: any) =>
      post({type: 'error', message: String(error)}),
    onException: ({error}: any) =>
      post({type: 'error', message: String(error)}),
  });
};

window.__handleMessage = (data: string) => {
  let cmd: any;
  try {
    cmd = JSON.parse(data);
  } catch {
    return;
  }
  if (cmd.cmd === 'load' && typeof cmd.b64 === 'string') {
    window.__mount!(cmd.b64);
  }
  if (cmd.cmd === 'loadBlank') {
    window.__mount!();
  }
  if (cmd.cmd === 'exportNow') {
    const requestId = cmd.requestId ?? '0';
    pendingExports.set(requestId, (b64: string) =>
      post({type: 'docx', b64, requestId}),
    );
    void serializeAndPost('reply', requestId);
  }
  switch (cmd.cmd) {
    case 'format': {
      const ed = getEditor();
      if (!ed || !applyFormat(ed, cmd.key, cmd.value)) {
        post({type: 'cmd-error', cmd: 'format'});
      }
      break;
    }
    case 'insertText': {
      const ed = getEditor();
      if (ed) {
        ed.commands.insertContent(cmd.text);
      }
      break;
    }
    case 'undo':
    case 'redo': {
      const ed = getEditor();
      if (ed) {
        ed.commands[cmd.cmd]();
      }
      break;
    }
    case 'insertImage': {
      const ed = getEditor();
      if (ed && typeof cmd.dataUrl === 'string') {
        ed.commands.setImage({src: cmd.dataUrl});
      }
      break;
    }
    case 'setTheme': {
      document.body.classList.toggle('dark', cmd.dark === true);
      break;
    }
    case 'insertTable': {
      const ed = getEditor();
      if (!ed) {
        post({type: 'cmd-error', cmd: 'insertTable'});
        break;
      }
      try {
        ed.commands.insertTable({
          rows: Number(cmd.rows) + 1,
          cols: Number(cmd.cols),
          withHeaderRow: true,
        });
      } catch (e: unknown) {
        post({type: 'cmd-error', cmd: 'insertTable'});
        post({type: 'error', message: String(e)});
      }
      break;
    }
    case 'addTableRow':
    case 'addTableColumn':
    case 'deleteTableRow':
    case 'deleteTableColumn':
    case 'deleteTable': {
      const ed = getEditor();
      const tableCmd: Record<string, string> = {
        addTableRow: 'addRowAfter',
        addTableColumn: 'addColumnAfter',
        deleteTableRow: 'deleteRow',
        deleteTableColumn: 'deleteColumn',
        deleteTable: 'deleteTable',
      };
      const fn = tableCmd[cmd.cmd];
      if (!ed || typeof ed.commands?.[fn] !== 'function') {
        post({type: 'cmd-error', cmd: cmd.cmd});
        break;
      }
      try {
        ed.commands[fn]();
      } catch (e: unknown) {
        // table mutations throw when the caret is outside a table
        post({type: 'cmd-error', cmd: cmd.cmd});
        post({type: 'error', message: String(e)});
      }
      break;
    }
    case 'insertPageBreak': {
      const ed = getEditor();
      if (!ed || !ed.state?.schema?.nodes || !ed.state.schema.nodes.pageBreak) {
        post({type: 'cmd-error', cmd: 'insertPageBreak'});
        break;
      }
      try {
        ed.commands.insertContent({type: 'pageBreak'});
      } catch (e: unknown) {
        post({type: 'cmd-error', cmd: 'insertPageBreak'});
        post({type: 'error', message: String(e)});
      }
      break;
    }
    case 'setPaperSize': {
      const sizes: Record<string, [string, string]> = {
        a4: ['210mm', '297mm'],
        letter: ['216mm', '279mm'],
        a5: ['148mm', '210mm'],
        a3: ['297mm', '420mm'],
      };
      const [w, h] =
        sizes[typeof cmd.paperSize === 'string' ? cmd.paperSize : ''] ??
        sizes.a4;
      document.documentElement.style.setProperty('--page-width', w);
      document.documentElement.style.setProperty('--page-height', h);
      break;
    }
  }
};
