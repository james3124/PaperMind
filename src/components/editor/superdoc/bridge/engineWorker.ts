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

export const WORKER_URL_GLOBAL = '__SUPERDOC_V2_BROWSER_WORKER_URL__';

export const WORKER_ENTRY_META = 'superdoc-worker-entry';

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
  createObjectUrl?: (blob: Blob) => string;
  setGlobal?: (url: string) => void;
}

/**
 * Installs the DOCX-engine worker URL global. Prefers a Blob object URL built
 * from the fetched worker source; if the source cannot be fetched (e.g. file
 * access denied), falls back to the direct asset URL so WebViews that permit
 * file:// workers still boot. Returns whether any URL was installed.
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
  const fetchText =
    options.fetchText ??
    ((url: string) =>
      fetch(url).then(r => {
        if (!r.ok) {
          throw new Error(`worker fetch failed: ${r.status}`);
        }
        return r.text();
      }));
  const createObjectUrl =
    options.createObjectUrl ?? ((blob: Blob) => URL.createObjectURL(blob));

  try {
    const source = await fetchText(resolved);
    setGlobal(createObjectUrl(new Blob([source], {type: 'text/javascript'})));
  } catch {
    setGlobal(resolved);
  }
  return true;
}
