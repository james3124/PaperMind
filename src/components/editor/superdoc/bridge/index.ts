import {SuperDoc} from 'superdoc';
import 'superdoc/style.css';

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
    onContentError: ({error}: any) => post({type: 'error', message: String(error)}),
    onException: ({error}: any) => post({type: 'error', message: String(error)}),
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
};
