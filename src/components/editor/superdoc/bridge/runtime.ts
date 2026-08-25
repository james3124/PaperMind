// Shared bridge runtime primitives. Kept in their own module so sibling
// files (formatCommands, docApi) can use them without importing
// ./index — that would create a bundler cycle (see formatCommands.ts).

export type AnyObj = Record<string, any>;

export function getEditor(): AnyObj | null {
  const sd = (window as any).__sd;
  return sd ? sd.activeEditor ?? sd.editor ?? sd.editors?.[0] : null;
}

export function post(msg: Record<string, unknown>): void {
  const rn = (window as any).ReactNativeWebView;
  if (rn) {
    rn.postMessage(JSON.stringify(msg));
  }
}
