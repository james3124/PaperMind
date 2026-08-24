import {
  buildTocLines,
  footnoteContent,
  resolveFootnoteSchema,
  tocParagraphs,
} from '@/components/editor/superdoc/bridge/tocFootnotes';
import {collectHeadings} from '@/components/editor/superdoc/bridge/docQueries';

const headings = [
  {level: 1, text: 'Title', index: 0},
  {level: 2, text: 'Method', index: 2},
  {level: 3, text: 'Detail', index: 4},
];

describe('tocFootnotes', () => {
  it('indents TOC lines by heading level using NBSPs', () => {
    expect(buildTocLines(headings)).toEqual([
      'Title',
      '\u00a0\u00a0\u00a0\u00a0Method',
      '\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0Detail',
    ]);
  });

  it('builds one paragraph block per TOC line', () => {
    const blocks = tocParagraphs(headings);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({
      type: 'paragraph',
      content: [{type: 'text', text: 'Title'}],
    });
  });

  it('feeds TOC paragraphs straight from collectHeadings output', () => {
    const nodes = [
      {type: {name: 'heading'}, attrs: {level: 2}, textContent: 'A'},
      {type: {name: 'paragraph'}, textContent: 'x'},
    ];
    expect(tocParagraphs(collectHeadings(nodes as any))).toEqual([
      {
        type: 'paragraph',
        content: [{type: 'text', text: `\u00a0\u00a0\u00a0\u00a0A`}],
      },
    ]);
  });

  it('resolves schema defensively when nodes/marks are missing', () => {
    expect(resolveFootnoteSchema(undefined)).toEqual({
      hasFootnoteNode: false,
      superscriptMarkName: null,
      hasHardBreakNode: false,
    });
    expect(resolveFootnoteSchema({})).toMatchObject({
      hasFootnoteNode: false,
      hasHardBreakNode: false,
    });
  });

  it('detects footnote node and superscript mark variants', () => {
    expect(
      resolveFootnoteSchema({
        nodes: {footnote: {}},
        marks: {superScript: {}},
      }),
    ).toEqual({
      hasFootnoteNode: true,
      superscriptMarkName: 'superScript',
      hasHardBreakNode: false,
    });
  });

  it('prefers the native footnote node when present', () => {
    const shape = resolveFootnoteSchema({nodes: {footnote: {}, hardBreak: {}}});
    expect(footnoteContent(3, 'see appendix', shape)).toEqual([
      {type: 'footnote', attrs: {content: 'see appendix'}},
    ]);
  });

  it('uses a superscript marker plus hard break in the manual path', () => {
    const shape = resolveFootnoteSchema({
      marks: {superscript: {}},
      nodes: {hardBreak: {}},
    });
    expect(footnoteContent(1, 'note body', shape)).toEqual([
      {type: 'text', marks: [{type: 'superscript'}], text: '1'},
      {type: 'hardBreak'},
      {type: 'text', text: 'note body'},
    ]);
  });

  it('falls back to a plain [fn N] marker without a superscript mark', () => {
    const shape = resolveFootnoteSchema({nodes: {hardBreak: {}}});
    expect(footnoteContent(2, 'body', shape)).toEqual([
      {type: 'text', text: '[fn 2]'},
      {type: 'hardBreak'},
      {type: 'text', text: 'body'},
    ]);
  });

  it('moves note text to its own paragraph without a hardBreak node', () => {
    const shape = resolveFootnoteSchema({marks: {superscript: {}}});
    expect(footnoteContent(1, 'b', shape)).toEqual([
      {type: 'text', marks: [{type: 'superscript'}], text: '1'},
      {type: 'paragraph', content: [{type: 'text', text: 'b'}]},
    ]);
  });

  it('keeps the bridge reset on both document-load paths', () => {
    // index.ts pulls in the superdoc bundle (not jest-safe), so assert the
    // invariant at source level.
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../bridge/index.ts'),
      'utf8',
    );
    expect(src).toContain("cmd.cmd === 'load'");
    expect(src).toContain("cmd.cmd === 'loadBlank'");
    // Each load path must reset the counter immediately before remounting,
    // so a replaced document never inherits the old footnote numbering.
    expect(
      src.match(/footnotesUsed = 0;\s*\n\s*window\.__mount!/g),
    ).toHaveLength(2);
  });
});
