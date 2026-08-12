import RNFS from 'react-native-fs';
import JSZip from 'jszip';
import Share from 'react-native-share';

// ── Build word/document.xml ───────────────────────────────────────────────────

function textToParagraphXml(line: string): string {
  const escaped = line
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (!escaped.trim()) {
    // Empty paragraph (spacing)
    return '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>';
  }

  return `<w:p>
    <w:pPr><w:spacing w:after="160"/></w:pPr>
    <w:r><w:t xml:space="preserve">${escaped}</w:t></w:r>
  </w:p>`;
}

function buildDocumentXml(title: string, content: string): string {
  const lines = content.split('\n');
  const titleXml = `<w:p>
    <w:pPr>
      <w:pStyle w:val="Heading1"/>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:b/><w:sz w:val="32"/></w:rPr>
      <w:t>${title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</w:t>
    </w:r>
  </w:p>`;

  const paragraphsXml = lines.map(textToParagraphXml).join('\n');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${titleXml}
    ${paragraphsXml}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

// ── Minimal DOCX structure ────────────────────────────────────────────────────

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`;

const WORD_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

// ── Main export ───────────────────────────────────────────────────────────────

export async function exportDocx(title: string, content: string): Promise<string> {
  const zip = new JSZip();

  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.file('_rels/.rels',         RELS_XML);
  zip.file('word/_rels/document.xml.rels', WORD_RELS_XML);
  zip.file('word/document.xml',   buildDocumentXml(title, content));

  const base64 = await zip.generateAsync({ type: 'base64' });

  // Write to Downloads
  const safeTitle = title.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_');
  const fileName  = `${safeTitle || 'paper'}.docx`;
  const outPath   = `${RNFS.DownloadDirectoryPath}/${fileName}`;

  await RNFS.writeFile(outPath, base64, 'base64');

  // Share
  await Share.open({
    url:   `file://${outPath}`,
    type:  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    title: `Share ${fileName}`,
  });

  return outPath;
}