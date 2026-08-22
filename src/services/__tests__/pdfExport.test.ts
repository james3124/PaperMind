import RNHTMLtoPDF from 'react-native-html-to-pdf';
import {deltaToHtml, exportPdf} from '../pdfExport';

jest.mock('react-native-html-to-pdf', () => ({
  convert: jest.fn(),
}));

const mockedConvert = RNHTMLtoPDF.convert as jest.Mock;

describe('deltaToHtml', () => {
  it('renders h1/h2/h3 for header attributes', () => {
    const delta = JSON.stringify({
      ops: [
        {insert: 'Title', attributes: {header: 1}},
        {insert: 'Subtitle', attributes: {header: 2}},
        {insert: 'Section', attributes: {header: 3}},
      ],
    });
    const html = deltaToHtml(delta);
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<h2>Subtitle</h2>');
    expect(html).toContain('<h3>Section</h3>');
  });

  it('splits paragraphs on newlines', () => {
    const delta = JSON.stringify({
      ops: [{insert: 'First paragraph\nSecond paragraph\n'}],
    });
    const html = deltaToHtml(delta);
    expect(html).toContain('<p>First paragraph</p>');
    expect(html).toContain('<p>Second paragraph</p>');
  });

  it('groups consecutive bullet ops into a single ul', () => {
    const delta = JSON.stringify({
      ops: [
        {insert: 'One\n', attributes: {list: 'bullet'}},
        {insert: 'Two\n', attributes: {list: 'bullet'}},
        {insert: 'Three\n', attributes: {list: 'bullet'}},
      ],
    });
    const html = deltaToHtml(delta);
    expect((html.match(/<ul>/g) ?? []).length).toBe(1);
    expect((html.match(/<li>/g) ?? []).length).toBe(3);
    expect(html).toContain('<ul><li>One</li><li>Two</li><li>Three</li></ul>');
  });

  it('emits sup with footnote num for footnote-ref object inserts', () => {
    const delta = JSON.stringify({
      ops: [
        {insert: 'See the claim'},
        {insert: {'footnote-ref': {num: 4}}},
      ],
    });
    const html = deltaToHtml(delta);
    expect(html).toContain('<sup class="footnote-ref">4</sup>');
  });

  it('escapes HTML special characters in text', () => {
    const delta = JSON.stringify({
      ops: [{insert: 'a & b < c > d\n'}],
    });
    const html = deltaToHtml(delta);
    expect(html).toContain('<p>a &amp; b &lt; c &gt; d</p>');
  });

  it('wraps bold and italic runs', () => {
    const delta = JSON.stringify({
      ops: [
        {insert: 'bold', attributes: {bold: true}},
        {insert: ' and '},
        {insert: 'italic', attributes: {italic: true}},
        {insert: '\n'},
      ],
    });
    const html = deltaToHtml(delta);
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('skips image inserts without breaking output', () => {
    const delta = JSON.stringify({
      ops: [{insert: 'before\n'}, {insert: {image: 'data:image/png;base64,x'}}, {insert: 'after\n'}],
    });
    const html = deltaToHtml(delta);
    expect(html).not.toContain('data:image');
    expect(html).toContain('<p>before</p>');
    expect(html).toContain('<p>after</p>');
  });

  it('returns empty-ish html on invalid JSON without throwing', () => {
    expect(() => deltaToHtml('{not json')).not.toThrow();
    expect(deltaToHtml('{not json')).toBe('<p></p>');
  });
});

describe('exportPdf', () => {
  beforeEach(() => {
    mockedConvert.mockReset();
  });

  it('calls convert once and returns filePath', async () => {
    mockedConvert.mockResolvedValue({filePath: '/tmp/doc.pdf'});
    const result = await exportPdf('My Paper', '{"ops":[{"insert":"hi\\n"}]}');
    expect(mockedConvert).toHaveBeenCalledTimes(1);
    expect(result).toBe('/tmp/doc.pdf');
    const options = mockedConvert.mock.calls[0][0];
    expect(options.html).toContain('<!DOCTYPE html>');
    expect(options.html).toContain('<body>');
  });

  it('sanitizes filename from title', async () => {
    mockedConvert.mockResolvedValue({filePath: '/tmp/x.pdf'});
    await exportPdf('My Paper: Draft #2!', '{}');
    const options = mockedConvert.mock.calls[0][0];
    expect(options.fileName).toBe('My-Paper-Draft-2-');
    expect(options.fileName).not.toMatch(/[\s:#]/);
  });

  it('throws when convert returns no filePath', async () => {
    mockedConvert.mockResolvedValue({});
    await expect(exportPdf('T', '{}')).rejects.toThrow();
  });

  it('falls back to document filename when title is blank', async () => {
    mockedConvert.mockResolvedValue({filePath: '/tmp/y.pdf'});
    await exportPdf('   ', '{}');
    expect(mockedConvert.mock.calls[0][0].fileName).toBe('document');
  });
});
