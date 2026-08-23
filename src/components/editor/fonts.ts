export interface EditorFont {
  key: string;
  label: string;
  stack: string;
}

// Font families offered in the style bar, adapted from genoffice's builtin
// font list. Mobile WebViews don't ship desktop fonts like Calibri/Arial,
// so each entry carries metric-compatible fallbacks in its CSS stack.
export const EDITOR_FONTS: readonly EditorFont[] = [
  {key: 'georgia', label: 'Georgia', stack: "Georgia, 'Times New Roman', serif"},
  {
    key: 'times',
    label: 'Times New Roman',
    stack: "'Times New Roman', Tinos, 'Nimbus Roman', Times, serif",
  },
  {
    key: 'calibri',
    label: 'Calibri',
    stack: "Calibri, Carlito, 'Segoe UI', Roboto, sans-serif",
  },
  {
    key: 'arial',
    label: 'Arial',
    stack: "Arial, Helvetica, 'Liberation Sans', Roboto, sans-serif",
  },
  {
    key: 'verdana',
    label: 'Verdana',
    stack: "Verdana, 'DejaVu Sans', Geneva, sans-serif",
  },
  {key: 'mono', label: 'Courier New', stack: "'Courier New', Courier, monospace"},
];

export const DEFAULT_FONT_KEY = 'georgia';

export function fontLabelFor(key: string | undefined): string {
  return (
    EDITOR_FONTS.find(f => f.key === key)?.label ??
    EDITOR_FONTS.find(f => f.key === DEFAULT_FONT_KEY)!.label
  );
}
