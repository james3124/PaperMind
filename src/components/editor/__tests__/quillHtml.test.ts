import {PAPER_RATIOS} from '@/components/editor/quillHtml';

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
    const {buildQuillHtml} = require('@/components/editor/quillHtml');
    const html = buildQuillHtml('Hello', 'a5');
    expect(html).toContain("applyPaperSize('a5')");
    expect(html).toContain('font-size: 16px');
    expect(html).toContain('setPaperSize');
  });

  it('registers the custom table blot and its CSS', () => {
    const {buildQuillHtml} = require('@/components/editor/quillHtml');
    const html = buildQuillHtml('');
    expect(html).toContain("PaperTableBlot.blotName = 'paper-table'");
    expect(html).toContain("PaperTableBlot.tagName = 'table'");
    expect(html).toContain('table.ql-paper-table');
    expect(html).toContain('Quill.register(PaperTableBlot, true)');
  });

  it('registers the page-break blot and its CSS', () => {
    const {buildQuillHtml} = require('@/components/editor/quillHtml');
    const html = buildQuillHtml('');
    expect(html).toContain("PageBreakBlot.blotName = 'page-break'");
    expect(html).toContain("PageBreakBlot.tagName = 'hr'");
    expect(html).toContain('hr.ql-page-break');
    expect(html).toContain('Quill.register(PageBreakBlot, true)');
  });

  it('registers the spacing attributor and exposes table/image/pagebreak commands', () => {
    const {buildQuillHtml} = require('@/components/editor/quillHtml');
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
    const {buildQuillHtml} = require('@/components/editor/quillHtml');
    const html = buildQuillHtml('cost: $5 and `tick` and \\backslash\\');
    expect(html).toContain('cost: \\$5 and \\`tick\\` and \\\\backslash\\\\');
  });
});
