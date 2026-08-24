jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  DocumentDirectoryPath: '/mock/docs',
  mkdir: jest.fn().mockResolvedValue(undefined),
  copyFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: {open: jest.fn().mockResolvedValue(undefined)},
}));

import {sanitizeTitle, shareExistingDocx} from '@/services/exportContent';

describe('sanitizeTitle', () => {
  it('strips unsafe characters and uses underscores', () => {
    expect(sanitizeTitle('My: Cool/Paper?')).toBe('My_CoolPaper');
  });

  it('falls back to "paper" when nothing survives', () => {
    expect(sanitizeTitle('???')).toBe('paper');
  });
});

describe('shareExistingDocx', () => {
  it('copies the stored paper to a titled path and opens the share sheet', async () => {
    const {copyFile, mkdir} = require('react-native-fs');
    const Share = require('react-native-share').default;

    await shareExistingDocx({id: 'doc1', title: 'My Title'});

    expect(mkdir).toHaveBeenCalledWith('/cache/export');
    expect(copyFile).toHaveBeenCalledWith(
      '/mock/docs/papers/doc1.docx',
      '/cache/export/My_Title.docx',
    );
    expect(Share.open).toHaveBeenCalledWith(
      expect.objectContaining({url: 'file:///cache/export/My_Title.docx'}),
    );
  });
});
