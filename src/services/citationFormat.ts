import {SourcePaper} from './literatureSearch';

const NUMERIC_STYLES = new Set(['ieee', 'vancouver']);

export function familyName(author: string): string {
  const family = author.split(',')[0].trim();
  const tokens = family.split(/\s+/).filter(Boolean);
  return tokens.length > 0 ? tokens[tokens.length - 1] : 'Unknown';
}

function givenInitials(author: string): string {
  const parts = author.split(',');
  const given = parts.length > 1 ? parts[1].trim() : '';
  if (given) {
    return given
      .split(/\s+/)
      .filter(Boolean)
      .map(w => `${w[0]}.`)
      .join(' ');
  }
  const tokens = parts[0].trim().split(/\s+/).filter(Boolean);
  return tokens
    .slice(0, -1)
    .map(w => `${w[0]}.`)
    .join(' ');
}

function authorText(paper: SourcePaper, style: string): string {
  const authors = paper.authors;
  const first = (a: string) => `${familyName(a)}, ${givenInitials(a)}`;
  const andText = (list: string[], joiner: string, commaBefore = false) =>
    list.length > 1
      ? `${list.slice(0, -1).join(', ')}${commaBefore ? ',' : ''} ${joiner} ${
          list[list.length - 1]
        }`
      : list[0];

  switch (style) {
    case 'apa': {
      const formatted = authors.map(first);
      return andText(formatted, '&', true);
    }
    case 'mla':
    case 'chicago':
    case 'harvard': {
      const formatted =
        authors.length > 3
          ? [`${familyName(authors[0])}, ${givenInitials(authors[0])} et al.`]
          : authors.map(first);
      return andText(formatted, 'and', true);
    }
    case 'ieee': {
      const formatted =
        authors.length > 3
          ? [`${givenInitials(authors[0])} ${familyName(authors[0])} et al.`]
          : authors.map(a => `${givenInitials(a)} ${familyName(a)}`);
      return andText(formatted, 'and');
    }
    case 'vancouver': {
      const formatted =
        authors.length > 6
          ? [
              `${familyName(authors[0])} ${givenInitials(authors[0])
                .replace(/\./g, '')
                .replace(/ /g, '')} et al.`,
            ]
          : authors.map(
              a =>
                `${familyName(a)} ${givenInitials(a)
                  .replace(/\./g, '')
                  .replace(/ /g, '')}`,
            );
      return formatted.join(', ');
    }
    default:
      return authorText(paper, 'apa');
  }
}

export function formatMarker(
  paper: SourcePaper,
  style: string,
  index: number,
): string {
  if (NUMERIC_STYLES.has(style)) {
    return `[${index}]`;
  }
  const year = paper.year;
  const l = (i: number) => familyName(paper.authors[i]);
  const n = paper.authors.length;
  switch (style) {
    case 'apa':
    case 'harvard':
      if (n === 1) {
        return `(${l(0)}, ${year})`;
      }
      if (n === 2) {
        return `(${l(0)} & ${l(1)}, ${year})`;
      }
      return `(${l(0)} et al., ${year})`;
    case 'mla':
      if (n === 1) {
        return `(${l(0)})`;
      }
      if (n === 2) {
        return `(${l(0)} and ${l(1)})`;
      }
      return `(${l(0)} et al.)`;
    case 'chicago':
      if (n === 1) {
        return `(${l(0)} ${year})`;
      }
      if (n === 2) {
        return `(${l(0)} and ${l(1)} ${year})`;
      }
      return `(${l(0)} et al. ${year})`;
    default:
      return `[${index}]`;
  }
}

export function formatReference(
  paper: SourcePaper,
  style: string,
  edition: string,
  index: number,
): string {
  const urlPart = paper.doi
    ? `https://doi.org/${paper.doi}`
    : paper.url
    ? paper.url
    : '';
  const withUrl = (s: string) => (urlPart ? s.replace('{url}', urlPart) : s);
  const title = paper.title;

  switch (style) {
    case 'apa': {
      const base = `${authorText(paper, 'apa')} (${paper.year}). ${title}.`;
      return withUrl(base + (urlPart ? ' {url}' : ''));
    }
    case 'mla':
      return withUrl(
        `${authorText(paper, 'mla')} "${title}." ${paper.year}, {url}.`,
      );
    case 'ieee':
      return `${formatMarker(paper, 'ieee', index)} ${authorText(
        paper,
        'ieee',
      )}, "${title}," ${paper.year}.`;
    case 'chicago':
      return withUrl(
        `${authorText(paper, 'chicago')} ${paper.year}. "${title}." {url}.`,
      );
    case 'harvard':
      return withUrl(
        `${authorText(paper, 'harvard')} (${
          paper.year
        }) ${title}. Available at: {url}.`,
      );
    case 'vancouver':
      return `${index}. ${authorText(paper, 'vancouver')}. ${title}. ${
        paper.year
      }.`;
    default:
      return formatReference(paper, 'apa', edition, index);
  }
}
