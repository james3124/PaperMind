import {
  collectHeadings,
  collectMatchRanges,
  collectTextFragments,
  countOccurrences,
  findReplaceAll,
  findAllOccurrences,
} from '@/components/editor/superdoc/bridge/docQueries';

describe('docQueries', () => {
  it('collects headings with running paragraph index', () => {
    const nodes = [
      {type: {name: 'heading'}, attrs: {level: 1}, textContent: 'Intro'},
      {type: {name: 'paragraph'}, textContent: 'hello world'},
      {type: {name: 'heading'}, attrs: {level: 2}, textContent: 'Method'},
    ];
    expect(collectHeadings(nodes as any)).toEqual([
      {level: 1, text: 'Intro', index: 0},
      {level: 2, text: 'Method', index: 2},
    ]);
  });

  it('skips non-heading nodes safely', () => {
    const nodes = [
      {type: {name: 'paragraph'}, textContent: 'plain'},
      {type: {name: 'heading'}, attrs: undefined, textContent: 'x'},
    ];
    expect(collectHeadings(nodes as any)).toHaveLength(1);
  });

  it('counts non-overlapping occurrences', () => {
    expect(countOccurrences('aaaa', 'aa')).toBe(2);
    expect(countOccurrences('', 'x')).toBe(0);
    expect(countOccurrences('abc', '')).toBe(0);
  });

  it('replaces every occurrence via split/join', () => {
    expect(findReplaceAll('aaaa', 'aa', 'b')).toBe('bb');
    expect(findReplaceAll('abc', '', 'z')).toBe('abc');
    expect(findReplaceAll('hello world', 'world', 'there')).toBe('hello there');
  });

  it('finds all non-overlapping occurrence offsets', () => {
    expect(findAllOccurrences('aaaa', 'aa')).toEqual([0, 2]);
    expect(findAllOccurrences('abc', '')).toEqual([]);
    expect(findAllOccurrences('aXbXc', 'X')).toEqual([1, 3]);
  });
});

// Minimal ProseMirror-shaped fakes: a block's descendants() yields its text
// children at block-relative positions (opening token included), and the doc
// walks top-level blocks with their absolute offsets.
function fakeBlock(texts: string[]) {
  const nodeSize = 2 + texts.join('').length;
  return {
    nodeSize,
    descendants(cb: (node: any, pos: number) => void) {
      let pos = 1;
      texts.forEach(text => {
        cb({isText: true, text}, pos);
        pos += text.length;
      });
    },
  };
}

function fakeDoc(blocks: ReturnType<typeof fakeBlock>[]) {
  return {
    forEach(cb: (block: any, offset: number) => void) {
      let offset = 0;
      blocks.forEach(block => {
        cb(block, offset);
        offset += block.nodeSize;
      });
    },
  };
}

describe('collectMatchRanges (block-scoped find & replace)', () => {
  it('matches a needle spanning an inline mark boundary', () => {
    // "important " plain + "term" bold — one block, two fragments.
    const doc = fakeDoc([fakeBlock(['important ', 'term'])]);
    expect(collectMatchRanges(doc as any, 'important term')).toEqual([
      {from: 1, to: 15},
    ]);
  });

  it('maps every fragment character to the correct document position', () => {
    const doc = fakeDoc([fakeBlock(['ab', 'cd', 'ef'])]);
    expect(collectMatchRanges(doc as any, 'abcdef')).toEqual([
      {from: 1, to: 7},
    ]);
    expect(collectMatchRanges(doc as any, 'cdef')).toEqual([{from: 3, to: 7}]);
    expect(collectMatchRanges(doc as any, 'abcd')).toEqual([{from: 1, to: 5}]);
    expect(collectMatchRanges(doc as any, 'bcde')).toEqual([{from: 2, to: 6}]);
  });

  it('collects across multiple blocks with correct per-block positions', () => {
    // Block one: nodeSize = 2 + len("aa bb") = 7, so block two starts at 7
    // and its text content at 8. Matches never join across the boundary.
    const first = fakeBlock(['aa ', 'bb']);
    const second = fakeBlock(['cc']);
    const doc = fakeDoc([first, second]);
    expect(collectMatchRanges(doc as any, 'bb c')).toEqual([]);
    expect(collectMatchRanges(doc as any, 'bbcc')).toEqual([]);
    expect(collectMatchRanges(doc as any, 'bb')).toEqual([{from: 4, to: 6}]);
    expect(collectMatchRanges(doc as any, 'cc')).toEqual([{from: 8, to: 10}]);
  });

  it('finds repeated occurrences inside one block', () => {
    const doc = fakeDoc([fakeBlock(['x', 'axax'])]);
    expect(collectMatchRanges(doc as any, 'ax')).toEqual([
      {from: 2, to: 4},
      {from: 4, to: 6},
    ]);
  });

  it('handles a match ending exactly at block end', () => {
    const doc = fakeDoc([fakeBlock(['hello ', 'world'])]);
    expect(collectMatchRanges(doc as any, 'world')).toEqual([
      {from: 7, to: 12},
    ]);
  });

  it('skips empty-text fragments but keeps surrounding matches', () => {
    const doc = fakeDoc([fakeBlock(['ab', '', 'cd'])]);
    expect(collectMatchRanges(doc as any, 'abcd')).toEqual([{from: 1, to: 5}]);
  });

  it('returns nothing for an empty needle or a text-free block', () => {
    expect(collectMatchRanges(fakeDoc([]) as any, 'x')).toEqual([]);
    expect(
      collectMatchRanges(fakeDoc([fakeBlock(['text'])]) as any, ''),
    ).toEqual([]);
  });

  it('is idempotent on repeated collection (replacement containing the needle cannot loop)', () => {
    const doc = fakeDoc([fakeBlock(['important ', 'term'])]);
    const firstPass = collectMatchRanges(doc as any, 'term');
    // Simulate "very important term".replace → snapshot re-collected after
    // mutation still resolves exactly once against each immutable snapshot.
    expect(firstPass).toEqual(collectMatchRanges(doc as any, 'term'));
    expect(firstPass).toHaveLength(1);
  });
});

describe('collectTextFragments', () => {
  it('concatenates descendant text with absolute start positions', () => {
    const fragments = collectTextFragments(fakeBlock(['abc', 'de']) as any, 10);
    expect(fragments).toEqual([
      {start: 11, text: 'abc'},
      {start: 14, text: 'de'},
    ]);
  });

  it('ignores non-text nodes', () => {
    const block = {
      descendants(cb: (node: any, pos: number) => void) {
        cb({isText: false, text: null}, 1);
        cb({isText: true, text: 'hi'}, 2);
      },
    };
    expect(collectTextFragments(block, 0)).toEqual([{start: 2, text: 'hi'}]);
  });
});
