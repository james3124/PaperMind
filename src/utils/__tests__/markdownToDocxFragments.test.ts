import {markdownToBlocks} from '@/utils/markdownToDocxFragments';

describe('markdownToBlocks', () => {
  it('maps headings by level', () => {
    expect(markdownToBlocks('# Title')).toEqual([
      {
        type: 'heading',
        attrs: {level: 1},
        content: [{type: 'text', text: 'Title'}],
      },
    ]);
  });

  it('parses bold and italic inline', () => {
    const [para] = markdownToBlocks('plain **bold** *ital* end') as Array<{
      content: Array<{text?: string; marks?: Array<{type: string}>}>;
    }>;
    expect(para.content).toEqual([
      {type: 'text', text: 'plain '},
      {type: 'text', marks: [{type: 'bold'}], text: 'bold'},
      {type: 'text', text: ' '},
      {type: 'text', marks: [{type: 'italic'}], text: 'ital'},
      {type: 'text', text: ' end'},
    ]);
  });

  it('maps bullets and numbered lists', () => {
    const blocks = markdownToBlocks('- a\n- b\n1. c');
    expect(blocks.filter(b => b.type === 'bulletList')).toHaveLength(1);
    expect(blocks.filter(b => b.type === 'orderedList')).toHaveLength(1);
  });
});
