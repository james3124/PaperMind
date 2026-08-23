# SuperDoc Editor Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Quill.js WebView editor with SuperDoc so papers are stored, edited, imported and exported as real DOCX files, at full feature parity, plus fix the keyboard white-flash bug and add a "new blank document" option to the Library `+` button.

**Architecture:** SuperDoc core runs inside the existing React Native WebView, loaded from a tiny static HTML shell plus an esbuild-bundled JS/CSS pair in Android assets. Each paper lives as `<docsDir>/papers/<id>.docx` on disk; WatermelonDB's `content` column stores that relative path. The ~20 bridge commands keep their names; only their WebView-side implementation changes.

**Tech Stack:** React Native 0.74, TypeScript, react-native-webview, react-native-fs, WatermelonDB, superdoc (npm), esbuild, jest.

**Spec:** `docs/superpowers/specs/2026-08-22-superdoc-editor-design.md`

## Global Constraints

- App is **Android-only**; assets go to `android/app/src/main/assets/`.
- Pin exact `superdoc` version in `package.json` after first install.
- SuperDoc is **AGPL-3.0** — do not remove its license notice from vendor output.
- Keep the RN-side bridge contract (`EditorRef` method names, message type names) stable unless a task explicitly changes it.
- All new TS files follow repo style: single quotes, 2-space indent, no semicolone-less style deviation (match `.prettierrc.js`).
- Run `npm run lint` and `npm test` before every commit step that says "run checks".
- Tests use the existing jest config (`preset: react-native`, `@/` → `src/` alias).
- Never overwrite a paper's `.docx` file when export fails.

---

### Task 1: Repo setup + editor asset build pipeline

**Files:**
- Create: `scripts/build-superdoc-editor.mjs`
- Create: `src/components/editor/superdoc/shell/index.html`
- Create: `src/components/editor/superdoc/bridge/index.ts`
- Modify: `package.json` (scripts + deps)

**Interfaces:**
- Produces: `android/app/src/main/assets/superdoc/{index.html,superdoc.js,superdoc.css}` consumed by Task 5.
- Produces: npm script `build:editor`.

- [ ] **Step 1: Initialize git and install dependencies**

```bash
git init
npm install --save-exact superdoc
npm install --save-dev esbuild@^2
```

If a git repo already exists, skip `git init`.

- [ ] **Step 2: Create the shell HTML**

Create `src/components/editor/superdoc/shell/index.html`:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="superdoc.css" />
    <style>
      html,
      body,
      #superdoc {
        background: #ffffff;
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <div id="superdoc-toolbar"></div>
    <div id="superdoc"></div>
    <script src="superdoc.js"></script>
  </body>
</html>
```

- [ ] **Step 3: Create a minimal bridge entry**

Create `src/components/editor/superdoc/bridge/index.ts`:

```ts
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
```

Note: `atob` exists in Android WebView. If lint flags `any`, add targeted eslint-disable lines matching repo conventions.

- [ ] **Step 4: Create the build script**

Create `scripts/build-superdoc-editor.mjs`:

```js
import esbuild from 'esbuild';
import {cpSync, mkdirSync} from 'node:fs';

const OUT = 'android/app/src/main/assets/superdoc';
mkdirSync(OUT, {recursive: true});

await esbuild.build({
  entryPoints: ['src/components/editor/superdoc/bridge/index.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome90'],
  outfile: `${OUT}/superdoc.js`,
  legalComments: 'inline',
});

cpSync('src/components/editor/superdoc/shell/index.html', `${OUT}/index.html`);
console.log(`[build-superdoc-editor] wrote ${OUT}/superdoc.{js,css} and index.html`);
```

esbuild emits `superdoc.css` next to `superdoc.js` because the entry imports CSS.

- [ ] **Step 5: Add npm script**

In `package.json` scripts add:

```json
"build:editor": "node scripts/build-superdoc-editor.mjs"
```

- [ ] **Step 6: Build and verify outputs**

Run: `npm run build:editor`
Expected: console line `[build-superdoc-editor] wrote ...`; files exist under `android/app/src/main/assets/superdoc/`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json scripts/build-superdoc-editor.mjs src/components/editor/superdoc android/app/src/main/assets/superdoc
git commit -m "feat(editor): add SuperDoc WebView asset build pipeline"
```

---

### Task 2: paperFileStore service

**Files:**
- Create: `src/services/paperFileStore.ts`
- Test: `src/services/__tests__/paperFileStore.test.ts`

**Interfaces:**
- Produces (used by Tasks 4, 12, 13, 14):
  - `paperPath(id: string): string` — returns absolute path `<RNFS.DocumentDirectoryPath>/papers/<id>.docx`
  - `savePaperDocx(id: string, base64: string): Promise<void>` — atomic via temp file
  - `loadPaperDocx(id: string): Promise<string>` — base64
  - `deletePaperDocx(id: string): Promise<void>` — ignores missing file
  - `duplicatePaperDocx(srcId: string, destId: string): Promise<void>`
  - `copyBlankTemplate(destId: string): Promise<void>` — copies bundled asset (Task 3 wires the real template)

- [ ] **Step 1: Write the failing tests**

Create `src/services/__tests__/paperFileStore.test.ts`:

```ts
import RNFS from 'react-native-fs';

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/docs',
  exists: jest.fn().mockResolvedValue(false),
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('AAA='),
  unlink: jest.fn().mockResolvedValue(undefined),
  moveFile: jest.fn().mockResolvedValue(undefined),
  copyFile: jest.fn().mockResolvedValue(undefined),
}));

import {savePaperDocx, loadPaperDocx, deletePaperDocx, duplicatePaperDocx} from '@/services/paperFileStore';

describe('paperFileStore', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saves atomically via temp file', async () => {
    await savePaperDocx('p1', 'AAA=');
    expect(RNFS.writeFile).toHaveBeenCalledWith('/mock/docs/papers/p1.docx.tmp', 'AAA=', 'base64');
    expect(RNFS.moveFile).toHaveBeenCalledWith('/mock/docs/papers/p1.docx.tmp', '/mock/docs/papers/p1.docx');
  });

  it('loads by id', async () => {
    await expect(loadPaperDocx('p1')).resolves.toBe('AAA=');
    expect(RNFS.readFile).toHaveBeenCalledWith('/mock/docs/papers/p1.docx', 'base64');
  });

  it('delete ignores missing files', async () => {
    (RNFS.unlink as jest.Mock).mockRejectedValueOnce(new Error('nope'));
    await expect(deletePaperDocx('p1')).resolves.toBeUndefined();
  });

  it('duplicates copies source to destination', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValueOnce(true);
    await duplicatePaperDocx('a', 'b');
    expect(RNFS.copyFile).toHaveBeenCalledWith('/mock/docs/papers/a.docx', '/mock/docs/papers/b.docx');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test -- paperFileStore`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the store**

Create `src/services/paperFileStore.ts`:

```ts
import RNFS from 'react-native-fs';

const PAPERS_DIR = `${RNFS.DocumentDirectoryPath}/papers`;
const BLANK_ASSET = 'documents/blank.docx';

function pathFor(id: string): string {
  return `${PAPERS_DIR}/${id}.docx`;
}

async function ensureDir(): Promise<void> {
  if (!(await RNFS.exists(PAPERS_DIR))) {
    await RNFS.mkdir(PAPERS_DIR);
  }
}

export async function savePaperDocx(id: string, base64: string): Promise<void> {
  await ensureDir();
  const dest = pathFor(id);
  const tmp = `${dest}.tmp`;
  await RNFS.writeFile(tmp, base64, 'base64');
  try {
    await RNFS.unlink(dest);
  } catch {}
  await RNFS.moveFile(tmp, dest);
}

export async function loadPaperDocx(id: string): Promise<string> {
  return RNFS.readFile(pathFor(id), 'base64');
}

export async function deletePaperDocx(id: string): Promise<void> {
  try {
    await RNFS.unlink(pathFor(id));
  } catch {}
}

export async function duplicatePaperDocx(srcId: string, destId: string): Promise<void> {
  await ensureDir();
  await RNFS.copyFile(pathFor(srcId), pathFor(destId));
}

export async function copyBlankTemplate(destId: string): Promise<void> {
  await ensureDir();
  await RNFS.copyFileAssets(BLANK_ASSET, pathFor(destId));
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- paperFileStore`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/paperFileStore.ts src/services/__tests__/paperFileStore.test.ts
git commit -m "feat(storage): add paperFileStore for per-paper docx files"
```

---

### Task 3: Blank DOCX template asset

**Files:**
- Create: `scripts/make-blank-docx.mjs`
- Create: `android/app/src/main/assets/documents/blank.docx`

**Interfaces:**
- Produces: the asset read by `copyBlankTemplate` (Task 2).

- [ ] **Step 1: Write the generator script**

A minimal valid OOXML package needs `[Content_Types].xml`, `_rels/.rels`, and `word/document.xml`. jszip is already a dependency. Create `scripts/make-blank-docx.mjs`:

```js
import JSZip from 'jszip';
import {writeFileSync} from 'node:fs';

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body><w:p/></w:body>
</w:document>`;

const zip = new JSZip();
zip.file('[Content_Types].xml', contentTypes);
zip.file('_rels/.rels', rels);
zip.file('word/document.xml', documentXml);

const buf = await zip.generateAsync({type: 'nodebuffer'});
writeFileSync('android/app/src/main/assets/documents/blank.docx', buf);
console.log('wrote android/app/src/main/assets/documents/blank.docx');
```

- [ ] **Step 2: Generate and sanity-check the asset**

Run:
```bash
node scripts/make-blank-docx.mjs
unzip -l android/app/src/main/assets/documents/blank.docx
```
Expected: listing shows the three entries.

- [ ] **Step 3: Commit**

```bash
git add scripts/make-blank-docx.mjs android/app/src/main/assets/documents/blank.docx
git commit -m "feat(storage): add blank docx template asset"
```

---

### Task 4: Bridge core — autosave, export, word count

**Files:**
- Modify: `src/components/editor/superdoc/bridge/index.ts`
- Create: `src/components/editor/superdoc/bridge/exporter.ts`
- Test: `src/components/editor/superdoc/__tests__/exporter.test.ts`

**Interfaces:**
- Consumes: `window.__sd` (the mounted SuperDoc instance from Task 1).
- Produces messages: `{type:'content-change', wordCount}`, `{type:'save-state', state:'dirty'|'saved'}`, `{type:'docx-autosave', b64}`, `{type:'docx', b64, requestId}` in reply to `{cmd:'exportNow', requestId}`.
- Produces: `blobToBase64(blob: Blob): Promise<string>` (pure, tested).

- [ ] **Step 1: Write failing tests for blobToBase64**

Create `src/components/editor/superdoc/__tests__/exporter.test.ts`:

```ts
import {blobToBase64} from '@/components/editor/superdoc/bridge/exporter';

describe('blobToBase64', () => {
  it('encodes bytes as base64 without data-uri prefix', async () => {
    const blob = new Blob([Uint8Array.from([104, 105])]); // "hi"
    await expect(blobToBase64(blob)).resolves.toBe('aGk=');
  });
});
```

Run: `npm test -- exporter` — expected FAIL (module missing). Node ≥18 provides `Blob`, so no polyfill needed in jest.

- [ ] **Step 2: Implement exporter**

Create `src/components/editor/superdoc/bridge/exporter.ts`:

```ts
export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}
```

Run: `npm test -- exporter` — PASS.

- [ ] **Step 3: Wire autosave into the bridge**

In `src/components/editor/superdoc/bridge/index.ts`, extend the SuperDoc construction and dispatcher:

```ts
import {blobToBase64} from './exporter';

let dirty = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const pendingExports = new Map<string, (b64: string) => void>();

function getEditor(): any {
  const sd = (window as any).__sd;
  return sd ? (sd.activeEditor ?? sd.editor ?? sd.editors?.[0]) : null;
}

async function serializeAndPost(kind: 'autosave' | 'reply', requestId?: string): Promise<void> {
  const sd = (window as any).__sd;
  if (!sd) return;
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
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void serializeAndPost('autosave'), 2000);
}

// inside window.__mount, after constructing SuperDoc:
//   const ed = getEditor();
//   if (ed) {
//     ed.on('update', () => {
//       markDirty();
//       const text = ed.state.doc.textBetween(0, ed.state.doc.content.size, '\n', ' ');
//       post({type: 'content-change', wordCount: text.split(/\s+/).filter(Boolean).length});
//     });
//   }

// inside window.__handleMessage switch:
//   if (cmd.cmd === 'exportNow') {
//     pendingExports.set(cmd.requestId ?? '0', (b64: string) =>
//       post({type: 'docx', b64, requestId: cmd.requestId ?? '0'}));
//     void serializeAndPost('reply', cmd.requestId ?? '0');
//   }
```

Apply the commented blocks as real code in their indicated locations (remove comment markers). The `update` hook name is tiptap-standard; verify during device smoke test (Task 5 Step 4) and adjust only this wiring if the event name differs.

- [ ] **Step 4: Rebuild asset and commit**

Run: `npm run build:editor && npm run lint`
Expected: build succeeds, lint clean.

```bash
git add src/components/editor/superdoc android/app/src/main/assets/superdoc
git commit -m "feat(editor): bridge autosave/export pipeline over docx bytes"
```

---

### Task 5: Rewrite EditorWebView + wire EditorScreen open/save

**Files:**
- Modify: `src/components/editor/EditorWebView.tsx` (full rewrite)
- Modify: `src/screens/EditorScreen.tsx`
- Modify: `src/services/pipelineService.ts` (only where it sets `doc.content`)
- Modify: `src/db/DocumentRepository.ts` (create() writes docx path)

**Interfaces:**
- Consumes: `paperFileStore.savePaperDocx/loadPaperDocx/copyBlankTemplate`.
- Produces: same `EditorRef` API except `getContent(cb)` now delivers **docx base64**, and `insertDelta(deltaJson)` becomes `insertMarkdown(md: string)` (implemented as no-op until Task 11 wires markdown insertion).
- Legacy guard: if a DB row's `content` does not start with `papers/`, treat as fresh (copy blank template, set path).

- [ ] **Step 1: Rewrite EditorWebView.tsx**

Replace the body of `EditorWebView.tsx` (keep the same props interface, plus change):

```tsx
const EDITOR_URL = 'file:///android_asset/superdoc/index.html';
```

Key changes from the Quill version:

```tsx
const webviewRef = useRef<any>(null);
const readyRef = useRef(false);
const initialB64Ref = useRef<string | null>(null);
const pendingGetContent = useRef<Map<string, (b64: string) => void>>(new Map());
const requestSeq = useRef(0);
const queueRef = useRef<Record<string, unknown>[]>([]);

function postCmd(cmd: Record<string, unknown>) {
  if (!readyRef.current && cmd.cmd !== 'load') {
    queueRef.current.push(cmd);
    return;
  }
  webviewRef.current?.injectJavaScript(
    `(function(){ window.__handleMessage(${JSON.stringify(
      JSON.stringify(cmd),
    )}); })(); true;`,
  );
}
```

On mount, load the initial docx then set source:

```tsx
useEffect(() => {
  let cancelled = false;
  (async () => {
    let b64: string | null = null;
    if (props.initialContentPath?.startsWith('papers/')) {
      b64 = await loadPaperDocx(props.initialContentPath.replace(/^papers\//, '').replace(/\.docx$/, ''));
    }
    if (!cancelled && b64) {
      initialB64Ref.current = b64;
      postCmd({cmd: 'load', b64});
    }
    if (!cancelled) props.onReady();
  })();
  return () => {
    cancelled = true;
  };
}, []);
```

The `onMessage` handler maps incoming types exactly as before (`content-change`, `format-change`, `headings`, `replace-done`, `selection-text`, `error`, `ready`, `save-state`) plus two new ones:

```tsx
case 'docx-autosave':
  props.onAutosave?.(msg.b64);
  break;
case 'docx':
  pendingGetContent.current.get(msg.requestId)?.(msg.b64);
  pendingGetContent.current.delete(msg.requestId);
  break;
case 'ready':
  readyRef.current = true;
  if (initialB64Ref.current == null && props.blankMode) {
    postCmd({cmd: 'loadBlank'});
  }
  queueRef.current.forEach(postCmd);
  queueRef.current = [];
  props.onReady();
  break;
```

WebView JSX changes (white-flash mitigations from spec §Additional scope 1):

```tsx
<WebView
  ref={webviewRef}
  source={{uri: EDITOR_URL}}
  originWhitelist={['*']}
  allowFileAccess={true}
  onlyArchivedExtension={false}
  onMessage={onMessage}
  javaScriptEnabled
  domStorageEnabled
  backgroundColor="#ffffff"
  androidLayerType="hardware"
  style={[styles.webview, {backgroundColor: '#ffffff'}]}
  // ...keep all other props from the Quill version unchanged
/>
```

Also update `styles.webview` to include `backgroundColor: '#ffffff'`. If flash persists on-device later, flip `androidLayerType` to `'none'` (single-line experiment recorded in spec order).

`EditorRef.getContent` becomes:

```tsx
getContent: onContent => {
  const requestId = String(++requestSeq.current);
  pendingGetContent.current.set(requestId, onContent);
  postCmd({cmd: 'exportNow', requestId});
},
```

Props interface: replace `initialContent: string` with `initialContentPath: string | null` and `blankMode: boolean`; add `onAutosave?: (b64: string) => void`.

- [ ] **Step 2: Update EditorScreen open flow**

In `EditorScreen.tsx`:

1. Replace the `useMemo(() => buildQuillHtml(...))` usage — delete it; render `<EditorWebView initialContentPath={contentPath} blankMode={!contentPath} ... />` where `contentPath` comes from the document row.
2. Add autosave persistence:

```tsx
const onAutosave = useCallback(
  async (b64: string) => {
    try {
      await savePaperDocx(documentId, b64);
      lastSnapshottedContentRef.current = 'file'; // see Task 12
    } catch (e: unknown) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Unknown error');
    }
  },
  [documentId],
);
```

Pass `onAutosave={onAutosave}` to `EditorWebView`.

3. In `onContentChange(delta, wc)` callback: drop the `documentRepository.update({content: delta})` write; keep only word-count state updates and `setSaveStatus` driven by `save-state` messages instead.
4. Legacy guard where the row loads:

```tsx
let contentPath = doc.content;
if (!contentPath.startsWith('papers/')) {
  await copyBlankTemplate(documentId);
  contentPath = `papers/${documentId}.docx`;
  await documentRepository.update(documentId, {content: contentPath});
}
```

5. Every call site of `editorRef.current?.insertDelta(markdownToDeltaJson(x))` becomes `editorRef.current?.insertMarkdown(x)` (temporary no-op in the ref until Task 11).
6. Remove `import {markdownToDeltaJson} from '@/utils/markdownToQuillDelta'`.

- [ ] **Step 3: Pipeline final save writes a real docx path**

In `pipelineService.ts` stage 19: replace `markdownToDeltaJson(fullPaperText)` + `update(doc.id, {content: fullPaperDelta})` with:

```ts
await copyBlankTemplate(doc.id);
await documentRepository.update(doc.id, {content: `papers/${doc.id}.docx`});
pendingMarkdownByDoc.set(doc.id, fullPaperText); // module-level Map<string,string>
```

Add to the same file a helper consumed by EditorScreen after opening a freshly generated paper:

```ts
export function takePendingMarkdown(docId: string): string | undefined {
  const md = pendingMarkdownByDoc.get(docId);
  pendingMarkdownByDoc.delete(docId);
  return md;
}
```

EditorScreen, once `props.onReady()` fires and `blankMode === true`, calls `takePendingMarkdown(documentId)` and passes the result to `insertMarkdown` (Task 11 implements the command; until then the call is safely ignored by the bridge).

- [ ] **Step 4: Device smoke test (Milestone 0)**

Run: `npm run build:editor && npm run android`
Manual checklist on device:
1. Open an existing paper → toolbar renders, typing works, backspace works, autocorrect applies, cursor never jumps.
2. Dismiss keyboard repeatedly while focused → no white flash.
3. Rotate device → layout survives.
4. Kill app mid-typing, reopen → edits persisted via `docx-autosave` (verify file exists: `adb shell ls /data/data/<pkg>/files/papers/`).
5. Word count updates live.

If IME issues appear, stop and fix before proceeding (spec Milestone 0 rule). Record findings in commit message.

- [ ] **Step 5: Run checks and commit**

Run: `npm run lint && npm test`
Expected: clean (quillHtml tests still present but untouched — they are deleted in Task 15).

```bash
git add src/components/editor/EditorWebView.tsx src/screens/EditorScreen.tsx src/services/pipelineService.ts src/db/DocumentRepository.ts
git commit -m "feat(editor): mount SuperDoc WebView, persist papers as docx files"
```

---

### Task 6: Formatting commands (format / insertText / undo / redo / insertImage / format-change)

**Files:**
- Create: `src/components/editor/superdoc/bridge/formatCommands.ts`
- Modify: `src/components/editor/superdoc/bridge/index.ts` (dispatcher)
- Modify: `src/components/editor/superdoc/shell/index.html` (dark-mode CSS variables)

**Interfaces:**
- Consumes: `getEditor()` adapter from Task 4.
- Produces: handling for `{cmd:'format',key,value}`, `{cmd:'insertText',text}`, `{cmd:'undo'}`, `{cmd:'redo'}`, `{cmd:'insertImage',dataUrl}`; emits `{type:'format-change', format}` on selection change.

- [ ] **Step 1: Implement formatCommands.ts**

```ts
const FORMAT_MAP: Record<string, (ed: any, value: unknown) => void> = {
  bold: (ed, v) => (v ? ed.commands.setBold() : ed.commands.unsetBold()),
  italic: (ed, v) => (v ? ed.commands.setItalic() : ed.commands.unsetItalic()),
  underline: (ed, v) => (v ? ed.commands.setUnderline() : ed.commands.unsetUnderline()),
  strike: (ed, v) => (v ? ed.commands.setStrike() : ed.commands.unsetStrike()),
  color: (ed, v) => ed.commands.setColor(String(v)),
  background: (ed, v) => ed.commands.setBackgroundColor?.(String(v)),
  align: (ed, v) => ed.commands.setTextAlign(String(v)),
  header: (ed, v) =>
    v ? ed.commands.setHeading({level: Number(v)}) : ed.commands.setParagraph(),
  font: (ed, v) => ed.commands.setFontFamily?.(String(v)),
  size: (ed, v) => ed.commands.setFontSize?.(String(v)),
  list: (ed, v) =>
    v === 'ordered'
      ? ed.commands.toggleOrderedList()
      : v === 'bullet'
      ? ed.commands.toggleBulletList()
      : ed.commands.toggleBlockquote(),
};

export function applyFormat(ed: any, key: string, value: unknown): void {
  const fn = FORMAT_MAP[key];
  if (fn) {
    fn(ed, value);
  } else {
    post({type: 'cmd-error', cmd: 'format'});
  }
}

export function currentFormats(ed: any): Record<string, unknown> {
  const a = ed.isActive.bind(ed);
  const attrs = ed.getAttributes('textStyle');
  const format: Record<string, unknown> = {
    bold: a('bold'),
    italic: a('italic'),
    underline: a('underline'),
    strike: a('strike'),
    align: ed.getAttributes('paragraph').textAlign ?? 'left',
  };
  if (attrs.color) format.color = attrs.color;
  return format;
}

import {post} from './index';
```

- [ ] **Step 2: Dispatcher entries**

In `bridge/index.ts` `__handleMessage`, extend the switch:

```ts
const ed = getEditor();
if (!ed) return;
switch (cmd.cmd) {
  case 'format':
    applyFormat(ed, cmd.key, cmd.value);
    break;
  case 'insertText':
    ed.commands.insertContent(cmd.text);
    break;
  case 'undo':
    ed.commands.undo();
    break;
  case 'redo':
    ed.commands.redo();
    break;
  case 'insertImage':
    ed.commands.setImage({src: cmd.dataUrl});
    break;
}
```

And register selection tracking inside `__mount`:

```ts
ed.on('selectionUpdate', () => post({type: 'format-change', format: currentFormats(ed)}));
```

- [ ] **Step 3: Dark theme support**

In `shell/index.html` `<style>` add:

```css
body.dark,
body.dark #superdoc {
  background: #1f2937;
}
```

Dispatcher handles `{cmd:'setTheme', dark:boolean}` by toggling `document.body.classList`.

- [ ] **Step 4: Verify + commit**

Rebuild, run app, exercise StyleBar buttons (bold/italic/headings/lists/colors/alignment/font size), confirm toolbar state highlights track selection. Run `npm run lint && npm test`.

```bash
git add -A src/components/editor/superdoc android/app/src/main/assets/superdoc
git commit -m "feat(editor): port formatting commands to superdoc bridge"
```

---

### Task 7: Tables, page breaks, paper size

**Files:**
- Modify: `src/components/editor/superdoc/bridge/index.ts`

**Interfaces:**
- Consumes: tiptap table commands exposed by SuperDoc.
- Produces: `insertTable(rows, cols)`, `addTableRow`, `addTableColumn`, `deleteTableRow`, `deleteTableColumn`, `deleteTable`, `insertPageBreak`, `setPaperSize(paperSize)`.

- [ ] **Step 1: Dispatcher additions**

```ts
case 'insertTable':
  ed.commands.insertTable({rows: Number(cmd.rows) + 1, cols: Number(cmd.cols), withHeaderRow: true});
  break;
case 'addTableRow':
  ed.commands.addRowAfter();
  break;
case 'addTableColumn':
  ed.commands.addColumnAfter();
  break;
case 'deleteTableRow':
  ed.commands.deleteRow();
  break;
case 'deleteTableColumn':
  ed.commands.deleteColumn();
  break;
case 'deleteTable':
  ed.commands.deleteTable();
  break;
case 'insertPageBreak':
  ed.commands.insertContent({type: 'pageBreak'});
  break;
case 'setPaperSize': {
  const sizes: Record<string, [number, number]> = {
    A4: ['210mm', '297mm'],
    Letter: ['216mm', '279mm'],
  };
  const [w, h] = sizes[cmd.paperSize] ?? sizes.A4;
  document.documentElement.style.setProperty('--page-width', w);
  document.documentElement.style.setProperty('--page-height', h);
  break;
}
```

In `shell/index.html` add default page variables and a page rule:

```css
:root {
  --page-width: 210mm;
  --page-height: 297mm;
}
```

- [ ] **Step 2: Device verification**

Insert each table op from TableDialog; verify rows/columns mutate and exported docx reopens correctly in Word. Toggle paper size in settings; page width visibly changes.

- [ ] **Step 3: Commit**

```bash
git add -A src/components/editor/superdoc android/app/src/main/assets/superdoc
git commit -m "feat(editor): tables, page breaks and paper sizing"
```

---

### Task 8: Outline panel + find & replace

**Files:**
- Create: `src/components/editor/superdoc/bridge/docQueries.ts`
- Modify: `src/components/editor/superdoc/bridge/index.ts`

**Interfaces:**
- Consumes: ProseMirror doc traversal.
- Produces: replies `{type:'headings', headings:[{level,text,index}]}` and `{type:'replace-done', count}`.

- [ ] **Step 1: docQueries.ts with pure helpers (TDD)**

Test first — create `src/components/editor/superdoc/__tests__/docQueries.test.ts` using a minimal fake PM doc shape:

```ts
import {collectHeadings, countOccurrences} from '@/components/editor/superdoc/bridge/docQueries';

describe('docQueries', () => {
  it('collects headings with running paragraph index', () => {
    const nodes = [
      {type: {name: 'heading'}, attrs: {level: 1}, textContent: 'Intro'},
      {type: {name: 'paragraph'}, textContent: 'hello world'},
      {type: {name: 'heading'}, attrs: {level: 2}, textContent: 'Method'},
    ];
    expect(collectHeadings(nodes as any)).toEqual([
      {level: 1, text: 'Intro', index: 0},
      {level: 2, text: 'Method', index: 2},
    ]);
  });

  it('counts non-overlapping occurrences', () => {
    expect(countOccurrences('aaaa', 'aa')).toBe(2);
    expect(countOccurrences('', 'x')).toBe(0);
  });
});
```

Implement `docQueries.ts`:

```ts
export interface HeadingInfo {
  level: number;
  text: string;
  index: number;
}

export function collectHeadings(blocks: Array<{type: {name: string}; attrs?: any; textContent: string}>): HeadingInfo[] {
  const out: HeadingInfo[] = [];
  blocks.forEach((node, index) => {
    if (node.type.name === 'heading') {
      out.push({level: node.attrs.level, text: node.textContent, index});
    }
  });
  return out;
}

export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let pos = haystack.indexOf(needle);
  while (pos !== -1) {
    count += 1;
    pos = haystack.indexOf(needle, pos + needle.length);
  }
  return count;
}

export function findReplaceAll(text: string, find: string, replace: string): string {
  if (!find) return text;
  return text.split(find).join(replace);
}
```

Run: `npm test -- docQueries` — PASS.

- [ ] **Step 2: Dispatcher wiring**

```ts
import {collectHeadings, findReplaceAll, countOccurrences} from './docQueries';

case 'getHeadings': {
  const headings = collectHeadings(ed.state.doc.content.content as any);
  post({type: 'headings', headings});
  break;
}
case 'scrollTo': {
  const blockIndex = Number(cmd.index);
  let seen = 0;
  let targetPos = 0;
  ed.state.doc.forEach((node: any, offset: number) => {
    if (seen === blockIndex) targetPos = offset + 1;
    seen += 1;
  });
  ed.commands.focus();
  ed.view.dispatch(
    ed.state.tr.setSelection(TextSelection.near(ed.state.doc.resolve(targetPos))).scrollIntoView(),
  );
  break;
}
case 'findReplace': {
  const {find, replace} = cmd as {find: string; replace: string};
  let count = 0;
  ed.state.doc.descendants((node: any, pos: number) => {
    if (node.isText && node.text.includes(find)) {
      const idx = node.text.indexOf(find);
      ed.view.dispatch(
        ed.state.tr
          .replaceWith(pos + idx, pos + idx + find.length, ed.schema.text(replace))
          .scrollIntoView(),
      );
      count += 1;
    }
  });
  post({type: 'replace-done', count});
  break;
}
```

Import `TextSelection` from `prosemirror-state` (re-exported through superdoc's dependency tree; if unavailable directly, use `ed.state.selection.constructor.near` fallback documented in code).

- [ ] **Step 3: Verify + commit**

OutlinePanel lists headings and jumps; FindReplaceBar replaces and reports counts. `npm run lint && npm test`.

```bash
git add -A src/components/editor/superdoc
git commit -m "feat(editor): outline navigation and find/replace"
```

---

### Task 9: Citations — marker swap + references rebuild

**Files:**
- Modify: `src/components/editor/superdoc/bridge/index.ts`
- Modify: `src/screens/EditorScreen.tsx` (payload prep only)

**Interfaces:**
- Consumes: `replaceCitationMarkers(index, oldMarker, newMarker)` and `replaceReferences(entries: string[])` semantics identical to today: markers are plain text like `[3]`; References section is a heading followed by numbered paragraphs.
- Produces: same `replace-done` reply used by CitationManagerModal flow.

- [ ] **Step 1: Text-level replacement across runs**

Add to `bridge/index.ts`:

```ts
function replaceEverywhere(ed: any, find: string, replace: string): number {
  const positions: Array<{from: number; to: number}> = [];
  ed.state.doc.descendants((node: any, pos: number) => {
    if (node.isText && node.text.includes(find)) {
      const idx = node.text.indexOf(find);
      positions.push({from: pos + idx, to: pos + idx + find.length});
    }
  });
  // apply bottom-up so earlier replacements don't shift later offsets
  positions.reverse().forEach(({from, to}) => {
    ed.view.dispatch(ed.state.tr.replaceWith(from, to, ed.schema.text(replace)));
  });
  return positions.length;
}

case 'replaceCitationMarkers':
  post({
    type: 'replace-done',
    count: replaceEverywhere(ed, cmd.oldMarker, cmd.newMarker),
  });
  break;

case 'replaceReferences': {
  const entries: string[] = cmd.entries;
  // locate the References heading, delete everything after it, re-insert entries
  let refsHeadingPos = -1;
  ed.state.doc.forEach((node: any, offset: number) => {
    if (
      node.type.name === 'heading' &&
      /^references$/i.test(node.textContent.trim())
    ) {
      refsHeadingPos = offset;
    }
  });
  if (refsHeadingPos >= 0) {
    const from = refsHeadingPos + 1;
    const to = ed.state.doc.content.size - 1;
    ed.view.dispatch(ed.state.tr.delete(from, Math.max(from, to)));
    const paras = entries.map(e => ({type: 'paragraph', content: [{type: 'text', text: e}]}));
    ed.commands.insertContentAt(Math.max(from, 1), paras);
  }
  post({type: 'replace-done', count: entries.length});
  break;
}
```

Markers spanning multiple text runs (e.g., partial bolding) won't match `node.isText` scanning — acceptable: markers are inserted programmatically as single runs (Task 10/11 guarantee this); note this invariant in a code comment.

- [ ] **Step 2: Verify + commit**

Swap a citation via CitationManagerModal: all occurrences update; reference list rebuilds in the chosen style. `npm run lint && npm test`.

```bash
git add -A src/components/editor/superdoc src/screens/EditorScreen.tsx
git commit -m "feat(editor): citation marker swap and references rebuild"
```

---

### Task 10: TOC + footnotes

**Files:**
- Modify: `src/components/editor/superdoc/bridge/index.ts`

**Interfaces:**
- Produces: `insertToc` inserts heading list at cursor; `insertFootnote(text)` appends superscript marker + footnote paragraph at end of current block.

- [ ] **Step 1: Dispatcher additions**

```ts
case 'insertToc': {
  const items = collectHeadings(ed.state.doc.content.content as any);
  const tocLines = items.map(
    h => `${'\u00a0'.repeat((h.level - 1) * 4)}${h.level === 1 ? '' : ''}${h.text}`,
  );
  ed.commands.insertContent(
    tocLines.map(t => ({type: 'paragraph', content: [{type: 'text', text: t}]})),
  );
  break;
}

case 'insertFootnote': {
  const seq = footnotesUsed + 1;
  footnotesUsed += 1;
  ed.commands.insertContent([
    {type: 'text', marks: [{type: 'superscript'}], text: String(seq)},
    {type: 'hardBreak'},
    {type: 'text', text: cmd.text},
  ]);
  break;
}
```

with `let footnotesUsed = 0;` module state (reset on `load`). If SuperDoc exposes a native `footnote` node (check `ed.schema.nodes`), prefer it over the manual sequence above:

```ts
if (ed.schema.nodes.footnote) {
  ed.commands.insertContent({type: 'footnote', attrs: {content: cmd.text}});
  break;
}
```

- [ ] **Step 2: Verify + commit**

TOC reflects current headings; footnotes survive export/reopen in Word. `npm run lint && npm test`.

```bash
git add -A src/components/editor/superdoc android/app/src/main/assets/superdoc
git commit -m "feat(editor): toc insertion and footnotes"
```

---

### Task 11: Markdown → DOCX fragment insertion (AI paths)

**Files:**
- Create: `src/utils/markdownToDocxFragments.ts`
- Test: `src/utils/__tests__/markdownToDocxFragments.test.ts`
- Modify: `src/components/editor/superdoc/bridge/index.ts` (`insertMarkdown` command)
- Delete: `src/utils/markdownToQuillDelta.ts` (its remaining importers were removed in Task 5; final deletion lands in Task 15)

**Interfaces:**
- Produces: `markdownToBlocks(md: string): Array<Record<string, unknown>>` returning tiptap JSON blocks (headings, paragraphs, bullet/ordered lists, bold/italic inline).
- Bridge consumes: `{cmd:'insertMarkdown', md}` → `ed.commands.insertContent(markdownToBlocks(cmd.md))`.

- [ ] **Step 1: Failing tests**

```ts
import {markdownToBlocks} from '@/utils/markdownToDocxFragments';

describe('markdownToBlocks', () => {
  it('maps headings by level', () => {
    expect(markdownToBlocks('# Title')).toEqual([
      {type: 'heading', attrs: {level: 1}, content: [{type: 'text', text: 'Title'}]},
    ]);
  });

  it('parses bold and italic inline', () => {
    const [para] = markdownToBlocks('plain **bold** *ital* end');
    expect(para.content).toEqual([
      {type: 'text', text: 'plain '},
      {type: 'text', marks: [{type: 'bold'}], text: 'bold'},
      {type: 'text', text: ' '},
      {type: 'text', marks: [{type: 'italic'}], text: 'ital'},
      {type: 'text', text: ' end'},
    ]);
  });

  it('maps bullets and numbered lists', () => {
    const blocks = markdownToBlocks('- a\n- b\n1. c');
    expect(blocks.filter(b => b.type === 'bulletList')).toHaveLength(1);
    expect(blocks.filter(b => b.type === 'orderedList')).toHaveLength(1);
  });
});
```

Run: `npm test -- markdownToDocxFragments` — FAIL.

- [ ] **Step 2: Implement converter**

Create `src/utils/markdownToDocxFragments.ts`:

```ts
interface InlineMark {
  type: string;
}
interface InlineNode {
  type: 'text';
  text: string;
  marks?: InlineMark[];
}

function parseInline(text: string): InlineNode[] {
  const out: InlineNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    if (m.index > last) out.push({type: 'text', text: text.slice(last, m.index)});
    const token = m[0];
    if (token.startsWith('**')) {
      out.push({type: 'text', text: token.slice(2, -2), marks: [{type: 'bold'}]});
    } else {
      out.push({type: 'text', text: token.slice(1, -1), marks: [{type: 'italic'}]});
    }
    last = m.index + token.length;
  }
  if (last < text.length) out.push({type: 'text', text: text.slice(last)});
  return out.length ? out : [{type: 'text', text}];
}

export function markdownToBlocks(md: string): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = [];
  const lines = md.split('\n');
  let listBuffer: Array<{ordered: boolean; text: string}> = [];

  function flushList(): void {
    if (!listBuffer.length) return;
    const ordered = listBuffer[0].ordered;
    const items = listBuffer.map(li => ({
      type: 'listItem',
      content: [{type: 'paragraph', content: parseInline(li.text)}],
    }));
    blocks.push(ordered ? {type: 'orderedList', content: items} : {type: 'bulletList', content: items});
    listBuffer = [];
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const ordered = /^\d+\.\s+(.*)$/.exec(line);
    if (h) {
      flushList();
      blocks.push({
        type: 'heading',
        attrs: {level: h[1].length},
        content: parseInline(h[2]),
      });
    } else if (bullet) {
      listBuffer.push({ordered: false, text: bullet[1]});
    } else if (ordered) {
      listBuffer.push({ordered: true, text: ordered[1]});
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      blocks.push({type: 'paragraph', content: parseInline(line.trim())});
    }
  }
  flushList();
  return blocks;
}
```

Run: `npm test -- markdownToDocxFragments` — PASS.

- [ ] **Step 3: Bridge command**

```ts
import {markdownToBlocks} from '@/utils/markdownToDocxFragments';

case 'insertMarkdown':
  ed.commands.insertContent(markdownToBlocks(cmd.md));
  break;
```

(The bundler resolves the `@/` alias — add `alias: {'@': './src'}` condition to `scripts/build-superdoc-editor.mjs` esbuild options.)

- [ ] **Step 4: End-to-end AI verification**

Generate a short paper via the pipeline; sections arrive formatted (headings/bold/lists) inside the editor; Chat insert-at-cursor works.

- [ ] **Step 5: Commit**

```bash
git add src/utils/markdownToDocxFragments.ts src/utils/__tests__/markdownToDocxFragments.test.ts src/components/editor/superdoc scripts/build-superdoc-editor.mjs android/app/src/main/assets/superdoc
git commit -m "feat(editor): insert AI markdown as docx fragments"
```

---

### Task 12: Snapshots, duplicate, delete lifecycle

**Files:**
- Modify: `src/screens/EditorScreen.tsx` (snapshot handlers)
- Modify: `src/db/DocumentRepository.ts` (snapshot restore)
- Modify: `src/services/paperFileStore.ts` (+ `restoreFromBase64(id, base64)`)
- Test: extend `src/services/__tests__/paperFileStore.test.ts`

**Interfaces:**
- Snapshot storage: `document_revisions.content` stores **docx base64** (string column, unchanged schema).
- `restoreFromBase64(id, base64)` = `savePaperDocx` + notify editor to reload (`{cmd:'load', b64}`).

- [ ] **Step 1: Add restore test**

Append to `paperFileStore.test.ts`:

```ts
it('restoreFromBase64 delegates to atomic save', async () => {
  const {restoreFromBase64} = require('@/services/paperFileStore');
  await restoreFromBase64('p9', 'QQ==');
  expect(RNFS.moveFile).toHaveBeenCalledWith('/mock/docs/papers/p9.docx.tmp', '/mock/docs/papers/p9.docx');
});
```

Implement `restoreFromBase64 = savePaperDocx` (re-export under the new name).

- [ ] **Step 2: Rewire snapshot flows in EditorScreen**

- `handleSnapshotNow`: `editorRef.current?.getContent(b64 => documentRepository.createSnapshot(documentId, b64, wordCountRef.current))`.
- Restore action in SnapshotsModal flow: fetch revision → `restoreFromBase64(documentId, revision.content)` → `postCmd({cmd:'load', b64: revision.content})` via a new `EditorRef.reloadWith(b64: string)` handle.

```tsx
reloadWith: b64 => postCmd({cmd: 'load', b64}),
```

(`__mount` already guards double-mount; extend it: if `__sd` exists, destroy via `__sd.destroy?.()` before recreating.)

- [ ] **Step 3: Duplicate/delete document lifecycle**

Wherever `documentRepository.duplicate(id)` is called (LibraryScreen card menu), also `await duplicatePaperDocx(newId /* returned by repository */, destId)` — check repository signature; adjust so the caller knows both ids (repository.duplicate already copies `content` path string; overwrite the copy's path afterwards with `update(copy.id, {content: 'papers/' + copy.id + '.docx'})`). For delete: call `deletePaperDocx(id)` alongside `repository.delete`.

- [ ] **Step 4: Verify + commit**

Snapshot → restore round-trip preserves formatting; duplicate/delete leave no orphan files. `npm run lint && npm test`.

```bash
git add -A src
git commit -m "feat(editor): snapshots and file lifecycle on docx storage"
```

---

### Task 13: Import DOCX + export/share rework

**Files:**
- Modify: import flow screen using `docxImport.ts` (locate via `grep -rn docxImport src/`)
- Modify: `src/services/exportContent.ts`
- Delete usages (files removed fully in Task 15): `docxExport.ts`, `docxImport.ts`

**Interfaces:**
- Import: picker URI → `RNFS.copyFile(uri, papers/<newId>.docx)` → create row with `content: papers/<newId>.docx`.
- Export/share: share the stored file directly via `react-native-share` if present, else existing `shareDocx` path adapted to accept a file path instead of building one from Delta.

- [ ] **Step 1: Rework import**

Replace the jszip parsing path with:

```ts
const destRel = `papers/${newId}.docx`;
await ensurePapersDir();
await RNFS.copyFile(pickerUri, `${RNFS.DocumentDirectoryPath}/${destRel}`);
await documentRepository.create(title, {content: destRel});
navigation.navigate('Editor', {documentId: newId});
```

- [ ] **Step 2: Rework export/share**

`exportAndShareDocx(title, content)` callers pass the document row; change to `shareExistingDocx(doc)`:

```ts
export async function shareExistingDocx(doc: {title: string; id: string}): Promise<void> {
  const src = `${RNFS.DocumentDirectoryPath}/papers/${doc.id}.docx`;
  const sharePath = `${RNFS.DocumentDirectoryPath}/${sanitizeTitle(doc.title)}.docx`;
  await RNFS.copyFile(src, sharePath);
  await shareDocx(sharePath, `${sanitizeTitle(doc.title)}.docx`);
}
```

Keep `sanitizeTitle` logic from the old `docxExport.ts` (move it here).

- [ ] **Step 3: Verify + commit**

Import a real-world .docx (from Google Docs export) → opens, editable, saves. Share produces a valid file Word can open. `npm run lint && npm test`.

```bash
git add -A src
git commit -m "feat(io): import copies docx directly; share exports stored file"
```

---

### Task 14: Library "+" — New blank document

**Files:**
- Modify: `src/screens/LibraryScreen.tsx`

**Interfaces:**
- Consumes: `copyBlankTemplate`, `documentRepository.create`.
- Produces: FAB opens choice; "New blank document" creates row + file and navigates to Editor.

- [ ] **Step 1: Add choice UI + handler**

Reuse the existing `sortMenu`/`sortBackdrop` styles pattern for the FAB sheet:

```tsx
const [fabOpen, setFabOpen] = useState(false);

async function createBlankDocument() {
  setFabOpen(false);
  try {
    const doc = await documentRepository.create('Untitled document');
    await copyBlankTemplate(doc.id);
    await documentRepository.update(doc.id, {content: `papers/${doc.id}.docx`});
    navigation.navigate('Editor', {documentId: doc.id});
  } catch (e: unknown) {
    Alert.alert('Could not create document', e instanceof Error ? e.message : 'Unknown error');
  }
}
```

FAB press toggles `fabOpen`; sheet shows two Touchables: "Generate with AI" → `navigation.navigate('Generate')`, "New blank document" → `createBlankDocument()`.

- [ ] **Step 2: Verify + commit**

Both paths work; blank doc opens instantly with title "Untitled document"; empty-state hint text updated to mention both options.

```bash
git add src/screens/LibraryScreen.tsx
git commit -m "feat(library): new blank document option on fab"
```

---

### Task 15: Delete Quill remnants + final verification

**Files:**
- Delete: `src/components/editor/vendor/quill.js`, `vendor/quill.snow.css`, `vendor/quillAssets.ts`, `src/components/editor/quillHtml.ts`, `src/components/editor/__tests__/quillHtml.test.ts`, `src/utils/markdownToQuillDelta.ts`, `src/services/docxExport.ts`, `src/services/docxImport.ts`
- Modify: any file still importing the above (expect none — verified by grep)

- [ ] **Step 1: Delete files and verify no dangling imports**

```bash
rm src/components/editor/quillHtml.ts src/components/editor/__tests__/quillHtml.test.ts \
   src/utils/markdownToQuillDelta.ts src/services/docxExport.ts src/services/docxImport.ts \
   src/components/editor/vendor/quill.js src/components/editor/vendor/quill.snow.css \
   src/components/editor/vendor/quillAssets.ts
grep -rn "quill\|markdownToDeltaJson\|docxExport\|docxImport" src/ --include="*.ts" --include="*.tsx"
```
Expected: no matches (case-insensitive `quill` may hit comments — remove them).

- [ ] **Step 2: Full checks**

Run: `npm run lint && npm test`
Expected: green suite, zero lint errors.

- [ ] **Step 3: Full manual regression checklist (device)**

1. Generate paper end-to-end → editor receives formatted content
2. All StyleBar controls; Table dialog ops; page break; paper size; dark mode
3. Outline jump; find/replace counts; snapshots round-trip; citations swap; TOC; footnotes
4. Import external docx; export/share; duplicate; delete
5. Keyboard dismiss x20 — no white flash
6. Fresh install → library empty → "+" → blank doc works

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore(editor): remove quill and legacy delta/docx converters"
```

---

## Self-Review Notes

- **Spec coverage:** DOCX-native storage (Tasks 2–5), full command parity (Tasks 6–11), error handling incl. cmd-error + no-overwrite-on-failed-export (Task 4), testing strategy (per-task TDD + Task 15 checklist), white-flash fix (Task 5 Step 1), blank-document FAB (Task 14), AGPL pinning (Global Constraints), Milestone-0 IME gate (Task 5 Step 4). ✔
- **Type consistency:** `getEditor()` defined Task 4, reused Tasks 6–10; message names (`docx-autosave`, `docx`, `cmd-error`) consistent between bridge and EditorWebView; `paperFileStore` signatures match all consumers. ✔
- **Known API risks flagged inline:** `ed.on('update')` event name and `activeEditor` accessor have documented fallbacks; footnote node preference checked at runtime (Task 10). These are the two places device verification may force a one-line adjustment, isolated behind adapters.
