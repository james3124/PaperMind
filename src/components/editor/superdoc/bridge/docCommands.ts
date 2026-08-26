// Document-API command implementations for the native toolbar bridge.
//
// Every export attempts the SuperDoc v2 public surface (`ed.doc.*`) first
// and reports honest failure so callers can fall back to the legacy
// ProseMirror/TipTap paths. No export throws under normal operation.

import {fontFamilyFor} from './formatCommands';
import {
  getDoc,
  selectionTarget,
  selectedBlockIds,
  paragraphTarget,
  caretPoint,
  tryDoc,
  PAPER_SIZE_TWIPS,
  setPageSetupAllSections,
} from './docApi';
import type {AnyObj} from './runtime';

/** A falsy "clear" request: false or null/undefined means unset. */
function UNSET(v: unknown): boolean {
  return v === false || v == null;
}

/** "16px" / 16 → 16 (points); null when unparseable. */
function sizeToNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === 'string') {
    const n = parseFloat(v);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return null;
}

/** Current table context from the host UI facade, or null. */
function tableContext(): AnyObj | null {
  const sd = (window as any).__sd;
  const ui = sd?.ui ?? sd?.activeEditor?.ui;
  try {
    return ui?.tables?.getContext?.() ?? null;
  } catch {
    return null;
  }
}

/**
 * Apply an inline format through doc.format aliases.
 * Keys: bold, italic, underline, strike, color, font, size,
 * background, script. Returns error string or null on success.
 */
function formatInline(
  key: string,
  value: unknown,
  target: AnyObj,
): string | null | undefined {
  const doc = getDoc()!;
  const f = doc.format;
  const set = (op: () => unknown) => tryDoc(op)[1];
  switch (key) {
    case 'bold':
    case 'italic':
    case 'underline':
    case 'strike':
      return set(() => f[key]({target, value: UNSET(value) ? null : true}));
    case 'color':
      return set(() =>
        f.color({target, value: UNSET(value) ? null : String(value)}),
      );
    case 'background':
      return set(() =>
        f.shading({
          target,
          value: UNSET(value) ? null : {fill: String(value)},
        }),
      );
    case 'font':
      return set(() =>
        f.fontFamily({
          target,
          value: UNSET(value) ? null : fontFamilyFor(value),
        }),
      );
    case 'size': {
      const pt = sizeToNumber(value);
      return set(() => f.fontSize({target, value: UNSET(value) ? null : pt}));
    }
    case 'script':
      if (!UNSET(value) && value !== 'super' && value !== 'sub') {
        return `unsupported script value: ${String(value)}`;
      }
      return set(() =>
        f.vertAlign({
          target,
          value:
            value === 'super'
              ? 'superscript'
              : value === 'sub'
              ? 'subscript'
              : null,
        }),
      );
    default:
      return undefined; // not an inline key
  }
}

/** DOCX style ids for the heading levels the StyleBar offers. */
const STYLE_IDS: Record<string, string> = {
  '1': 'Heading1',
  '2': 'Heading2',
  '3': 'Heading3',
};

/**
 * Route one `format` command through the Document API.
 * Returns null when fully handled; otherwise a string explaining why the
 * caller should fall back to the legacy path.
 */
export function docFormatCommand(key: string, value: unknown): string | null {
  const doc = getDoc();
  if (!doc) {
    return 'document api unavailable';
  }
  const target = selectionTarget(doc);
  if (!target && !['header', 'align', 'spacing', 'indent'].includes(key)) {
    return 'no resolvable selection';
  }

  // Inline marks/properties act on the selection envelope directly.
  const inlineResult = formatInline(key, value, target ?? {});
  if (inlineResult !== undefined) {
    return inlineResult ?? null;
  }

  const blocks = selectedBlockIds(doc);
  if (blocks.length === 0) {
    return 'no blocks in selection';
  }
  const targets = blocks.map(paragraphTarget);

  switch (key) {
    case 'header': {
      const styleId =
        Number(value) > 0 ? STYLE_IDS[String(Number(value))] : 'Normal';
      if (!styleId) {
        return `unsupported heading level: ${String(value)}`;
      }
      for (const t of targets) {
        const [ok, err] = tryDoc(() =>
          doc.styles.paragraph.setStyle({target: t, styleId}),
        );
        if (!ok) {
          return err ?? 'setStyle failed';
        }
      }
      return null;
    }
    case 'align': {
      const alignment =
        UNSET(value) || value === 'left' ? 'left' : String(value);
      for (const t of targets) {
        const [ok, err] = tryDoc(() =>
          doc.format.paragraph.setAlignment({target: t, alignment}),
        );
        if (!ok) {
          return err ?? 'setAlignment failed';
        }
      }
      return null;
    }
    case 'spacing': {
      for (const t of targets) {
        if (UNSET(value)) {
          const [ok, err] = tryDoc(() =>
            doc.format.paragraph.clearSpacing({target: t}),
          );
          if (!ok) {
            return err ?? 'clearSpacing failed';
          }
        } else {
          const line = Math.round(parseFloat(String(value)) * 240);
          if (!Number.isFinite(line) || line <= 0) {
            return `unsupported spacing: ${String(value)}`;
          }
          const [ok, err] = tryDoc(() =>
            doc.format.paragraph.setSpacing({
              target: t,
              line,
              lineRule: 'auto',
            }),
          );
          if (!ok) {
            return err ?? 'setSpacing failed';
          }
        }
      }
      return null;
    }
    case 'indent': {
      const outdent = String(value).startsWith('-');
      for (const t of targets) {
        const op = outdent
          ? () => doc.lists.outdent({target: t})
          : () => doc.lists.indent({target: t});
        const [ok, err] = tryDoc(op);
        if (!ok) {
          return err ?? 'indent failed';
        }
      }
      return null;
    }
    case 'list': {
      // Task lists have no OOXML list-kind equivalent here; the caller
      // falls back to the legacy schema node path for those.
      if (value !== 'bullet' && value !== 'ordered') {
        return `unsupported list kind: ${String(value)}`;
      }
      for (const t of targets) {
        // Toggle semantics: strip an existing list, otherwise seed a new one.
        let alreadyList = false;
        try {
          const st = doc.lists.getState?.({target: t});
          alreadyList = st?.success === true && st.isListItem === true;
        } catch {
          alreadyList = false;
        }
        const op = alreadyList
          ? () => doc.lists.remove({target: t})
          : () => doc.lists.apply({target: t, seed: value});
        const [ok, err] = tryDoc(op);
        if (!ok) {
          return err ?? 'list mutation failed';
        }
      }
      return null;
    }
    default:
      return `unsupported format key: ${key}`;
  }
}

/** Insert plain text at the caret. Returns fallback reason or null. */
export function docInsertText(text: string): string | null {
  const doc = getDoc();
  if (!doc?.insert) {
    return 'insert api unavailable';
  }
  const target = selectionTarget(doc);
  if (!target) {
    return 'no caret position';
  }
  const [ok, err] = tryDoc(() =>
    doc.insert({value: text, type: 'text', target}),
  );
  return ok ? null : err ?? 'insert failed';
}

/** Insert markdown at the caret. Returns fallback reason or null. */
export function docInsertMarkdown(md: string): string | null {
  const doc = getDoc();
  if (!doc?.insert) {
    return 'insert api unavailable';
  }
  const input: AnyObj = {value: md, type: 'markdown'};
  const target = selectionTarget(doc);
  if (target) {
    input.target = target;
  }
  const [ok, err] = tryDoc(() => doc.insert(input));
  return ok ? null : err ?? 'markdown insert failed';
}

function historyStep(fn: 'undo' | 'redo'): string | null {
  const doc = getDoc();
  if (typeof doc?.history?.[fn] !== 'function') {
    return 'history api unavailable';
  }
  let result: unknown;
  try {
    result = doc.history[fn]();
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
  // HistoryActionResult carries noop/reason/status — never a .success flag.
  const r = result as AnyObj | undefined;
  if (
    r &&
    (r.success === false ||
      r.noop === true ||
      r.status === 'rejected' ||
      r.status === 'partial')
  ) {
    return `${fn} rejected: ${String(r.reason ?? r.status ?? 'noop')}`;
  }
  return null;
}

export function docUndo(): string | null {
  return historyStep('undo');
}

export function docRedo(): string | null {
  return historyStep('redo');
}

/** Insert an image after the block containing the caret. */
export function docInsertImage(dataUrl: string): string | null {
  const doc = getDoc();
  if (!doc?.create?.image) {
    return 'create.image unavailable';
  }
  const caret = caretPoint(doc);
  // Location kinds require a BlockNodeAddress under `target` — a flat
  // nodeId fails runtime validation ("requires at.target").
  const at = caret
    ? {kind: 'after', target: paragraphTarget(caret.blockId)}
    : {kind: 'documentEnd'};
  const [ok, err] = tryDoc(() => doc.create.image({src: dataUrl, at}));
  return ok ? null : err ?? 'image insert failed';
}

/** Insert a table at the caret (splitting the paragraph, Word-style). */
export function docInsertTable(rows: number, cols: number): string | null {
  const doc = getDoc();
  if (!doc?.create?.table) {
    return 'create.table unavailable';
  }
  const caret = caretPoint(doc);
  const at: AnyObj = caret
    ? {
        kind: 'inParagraph',
        target: paragraphTarget(caret.blockId),
        offset: caret.offset,
      }
    : {kind: 'documentEnd'};
  const [ok, err] = tryDoc(() => doc.create.table({rows, columns: cols, at}));
  if (ok) {
    return null;
  }
  // Some builds reject the split-paragraph location; retry anchored after
  // the caret block before giving up entirely.
  const fallbackAt = caret
    ? {kind: 'after', target: paragraphTarget(caret.blockId)}
    : {kind: 'documentEnd'};
  const [ok2, err2] = tryDoc(() =>
    doc.create.table({rows, columns: cols, at: fallbackAt}),
  );
  return ok2 ? null : err2 ?? err ?? 'table insert failed';
}

/** Run a row/column mutation against the live table context. */
function tableOp(opName: string, needsCell: boolean): string | null {
  const doc = getDoc();
  const fn = doc?.tables?.[opName];
  if (typeof fn !== 'function') {
    return 'tables api unavailable';
  }
  const ctx = tableContext();
  const nodeId =
    ctx?.nodeId ?? ctx?.tableNodeId ?? ctx?.table?.nodeId ?? ctx?.table?.id;
  const input: AnyObj = {};
  if (nodeId) {
    input.nodeId = nodeId;
  } else if (ctx?.target != null) {
    input.target = ctx.target;
  } else {
    return 'no table context';
  }
  if (needsCell || opName === 'deleteRow' || opName === 'deleteColumn') {
    if (Number.isFinite(ctx?.rowIndex)) {
      input.rowIndex = ctx.rowIndex;
    }
    if (Number.isFinite(ctx?.columnIndex)) {
      input.columnIndex = ctx.columnIndex;
    }
  }
  let lastErr: string | null = null;
  const attempt = (payload: AnyObj): boolean => {
    const [ok, err] = tryDoc(() => fn.call(doc.tables, payload));
    if (ok) {
      return true;
    }
    lastErr = err;
    return false;
  };
  if (attempt({...input})) {
    return null;
  }
  if (attempt({nodeId: input.nodeId})) {
    return null;
  }
  return lastErr ?? `${opName} failed`;
}

export function docTableCommand(cmd: string): string | null {
  const map: Record<string, [string, boolean]> = {
    addTableRow: ['insertRow', false],
    addTableColumn: ['insertColumn', false],
    deleteTableRow: ['deleteRow', true],
    deleteTableColumn: ['deleteColumn', true],
    deleteTable: ['deleteTable', false],
  };
  const entry = map[cmd];
  if (!entry) {
    return `unknown table command: ${cmd}`;
  }
  return tableOp(entry[0], entry[1]);
}

/** Insert a real TOC field near the caret. */
export function docInsertToc(): string | null {
  const doc = getDoc();
  if (!doc?.create?.tableOfContents) {
    return 'create.tableOfContents unavailable';
  }
  const caret = caretPoint(doc);
  const at = caret
    ? {kind: 'before', target: paragraphTarget(caret.blockId)}
    : {kind: 'documentEnd'};
  const [ok, err] = tryDoc(() => doc.create.tableOfContents({at}));
  return ok ? null : err ?? 'toc insert failed';
}

/** Insert a footnote at the caret (host-native placement). */
export function docInsertFootnote(text: string): string | null {
  const doc = getDoc();
  if (!doc?.footnotes?.insert) {
    return 'footnotes api unavailable';
  }
  const [ok, err] = tryDoc(() =>
    doc.footnotes.insert({type: 'footnote', content: text}),
  );
  return ok ? null : err ?? 'footnote insert failed';
}

/** Apply a paper size to every section. Returns error string or null. */
export function docSetPaperSize(paperSize: string): string | null {
  const twips = PAPER_SIZE_TWIPS[paperSize];
  if (!twips) {
    return `unknown paper size: ${paperSize}`;
  }
  const doc = getDoc();
  if (!doc) {
    return 'document api unavailable';
  }
  return setPageSetupAllSections(doc, twips[0], twips[1]);
}
