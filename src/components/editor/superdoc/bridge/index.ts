import {SuperDoc} from 'superdoc';
import 'superdoc/style.css';

import {blobToBase64} from './exporter';
import {applyFormat, currentFormats} from './formatCommands';
import {createSaveStateTracker} from './saveState';
import {markdownToBlocks} from '@/utils/markdownToDocxFragments';
import {
  collectHeadings,
  findAllOccurrences,
  type HeadingNode,
} from './docQueries';
import {
  footnoteContent,
  resolveFootnoteSchema,
  tocParagraphs,
} from './tocFootnotes';

const tracker = createSaveStateTracker();
// Highest footnote number handed out in this document session; reset on
// every load/loadBlank so renumbering starts at 1 for each new document.
let footnotesUsed = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const pendingExports = new Map<string, (b64: string) => void>();

function getEditor(): any {
  const sd = (window as any).__sd;
  return sd ? sd.activeEditor ?? sd.editor ?? sd.editors?.[0] : null;
}

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
 * Replaces every occurrence of `find` with `replace` across all text nodes.
 * Positions are collected first from the current immutable doc snapshot,
 * then applied bottom-up so each replacement cannot shift the offsets of
 * the ones still pending. Count = replacements actually dispatched.
 */
function replaceEverywhere(ed: any, find: string, replace: string): number {
  if (!find) {
    return 0;
  }
  const positions: Array<{from: number; to: number}> = [];
  ed.state.doc.descendants((node: any, pos: number) => {
    if (node.isText && typeof node.text === 'string') {
      findAllOccurrences(node.text, find).forEach((offset: number) => {
        positions.push({from: pos + offset, to: pos + offset + find.length});
      });
    }
  });
  positions
    .reverse()
    .forEach(({from, to}) =>
      ed.view.dispatch(
        ed.state.tr.replaceWith(from, to, ed.schema.text(replace)),
      ),
    );
  return positions.length;
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
    emitWordCount(ed);
  });
  // Toolbar state must track the caret/selection; also emit once right
  // after attach so StyleBar highlights are correct before any navigation.
  ed.on('selectionUpdate', () =>
    post({type: 'format-change', format: currentFormats(ed)}),
  );
  post({type: 'format-change', format: currentFormats(ed)});
}

export function post(msg: Record<string, unknown>): void {
  const rn = (window as any).ReactNativeWebView;
  if (rn) {
    rn.postMessage(JSON.stringify(msg));
  }
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

function startSuperDoc(b64?: string): void {
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
    window.__mount!(cmd.b64);
  }
  if (cmd.cmd === 'loadBlank') {
    footnotesUsed = 0;
    window.__mount!();
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
      const ed = getEditor();
      if (!ed || !applyFormat(ed, cmd.key, cmd.value)) {
        post({type: 'cmd-error', cmd: 'format'});
      }
      break;
    }
    case 'insertText': {
      const ed = getEditor();
      if (ed) {
        ed.commands.insertContent(cmd.text);
      }
      break;
    }
    case 'insertMarkdown': {
      const ed = getEditor();
      if (ed && typeof cmd.md === 'string') {
        try {
          ed.commands.insertContent(markdownToBlocks(cmd.md));
        } catch (e: unknown) {
          post({type: 'cmd-error', cmd: 'insertMarkdown'});
          post({type: 'error', message: String(e)});
        }
      }
      break;
    }
    case 'undo':
    case 'redo': {
      const ed = getEditor();
      if (ed) {
        ed.commands[cmd.cmd]();
      }
      break;
    }
    case 'insertImage': {
      const ed = getEditor();
      if (ed && typeof cmd.dataUrl === 'string') {
        ed.commands.setImage({src: cmd.dataUrl});
      }
      break;
    }
    case 'setTheme': {
      document.body.classList.toggle('dark', cmd.dark === true);
      break;
    }
    case 'insertTable': {
      const ed = getEditor();
      if (!ed) {
        post({type: 'cmd-error', cmd: 'insertTable'});
        break;
      }
      try {
        ed.commands.insertTable({
          rows: Number(cmd.rows) + 1,
          cols: Number(cmd.cols),
          withHeaderRow: true,
        });
      } catch (e: unknown) {
        post({type: 'cmd-error', cmd: 'insertTable'});
        post({type: 'error', message: String(e)});
      }
      break;
    }
    case 'addTableRow':
    case 'addTableColumn':
    case 'deleteTableRow':
    case 'deleteTableColumn':
    case 'deleteTable': {
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
        post({type: 'cmd-error', cmd: cmd.cmd});
        break;
      }
      try {
        ed.commands[fn]();
      } catch (e: unknown) {
        // table mutations throw when the caret is outside a table
        post({type: 'cmd-error', cmd: cmd.cmd});
        post({type: 'error', message: String(e)});
      }
      break;
    }
    case 'insertPageBreak': {
      const ed = getEditor();
      if (!ed || !ed.state?.schema?.nodes || !ed.state.schema.nodes.pageBreak) {
        post({type: 'cmd-error', cmd: 'insertPageBreak'});
        break;
      }
      try {
        ed.commands.insertContent({type: 'pageBreak'});
      } catch (e: unknown) {
        post({type: 'cmd-error', cmd: 'insertPageBreak'});
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
      const [w, h] =
        sizes[typeof cmd.paperSize === 'string' ? cmd.paperSize : ''] ??
        sizes.a4;
      document.documentElement.style.setProperty('--page-width', w);
      document.documentElement.style.setProperty('--page-height', h);
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
      }
      break;
    }
    case 'replaceCitationMarkers': {
      // Citation markers are inserted programmatically as single text runs
      // (CitationManagerModal flow), so per-node scanning is safe; markers
      // split across runs by partial formatting will not match here.
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
      const ed = getEditor();
      if (!ed) {
        post({type: 'cmd-error', cmd: 'insertToc'});
        break;
      }
      try {
        const headings = collectHeadings(
          ed.state.doc.content.content as HeadingNode[],
        );
        // Legacy parity: a document with no headings gets no TOC.
        if (headings.length > 0) {
          ed.commands.insertContent(tocParagraphs(headings));
        }
      } catch (e: unknown) {
        post({type: 'cmd-error', cmd: 'insertToc'});
        post({type: 'error', message: String(e)});
      }
      break;
    }
    case 'insertFootnote': {
      const ed = getEditor();
      if (!ed || typeof cmd.text !== 'string') {
        post({type: 'cmd-error', cmd: 'insertFootnote'});
        break;
      }
      try {
        const shape = resolveFootnoteSchema(ed.state.schema);
        if (shape.hasFootnoteNode) {
          // Native footnote node numbers itself; the manual counter stays
          // untouched so it never drifts if both paths are ever mixed.
          ed.commands.insertContent(footnoteContent(0, cmd.text, shape));
        } else {
          // Increment only after the dispatch succeeded so a failed
          // insert never burns a footnote number.
          ed.commands.insertContent(
            footnoteContent(footnotesUsed + 1, cmd.text, shape),
          );
          footnotesUsed += 1;
        }
      } catch (e: unknown) {
        post({type: 'cmd-error', cmd: 'insertFootnote'});
        post({type: 'error', message: String(e)});
      }
      break;
    }
  }
};
