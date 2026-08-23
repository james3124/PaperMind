# Design: Replace Quill with SuperDoc (DOCX-native editor)

Date: 2026-08-22
Status: Approved design, pending implementation plan

## Goal

Replace the Quill.js-based editor with [SuperDoc](https://github.com/superdoc/docx-editor) so papers are stored, edited, imported, and exported as **real DOCX documents** — no more lossy Delta↔HTML↔DOCX conversions.

## Context

PaperMind is an Android React Native app. Today:

- The editor is vendored Quill.js running inside `react-native-webview` (`EditorWebView.tsx`).
- Papers are stored as **Quill Delta JSON** in the WatermelonDB `content` column.
- `quillHtml.ts` (717 lines) builds the entire WebView page as an HTML string.
- ~20 bridge commands flow RN→WebView as JSON (`format`, `insertTable`, `replaceReferences`, `insertToc`, `insertFootnote`, `findReplace`, …); results flow back as typed messages (`content-change`, `headings`, `save-state`, …).
- The AI pipeline generates markdown, converted by `markdownToQuillDelta.ts`.
- DOCX import/export uses jszip + react-native-fs.

SuperDoc v2 is a browser library (OOXML-backed, edits write back to document XML). It has **no native React Native port**, so the WebView stays — but everything inside it changes.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Integration model | SuperDoc core package inside existing WebView | Only viable path in RN; keeps offline-first |
| Document format | Real `.docx` per paper on disk | User goal: DOCX-native; export = share the file |
| Existing Delta JSON data | Fresh start, no migration | No real users yet |
| Feature scope | Full parity with all ~20 bridge commands in one pass | Per user decision |
| HTML strategy | Tiny static HTML shell + esbuild-bundled JS/CSS assets | Avoids the 717-line HTML-string pattern entirely; all logic in testable TS |
| React wrapper (`@superdoc/react`) | Not used | It targets React DOM web apps; our WebView contains no React |

## Architecture

```
┌─ RN App (React Native) ─────────────────────────────────────┐
│ EditorScreen, StyleBar, OutlinePanel, modals — UNCHANGED     │
│ (same EditorRef imperative API)                              │
│        │ postCmd / onMessage   (existing JSON bridge)        │
│ ┌─ WebView ───────────────────────────────────────────────┐  │
│ │ index.html  (~20 lines: #superdoc-toolbar, #superdoc,   │  │
│ │              <script src="superdoc.js">)                │  │
│ │  superdoc.js / superdoc.css ← esbuild bundle of         │  │
│ │    superdocBridge.ts (imports 'superdoc')               │  │
│ │  • new SuperDoc({selector, document: Blob, ...})        │  │
│ │  • command dispatcher — same cmd names as today         │  │
│ │  • DOCX bytes ⇄ base64 over the bridge                  │  │
│ └─────────────────────────────────────────────────────────┘  │
│ paperFileStore.ts — RNFS read/write/delete                   │
│   ${DocumentDirectoryPath}/papers/<paperId>.docx             │
└──────────────────────────────────────────────────────────────┘
DB `content` column now stores the file path (`papers/<id>.docx`).
```

### Build step

New script `scripts/build-superdoc-asset.mjs` (esbuild):

1. Bundles `src/components/editor/superdoc/superdocBridge.ts` (entry) with the `superdoc` npm package into `vendor/superdoc/superdoc.js`.
2. Emits SuperDoc CSS to `vendor/superdoc/superdoc.css`.
3. Copies the static shell `vendor/superdoc/index.html`.
4. Wired as a pre-metro/bundle step so CI APK builds include fresh assets.

Pin the resolved `superdoc` npm version before shipping (per upstream guidance).

### Bridge contract

RN side (`EditorWebView.tsx`) keeps its exact public interface: same `EditorRef` methods, same command names over `postCmd`, same incoming message types. Only the WebView-side implementation is rewritten.

SuperDoc lifecycle used by the bridge:

```js
const superdoc = new SuperDoc({
  selector: '#superdoc',
  toolbar: '#superdoc-toolbar',
  documentMode: 'editing',
  document: blobFromBase64(initialDocxB64),
  onReady: () => send({type: 'ready'}),
  onContentError: ({error}) => send({type: 'error', message: String(error)}),
  onException: ({error}) => send({type: 'error', message: String(error)}),
});
```

Save path (autosave and explicit export):

```js
const result = await superdoc.export({
  exportType: ['docx'],
  triggerDownload: false,   // returns Blob instead of browser download
});
// Blob → base64 → {type:'docx-saved', b64} → paperFileStore writes to disk
```

## New / changed components

| Unit | Purpose |
|---|---|
| `scripts/build-superdoc-asset.mjs` | esbuild bundling step producing the three vendor assets |
| `vendor/superdoc/index.html` | Static ~20-line shell (toolbar div, editor div, script/css tags) |
| `src/components/editor/superdoc/superdocBridge.ts` | All in-WebView logic: mounts SuperDoc, dispatches the ~20 commands against the SuperDoc/ProseMirror API, emits the existing message types, serializes exports to base64 |
| `buildSuperdocHtml()` (in `EditorWebView.tsx` or helper) | Returns the static shell content; initial DOCX base64 and theme/paper-size config pass through the bridge after `ready`, not via HTML templating |
| `src/services/paperFileStore.ts` | Save/load/delete `.docx` per paper id; debounced autosave orchestration |
| `markdownToDocxFragment.ts` | AI markdown → DOCX fragment inserted at cursor (replaces `markdownToQuillDelta.ts`) |
| Citation/reference handling (inside `superdocBridge.ts`) | Markers remain plain text like `[12]`; References section is a generated heading rebuilt by `replaceReferences` — identical semantics on DOCX text runs |

**Deleted:** `vendor/quill.js`, `vendor/quill.snow.css`, `vendor/quillAssets.ts`, `quillHtml.ts`, `__tests__/quillHtml.test.ts`, `utils/markdownToQuillDelta.ts`.

## Key flows

- **Open paper:** read `<id>.docx` from disk → base64 → WebView → build Blob → mount SuperDoc → `ready`.
- **Edit:** SuperDoc change events → throttled `content-change` (word count) + `save-state: dirty` → autosave timer → `export({triggerDownload:false})` → base64 → `paperFileStore.save()` → `save-state: saved`.
- **AI insert at cursor:** pipeline markdown → `markdownToDocxFragment` → insert command at current selection.
- **Import DOCX:** document picker → copy file into `papers/<id>.docx` → open normally (replaces jszip import path).
- **Export/share:** the stored file *is* the DOCX export — share via existing share sheet.
- **Paper size / dark mode:** applied via bridge command adjusting page setup/CSS variables at runtime.

## Error handling

- WebView script errors keep using the existing `error` message channel.
- Corrupt/unopenable DOCX: `onContentError` → non-blocking toast in `EditorScreen`; last-good bytes on disk are never overwritten (failed export ⇒ no write).
- Every bridge command failure replies `{type:'cmd-error', cmd}` so pending RN-side callbacks resolve instead of hanging.
- Autosave failures surface `save-state: dirty` persistently plus a warning toast; retry on next change.

## Testing

- Jest unit tests: `paperFileStore` (mocked RNFS), `markdownToDocxFragment`.
- Port format-agnostic cases from `quillHtml.test.ts` (find/replace counting, reference rebuild ordering) against the new pure helpers.
- Bridge contract tests where feasible headlessly (jsdom); otherwise a manual smoke checklist covering all 20 commands, both themes, and paper sizes.

## Additional scope

### 1. Fix white screen when dismissing the keyboard while typing

Reported bug: during paper creation/editing, dismissing the soft keyboard makes the screen flash/go white. Root cause is almost certainly the WebView repaint/relayout when Android resizes the window for the keyboard.

Fix approach (investigate in this order):

1. Give the WebView, its RN container, and the page's `html`/`body`/editor elements matching non-transparent background colors so no unpainted frame shows during resize.
2. Keep WebView layout stable across keyboard transitions (e.g., `windowSoftInputMode` adjustment, avoiding full-height re-measure) instead of letting the surface shrink/redraw.
3. If flashing persists, test `androidLayerType` settings (`'none'` vs `'hardware'`) on the WebView.

Verify: open editor, type, dismiss keyboard repeatedly on a physical device — no white flash.

### 2. "+" button can create a new blank document

Today the Library FAB only navigates to the AI Generate flow (`LibraryScreen.tsx:125`). Change:

- FAB opens a small action sheet with two options: **"Generate with AI"** (existing behavior) and **"New blank document"**.
- "New blank document": copy a pre-made minimal `blank.docx` template shipped in the APK assets to `papers/<newId>.docx`, create the DB row pointing at it, navigate straight into the Editor.
- A bundled template file (rather than generating DOCX bytes in JS) keeps this instant and fully offline; SuperDoc opens the template normally.

## Risks

- **Android IME/keyboard behavior inside WebView** with a ProseMirror-based editor needs early validation — Milestone 0 is bare open-edit-save in the WebView before any feature port.
- **License:** SuperDoc is AGPL-3.0 (commercial license available). Acceptable while PaperMind remains open source under a compatible license.
- **APK size** grows roughly by the SuperDoc bundle (~5–10 MB).
- Some Quill-era behaviors (e.g., footnote insertion styling) may map imperfectly to OOXML; fallbacks documented during implementation.
