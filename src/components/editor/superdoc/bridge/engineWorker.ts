// The DOCX engine inside superdoc spawns its worker with
//   new Worker(new URL('./assets/browser-worker-entry-*.js', import.meta.url))
// which only resolves when the bundle is loaded as an ES module. This app
// bundles SuperDoc as a classic IIFE script for file:// WebView use, so
// import.meta.url is gone and every worker spawn throws. SuperDoc documents
// the escape hatch global __SUPERDOC_V2_BROWSER_WORKER_URL__: when set to a
// string/URL it is used verbatim as the Worker script URL for engine workers.
//
// The build stamps the real (content-hashed) worker entry path into the shell
// as <meta name="superdoc-worker-entry">; at runtime we fetch that file next
// to the shell page, wrap it in a Blob, and install its object URL — Blob
// workers are what SuperDoc itself uses in dev mode and they work from a
// file:// origin where direct file:// module workers do not.
//
// fetch() is tried first but Android WebView rejects it for file:// URLs even
// when allowFileAccessFromFileURLs/allowUniversalAccessFromFileURLs are on;
// XMLHttpRequest honors those settings, so an XHR retry runs before the last-
// resort direct asset URL (which Chromium can never boot as a module worker).

export const WORKER_URL_GLOBAL = '__SUPERDOC_V2_BROWSER_WORKER_URL__';

export const WORKER_ENTRY_META = 'superdoc-worker-entry';

export type WorkerInstallStrategy = 'blob-fetch' | 'blob-xhr' | 'direct';

export function resolveWorkerAssetUrl(
  baseHref: string,
  entryPath: string,
): string | null {
  if (!entryPath) {
    return null;
  }
  try {
    return new URL(entryPath, baseHref || undefined).href;
  } catch {
    return null;
  }
}

export function readWorkerEntryMeta(doc: Document): string {
  return (
    doc
      .querySelector(`meta[name="${WORKER_ENTRY_META}"]`)
      ?.getAttribute('content') ?? ''
  );
}

interface InstallOptions {
  baseHref?: string;
  entryPath: string;
  fetchText?: (url: string) => Promise<string>;
  xhrText?: (url: string) => Promise<string>;
  createObjectUrl?: (blob: Blob) => string;
  setGlobal?: (url: string) => void;
  onInstalled?: (info: {strategy: WorkerInstallStrategy}) => void;
}

/**
 * Reads a URL with XMLHttpRequest. Unlike fetch(), XHR respects the WebView's
 * file-access settings, which is what makes local worker assets reachable
 * from the file:// shell page. status === 0 is success for file:// loads.
 */
export function readViaXhr(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onload = () => {
        if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
          resolve(String(xhr.responseText));
        } else {
          reject(new Error(`worker xhr failed: ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('worker xhr blocked'));
      xhr.send();
    } catch (e: unknown) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

/**
 * Reads a URL with the Fetch API. Primary strategy; Android WebView may
 * still reject it for file:// URLs, which readViaXhr then covers.
 */
function defaultFetchText(url: string): Promise<string> {
  return fetch(url).then(r => {
    if (!r.ok) {
      throw new Error(`worker fetch failed: ${r.status}`);
    }
    return r.text();
  });
}

/**
 * Installs the DOCX-engine worker URL global. Tries a Blob object URL built
 * from the fetched worker source first via fetch(), then via XHR; only when
 * both fail does it fall back to the direct asset URL so WebViews that permit
 * file:// module workers still boot. Returns whether any URL was installed.
 */
export async function installEngineWorkerUrl(
  options: InstallOptions,
): Promise<boolean> {
  const base = options.baseHref ?? window.location.href;
  const resolved = resolveWorkerAssetUrl(base, options.entryPath);
  if (!resolved) {
    return false;
  }

  const setGlobal =
    options.setGlobal ??
    ((url: string) => {
      (window as any)[WORKER_URL_GLOBAL] = url;
    });
  const createObjectUrl =
    options.createObjectUrl ?? ((blob: Blob) => URL.createObjectURL(blob));
  const xhrText = options.xhrText ?? readViaXhr;

  let strategy: WorkerInstallStrategy | null = null;
  try {
    const source = await (options.fetchText ?? defaultFetchText)(resolved);
    setGlobal(createObjectUrl(new Blob([source], {type: 'text/javascript'})));
    strategy = 'blob-fetch';
  } catch {
    try {
      const source = await xhrText(resolved);
      setGlobal(createObjectUrl(new Blob([source], {type: 'text/javascript'})));
      strategy = 'blob-xhr';
    } catch {
      setGlobal(resolved);
      strategy = 'direct';
    }
  }
  options.onInstalled?.({strategy});
  return true;
}
