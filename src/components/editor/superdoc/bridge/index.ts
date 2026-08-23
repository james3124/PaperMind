import {SuperDoc} from 'superdoc';
import 'superdoc/style.css';

import {blobToBase64} from './exporter';
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
};
