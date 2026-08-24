import {
  applyFormat,
  currentFormats,
  fontFamilyFor,
  fontKeyFor,
} from '../bridge/formatCommands';
import {EDITOR_FONTS} from '@/components/editor/fonts';

function makeEditor(commandNames: string[] = [], overrides: any = {}): any {
  const calls: Array<[string, unknown]> = [];
  const commands: Record<string, jest.Mock> = {};
  for (const name of commandNames) {
    commands[name] = jest.fn((...args: unknown[]) =>
      calls.push([name, args[0]]),
    );
  }
  return {
    calls,
    commands,
    isActive: jest.fn(() => false),
    getAttributes: jest.fn(() => ({})),
    ...overrides,
  };
}

describe('applyFormat', () => {
  it('calls setBold/unsetBold based on the value', () => {
    const ed = makeEditor(['setBold', 'unsetBold']);
    expect(applyFormat(ed, 'bold', true)).toBe(true);
    expect(ed.commands.setBold).toHaveBeenCalledTimes(1);
    expect(applyFormat(ed, 'bold', false)).toBe(true);
    expect(ed.commands.unsetBold).toHaveBeenCalledTimes(1);
  });

  it('toggles italic/underline/strike on truthy value only', () => {
    const ed = makeEditor([
      'setItalic',
      'unsetItalic',
      'setUnderline',
      'unsetUnderline',
      'setStrike',
      'unsetStrike',
    ]);
    applyFormat(ed, 'italic', true);
    applyFormat(ed, 'underline', true);
    applyFormat(ed, 'strike', true);
    expect(ed.commands.setItalic).toHaveBeenCalled();
    expect(ed.commands.setUnderline).toHaveBeenCalled();
    expect(ed.commands.setStrike).toHaveBeenCalled();
    expect(ed.commands.unsetItalic).not.toHaveBeenCalled();
  });

  it('stringifies color/background/align/font/size values', () => {
    const ed = makeEditor([
      'setColor',
      'setBackgroundColor',
      'setTextAlign',
      'setFontFamily',
      'setFontSize',
    ]);
    applyFormat(ed, 'color', '#ff0000');
    applyFormat(ed, 'background', '#00ff00');
    applyFormat(ed, 'align', 'center');
    applyFormat(ed, 'font', 'Georgia');
    applyFormat(ed, 'size', '18pt');
    expect(ed.commands.setColor).toHaveBeenCalledWith('#ff0000');
    expect(ed.commands.setBackgroundColor).toHaveBeenCalledWith('#00ff00');
    expect(ed.commands.setTextAlign).toHaveBeenCalledWith('center');
    expect(ed.commands.setFontFamily).toHaveBeenCalledWith('Georgia');
    expect(ed.commands.setFontSize).toHaveBeenCalledWith('18pt');
  });

  it('returns false instead of writing "false" attrs when clearing', () => {
    const ed = makeEditor([
      'setColor',
      'setBackgroundColor',
      'setTextAlign',
      'setFontFamily',
      'setFontSize',
    ]);
    // None of the unset* variants exist in this stub.
    expect(applyFormat(ed, 'color', false)).toBe(false);
    expect(applyFormat(ed, 'color', null)).toBe(false);
    expect(applyFormat(ed, 'background', false)).toBe(false);
    expect(applyFormat(ed, 'size', false)).toBe(false);
    expect(applyFormat(ed, 'font', undefined)).toBe(false);
    expect(ed.commands.setColor).not.toHaveBeenCalledWith('false');
    expect(ed.commands.setBackgroundColor).not.toHaveBeenCalled();
    expect(ed.commands.setFontSize).not.toHaveBeenCalled();
    expect(ed.commands.setFontFamily).not.toHaveBeenCalled();
  });

  it('clears via unset* variants when they exist', () => {
    const ed = makeEditor([
      'unsetColor',
      'unsetBackgroundColor',
      'unsetFontSize',
      'unsetFontFamily',
      'setTextAlign',
    ]);
    expect(applyFormat(ed, 'color', false)).toBe(true);
    expect(applyFormat(ed, 'background', false)).toBe(true);
    expect(applyFormat(ed, 'size', false)).toBe(true);
    expect(applyFormat(ed, 'font', null)).toBe(true);
    expect(ed.commands.unsetColor).toHaveBeenCalled();
    expect(ed.commands.unsetBackgroundColor).toHaveBeenCalled();
    expect(ed.commands.unsetFontSize).toHaveBeenCalled();
    expect(ed.commands.unsetFontFamily).toHaveBeenCalled();
  });

  it('treats align=false as reset-to-left, never setTextAlign("false")', () => {
    const ed = makeEditor(['setTextAlign']);
    expect(applyFormat(ed, 'align', false)).toBe(true);
    expect(ed.commands.setTextAlign).toHaveBeenCalledWith('left');
  });

  it('maps logical font keys to metric-compatible stacks bridge-side', () => {
    const ed = makeEditor(['setFontFamily']);
    EDITOR_FONTS.forEach(f => {
      applyFormat(ed, 'font', f.key);
      expect(ed.commands.setFontFamily).toHaveBeenCalledWith(f.stack);
    });
  });

  it('passes unknown font values through as raw family names', () => {
    const ed = makeEditor(['setFontFamily']);
    applyFormat(ed, 'font', 'Georgia');
    expect(ed.commands.setFontFamily).toHaveBeenCalledWith('Georgia');
  });

  it('maps header to setHeading with numeric level and header=0 to paragraph', () => {
    const ed = makeEditor(['setHeading', 'setParagraph']);
    applyFormat(ed, 'header', 2);
    expect(ed.commands.setHeading).toHaveBeenCalledWith({level: 2});
    applyFormat(ed, 'header', 0);
    expect(ed.commands.setParagraph).toHaveBeenCalled();
  });

  it('accepts string levels for header', () => {
    const ed = makeEditor(['setHeading']);
    applyFormat(ed, 'header', '3');
    expect(ed.commands.setHeading).toHaveBeenCalledWith({level: 3});
  });

  it('treats string "0" as paragraph, not heading level 0', () => {
    const ed = makeEditor(['setHeading', 'setParagraph']);
    expect(applyFormat(ed, 'header', '0')).toBe(true);
    expect(ed.commands.setHeading).not.toHaveBeenCalled();
    expect(ed.commands.setParagraph).toHaveBeenCalled();
  });

  it('routes list variants explicitly, including checklists and quotes', () => {
    const ed = makeEditor([
      'toggleOrderedList',
      'toggleBulletList',
      'toggleTaskList',
      'toggleBlockquote',
    ]);
    applyFormat(ed, 'list', 'ordered');
    expect(ed.commands.toggleOrderedList).toHaveBeenCalled();
    applyFormat(ed, 'list', 'bullet');
    expect(ed.commands.toggleBulletList).toHaveBeenCalled();
    applyFormat(ed, 'list', 'check');
    expect(ed.commands.toggleTaskList).toHaveBeenCalled();
    applyFormat(ed, 'list', 'quote');
    applyFormat(ed, 'list', 'blockquote');
    expect(ed.commands.toggleBlockquote).toHaveBeenCalledTimes(2);
  });

  it('never inserts a blockquote for an unrecognized list value', () => {
    const ed = makeEditor(['toggleOrderedList', 'toggleBlockquote']);
    expect(applyFormat(ed, 'list', 'check')).toBe(false);
    expect(ed.commands.toggleBlockquote).not.toHaveBeenCalled();
  });

  it('applies and removes links', () => {
    const ed = makeEditor(['setLink', 'unsetLink']);
    expect(applyFormat(ed, 'link', 'https://example.com')).toBe(true);
    expect(ed.commands.setLink).toHaveBeenCalledWith({
      href: 'https://example.com',
    });
    expect(applyFormat(ed, 'link', false)).toBe(true);
    expect(ed.commands.unsetLink).toHaveBeenCalled();
  });

  it('routes blockquote to the same toggle as list quotes', () => {
    const ed = makeEditor(['toggleBlockquote']);
    expect(applyFormat(ed, 'blockquote', true)).toBe(true);
    expect(ed.commands.toggleBlockquote).toHaveBeenCalled();
  });

  it('applies superscript/subscript via script', () => {
    const ed = makeEditor(['setSuperscript', 'setSubscript']);
    expect(applyFormat(ed, 'script', 'super')).toBe(true);
    expect(ed.commands.setSuperscript).toHaveBeenCalled();
    expect(applyFormat(ed, 'script', 'sub')).toBe(true);
    expect(ed.commands.setSubscript).toHaveBeenCalled();
  });

  it('maps indent +/-1 to indent/outdent with list-item fallback', () => {
    const ed = makeEditor(['indent', 'outdent']);
    expect(applyFormat(ed, 'indent', '+1')).toBe(true);
    expect(ed.commands.indent).toHaveBeenCalled();
    expect(applyFormat(ed, 'indent', '-1')).toBe(true);
    expect(ed.commands.outdent).toHaveBeenCalled();

    const fallback = makeEditor(['sinkListItem', 'liftListItem']);
    expect(applyFormat(fallback, 'indent', '+1')).toBe(true);
    expect(fallback.commands.sinkListItem).toHaveBeenCalledWith('listItem');
    expect(applyFormat(fallback, 'indent', '-1')).toBe(true);
    expect(fallback.commands.liftListItem).toHaveBeenCalledWith('listItem');
  });

  it('sets paragraph line-height through updateAttributes when supported', () => {
    const ed = makeEditor(['updateAttributes'], {
      state: {schema: {nodes: {paragraph: {attrs: {lineHeight: {}}}}}},
    });
    expect(applyFormat(ed, 'spacing', '1.5')).toBe(true);
    expect(ed.commands.updateAttributes).toHaveBeenCalledWith('paragraph', {
      lineHeight: '1.5',
    });
    expect(applyFormat(ed, 'spacing', false)).toBe(true);
    expect(ed.commands.updateAttributes).toHaveBeenLastCalledWith('paragraph', {
      lineHeight: null,
    });
  });

  it('reports spacing as unsupported when the schema lacks lineHeight', () => {
    const ed = makeEditor(['updateAttributes'], {
      state: {schema: {nodes: {paragraph: {attrs: {textAlign: {}}}}}},
    });
    expect(applyFormat(ed, 'spacing', '1')).toBe(false);
    expect(ed.commands.updateAttributes).not.toHaveBeenCalled();
  });

  it('returns false for known keys whose backing commands are absent', () => {
    const ed = makeEditor([]);
    expect(applyFormat(ed, 'link', 'https://x.dev')).toBe(false);
    expect(applyFormat(ed, 'blockquote', true)).toBe(false);
    expect(applyFormat(ed, 'script', 'super')).toBe(false);
    expect(applyFormat(ed, 'indent', '+1')).toBe(false);
    expect(applyFormat(ed, 'list', 'check')).toBe(false);
  });

  it('returns false and calls nothing for an unknown key', () => {
    const ed = makeEditor(['setBold']);
    expect(applyFormat(ed, 'superscript', true)).toBe(false);
    expect(
      Object.values(ed.commands).every((fn: any) => fn.mock.calls.length === 0),
    ).toBe(true);
  });
});

describe('font mapping helpers', () => {
  it('resolves every shipped key to its stack and back', () => {
    EDITOR_FONTS.forEach(f => {
      expect(fontFamilyFor(f.key)).toBe(f.stack);
      expect(fontKeyFor(f.stack)).toBe(f.key);
    });
  });

  it('collapses a round-tripped first-family back to its key', () => {
    const georgia = EDITOR_FONTS[0];
    const firstFamily = georgia.stack.split(',')[0].trim();
    expect(fontKeyFor(firstFamily)).toBe(georgia.key);
  });

  it('leaves unknown values untouched', () => {
    expect(fontFamilyFor('Comic Sans MS')).toBe('Comic Sans MS');
    expect(fontKeyFor('Not A Real Stack')).toBeUndefined();
    expect(fontKeyFor(undefined)).toBeUndefined();
  });
});

describe('currentFormats', () => {
  it('reports active marks with align defaulting to left', () => {
    const ed = makeEditor([], {
      isActive: jest.fn((name: string) => name === 'bold'),
      getAttributes: jest.fn(() => ({})),
    });
    expect(currentFormats(ed)).toEqual({
      bold: true,
      italic: false,
      underline: false,
      strike: false,
      align: 'left',
    });
  });

  it('includes textAlign, color, background, size, font key and spacing', () => {
    const georgia = EDITOR_FONTS[0];
    const ed = makeEditor([], {
      isActive: jest.fn(() => false),
      getAttributes: jest.fn((_type: string) => ({
        textAlign: 'right',
        color: '#818cf8',
        backgroundColor: '#fef08a',
        fontSize: '18px',
        fontFamily: georgia.stack,
        lineHeight: '1.5',
      })),
    });
    expect(currentFormats(ed)).toEqual({
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      align: 'right',
      color: '#818cf8',
      background: '#fef08a',
      size: '18px',
      font: georgia.key,
      spacing: '1.5',
    });
  });

  it('omits attributes the selection does not carry', () => {
    const ed = makeEditor([], {
      isActive: jest.fn(() => false),
      getAttributes: jest.fn(() => ({textAlign: 'center'})),
    });
    const format = currentFormats(ed);
    expect(format.align).toBe('center');
    expect('color' in format).toBe(false);
    expect('background' in format).toBe(false);
    expect('size' in format).toBe(false);
    expect('font' in format).toBe(false);
    expect('spacing' in format).toBe(false);
  });

  it('does not report a font for unrecognized families', () => {
    const ed = makeEditor([], {
      isActive: jest.fn(() => false),
      getAttributes: jest.fn(() => ({fontFamily: 'Wingdings'})),
    });
    expect('font' in currentFormats(ed)).toBe(false);
  });
});
