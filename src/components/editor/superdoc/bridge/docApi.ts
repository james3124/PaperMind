// Typed-ish access layer over SuperDoc v2's public Document API
// (`activeEditor.doc.*`). The native toolbar must route through this
// facade — the v1-era TipTap `ed.commands.*` surface is not reliable
// in the installed SuperDoc build (its own toolbar uses doc routes).
//
// Everything here is defensive: the app must degrade to the legacy
// ProseMirror/TipTap paths instead of throwing when an optional
// member is absent in a given SuperDoc build.

import {getEditor, post, type AnyObj} from './runtime';

/** The Document API facade for the live editor, or null. */
export function getDoc(): AnyObj | null {
  const ed = getEditor();
  const doc = ed?.doc ?? null;
  return doc && typeof doc === 'object' ? doc : null;
}

/** Portable snapshot of the live selection (blockIds, targets, marks). */
export function selectionInfo(doc: AnyObj): AnyObj | null {
  try {
    return doc.selection?.current ? doc.selection.current({}) : null;
  } catch {
    return null;
  }
}

/**
 * SelectionTarget for write APIs (`format.*`, `insert`, …), or null when
 * the selection cannot be projected (no focus / empty document).
 */
export function selectionTarget(doc: AnyObj): AnyObj | null {
  return selectionInfo(doc)?.selectionTarget ?? null;
}

/** Distinct block ids covered by the selection, in document order. */
export function selectedBlockIds(doc: AnyObj): string[] {
  const segs = selectionInfo(doc)?.target?.segments ?? [];
  const ids: string[] = [];
  for (const s of segs) {
    if (s?.blockId && !ids.includes(s.blockId)) {
      ids.push(s.blockId);
    }
  }
  return ids;
}

/** ParagraphTarget for one block id (the shape paragraphs/lists APIs take). */
export function paragraphTarget(blockId: string): AnyObj {
  return {kind: 'block', nodeType: 'paragraph', nodeId: blockId};
}

/** First caret point of the selection, or null. */
export function caretPoint(
  doc: AnyObj,
): {blockId: string; offset: number} | null {
  const t = selectionInfo(doc)?.selectionTarget;
  const start = t?.start;
  if (start?.kind === 'text' && start.blockId) {
    return {blockId: start.blockId, offset: start.offset ?? 0};
  }
  return null;
}

/** True when a mutation receipt reports success. */
export function receiptOk(receipt: unknown): boolean {
  if (receipt == null) {
    // Absent receipt: treat as applied unless the caller proved otherwise.
    return true;
  }
  if (typeof receipt === 'object' && 'success' in (receipt as AnyObj)) {
    return (receipt as AnyObj).success === true;
  }
  return true;
}

/** Extract a human-readable failure reason from a receipt. */
export function receiptError(receipt: unknown): string | null {
  if (
    receipt != null &&
    typeof receipt === 'object' &&
    (receipt as AnyObj).success === false
  ) {
    const r = receipt as AnyObj;
    return String(
      r.failure?.reason ?? r.failure?.code ?? r.reason ?? 'mutation failed',
    );
  }
  return null;
}

/** Run a doc-API operation; returns [ok, errorReason]. */
export function tryDoc(op: () => unknown): [boolean, string | null] {
  try {
    const receipt = op();
    const err = receiptError(receipt);
    return err == null ? [true, null] : [false, err];
  } catch (e: unknown) {
    return [false, e instanceof Error ? e.message : String(e)];
  }
}

/** Report a failed native command back to React Native. */
export function reportCmdError(cmd: string, message?: string): void {
  post({
    type: 'cmd-error',
    cmd,
    ...(message ? {message} : {}),
  });
} /** Twips-per-size for paper setup (OOXML pgSz units). */
export const PAPER_SIZE_TWIPS: Record<string, [number, number]> = {
  a4: [11906, 16838],
  letter: [12240, 15840],
  a5: [8391, 11906],
  a3: [16838, 23811],
};

/**
 * Apply a paper size to every section through the sections API. Returns
 * an error string on failure, null on success.
 */
export function setPageSetupAllSections(
  doc: AnyObj,
  widthTwips: number,
  heightTwips: number,
): string | null {
  if (!doc.sections?.list || !doc.sections?.setPageSetup) {
    return 'sections API unavailable';
  }
  let listed: AnyObj;
  try {
    listed = doc.sections.list();
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
  const items: AnyObj[] = listed?.items ?? [];
  if (!Array.isArray(items) || items.length === 0) {
    return 'no sections reported';
  }
  for (const item of items) {
    const sectionId =
      item?.address?.sectionId ?? item?.domain?.address?.sectionId;
    if (!sectionId) {
      continue;
    }
    const [ok, err] = tryDoc(() =>
      doc.sections.setPageSetup({
        target: {kind: 'section', sectionId},
        width: widthTwips,
        height: heightTwips,
        orientation: 'portrait',
      }),
    );
    if (!ok) {
      return err ?? 'setPageSetup failed';
    }
  }
  return null;
}
