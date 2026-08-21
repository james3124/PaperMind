# Editor Improvements — Design

Date: 2026-08-22
Scope: PaperMind Quill-in-WebView editor (`src/components/editor/`, `src/screens/EditorScreen.tsx`)

## Goals

Fix correctness bugs, remove typing-lag bottlenecks, polish UX, and add writing features — shipped as three independently verifiable phases.

## Phase 1 — Correctness & Performance

### P1.1 `</script>` injection breaks the editor (bug)
`buildQuillHtml` interpolates user content into an inline `<script>` template literal. Content containing `</script` terminates the script tag → blank editor.
**Fix:** escape `<\/script` sequences when building the escaped content string.

### P1.2 Double command execution (bug)
`handleMessage` is registered on both `document` and `window`. On platforms firing both, commands execute twice (e.g., double-inserted text).
**Fix:** guard so a command payload executes only once per message id/timestamp; keep both listeners for platform compat.

### P1.3 deleteTable deletes a character instead of the table (bug)
`deleteTable` calls `quill.deleteText(range.index, 1)`.
**Fix:** resolve the table blot from the DOM node (`Quill.find(table)`), compute `quill.getIndex(blot)`, delete length 1 there.

### P1.4 Per-keystroke full-document bridge posts (perf)
`postContentChange` serialises the whole delta + full text on every keystroke.
**Fix:** trailing debounce (~250 ms) inside the WebView; flush immediately on blur/selection-null and before `getContent`. Word count computed only at send time.

### P1.5 findReplace posts once per match (perf)
**Fix:** perform all replacements, then emit a single `replace-done`; suppress intermediate content-change storms by batching into one update where feasible (or temporarily detaching the text-change handler and emitting one change after).

### P1.6 HTML rebuilt every render (perf)
`EditorWebView.tsx:49` recomputes `buildQuillHtml` each render; `source={{html}}` gets a new object identity.
**Fix:** `useMemo` on `[initialContent, paperSize]`.

## Phase 2 — UX Polish

### P2.1 Save-state indicator
WebView emits `save-state` (`dirty` on debounced change queued, `saved` after flush). EditorScreen shows "Saving…"/"Saved ✓" chip near word count.

### P2.2 Loading state
Replace plain "Loading editor…" text with spinner + skeleton shimmer; auto-hide on `ready` (already wired via `editorReady`).

### P2.3 Dark mode surface
`buildQuillHtml(initialContent, paperSize, opts?: {dark?: boolean})`: dark palette CSS variables (paper #1f2937, text #e5e7eb, page bg #111827, table borders #374151). Wired from app theme setting in EditorScreen.

## Phase 3 — Writing Features

### P3.1 Markdown shortcuts
Input-rule handler in WebView: `# `/`## `/`### ` + space → header 1–3; `- `/`* ` + space → bullet; `1. ` + space → numbered list; `> ` + space → blockquote. Implemented via Quill `text-change` diff inspection (no external module).

### P3.2 Font size control
New `setFontSize` command using existing `SpacingAttributor` pattern (style attributor `fontsize`). StyleBar gains a compact size stepper (A-, A+ cycling 14/16/18/20 px).

### P3.3 Word-count goal
Optional daily/document target in settings; progress shown next to word count (e.g., "812 / 1500").

## Error handling
Existing `window.onerror` → RN `console.warn` path covers all new JS. New features fail silent-but-visible (no crash loops); malformed deltas are caught as today.

## Testing
Each phase extends `__tests__/quillHtml.test.ts` (HTML contract assertions) and component tests where applicable. Full `tsc --noEmit` + `npm test` green at each wave boundary.

## File ownership (parallel execution)

| Domain | Files |
|---|---|
| A (WebView internals) | `src/components/editor/quillHtml.ts`, its test |
| B (RN shell) | `src/components/editor/EditorWebView.tsx`, `src/screens/EditorScreen.tsx` |

Waves run sequentially (A+B parallel within a wave) to avoid cross-file conflicts.
