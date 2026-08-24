// Tests extractDocxText against a mocked JSZip package carrying a realistic
// word/document.xml — covers paragraphs, runs, line breaks and heading styles.

jest.mock('react-native-fs', () => ({
  readFile: jest.fn().mockResolvedValue('AAAA'),
}));

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Introduction</w:t></w:r></w:p>
    <w:p><w:r><w:t>Hello </w:t></w:r><w:r><w:t>World</w:t></w:r></w:p>
    <w:p><w:r><w:t>line one</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>line two</w:t></w:r></w:p>
    <w:p></w:p>
  </w:body>
</w:document>`;

jest.mock('jszip', () => ({
  __esModule: true,
  default: {
    loadAsync: jest.fn().mockResolvedValue({
      file: (name: string) =>
        name === 'word/document.xml'
          ? {async: () => Promise.resolve(documentXml)}
          : null,
    }),
  },
}));

import {extractDocxText} from '@/services/docxText';

describe('extractDocxText', () => {
  it('extracts paragraphs, runs and line breaks with heading markers', async () => {
    await expect(extractDocxText('/tmp/paper.docx')).resolves.toBe(
      'Introduction\n\nHello World\nline one\nline two',
    );
  });

  it('rejects when word/document.xml is missing', async () => {
    const JSZip = require('jszip').default;
    (JSZip.loadAsync as jest.Mock).mockResolvedValueOnce({
      file: () => null,
    });
    await expect(extractDocxText('/tmp/bad.docx')).rejects.toThrow(
      'missing word/document.xml',
    );
  });
});
