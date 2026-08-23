import {SuperDoc} from 'superdoc';
import 'superdoc/style.css';

import {blobToBase64} from './exporter';

let dirty = false;
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
    return;
  }
  try {
    const result = await sd.export({
      exportType: ['docx'],
      triggerDownload: false,
    });
    if (!(result instanceof Blob)) {
      throw new Error('export did not return a Blob');
    }
    const b64 = await blobToBase64(result);
    dirty = false;
    post({type: 'save-state', state: 'saved'});
    if (kind === 'autosave') {
      post({type: 'docx-autosave', b64});
    } else {
      pendingExports.get(requestId!)?.(b64);
      pendingExports.delete(requestId!);
    }
  } catch (e: unknown) {
    // failed export must never clear dirty state
    post({type: 'error', message: String(e)});
  }
}

function markDirty(): void {
  if (!dirty) {
    dirty = true;
    post({type: 'save-state', state: 'dirty'});
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => void serializeAndPost('autosave'), 2000);
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
    __mount?: (b64: string) => void;
  }
}

window.__mount = (b64: string) => {
  if ((window as any).__sd) {
    return;
  }
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const blob = new Blob([bin], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  (window as any).__sd = new SuperDoc({
    selector: '#superdoc',
    toolbar: '#superdoc-toolbar',
    documentMode: 'editing',
    document: blob,
    onReady: () => post({type: 'ready'}),
    onContentError: ({error}: any) =>
      post({type: 'error', message: String(error)}),
    onException: ({error}: any) =>
      post({type: 'error', message: String(error)}),
  });
  const ed = getEditor();
  if (ed) {
    ed.on('update', () => {
      markDirty();
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
    });
  }
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
  if (cmd.cmd === 'exportNow') {
    const requestId = cmd.requestId ?? '0';
    pendingExports.set(requestId, (b64: string) =>
      post({type: 'docx', b64, requestId}),
    );
    void serializeAndPost('reply', requestId);
  }
};
