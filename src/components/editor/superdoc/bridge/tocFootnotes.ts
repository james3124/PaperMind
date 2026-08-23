// Pure builders for the insertToc / insertFootnote bridge commands.
// Kept free of editor imports so jest runs them natively (same pattern
// as docQueries.ts) and the bundler sees no cycle with ./index.

import type {HeadingInfo} from './docQueries';

export interface FootnoteSchemaShape {
  /** Native `footnote` node available → prefer it over the manual sequence. */
  hasFootnoteNode: boolean;
  /** Name of a superscript-like mark in this schema, or null when absent. */
  superscriptMarkName: string | null;
  /** `hardBreak` node available for inline marker/text separation. */
  hasHardBreakNode: boolean;
}

/** Mark names seen across tiptap/superdoc schema variants, most likely first. */
const SUPERSCRIPT_MARK_NAMES = ['superscript', 'superScript'] as const;

/**
 * Inspects a live ProseMirror schema defensively: neither the footnote node
 * nor a superscript mark is guaranteed to exist in the loaded superdoc build.
 */
export function resolveFootnoteSchema(schema: any): FootnoteSchemaShape {
  const marks = schema?.marks ?? {};
  const superscriptMarkName =
    SUPERSCRIPT_MARK_NAMES.find(name => !!marks[name]) ?? null;
  return {
    hasFootnoteNode: !!schema?.nodes?.footnote,
    superscriptMarkName,
    hasHardBreakNode: !!schema?.nodes?.hardBreak,
  };
}

/** TOC lines: level 1 flush, each deeper level indented by four NBSPs. */
export function buildTocLines(headings: HeadingInfo[]): string[] {
  return headings.map(h => `${'\u00a0'.repeat((h.level - 1) * 4)}${h.text}`);
}

/** TOC as paragraph blocks ready for ed.commands.insertContent. */
export function tocParagraphs(
  headings: HeadingInfo[],
): Array<Record<string, unknown>> {
  return buildTocLines(headings).map(text => ({
    type: 'paragraph',
    content: [{type: 'text', text}],
  }));
}

/**
 * Content array for footnote number `seq` with body `text`:
 * native footnote node when present; otherwise a superscript-numbered
 * marker at the cursor followed by the note text after a hard break.
 * With no superscript mark either, degrades to a plain '[fn N]' marker
 * so insertion never errors on an unexpected schema.
 */
export function footnoteContent(
  seq: number,
  text: string,
  shape: FootnoteSchemaShape,
): Array<Record<string, unknown>> {
  if (shape.hasFootnoteNode) {
    return [{type: 'footnote', attrs: {content: text}}];
  }
  const marker = shape.superscriptMarkName
    ? {
        type: 'text',
        marks: [{type: shape.superscriptMarkName}],
        text: String(seq),
      }
    : {type: 'text', text: `[fn ${seq}]`};
  if (!shape.hasHardBreakNode) {
    // No hardBreak node: put the note text in its own trailing block.
    return [marker, {type: 'paragraph', content: [{type: 'text', text}]}];
  }
  return [marker, {type: 'hardBreak'}, {type: 'text', text}];
}
