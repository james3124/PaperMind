# Editor Power Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add version snapshots, footnotes, auto-TOC, and PDF export to the PaperMind editor.

**Architecture:** Snapshots live in a new WatermelonDB table (schema v2→v3 migration). Footnotes and TOC are WebView-side Quill features (custom blots + commands in `quillHtml.ts`), exposed through `EditorRef`. PDF export is a new service wrapping `react-native-html-to-pdf`.

**Tech Stack:** WatermelonDB 0.27, react-native-webview 14 (vendored Quill v2), react-native-html-to-pdf (new), Jest.

## Global Constraints

- TypeScript strict; `npx tsc --noEmit` must pass after every task.
- Test command: `npx jest <file>` per task; full suite `npx jest` green before final commit.
- No new comments unless matching surrounding style; no emojis in code.
- WebView message/command protocol is JSON `{cmd: ...}` in, `{type: ...}` out.
- Do NOT run `npx eslint` (hangs in this environment).
- Native dep (`react-native-html-to-pdf`) cannot be built here — its verification is `tsc` + mocked unit tests only; device build is manual.

---

### Task 1: Snapshot storage layer

**Files:**
- Modify: `src/db/schema.ts` (version 2→3, add `document_revisions` table)
- Modify: `src/db/migrations/index.ts` (add toVersion 3 step)
- Modify: `src/db/database.ts` (register model class)
- Create: `src/db/models/DocumentRevision.ts`
- Modify: `src/db/DocumentRepository.ts` (snapshot methods)
- Test: `src/db/__tests__/DocumentRepository.test.ts` (extend)

**Interfaces:**
- Produces: `class DocumentRevision extends Model` with fields `documentId`, `content`, `wordCount`, `label`, `createdAt`.
- Produces: `documentRepository.createSnapshot(id: string, content: string, wordCount: number): Promise<DocumentRevision>`; `.listSnapshots(id: string): Promise<DocumentRevision[]>` (newest first); `.restoreSnapshot(documentId: string, revisionId: string): Promise<void>` (writes content back into document); `.deleteSnapshot(revisionId: string): Promise<void>`.

- [ ] **Step 1:** Extend schema: bump `version: 3`; add tableSchema `document_revisions` columns: `document_id string`, `content string`, `word_count number`, `label string optional`, `created_at number`. Add migration entry `{toVersion: 3, steps: [createTable({name: 'document_revisions', columns: [...]})]}` importing `createTable` from `@nozbe/watermelondb/Schema/migrations`.
- [ ] **Step 2:** Create model following `Document.ts` decorators pattern (`@json`, `@field`, `@children` as applicable). Static `table = 'document_revisions'`.
- [ ] **Step 3:** Register in `database.ts` `modelClasses`.
- [ ] **Step 4:** Write failing repo tests (create → list order → restore updates document.content + updated_at → delete), then implement the four methods using existing `database.write(async () => ...)` patterns from DocumentRepository.
- [ ] **Step 5:** Run `npx jest src/db/__tests__/DocumentRepository.test.ts src/db/__tests__/Document.test.ts`, then `npx tsc --noEmit`. Commit `feat(db): document revisions table + snapshot API`.

### Task 2: Footnotes + TOC in the WebView

**Files:**
- Modify: `src/components/editor/quillHtml.ts`
- Test: `src/components/editor/__tests__/quillHtml.test.ts`

**Interfaces:**
- Consumes: existing command dispatcher pattern (`executeCommand`), custom blot precedent (`PageBreakBlot`).
- Produces commands: `{cmd:'insertToc'}`, `{cmd:'insertFootnote', text: string}`. Produces inline blot format name `'footnote-ref'`.

Behavior spec:
- **Footnote marker:** inline superscript blot `FootnoteRefBlot` (tagName `'sup'`, className `'ql-footnote-ref'`, blotName `'footnote-ref'`). CSS: `.ql-footnote-ref { vertical-align: super; font-size: 0.75em; color: #6366f1; cursor: default; }` plus dark variant `#818cf8` inside DARK_CSS. `insertFootnote` computes next number = count of existing footnote markers + 1, inserts blot value `{num}` at cursor, then appends/updates a "Footnotes" section at document end (a paragraph with header attr level 2 text "Footnotes", followed by one line per note: `${num}. ${text}`). Rebuilding the list re-scans markers for numbering consistency. Skip insert when cursor is null or inside table.
- **TOC:** `insertToc` reads headings via same traversal as existing `getHeadings` case; inserts at cursor lines: for each heading, indented plain text line `h1 → no indent`, `h2 → two spaces`, `h3 → four spaces`, each formatted `{link: false}` (plain). If zero headings, do nothing.

- [ ] **Step 1:** Failing tests asserting generated html contains: `'ql-footnote-ref'`, `case 'insertFootnote'`, `case 'insertToc'`, `'Footnotes'` header logic, dark CSS override.
- [ ] **Step 2:** Implement blots/CSS/commands; register `Quill.register(FootnoteRefBlot, true)`.
- [ ] **Step 3:** `npx jest src/components/editor/__tests__/quillHtml.test.ts` + `npx tsc --noEmit`. Commit `feat(editor-web): footnotes and TOC commands`.

### Task 3: EditorRef exposure + toolbar wiring + snapshot UI

**Files:**
- Modify: `src/components/editor/EditorWebView.tsx` (ref methods)
- Create: `src/components/editor/SnapshotsModal.tsx`
- Modify: `src/screens/EditorScreen.tsx`

**Interfaces:**
- Consumes Task 1 repo methods; Task 2 commands.
- Produces: `EditorRef.insertToc(): void`, `EditorRef.insertFootnote(text: string): void`.

- [ ] **Step 1:** Add ref methods posting the new cmds. Add `SnapshotsModal`: props `{visible, snapshots, onRestore(revision), onDelete(revision), onSnapshotNow(), onDismiss}`; simple list rows showing relative date + word count, swipe/long-press delete, header button "Snapshot now".
- [ ] **Step 2:** EditorScreen: load snapshots when opening modal; autosnapshot every 5 min while editor open AND dirty content changed since last snapshot (compare wordCount/content hash) via `useRef` timer in existing effects; on restore → `editorRef.current?.insertDelta` not needed — restore writes DB then reload screen state following the existing `[documentId]` load effect (re-run it). Wire TabToolbar or overflow menu buttons: TOC button calls `editorRef.current?.insertToc()`; footnote flow: prompt dialog (reuse Alert.prompt unavailable on Android → small TextInput modal like LinkDialog pattern) then `insertFootnote(text)`.
- [ ] **Step 3:** `npx tsc --noEmit`. Commit `feat(editor): snapshots UI, TOC and footnote wiring`.

### Task 4: PDF export service

**Files:**
- Modify: `package.json` (add `"react-native-html-to-pdf": "^0.12.0"`)
- Create: `src/services/pdfExport.ts`
- Test: `src/services/__tests__/pdfExport.test.ts`

**Interfaces:**
- Produces: `exportPdf(title: string, deltaJson: string): Promise<string>` (returns share/file path).

- [ ] **Step 1:** `npm install react-native-html-to-pdf@^0.12.0 --save` (package.json change only; native linking documented below).
- [ ] **Step 2:** Service converts delta JSON → semantic HTML (headings, paragraphs, lists, blockquote, sup.footnote-ref, tables) WITHOUT scripts/styles-heavy payload; calls `RNHTMLtoPDF.convert({html, fileName: sanitized title, base64: false})`; resolves `result.filePath`. Mock `react-native-html-to-pdf` in jest.setup if needed (jest.mock in test file).
- [ ] **Step 3:** Failing test first: valid delta produces html containing `<h1>`, `<p>`, `<sup class="footnote-ref">`; convert called once with sanitized filename. Then implement.
- [ ] **Step 4:** Wire an "Export PDF" entry next to existing DOCX export in EditorScreen overflow menu calling the service then `Share.share` the file path (follow `exportAndShareDocx` usage). NOTE: single-file edit — coordinate: this step runs AFTER Task 3 agent completes.
- [ ] **Step 5:** Manual-build note in commit message: requires `cd ios && pod install` / Android gradle sync. Run tests + tsc. Commit `feat(export): PDF export via html-to-pdf`.

## Execution Order & Ownership

| Wave | Agent | Files |
|---|---|---|
| 1 (parallel) | A: Task 1 | db/* only |
| 1 (parallel) | B: Task 2 | quillHtml.ts + test |
| 2 (parallel) | C: Task 3 | EditorWebView, SnapshotsModal, EditorScreen |
| 2 (parallel) | D: Task 4 steps 1–3 | package.json, pdfExport service + test |
| 3 (me) | Task 4 step 4 + integration verify + push | EditorScreen |

Already exists (verified, not in scope): undo/redo toolbar buttons; selection AI actions (AiPanel + handleAiAction + replace-on-insert semantics).
