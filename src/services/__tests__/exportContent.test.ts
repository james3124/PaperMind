jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: {open: jest.fn().mockResolvedValue(undefined)},
}));

jest.mock('jszip');

import {
  getFileNameFromPath,
  exportAndShareDocx,
} from '@/services/exportContent';

describe('getFileNameFromPath', () => {
  it('returns the trailing filename', () => {
    expect(
      getFileNameFromPath(
        '/data/user/0/com.papermind/cache/export/My_Paper.docx',
      ),
    ).toBe('My_Paper.docx');
  });

  it('falls back when path is empty', () => {
    expect(getFileNameFromPath('')).toBe('paper.docx');
  });
});

describe('exportAndShareDocx wiring', () => {
  it('exports a DOCX and opens the share sheet', async () => {
    const {writeFile, mkdir} = require('react-native-fs');
    const Share = require('react-native-share').default;

    await exportAndShareDocx('My Title', 'Hello\nWorld');

    expect(mkdir).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalled();
    expect(Share.open).toHaveBeenCalled();
  });
});
