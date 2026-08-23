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
