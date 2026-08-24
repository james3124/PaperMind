interface InlineMark {
  type: string;
}
interface InlineNode {
  type: 'text';
  text: string;
  marks?: InlineMark[];
}

function parseInline(text: string): InlineNode[] {
  const out: InlineNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    if (m.index > last) {
      out.push({type: 'text', text: text.slice(last, m.index)});
    }
    const token = m[0];
    if (token.startsWith('**')) {
      out.push({
        type: 'text',
        text: token.slice(2, -2),
        marks: [{type: 'bold'}],
      });
    } else {
      out.push({
        type: 'text',
        text: token.slice(1, -1),
        marks: [{type: 'italic'}],
      });
    }
    last = m.index + token.length;
  }
  if (last < text.length) {
    out.push({type: 'text', text: text.slice(last)});
  }
  return out.length ? out : [{type: 'text', text}];
}

export function markdownToBlocks(md: string): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = [];
  const lines = md.split('\n');
  let listBuffer: Array<{ordered: boolean; text: string}> = [];

  function flushList(): void {
    if (!listBuffer.length) {
      return;
    }
    const ordered = listBuffer[0].ordered;
    const items = listBuffer.map(li => ({
      type: 'listItem',
      content: [{type: 'paragraph', content: parseInline(li.text)}],
    }));
    blocks.push(
      ordered
        ? {type: 'orderedList', content: items}
        : {type: 'bulletList', content: items},
    );
    listBuffer = [];
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const ordered = /^\d+\.\s+(.*)$/.exec(line);
    if (h) {
      flushList();
      blocks.push({
        type: 'heading',
        attrs: {level: h[1].length},
        content: parseInline(h[2]),
      });
    } else if (bullet) {
      // A run of bullets following numbered items (or vice versa) must
      // flush first so each list keeps its own type.
      if (listBuffer.length && listBuffer[listBuffer.length - 1].ordered) {
        flushList();
      }
      listBuffer.push({ordered: false, text: bullet[1]});
    } else if (ordered) {
      if (listBuffer.length && !listBuffer[listBuffer.length - 1].ordered) {
        flushList();
      }
      listBuffer.push({ordered: true, text: ordered[1]});
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      blocks.push({type: 'paragraph', content: parseInline(line.trim())});
    }
  }
  flushList();
  return blocks;
}
