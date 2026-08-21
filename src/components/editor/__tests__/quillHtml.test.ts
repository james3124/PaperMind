import {buildQuillHtml, PAPER_RATIOS} from '@/components/editor/quillHtml';

describe('PAPER_RATIOS', () => {
  it('has expected ratios for all supported paper sizes', () => {
    expect(PAPER_RATIOS.a4).toBeCloseTo(1.0, 5);
    expect(PAPER_RATIOS.letter).toBeCloseTo(1.03, 5);
    expect(PAPER_RATIOS.a5).toBeCloseTo(0.7, 5);
    expect(PAPER_RATIOS.a3).toBeCloseTo(1.41, 5);
  });

  it('keeps A4 as the default (ratio 1)', () => {
    expect(PAPER_RATIOS.a4).toBe(1);
  });

  it('buildQuillHtml injects the paper size and enables 16px font', () => {
    const html = buildQuillHtml('Hello', 'a5');
    expect(html).toContain("applyPaperSize('a5')");
    expect(html).toContain('font-size: 16px');
    expect(html).toContain('setPaperSize');
  });

  it('registers the custom table blot and its CSS', () => {
    const html = buildQuillHtml('');
    expect(html).toContain("PaperTableBlot.blotName = 'paper-table'");
    expect(html).toContain("PaperTableBlot.tagName = 'table'");
    expect(html).toContain('table.ql-paper-table');
    expect(html).toContain('Quill.register(PaperTableBlot, true)');
  });

  it('registers the page-break blot and its CSS', () => {
    const html = buildQuillHtml('');
    expect(html).toContain("PageBreakBlot.blotName = 'page-break'");
    expect(html).toContain("PageBreakBlot.tagName = 'hr'");
    expect(html).toContain('hr.ql-page-break');
    expect(html).toContain('Quill.register(PageBreakBlot, true)');
  });

  it('registers the spacing attributor and exposes table/image/pagebreak commands', () => {
    const html = buildQuillHtml('');
    expect(html).toContain('SpacingAttributor');
    expect(html).toContain("case 'insertTable'");
    expect(html).toContain("case 'insertImage'");
    expect(html).toContain("case 'insertPageBreak'");
    expect(html).toContain("case 'addTableRow'");
    expect(html).toContain("case 'addTableColumn'");
    expect(html).toContain("case 'deleteTableRow'");
    expect(html).toContain("case 'deleteTableColumn'");
    expect(html).toContain("case 'deleteTable'");
    expect(html).toContain("'paper-table', { rows: msg.rows, cols: msg.cols }");
  });

  it('escapes user content before injecting into the template literal', () => {
    const html = buildQuillHtml('cost: $5 and `tick` and \\backslash\\');
    expect(html).toContain('cost: \\$5 and \\`tick\\` and \\\\backslash\\\\');
  });

  it('escapes </script in user content so it cannot terminate the inline script', () => {
    const html = buildQuillHtml('</script><b>x</b>');
    expect(html).toContain('<\\/script');
    // The initialText template literal must not contain a raw closing script tag.
    const start = html.indexOf('const initialText');
    const end = html.indexOf('`;', start);
    const region = html.slice(start, end);
    expect(region).not.toMatch(/<\/script/);
  });

  it('dedupes duplicate message payloads across document/window listeners', () => {
    const html = buildQuillHtml('');
    expect(html).toContain("document.addEventListener('message', handleMessage)");
    expect(html).toContain("window.addEventListener('message', handleMessage)");
    expect(html).toContain('lastExecuted');
  });

  it('deleteTable resolves the blot via Quill.find/getIndex instead of eating a character', () => {
    const html = buildQuillHtml('');
    expect(html).toContain("case 'deleteTable'");
    expect(html).toContain('const blot = Quill.find(table)');
    expect(html).toContain('quill.getIndex(blot)');
  });

  it('debounces content-change posting with an immediate flush path', () => {
    const html = buildQuillHtml('');
    expect(html).toContain('setTimeout(postContentChangeNow, 250)');
    expect(html).toContain("'content-change'");
    expect(html).toContain("window.addEventListener('beforeunload'");
    expect(html).toContain('postContentChangeNow()');
  });

  it('batches findReplace into one content-change plus a single replace-done', () => {
    const html = buildQuillHtml('');
    expect(html).toContain("type: 'replace-done'");
    expect(html).toContain('suppressChangePosts');
    expect(html).toContain("if (count > 0) postContentChangeNow()");
  });

  it('embeds replaceCitationMarkers command handler', () => {
    const html = buildQuillHtml('');
    expect(html).toContain(`case 'replaceCitationMarkers'`);
    expect(html).toContain('msg.oldMarker');
    expect(html).toContain('msg.newMarker');
  });

  it('embeds replaceReferences command handler', () => {
    const html = buildQuillHtml('');
    expect(html).toContain(`case 'replaceReferences'`);
    expect(html).toContain('msg.entries');
  });

  it('emits no dark CSS by default and dark CSS only when opts.dark is true', () => {
    const light = buildQuillHtml('');
    expect(light).not.toContain('#111827');
    expect(light).not.toContain('#1f2937');
    const dark = buildQuillHtml('', 'a4', {dark: true});
    expect(dark).toContain('#111827');
    expect(dark).toContain('#1f2937');
    expect(dark).toContain('#e5e7eb');
    expect(dark).toContain('#374151');
    expect(dark).toContain('#818cf8');
    expect(dark).toContain('#4b5563');
    expect(dark).toContain('#9ca3af');
  });

  it('posts save-state dirty once per burst and saved after each flush', () => {
    const html = buildQuillHtml('');
    expect(html).toContain("type: 'save-state'");
    expect(html).toContain("postSaveState('dirty')");
    expect(html).toContain("postSaveState('saved')");
    expect(html).toContain('saveStateNotifiedDirty');
    // Guard ensures dirty is posted once per burst (set true when posted,
    // cleared when the flush completes).
    expect(html).toMatch(/saveStateNotifiedDirty = false/);
  });

  it('registers the size style attributor with a fixed px whitelist', () => {
    const html = buildQuillHtml('');
    expect(html).toContain("Quill.import('attributors/style/size')");
    expect(html).toContain('FontSize.whitelist');
    expect(html).toContain('FontSize.whitelist = [\'14px\', \'16px\', \'18px\', \'20px\']');
    expect(html).toContain('FONT_SIZE_VALUES = [14, 16, 18, 20]');
    expect(html).toContain('Quill.register(FontSize, true)');
  });

  it('handles the setFontSize command with a whitelist guard', () => {
    const html = buildQuillHtml('');
    expect(html).toContain("case 'setFontSize'");
    expect(html).toContain('FONT_SIZE_VALUES.indexOf(msg.size) === -1');
    expect(html).toContain("quill.format('size', msg.size + 'px')");
  });

  it('embeds markdown shortcut rules for headers', () => {
    const html = buildQuillHtml('');
    expect(html).toContain("'# '");
    expect(html).toContain("'## '");
    expect(html).toContain("'### '");
    expect(html).toContain('{ header: 1 }');
    expect(html).toContain('{ header: 2 }');
    expect(html).toContain('{ header: 3 }');
  });

  it('embeds markdown shortcut rules for lists and blockquotes', () => {
    const html = buildQuillHtml('');
    expect(html).toContain("'- '");
    expect(html).toContain("'* '");
    expect(html).toContain("'1. '");
    expect(html).toContain("'> '");
    expect(html).toContain("{ list: 'bullet' }");
    expect(html).toContain("{ list: 'ordered' }");
    expect(html).toContain('{ blockquote: true }');
  });

  it('markdown shortcuts fire only on user typing and skip tables', () => {
    const html = buildQuillHtml('');
    expect(html).toContain("if (source !== 'user') return;");
    expect(html).toContain('if (!sel) return;');
    expect(html).toContain('if (getTableAtSelection()) return;');
  });
});
