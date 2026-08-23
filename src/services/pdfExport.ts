import RNHTMLtoPDF from 'react-native-html-to-pdf';

type FootnoteRef = {num?: number};

interface DeltaOp {
  insert?: string | Record<string, unknown>;
  attributes?: {
    header?: number;
    list?: string;
    blockquote?: boolean;
    bold?: boolean;
    italic?: boolean;
    'footnote-ref'?: FootnoteRef;
  } & Record<string, unknown>;
}

interface Delta {
  ops?: DeltaOp[];
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderInline(text: string, attrs?: DeltaOp['attributes']): string {
  let out = escapeText(text);
  if (!attrs) {
    return out;
  }
  if (attrs.italic) {
    out = `<em>${out}</em>`;
  }
  if (attrs.bold) {
    out = `<strong>${out}</strong>`;
  }
  return out;
}

export function deltaToHtml(deltaJson: string): string {
  let delta: Delta;
  try {
    delta = JSON.parse(deltaJson) as Delta;
  } catch {
    return '<p></p>';
  }

  const ops = Array.isArray(delta?.ops) ? delta.ops : [];

  const out: string[] = [];
  let paraBuf = '';
  let quoteBuf = '';
  let quoteOpen = false;
  let listItemBuf = '';
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushPara = (): void => {
    if (paraBuf.length > 0 || out[out.length - 1] === undefined) {
      if (paraBuf.length > 0) {
        out.push(`<p>${paraBuf}</p>`);
        paraBuf = '';
      }
    }
  };

  const flushList = (): void => {
    if (listType !== null) {
      out.push(
        `<${listType}>${listItems
          .map(item => `<li>${item}</li>`)
          .join('')}</${listType}>`,
      );
      listItems = [];
      listType = null;
      listItemBuf = '';
    }
  };

  const flushQuote = (): void => {
    if (quoteOpen) {
      out.push('</blockquote>');
      quoteOpen = false;
      quoteBuf = '';
    }
  };

  const endLine = (): void => {
    if (listType !== null) {
      listItems.push(listItemBuf);
      listItemBuf = '';
      return;
    }
    if (quoteOpen) {
      out.push(`<p>${quoteBuf}</p>`);
      quoteBuf = '';
      return;
    }
    out.push(`<p>${paraBuf}</p>`);
    paraBuf = '';
  };

  for (const op of ops) {
    const attrs = op.attributes;

    if (op.insert !== null && typeof op.insert === 'object') {
      const footnoteRef = op.insert['footnote-ref'];
      if (
        footnoteRef &&
        typeof footnoteRef === 'object' &&
        typeof (footnoteRef as FootnoteRef).num !== 'undefined'
      ) {
        const sup = `<sup class="footnote-ref">${escapeText(
          String((footnoteRef as FootnoteRef).num),
        )}</sup>`;
        if (listType !== null) {
          listItemBuf += sup;
        } else if (quoteOpen) {
          quoteBuf += sup;
        } else {
          paraBuf += sup;
        }
      }
      continue;
    }

    const text = typeof op.insert === 'string' ? op.insert : '';
    if (text.length === 0) {
      continue;
    }

    if (typeof attrs?.header === 'number') {
      flushList();
      flushQuote();
      flushPara();
      const level = Math.min(Math.max(Math.round(attrs.header), 1), 3);
      for (const part of text.split('\n')) {
        if (part.length > 0) {
          out.push(`<h${level}>${renderInline(part, attrs)}</h${level}>`);
        }
      }
      continue;
    }

    const list = attrs?.list;
    if (list === 'bullet' || list === 'ordered') {
      flushPara();
      flushQuote();
      if (listType === null) {
        listType = list === 'ordered' ? 'ol' : 'ul';
      }
    } else if (attrs?.blockquote) {
      flushPara();
      flushList();
      if (!quoteOpen) {
        out.push('<blockquote>');
        quoteOpen = true;
      }
    } else {
      flushList();
      flushQuote();
    }

    const parts = text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.length > 0) {
        const rendered = renderInline(part, attrs);
        if (listType !== null) {
          listItemBuf += rendered;
        } else if (quoteOpen) {
          quoteBuf += rendered;
        } else {
          paraBuf += rendered;
        }
      }
      if (i < parts.length - 1) {
        endLine();
      }
    }
  }

  flushList();
  flushQuote();
  flushPara();

  return out.join('');
}

export async function exportPdf(
  title: string,
  deltaJson: string,
): Promise<string> {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Georgia,serif;line-height:1.6;padding:24px}sup.footnote-ref{font-size:.75em;color:#6366f1}</style></head><body>${deltaToHtml(
    deltaJson,
  )}</body></html>`;
  const fileName =
    title.trim().replace(/[^\w\d-]+/g, '-').slice(0, 60) || 'document';
  const result = await RNHTMLtoPDF.convert({
    html,
    fileName,
    base64: false,
    padding: 0,
  });
  if (!result?.filePath) {
    throw new Error('PDF export failed: no file path returned');
  }
  return result.filePath;
}
