// Formatting command dispatch for the SuperDoc bridge.
// Kept free of imports from ./index so the bundler sees no cycle:
// applyFormat reports success via its boolean return and the caller
// (bridge/index.ts) posts cmd-error itself.

const FORMAT_MAP: Record<string, (ed: any, value: unknown) => void> = {
  bold: (ed, v) => (v ? ed.commands.setBold() : ed.commands.unsetBold()),
  italic: (ed, v) => (v ? ed.commands.setItalic() : ed.commands.unsetItalic()),
  underline: (ed, v) =>
    v ? ed.commands.setUnderline() : ed.commands.unsetUnderline(),
  strike: (ed, v) => (v ? ed.commands.setStrike() : ed.commands.unsetStrike()),
  color: (ed, v) => ed.commands.setColor(String(v)),
  background: (ed, v) => ed.commands.setBackgroundColor?.(String(v)),
  align: (ed, v) => ed.commands.setTextAlign(String(v)),
  header: (ed, v) =>
    // Number() check, not truthiness: StyleBar's "Normal" sends false but a
    // persisted/round-tripped '0' string is truthy and would set heading 0.
    Number(v) > 0
      ? ed.commands.setHeading({level: Number(v)})
      : ed.commands.setParagraph(),
  font: (ed, v) => ed.commands.setFontFamily?.(String(v)),
  size: (ed, v) => ed.commands.setFontSize?.(String(v)),
  list: (ed, v) =>
    v === 'ordered'
      ? ed.commands.toggleOrderedList()
      : v === 'bullet'
      ? ed.commands.toggleBulletList()
      : ed.commands.toggleBlockquote(),
};

/** Applies a named format; returns false when the key is unknown. */
export function applyFormat(ed: any, key: string, value: unknown): boolean {
  const fn = FORMAT_MAP[key];
  if (!fn) {
    return false;
  }
  fn(ed, value);
  return true;
}

/** Snapshot of active marks/attributes at the current selection. */
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
  if (attrs.color) {
    format.color = attrs.color;
  }
  return format;
}
