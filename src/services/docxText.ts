import RNFS from 'react-native-fs';
import JSZip from 'jszip';

// Extracts plain text from a .docx file. Used where the app needs the paper's
// words (chat context, AI pipeline) rather than the file itself; the editor
// works directly on the stored docx bytes.
// Invariant: citation markers inserted programmatically are single text runs,
// so run-level extraction never splits them.

// ── XML helpers ───────────────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1]);
  }
  return results;
}

// ── Paragraph extraction ──────────────────────────────────────────────────────

function parseParagraph(paraXml: string): string {
  // Check for heading style
  const styleMatch = paraXml.match(/<w:pStyle[^>]*w:val="([^"]+)"/);
  const style = styleMatch?.[1] ?? '';

  // Extract all text runs
  const runs = extractTag(paraXml, 'w:r');
  const text = runs
    .map(run => {
      // Check for line break
      if (run.includes('<w:br/>') || run.includes('<w:br />')) {
        return '\n';
      }
      const tMatches = extractTag(run, 'w:t');
      return tMatches.join('');
    })
    .join('');

  if (!text.trim()) {
    return '';
  }

  // Add heading markers for context
  if (style.includes('Heading1') || style === 'h1') {
    return `\n${text}\n`;
  }
  if (style.includes('Heading2') || style === 'h2') {
    return `\n${text}\n`;
  }
  if (style.includes('Heading3') || style === 'h3') {
    return `\n${text}\n`;
  }

  return text;
}

// ── Main entry ────────────────────────────────────────────────────────────────

export async function extractDocxText(filePath: string): Promise<string> {
  // Read file as base64
  const base64 = await RNFS.readFile(filePath, 'base64');

  // Unzip
  const zip = await JSZip.loadAsync(base64, {base64: true});

  // Get word/document.xml
  const docFile = zip.file('word/document.xml');
  if (!docFile) {
    throw new Error('Invalid DOCX: missing word/document.xml');
  }

  const xml = await docFile.async('text');

  // Extract body
  const bodyMatch = xml.match(/<w:body>([\s\S]*?)<\/w:body>/);
  if (!bodyMatch) {
    throw new Error('Invalid DOCX: missing w:body');
  }

  const bodyXml = bodyMatch[1];

  // Parse paragraphs
  const paragraphs = extractTag(bodyXml, 'w:p');
  const lines = paragraphs
    .map(p => parseParagraph(p))
    .filter(line => line !== '');

  return lines.join('\n').trim();
}
