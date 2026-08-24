// Pure document-query helpers for the SuperDoc bridge.
// Kept free of editor imports so jest runs them natively and the
// bundler sees no cycle with ./index.

export interface HeadingInfo {
  level: number;
  text: string;
  index: number;
}

export interface HeadingNode {
  type: {name: string};
  attrs?: {level?: number};
  textContent: string;
}

/** Collects heading nodes from a top-level block list, keeping block index. */
export function collectHeadings(blocks: HeadingNode[]): HeadingInfo[] {
  const out: HeadingInfo[] = [];
  blocks.forEach((node, index) => {
    if (node.type.name === 'heading') {
      out.push({
        level: node.attrs?.level ?? 1,
        text: node.textContent,
        index,
      });
    }
  });
  return out;
}

/** Counts non-overlapping occurrences; empty needle counts as zero. */
export function countOccurrences(haystack: string, needle: string): number {
  return findAllOccurrences(haystack, needle).length;
}

/** Start offsets of every non-overlapping occurrence of needle. */
export function findAllOccurrences(haystack: string, needle: string): number[] {
  if (!needle) {
    return [];
  }
  const offsets: number[] = [];
  let pos = haystack.indexOf(needle);
  while (pos !== -1) {
    offsets.push(pos);
    pos = haystack.indexOf(needle, pos + needle.length);
  }
  return offsets;
}

/** Replaces every occurrence; empty find is a no-op. */
export function findReplaceAll(
  text: string,
  find: string,
  replace: string,
): string {
  if (!find) {
    return text;
  }
  return text.split(find).join(replace);
}

/**
 * One run of unformatted-interrupted text inside a block. Inline marks split
 * a phrase into several fragments whose concatenation is the block's text.
 */
export interface TextFragment {
  /** Document-absolute position of the fragment's first character. */
  start: number;
  text: string;
}

export interface MatchRange {
  from: number;
  to: number;
}

interface PmNodeLike {
  isText?: boolean;
  text?: string;
}

interface DescendantsLike {
  descendants(cb: (node: PmNodeLike, pos: number) => void): void;
}

/**
 * Text fragments of one top-level block in document order. `blockOffset` is
 * the block node's own document offset, so fragment positions are absolute.
 * Positions follow ProseMirror's descendants() convention (block-relative,
 * opening token included), matching what replaceWith expects as boundaries.
 */
export function collectTextFragments(
  block: DescendantsLike,
  blockOffset: number,
): TextFragment[] {
  const fragments: TextFragment[] = [];
  block.descendants((node, pos) => {
    if (node.isText && typeof node.text === 'string' && node.text.length > 0) {
      fragments.push({start: blockOffset + pos, text: node.text});
    }
  });
  return fragments;
}

/**
 * Maps a concatenated-string offset back to a document position via the
 * fragment map. `isEnd` tolerates a boundary sitting exactly at the end of
 * the block's text (maps just past the final character).
 */
function resolveBoundary(
  fragments: TextFragment[],
  offset: number,
  isEnd: boolean,
): number | null {
  let consumed = 0;
  for (const fragment of fragments) {
    if (offset < consumed + fragment.text.length) {
      return fragment.start + (offset - consumed);
    }
    consumed += fragment.text.length;
  }
  const last = fragments[fragments.length - 1];
  if (isEnd && offset === consumed && last) {
    return last.start + last.text.length;
  }
  return null;
}

interface ForEachDocLike {
  forEach(cb: (block: DescendantsLike, offset: number) => void): void;
}

/**
 * Block-scoped match collection for find & replace: occurrences of `find`
 * inside any single top-level textblock, even when inline formatting splits
 * them across several text nodes. Ranges are returned in document order and
 * are safe to apply bottom-up; collection happens on the pre-mutation
 * snapshot, so replacement strings containing the needle cannot loop.
 */
export function collectMatchRanges(
  doc: ForEachDocLike,
  find: string,
): MatchRange[] {
  if (!find) {
    return [];
  }
  const ranges: MatchRange[] = [];
  doc.forEach((block, blockOffset) => {
    const fragments = collectTextFragments(block, blockOffset);
    if (fragments.length === 0) {
      return;
    }
    const haystack = fragments.map(f => f.text).join('');
    findAllOccurrences(haystack, find).forEach(offset => {
      const from = resolveBoundary(fragments, offset, false);
      const to = resolveBoundary(fragments, offset + find.length, true);
      if (from != null && to != null) {
        ranges.push({from, to});
      }
    });
  });
  return ranges;
}
