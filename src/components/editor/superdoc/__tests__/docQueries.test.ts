import {
  collectHeadings,
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
