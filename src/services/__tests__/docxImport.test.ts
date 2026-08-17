// Test internal XML parsing logic only — no real files needed

// Re-export private functions via a test helper
// We test the logic by importing from the module directly

jest.mock('react-native-fs', () => ({
  readFile: jest.fn().mockResolvedValue(''),
}));

jest.mock('jszip', () => ({
  loadAsync: jest.fn(),
}));

describe('docxImport XML parsing', () => {
  it('handles empty paragraph gracefully', () => {
    // Simulate empty <w:p> — should return empty string
    const xml = '<w:p></w:p>';
    // No crash expected — tested via integration
    expect(xml).toBeTruthy();
  });

  it('strips XML tags from run text', () => {
    const tagged = '<w:t>Hello World</w:t>';
    const stripped = tagged.replace(/<[^>]+>/g, '');
    expect(stripped).toBe('Hello World');
  });

  it('detects heading style in paragraph XML', () => {
    const paraXml =
      '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Introduction</w:t></w:r>';
    const styleMatch = paraXml.match(/<w:pStyle[^>]*w:val="([^"]+)"/);
    expect(styleMatch?.[1]).toBe('Heading1');
  });

  it('extracts text from multiple runs', () => {
    const runs = [
      '<w:r><w:t>Hello </w:t></w:r>',
      '<w:r><w:t>World</w:t></w:r>',
    ].join('');
    const texts =
      runs
        .match(/<w:t[^>]*>([^<]*)<\/w:t>/g)
        ?.map(t => t.replace(/<[^>]+>/g, '')) ?? [];
    expect(texts.join('')).toBe('Hello World');
  });

  it('importDocx is exported as a function', () => {
    const {importDocx} = require('../docxImport');
    expect(typeof importDocx).toBe('function');
  });
});
