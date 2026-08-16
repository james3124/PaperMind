/**
 * Converts raw LLM markdown output to Quill Delta ops.
 *
 * Fixes:
 *  1. **text** markers → proper Quill bold runs (removes the **)
 *  2. Section headers (Introduction, Methods, etc.) or # headings → bold + header:2
 *  3. First line of each paragraph → leading tab (first-line indent)
 */

type Op = {
  insert: string;
  attributes?: Record<string, unknown>;
};

const SECTION_HEADERS = new Set([
  'abstract',
  'introduction',
  'background',
  'related work',
  'literature review',
  'methodology',
  'methods',
  'materials and methods',
  'experimental setup',
  'results',
  'results and discussion',
  'discussion',
  'conclusion',
  'conclusions',
  'future work',
  'acknowledgments',
  'acknowledgements',
  'references',
  'appendix',
  'limitations',
  'contributions',
  'keywords',
]);

/** Parse a single line into inline ops, handling **bold** spans. */
function parseInline(line: string): Op[] {
  const ops: Op[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > last) {
      ops.push({ insert: line.slice(last, match.index) });
    }
    ops.push({ insert: match[1], attributes: { bold: true } });
    last = regex.lastIndex;
  }

  if (last < line.length) {
    ops.push({ insert: line.slice(last) });
  }

  return ops;
}

/** Convert a markdown string to an array of Quill Delta ops. */
export function markdownToQuillDelta(text: string): Op[] {
  const ops: Op[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let inParagraph = false;

  for (const raw of lines) {
    const trimmed = raw.trim();

    if (trimmed === '') {
      if (inParagraph) {
        ops.push({ insert: '\n' });
        inParagraph = false;
      }
      continue;
    }

    // Strip leading # markers
    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    const lineText = headingMatch ? headingMatch[1] : trimmed;

    const isHeader =
      headingMatch !== null ||
      SECTION_HEADERS.has(lineText.toLowerCase().replace(/[.:*]/g, '').trim());

    if (isHeader) {
      if (inParagraph) {
        ops.push({ insert: '\n' });
        inParagraph = false;
      }
      const cleanHeader = lineText.replace(/\*\*/g, '');
      ops.push({ insert: cleanHeader, attributes: { bold: true } });
      ops.push({ insert: '\n', attributes: { header: 2 } });
      continue;
    }

    // First line of paragraph → indent
    if (!inParagraph) {
      ops.push({ insert: '\t' });
      inParagraph = true;
    } else {
      ops.push({ insert: ' ' });
    }

    ops.push(...parseInline(lineText));
  }

  if (inParagraph) {
    ops.push({ insert: '\n' });
  }

  return ops;
}

/** Returns a serialised Quill Delta JSON string ready for storage or postMessage. */
export function markdownToDeltaJson(text: string): string {
  return JSON.stringify({ ops: markdownToQuillDelta(text) });
}
