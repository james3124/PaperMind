import {SourcePaper} from './literatureSearch';
import {formatReference} from './citationFormat';

const SELF_NUMBERED_STYLES = new Set(['ieee', 'vancouver']);

export function buildReferencesEntries(
  sources: SourcePaper[],
  style: string,
  edition: string,
): string[] {
  return sources.map((paper, i) => {
    const entry = formatReference(paper, style, edition, i + 1);
    return SELF_NUMBERED_STYLES.has(style) ? entry : `${i + 1}. ${entry}`;
  });
}

export function buildReferencesMarkdown(entries: string[]): string {
  return `## References\n\n${entries.join('\n')}`;
}