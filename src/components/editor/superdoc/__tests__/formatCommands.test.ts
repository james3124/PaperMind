import {applyFormat, currentFormats} from '../bridge/formatCommands';

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

  it('does not throw when optional commands are missing', () => {
    const ed = makeEditor(['setColor']);
    expect(() => applyFormat(ed, 'background', '#123456')).not.toThrow();
    expect(() => applyFormat(ed, 'font', 'Arial')).not.toThrow();
    expect(() => applyFormat(ed, 'size', '14pt')).not.toThrow();
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

  it('routes list variants to ordered/bullet/blockquote toggles', () => {
    const ed = makeEditor([
      'toggleOrderedList',
      'toggleBulletList',
      'toggleBlockquote',
    ]);
    applyFormat(ed, 'list', 'ordered');
    expect(ed.commands.toggleOrderedList).toHaveBeenCalled();
    applyFormat(ed, 'list', 'bullet');
    expect(ed.commands.toggleBulletList).toHaveBeenCalled();
    applyFormat(ed, 'list', 'quote');
    expect(ed.commands.toggleBlockquote).toHaveBeenCalled();
  });

  it('returns false and calls nothing for an unknown key', () => {
    const ed = makeEditor(['setBold']);
    expect(applyFormat(ed, 'superscript', true)).toBe(false);
    expect(
      Object.values(ed.commands).every((fn: any) => fn.mock.calls.length === 0),
    ).toBe(true);
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

  it('includes textAlign and color when present', () => {
    const ed = makeEditor([], {
      isActive: jest.fn(() => false),
      getAttributes: jest.fn((type: string) =>
        type === 'textStyle' ? {color: '#818cf8'} : {textAlign: 'right'},
      ),
    });
    expect(currentFormats(ed)).toEqual({
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      align: 'right',
      color: '#818cf8',
    });
  });

  it('omits color when textStyle has none', () => {
    const ed = makeEditor([], {
      isActive: jest.fn(() => false),
      getAttributes: jest.fn(() => ({textAlign: 'center'})),
    });
    const format = currentFormats(ed);
    expect(format.align).toBe('center');
    expect('color' in format).toBe(false);
  });
});
