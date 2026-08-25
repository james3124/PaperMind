import {
  WORKER_URL_GLOBAL,
  installEngineWorkerUrl,
  readWorkerEntryMeta,
  resolveWorkerAssetUrl,
} from '@/components/editor/superdoc/bridge/engineWorker';

describe('resolveWorkerAssetUrl', () => {
  it('resolves the entry path against the shell location', () => {
    expect(
      resolveWorkerAssetUrl(
        'file:///android_asset/superdoc/index.html',
        'assets/browser-worker-entry-abc.js',
      ),
    ).toBe('file:///android_asset/superdoc/assets/browser-worker-entry-abc.js');
  });

  it('keeps absolute entries untouched', () => {
    expect(
      resolveWorkerAssetUrl(
        'file:///android_asset/superdoc/index.html',
        'blob:https://x/y',
      ),
    ).toBe('blob:https://x/y');
  });

  it('returns null without an entry path', () => {
    expect(resolveWorkerAssetUrl('http://localhost/', '')).toBeNull();
  });

  it('returns null when the URL is unresolvable', () => {
    expect(resolveWorkerAssetUrl('not a url at all', 'assets/w.js')).toBeNull();
  });
});

describe('readWorkerEntryMeta', () => {
  it('reads the stamped meta content', () => {
    const doc = {
      querySelector: (sel: string) =>
        sel === 'meta[name="superdoc-worker-entry"]'
          ? {getAttribute: () => 'assets/worker.js'}
          : null,
    };
    expect(readWorkerEntryMeta(doc as unknown as Document)).toBe(
      'assets/worker.js',
    );
  });

  it('falls back to empty string when the meta tag is missing', () => {
    const doc = {querySelector: () => null};
    expect(readWorkerEntryMeta(doc as unknown as Document)).toBe('');
  });
});

describe('installEngineWorkerUrl', () => {
  function makeHarness() {
    const installed: string[] = [];
    return {
      installed,
      setGlobal: (url: string) => {
        installed.push(url);
      },
    };
  }

  it('installs a blob object URL after fetching the worker source', async () => {
    const h = makeHarness();
    const created: Blob[] = [];
    const ok = await installEngineWorkerUrl({
      baseHref: 'file:///android_asset/superdoc/index.html',
      entryPath: 'assets/browser-worker-entry-abc.js',
      fetchText: async () => '// worker code',
      createObjectUrl: (blob: Blob) => {
        created.push(blob);
        return 'blob:fake/1';
      },
      setGlobal: h.setGlobal,
    });
    expect(ok).toBe(true);
    expect(h.installed).toEqual(['blob:fake/1']);
    expect(created).toHaveLength(1);
    expect(await created[0].text()).toBe('// worker code');
  });

  // Android WebView rejects fetch() for file:// URLs even when
  // allowFileAccessFromFileURLs is on; XHR honors those settings, so the
  // XHR-sourced blob must be tried before the (module-worker-incompatible)
  // direct file:// fallback.
  it('installs an xhr-fetched blob when fetch rejects', async () => {
    const h = makeHarness();
    const created: Blob[] = [];
    const strategies: string[] = [];
    const ok = await installEngineWorkerUrl({
      baseHref: 'file:///android_asset/superdoc/index.html',
      entryPath: 'assets/browser-worker-entry-abc.js',
      fetchText: async () => {
        throw new TypeError('Failed to fetch');
      },
      xhrText: async () => '// xhr worker code',
      createObjectUrl: (blob: Blob) => {
        created.push(blob);
        return 'blob:xhr/1';
      },
      setGlobal: h.setGlobal,
      onInstalled: info => strategies.push(info.strategy),
    });
    expect(ok).toBe(true);
    expect(h.installed).toEqual(['blob:xhr/1']);
    expect(await created[0].text()).toBe('// xhr worker code');
    expect(strategies).toEqual(['blob-xhr']);
  });

  it('reports the fetch blob strategy when the first attempt succeeds', async () => {
    const h = makeHarness();
    const strategies: string[] = [];
    await installEngineWorkerUrl({
      baseHref: 'file:///android_asset/superdoc/index.html',
      entryPath: 'assets/browser-worker-entry-abc.js',
      fetchText: async () => '// worker code',
      xhrText: async () => '// should never run',
      createObjectUrl: () => 'blob:fetch/1',
      setGlobal: h.setGlobal,
      onInstalled: info => strategies.push(info.strategy),
    });
    expect(strategies).toEqual(['blob-fetch']);
  });

  it('falls back to the direct asset URL only when fetch and xhr both fail', async () => {
    const h = makeHarness();
    const strategies: string[] = [];
    const ok = await installEngineWorkerUrl({
      baseHref: 'file:///android_asset/superdoc/index.html',
      entryPath: 'assets/browser-worker-entry-abc.js',
      fetchText: async () => {
        throw new TypeError('Failed to fetch');
      },
      xhrText: async () => {
        throw new Error('worker xhr blocked');
      },
      createObjectUrl: () => 'blob:never',
      setGlobal: h.setGlobal,
      onInstalled: info => strategies.push(info.strategy),
    });
    expect(ok).toBe(true);
    expect(h.installed).toEqual([
      'file:///android_asset/superdoc/assets/browser-worker-entry-abc.js',
    ]);
    expect(strategies).toEqual(['direct']);
  });

  it('reports failure when no entry path resolves', async () => {
    const h = makeHarness();
    const ok = await installEngineWorkerUrl({
      baseHref: 'file:///android_asset/superdoc/index.html',
      entryPath: '',
      fetchText: async () => '',
      createObjectUrl: () => 'blob:x',
      setGlobal: h.setGlobal,
    });
    expect(ok).toBe(false);
    expect(h.installed).toEqual([]);
  });

  it('exposes the superdoc-documented global key', () => {
    expect(WORKER_URL_GLOBAL).toBe('__SUPERDOC_V2_BROWSER_WORKER_URL__');
  });
});
