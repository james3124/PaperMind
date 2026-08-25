import {SuperDoc} from 'superdoc';
import 'superdoc/style.css';

import {blobToBase64} from './exporter';
import {applyFormat, currentFormats} from './formatCommands';
import {createSaveStateTracker} from './saveState';
import {installEngineWorkerUrl, readWorkerEntryMeta} from './engineWorker';
import {markdownToBlocks} from '@/utils/markdownToDocxFragments';
import {
  collectHeadings,
  collectMatchRanges,
  type HeadingNode,
} from './docQueries';
import {
  footnoteContent,
  resolveFootnoteSchema,
  tocParagraphs,
} from './tocFootnotes';
import {
  docFormatCommand,
  docInsertText,
  docInsertMarkdown,
  docUndo,
  docRedo,
  docInsertImage,
  docInsertTable,
  docTableCommand,
  docInsertToc,
  docInsertFootnote,
  docSetPaperSize,
} from './docCommands';
import {reportCmdError} from './docApi';
import {getEditor, post} from './runtime';

const tracker = createSaveStateTracker();
// Highest footnote number handed out in this document session; reset on
// every load/loadBlank so renumbering starts at 1 for each new document.
let footnotesUsed = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const pendingExports = new Map<string, (b64: string) => void>();

async function serializeAndPost(
  kind: 'autosave' | 'reply',
  requestId?: string,
): Promise<void> {
  const sd = (window as any).__sd;
  if (!sd) {
    if (kind === 'reply' && requestId != null) {
      pendingExports.delete(requestId);
      post({type: 'cmd-error', cmd: 'exportNow', requestId});
    }
    return;
  }
  tracker.beginExport();
  let succeeded = false;
  try {
    const result = await sd.export({
      exportType: ['docx'],
      triggerDownload: false,
    });
    if (!(result instanceof Blob)) {
      throw new Error('export did not return a Blob');
    }
    const b64 = await blobToBase64(result);
    tracker.markSaved();
    if (kind === 'autosave') {
      post({type: 'docx-autosave', b64});
    } else {
      pendingExports.get(requestId!)?.(b64);
      pendingExports.delete(requestId!);
    }
    succeeded = true;
  } catch (e: unknown) {
    // failed export must never clear dirty state
    post({type: 'error', message: String(e)});
    if (kind === 'reply' && requestId != null) {
      // release the caller so it can retry cleanly instead of hanging
      pendingExports.delete(requestId);
      post({type: 'cmd-error', cmd: 'exportNow', requestId});
    }
  } finally {
    const stale = tracker.endExportStaleEdits();
    if (stale) {
      // edits raced with this export; surface dirty instead of a stale saved
      markDirty();
    } else if (succeeded) {
      post({type: 'save-state', state: 'saved'});
    }
  }
}

function markDirty(): void {
  const wasClean = !tracker.isDirty();
  tracker.edit();
  if (wasClean) {
    post({type: 'save-state', state: 'dirty'});
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => void serializeAndPost('autosave'), 2000);
}

// Word count runs a full-document textBetween per keystroke; trailing
// debounce keeps the content-change post off the hot path on long papers.
let wordCountTimer: ReturnType<typeof setTimeout> | null = null;

function clearWordCountTimer(): void {
  if (wordCountTimer) {
    clearTimeout(wordCountTimer);
    wordCountTimer = null;
  }
}

function scheduleWordCount(ed: any): void {
  clearWordCountTimer();
  wordCountTimer = setTimeout(() => {
    wordCountTimer = null;
    emitWordCount(ed);
  }, 300);
}

function emitWordCount(ed: any): void {
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
}
/**
 * Replaces every occurrence of `find` with `replace`, including occurrences
 * split across inline formatting inside one block. Matches are collected
 * block-scoped from the current immutable doc snapshot, then applied
 * bottom-up so each replacement cannot shift the offsets of the ones still
 * pending. Count = replacements actually dispatched.
 */
function replaceEverywhere(ed: any, find: string, replace: string): number {
  if (!find) {
    return 0;
  }
  const ranges = collectMatchRanges(ed.state.doc, find);
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    const {from, to} = ranges[i];
    ed.view.dispatch(
      ed.state.tr.replaceWith(from, to, ed.schema.text(replace)),
    );
  }
  return ranges.length;
}

/**
 * Start offset + size of the top-level "References" heading, or null when
 * absent. Match is case-insensitive on trimmed text so DOCX round-trips
 * with stray whitespace or casing drift still resolve.
 */
function findReferencesHeading(ed: any): {offset: number; size: number} | null {
  let found: {offset: number; size: number} | null = null;
  ed.state.doc.forEach((node: any, offset: number) => {
    if (
      node.type.name === 'heading' &&
      /^references$/i.test(node.textContent.trim())
    ) {
      found = {offset, size: node.nodeSize};
    }
  });
  return found;
}

function citationEntryParas(entries: string[]): Array<Record<string, unknown>> {
  return entries.map(text => ({
    type: 'paragraph',
    content: [{type: 'text', text}],
  }));
}

function scrollToBlock(ed: any, blockIndex: number): void {
  let seen = 0;
  let targetPos = -1;
  ed.state.doc.forEach((node: HeadingNode, offset: number) => {
    if (seen === blockIndex) {
      targetPos = offset + 1;
    }
    seen += 1;
  });
  if (targetPos < 0) {
    targetPos = 1;
  }
  // prosemirror-state is bundled inside superdoc and not directly
  // importable, so use the live selection's constructor (TextSelection
  // or a subclass) which carries the static .near resolver.
  const SelCtor = ed.state.selection.constructor;
  ed.view.dispatch(
    ed.state.tr
      .setSelection(SelCtor.near(ed.state.doc.resolve(targetPos)))
      .scrollIntoView(),
  );
}

// Editor instances already wired with update/selectionUpdate listeners.
// Keyed per instance (not a module boolean) so every remount gets fresh
// wiring while double-attaching to the same editor stays impossible.
const wiredEditors = new WeakSet<object>();

// Last posted selection ("from:to") so identical selections are not
// re-broadcast while the caret blinks or format state refreshes.
let lastSelKey = '';

function attachEditorListeners(attempt = 0): void {
  const ed = getEditor();
  if (!ed) {
    // editors register asynchronously on ready; poll briefly as a fallback
    if (attempt < 50) {
      setTimeout(() => attachEditorListeners(attempt + 1), 100);
    } else {
      post({type: 'error', message: 'editor listeners failed to attach'});
    }
    return;
  }
  if (wiredEditors.has(ed)) {
    return;
  }
  wiredEditors.add(ed);
  ed.on('update', () => {
    markDirty();
    scheduleWordCount(ed);
  });
  // Toolbar state must track the caret/selection, and the AI panel needs the
  // selected text (empty selection closes it). Also emitted once right after
  // attach so StyleBar highlights are correct before any navigation.
  lastSelKey = '';
  ed.on('selectionUpdate', () => {
    post({type: 'format-change', format: currentFormats(ed)});
    const sel = ed.state?.selection;
    if (!sel) {
      return;
    }
    const key = `${sel.from}:${sel.to}`;
    if (key !== lastSelKey) {
      lastSelKey = key;
      const text = sel.empty
        ? ''
        : ed.state.doc.textBetween(sel.from, sel.to, '\n');
      post({type: 'selection-text', text});
    }
  });
  post({type: 'format-change', format: currentFormats(ed)});
}

declare global {
  interface Window {
    __handleMessage?: (data: string) => void;
    __mount?: (b64?: string) => void;
  }
}

/**
 * True while the currently mounted SuperDoc was created from a supplied
 * document (as opposed to a blank DOCX). Lets a no-arg loadBlank onto an
 * already-blank mount stay an explicit idempotent no-op.
 */
let mountedWithDocument = false;

// The DOCX engine boots a module worker; without the documented override
// global its import.meta-based URL resolution throws under this classic
// (non-module) bundle and SuperDoc mounts an empty stub. Prepare once, then
// let every mount reuse it. Failures are non-fatal: startSuperDoc still runs
// and reports engine errors through the normal error channel.
let enginePrepared: Promise<void> | null = null;

function prepareEngineWorker(): Promise<void> {
  if (!enginePrepared) {
    enginePrepared = installEngineWorkerUrl({
      entryPath: readWorkerEntryMeta(document),
      // Surfaced through the RN log so device logcat shows exactly which
      // install strategy won; 'direct' means the blob paths failed and the
      // module worker will almost certainly not boot.
      onInstalled: ({strategy}) =>
        post({type: 'engine-debug', message: `worker install: ${strategy}`}),
    }).then(
      () => undefined,
      () => undefined,
    );
  }
  return enginePrepared;
}

function startSuperDoc(b64?: string): void {
  // A pending word-count post from the outgoing document must never fire
  // against the replacement doc.
  clearWordCountTimer();
  let docFile: Blob | undefined;
  if (typeof b64 === 'string') {
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    docFile = new Blob([bin], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }
  // With no document supplied, SuperDoc starts a blank DOCX.
  (window as any).__sd = new SuperDoc({
    selector: '#superdoc',
    toolbar: '#superdoc-toolbar',
    documentMode: 'editing',
    ...(docFile ? {document: docFile} : {}),
    onReady: () => {
      attachEditorListeners();
      const ed = getEditor();
      if (ed) {
        emitWordCount(ed);
      }
      post({type: 'ready'});
    },
    onContentError: ({error}: any) =>
      post({type: 'error', message: String(error)}),
    onException: ({error}: any) =>
      post({type: 'error', message: String(error)}),
  });
  mountedWithDocument = docFile != null;
}

window.__mount = (b64?: string) => {
  const existing = (window as any).__sd;
  if (!existing) {
    startSuperDoc(b64);
    return;
  }
  // Explicit idempotence edge only: blank loadBlank onto an already-blank
  // mount. Anything else replaces the document (teardown + recreate).
  if (b64 == null && !mountedWithDocument) {
    return;
  }
  const finishReplace = () => {
    // A pending autosave from the outgoing document must never fire
    // against the replacement doc.
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    delete (window as any).__sd;
    startSuperDoc(b64);
  };
  const destroyed =
    typeof existing.destroy === 'function' ? existing.destroy() : undefined;
  if (destroyed && typeof destroyed.then === 'function') {
    // destroy may be async; recreate once it settles either way so a
    // failed teardown can never wedge the webview without a document.
    destroyed.catch(() => {}).then(finishReplace);
  } else {
    finishReplace();
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
    footnotesUsed = 0;
    void prepareEngineWorker().then(() => window.__mount!(cmd.b64));
  }
  if (cmd.cmd === 'loadBlank') {
    footnotesUsed = 0;
    void prepareEngineWorker().then(() => window.__mount!());
  }
  if (cmd.cmd === 'exportNow') {
    const requestId = cmd.requestId ?? '0';
    pendingExports.set(requestId, (b64: string) =>
      post({type: 'docx', b64, requestId}),
    );
    void serializeAndPost('reply', requestId);
  }
  switch (cmd.cmd) {
    case 'format': {
      // v2 Document API first; fall back to the v1 TipTap surface when the
      // facade is missing or rejects the operation.
      const docErr = docFormatCommand(cmd.key, cmd.value);
      if (docErr == null) {
        break;
      }
      const ed = getEditor();
      if (ed && applyFormat(ed, cmd.key, cmd.value)) {
        break;
      }
      reportCmdError('format', docErr ?? 'no editor');
      break;
    }
    case 'insertText': {
      const text = typeof cmd.text === 'string' ? cmd.text : null;
      const docErr = text == null ? 'missing text' : docInsertText(text);
      if (docErr == null) {
        break;
      }
      const ed = getEditor();
      if (
        ed &&
        text != null &&
        typeof ed.commands?.insertContent === 'function'
      ) {
        ed.commands.insertContent(text);
        break;
      }
      reportCmdError('insertText', docErr ?? 'no editor');
      break;
    }
    case 'insertMarkdown': {
      const md = typeof cmd.md === 'string' ? cmd.md : null;
      const docErr = md == null ? 'missing markdown' : docInsertMarkdown(md);
      if (docErr == null) {
        break;
      }
      const ed = getEditor();
      if (ed && md != null) {
        try {
          ed.commands.insertContent(markdownToBlocks(md));
          break;
        } catch (e: unknown) {
          reportCmdError('insertMarkdown', String(e));
          post({type: 'error', message: String(e)});
          break;
        }
      }
      reportCmdError('insertMarkdown', docErr ?? 'no editor');
      break;
    }
    case 'undo':
    case 'redo': {
      const docErr = cmd.cmd === 'undo' ? docUndo() : docRedo();
      if (docErr == null) {
        break;
      }
      const ed = getEditor();
      if (ed && typeof ed.commands?.[cmd.cmd] === 'function') {
        ed.commands[cmd.cmd]();
        break;
      }
      reportCmdError(cmd.cmd, docErr ?? 'no editor');
      break;
    }
    case 'insertImage': {
      const dataUrl = typeof cmd.dataUrl === 'string' ? cmd.dataUrl : null;
      const docErr =
        dataUrl == null ? 'missing image data' : docInsertImage(dataUrl);
      if (docErr == null) {
        break;
      }
      const ed = getEditor();
      if (
        ed &&
        dataUrl != null &&
        typeof ed.commands?.setImage === 'function'
      ) {
        ed.commands.setImage({src: dataUrl});
        break;
      }
      reportCmdError('insertImage', docErr ?? 'no editor');
      break;
    }
    case 'setTheme': {
      document.body.classList.toggle('dark', cmd.dark === true);
      break;
    }
    case 'insertTable': {
      const rows = Number(cmd.rows);
      const cols = Number(cmd.cols);
      const docErr =
        Number.isFinite(rows) && Number.isFinite(cols)
          ? docInsertTable(rows, cols)
          : 'missing table dimensions';
      if (docErr == null) {
        break;
      }
      const ed = getEditor();
      if (!ed || typeof ed.commands?.insertTable !== 'function') {
        reportCmdError('insertTable', docErr ?? 'no editor');
        break;
      }
      try {
        ed.commands.insertTable({
          rows: rows + 1,
          cols,
          withHeaderRow: true,
        });
      } catch (e: unknown) {
        reportCmdError('insertTable', String(e));
        post({type: 'error', message: String(e)});
      }
      break;
    }
    case 'addTableRow':
    case 'addTableColumn':
    case 'deleteTableRow':
    case 'deleteTableColumn':
    case 'deleteTable': {
      // Document API against the live table context first.
      const docErr = docTableCommand(cmd.cmd);
      if (docErr == null) {
        break;
      }
      const ed = getEditor();
      const tableCmd: Record<string, string> = {
        addTableRow: 'addRowAfter',
        addTableColumn: 'addColumnAfter',
        deleteTableRow: 'deleteRow',
        deleteTableColumn: 'deleteColumn',
        deleteTable: 'deleteTable',
      };
      const fn = tableCmd[cmd.cmd];
      if (!ed || typeof ed.commands?.[fn] !== 'function') {
        reportCmdError(cmd.cmd, docErr ?? 'no editor');
        break;
      }
      try {
        ed.commands[fn]();
      } catch (e: unknown) {
        // table mutations throw when the caret is outside a table
        reportCmdError(cmd.cmd, String(e));
        post({type: 'error', message: String(e)});
      }
      break;
    }
    case 'insertPageBreak': {
      const ed = getEditor();
      if (!ed || !ed.state?.schema?.nodes || !ed.state.schema.nodes.pageBreak) {
        reportCmdError('insertPageBreak', 'pageBreak node unavailable');
        break;
      }
      try {
        ed.commands.focus();
        ed.commands.insertContent({type: 'pageBreak'});
      } catch (e: unknown) {
        reportCmdError('insertPageBreak', String(e));
        post({type: 'error', message: String(e)});
      }
      break;
    }
    case 'setPaperSize': {
      const sizes: Record<string, [string, string]> = {
        a4: ['210mm', '297mm'],
        letter: ['216mm', '279mm'],
        a5: ['148mm', '210mm'],
        a3: ['297mm', '420mm'],
      };
      const requested = typeof cmd.paperSize === 'string' ? cmd.paperSize : '';
      const size = sizes[requested] ?? sizes.a4;
      if (!sizes[requested]) {
        // Unknown sizes silently fell back to A4 before; keep the behavior
        // but make it diagnosable from logcat.
        console.warn(`[superdoc] unknown paper size "${requested}", using a4`);
      }
      // The v2 layout engine derives page geometry from DOCX section
      // properties, so the real change happens through sections.setPageSetup.
      // The CSS variables stay in sync purely as shell defaults.
      const docErr = docSetPaperSize(requested || 'a4');
      if (docErr != null) {
        reportCmdError('setPaperSize', docErr);
      }
      document.documentElement.style.setProperty('--page-width', size[0]);
      document.documentElement.style.setProperty('--page-height', size[1]);
      break;
    }
    case 'getHeadings': {
      const ed = getEditor();
      if (!ed) {
        post({type: 'cmd-error', cmd: 'getHeadings'});
        post({type: 'headings', headings: []});
        break;
      }
      try {
        const headings = collectHeadings(
          ed.state.doc.content.content as HeadingNode[],
        );
        post({type: 'headings', headings});
      } catch (e: unknown) {
        post({type: 'cmd-error', cmd: 'getHeadings'});
        post({type: 'error', message: String(e)});
      }
      break;
    }
    case 'scrollTo': {
      const ed = getEditor();
      if (!ed) {
        post({type: 'cmd-error', cmd: 'scrollTo'});
        break;
      }
      try {
        scrollToBlock(ed, Number(cmd.index));
      } catch (e: unknown) {
        post({type: 'cmd-error', cmd: 'scrollTo'});
        post({type: 'error', message: String(e)});
      }
      break;
    }
    case 'findReplace': {
      const ed = getEditor();
      if (!ed || typeof cmd.find !== 'string' || cmd.find.length === 0) {
        post({type: 'cmd-error', cmd: 'findReplace'});
        post({type: 'replace-done', count: 0});
        break;
      }
      try {
        const count = replaceEverywhere(
          ed,
          cmd.find,
          typeof cmd.replace === 'string' ? cmd.replace : '',
        );
        post({type: 'replace-done', count});
      } catch (e: unknown) {
        post({type: 'cmd-error', cmd: 'findReplace'});
        post({type: 'error', message: String(e)});
        // Always settle the bar; FindReplaceBar waits on replace-done.
        post({type: 'replace-done', count: 0});
      }
      break;
    }
    case 'replaceCitationMarkers': {
      // Uses the same block-scoped routine as findReplace, so markers split
      // across runs by partial formatting are replaced too.
      const ed = getEditor();
      if (!ed || typeof cmd.oldMarker !== 'string') {
        post({type: 'cmd-error', cmd: 'replaceCitationMarkers'});
        post({type: 'replace-done', count: 0});
        break;
      }
      try {
        const count = replaceEverywhere(
          ed,
          cmd.oldMarker,
          typeof cmd.newMarker === 'string' ? cmd.newMarker : '',
        );
        post({type: 'replace-done', count});
      } catch (e: unknown) {
        post({type: 'cmd-error', cmd: 'replaceCitationMarkers'});
        post({type: 'error', message: String(e)});
        post({type: 'replace-done', count: 0});
      }
      break;
    }
    case 'replaceReferences': {
      const ed = getEditor();
      if (!ed || !Array.isArray(cmd.entries)) {
        post({type: 'cmd-error', cmd: 'replaceReferences'});
        post({type: 'replace-done', count: 0});
        break;
      }
      try {
        const entries: string[] = cmd.entries.map(String);
        const heading = findReferencesHeading(ed);
        if (heading) {
          // wipe everything after the heading, then rebuild the list.
          // (heading.offset + heading.size = first position past the
          // heading node; deleting to content.size clears the tail.)
          const from = heading.offset + heading.size;
          ed.view.dispatch(
            ed.state.tr.delete(from, Math.max(from, ed.state.doc.content.size)),
          );
          if (entries.length > 0) {
            ed.commands.insertContentAt(from, citationEntryParas(entries));
          }
        } else {
          // Deviation from plan: no References section exists (e.g. blank
          // doc or renamed heading), so append one at document end instead
          // of silently dropping the entries.
          ed.commands.insertContentAt(ed.state.doc.content.size, [
            {
              type: 'heading',
              attrs: {level: 1},
              content: [{type: 'text', text: 'References'}],
            },
            ...citationEntryParas(entries),
          ]);
        }
        post({type: 'replace-done', count: entries.length});
      } catch (e: unknown) {
        post({type: 'cmd-error', cmd: 'replaceReferences'});
        post({type: 'error', message: String(e)});
        post({type: 'replace-done', count: 0});
      }
      break;
    }
    case 'insertToc': {
      // Prefer a real TOC field through create.tableOfContents.
      const docErr = docInsertToc();
      if (docErr == null) {
        break;
      }
      const ed = getEditor();
      if (!ed) {
        reportCmdError('insertToc', docErr ?? 'no editor');
        break;
      }
      try {
        const headings = collectHeadings(
          ed.state.doc.content.content as HeadingNode[],
        );
        // Legacy parity: a document with no headings gets no TOC.
        if (headings.length > 0) {
          ed.commands.insertContent(tocParagraphs(headings));
        } else {
          reportCmdError('insertToc', 'document has no headings');
        }
      } catch (e: unknown) {
        reportCmdError('insertToc', String(e));
        post({type: 'error', message: String(e)});
      }
      break;
    }
    case 'insertFootnote': {
      const text = typeof cmd.text === 'string' ? cmd.text : null;
      if (text == null) {
        reportCmdError('insertFootnote', 'missing footnote text');
        break;
      }
      // The host runtime inserts at the caret natively — prefer that.
      const docErr = docInsertFootnote(text);
      if (docErr == null) {
        break;
      }
      const ed = getEditor();
      if (!ed) {
        reportCmdError('insertFootnote', docErr ?? 'no editor');
        break;
      }
      try {
        const shape = resolveFootnoteSchema(ed.state.schema);
        if (shape.hasFootnoteNode) {
          // Native footnote node numbers itself; the manual counter stays
          // untouched so it never drifts if both paths are ever mixed.
          ed.commands.insertContent(footnoteContent(0, text, shape));
        } else {
          // Increment only after the dispatch succeeded so a failed
          // insert never burns a footnote number.
          ed.commands.insertContent(
            footnoteContent(footnotesUsed + 1, text, shape),
          );
          footnotesUsed += 1;
        }
      } catch (e: unknown) {
        reportCmdError('insertFootnote', String(e));
        post({type: 'error', message: String(e)});
      }
      break;
    }
  }
};
