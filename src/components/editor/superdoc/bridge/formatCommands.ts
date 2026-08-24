// Formatting command dispatch for the SuperDoc bridge.
// Kept free of imports from ./index so the bundler sees no cycle:
// applyFormat reports success via its boolean return and the caller
// (bridge/index.ts) posts cmd-error itself.
//
// Every handler returns true when it dispatched (or legitimately no-op'd)
// and false when its backing command is missing, so unknown/unsupported
// formats surface as cmd-error instead of silent failure.

import {EDITOR_FONTS} from '@/components/editor/fonts';

/** A falsy "clear" request: false or null/undefined means unset. */
function UNSET(v: unknown): boolean {
  return v === false || v == null;
}

type FormatHandler = (ed: any, value: unknown) => boolean;

/** Calls a named command when present; reports whether it was available. */
function callCmd(ed: any, name: string, ...args: unknown[]): boolean {
  const fn = ed?.commands?.[name];
  if (typeof fn !== 'function') {
    return false;
  }
  fn.call(ed.commands, ...args);
  return true;
}

/**
 * Logical font key ('times', 'mono', …) → metric-compatible CSS stack.
 * Raw values that are not known keys pass through unchanged so DOCX
 * round-trips never embed bare keys like "mono" as family names.
 */
export function fontFamilyFor(value: unknown): string {
  const key = String(value);
  return EDITOR_FONTS.find(f => f.key === key)?.stack ?? key;
}

/** Inverse of fontFamilyFor: CSS family → logical key when recognizable. */
export function fontKeyFor(family: unknown): string | undefined {
  if (typeof family !== 'string' || family.length === 0) {
    return undefined;
  }
  const byStack = EDITOR_FONTS.find(f => f.stack === family);
  if (byStack) {
    return byStack.key;
  }
  // Tolerate round-trips that collapsed the stack to its first family name.
  const first = family.split(',')[0].trim().toLowerCase();
  return (
    EDITOR_FONTS.find(f => f.stack.split(',')[0].trim().toLowerCase() === first)
      ?.key ?? EDITOR_FONTS.find(f => f.key.toLowerCase() === first)?.key
  );
}

const FORMAT_MAP: Record<string, FormatHandler> = {
  bold: (ed, v) => callCmd(ed, v ? 'setBold' : 'unsetBold'),
  italic: (ed, v) => callCmd(ed, v ? 'setItalic' : 'unsetItalic'),
  underline: (ed, v) => callCmd(ed, v ? 'setUnderline' : 'unsetUnderline'),
  strike: (ed, v) => callCmd(ed, v ? 'setStrike' : 'unsetStrike'),
  color: (ed, v) =>
    // Falsy must mean clear: coercing "false"/null into setColor would
    // persist literal garbage into attrs and round-trip into the DOCX.
    UNSET(v) ? callCmd(ed, 'unsetColor') : callCmd(ed, 'setColor', String(v)),
  background: (ed, v) =>
    UNSET(v)
      ? callCmd(ed, 'unsetBackgroundColor')
      : callCmd(ed, 'setBackgroundColor', String(v)),
  align: (ed, v) => callCmd(ed, 'setTextAlign', UNSET(v) ? 'left' : String(v)),
  header: (ed, v) =>
    // Number() check, not truthiness: StyleBar's "Normal" sends false but a
    // persisted/round-tripped '0' string is truthy and would set heading 0.
    Number(v) > 0
      ? callCmd(ed, 'setHeading', {level: Number(v)})
      : callCmd(ed, 'setParagraph'),
  font: (ed, v) =>
    UNSET(v)
      ? callCmd(ed, 'unsetFontFamily')
      : callCmd(ed, 'setFontFamily', fontFamilyFor(v)),
  size: (ed, v) =>
    UNSET(v)
      ? callCmd(ed, 'unsetFontSize')
      : callCmd(ed, 'setFontSize', String(v)),
  list: (ed, v) => {
    // Explicit mapping only: an implicit else-fallthrough once turned the
    // checkbox button into a blockquote inserter.
    if (v === 'ordered') {
      return callCmd(ed, 'toggleOrderedList');
    }
    if (v === 'bullet') {
      return callCmd(ed, 'toggleBulletList');
    }
    if (v === 'check') {
      return callCmd(ed, 'toggleTaskList');
    }
    if (v === 'quote' || v === 'blockquote') {
      return callCmd(ed, 'toggleBlockquote');
    }
    return false;
  },
  link: (ed, v) =>
    UNSET(v)
      ? callCmd(ed, 'unsetLink')
      : callCmd(ed, 'setLink', {href: String(v)}),
  blockquote: ed => callCmd(ed, 'toggleBlockquote'),
  script: (ed, v) =>
    callCmd(ed, v === 'sub' ? 'setSubscript' : 'setSuperscript'),
  indent: (ed, v) => {
    const outdent = String(v).startsWith('-');
    if (callCmd(ed, outdent ? 'outdent' : 'indent')) {
      return true;
    }
    // Schema without indent commands: fall back to sinking/lifting the
    // enclosing list item before reporting honest failure.
    return callCmd(ed, outdent ? 'liftListItem' : 'sinkListItem', 'listItem');
  },
  spacing: (ed, v) => {
    // Paragraph line-height attribute; requires schema support on both ends
    // (updateAttributes alone can't prove the attr exists and would no-op).
    const para = ed?.state?.schema?.nodes?.paragraph;
    if (!para?.attrs || !('lineHeight' in para.attrs)) {
      return false;
    }
    return callCmd(ed, 'updateAttributes', 'paragraph', {
      lineHeight: UNSET(v) ? null : String(v),
    });
  },
};

/** Applies a named format; returns false when the key or command is missing. */
export function applyFormat(ed: any, key: string, value: unknown): boolean {
  const fn = FORMAT_MAP[key];
  if (!fn) {
    return false;
  }
  return fn(ed, value);
}

/** Snapshot of active marks/attributes at the current selection. */
export function currentFormats(ed: any): Record<string, unknown> {
  const a = ed.isActive.bind(ed);
  const textStyle = ed.getAttributes('textStyle') ?? {};
  const paragraph = ed.getAttributes('paragraph') ?? {};
  const format: Record<string, unknown> = {
    bold: a('bold'),
    italic: a('italic'),
    underline: a('underline'),
    strike: a('strike'),
    align: paragraph.textAlign ?? 'left',
  };
  if (textStyle.color) {
    format.color = textStyle.color;
  }
  if (textStyle.backgroundColor) {
    format.background = textStyle.backgroundColor;
  }
  if (textStyle.fontSize) {
    format.size = textStyle.fontSize;
  }
  const fontKey = fontKeyFor(textStyle.fontFamily);
  if (fontKey) {
    format.font = fontKey;
  }
  if (paragraph.lineHeight) {
    format.spacing = String(paragraph.lineHeight);
  }
  return format;
}
