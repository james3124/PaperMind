import RNFS from 'react-native-fs';

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/docs',
  exists: jest.fn().mockResolvedValue(false),
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('AAA='),
  unlink: jest.fn().mockResolvedValue(undefined),
  moveFile: jest.fn().mockResolvedValue(undefined),
  copyFile: jest.fn().mockResolvedValue(undefined),
  copyFileAssets: jest.fn().mockResolvedValue(undefined),
}));

import {
  paperPath,
  savePaperDocx,
  loadPaperDocx,
  deletePaperDocx,
  duplicatePaperDocx,
  copyBlankTemplate,
  importDocxFromUri,
} from '@/services/paperFileStore';

describe('paperFileStore', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('paperPath', () => {
    it('returns the absolute docx path for an id', () => {
      expect(paperPath('p1')).toBe('/mock/docs/papers/p1.docx');
    });
  });

  it('saves atomically via temp file', async () => {
    await savePaperDocx('p1', 'AAA=');
    expect(RNFS.writeFile).toHaveBeenCalledWith(
      '/mock/docs/papers/p1.docx.tmp',
      'AAA=',
      'base64',
    );
    expect(RNFS.moveFile).toHaveBeenCalledWith(
      '/mock/docs/papers/p1.docx.tmp',
      '/mock/docs/papers/p1.docx',
    );
  });

  it('creates the papers directory when missing', async () => {
    await copyBlankTemplate('p1');
    expect(RNFS.mkdir).toHaveBeenCalledWith('/mock/docs/papers');
  });

  it('does not mkdir when papers directory exists', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValueOnce(true);
    await savePaperDocx('p1', 'AAA=');
    expect(RNFS.mkdir).not.toHaveBeenCalled();
  });

  it('restores previous file when swap-in fails', async () => {
    (RNFS.exists as jest.Mock)
      .mockResolvedValueOnce(false) // ensureDir: papers dir missing
      .mockResolvedValueOnce(true); // dest exists
    (RNFS.moveFile as jest.Mock)
      .mockResolvedValueOnce(undefined) // dest -> backup
      .mockRejectedValueOnce(new Error('move failed')); // tmp -> dest
    await expect(savePaperDocx('p1', 'AAA=')).rejects.toThrow('move failed');
    expect(RNFS.moveFile).toHaveBeenCalledWith(
      '/mock/docs/papers/p1.docx.bak',
      '/mock/docs/papers/p1.docx',
    );
    expect(RNFS.unlink).not.toHaveBeenCalledWith(
      '/mock/docs/papers/p1.docx.bak',
    );
  });

  it('cleans up orphaned temp file on failure', async () => {
    (RNFS.writeFile as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await expect(savePaperDocx('p1', 'AAA=')).rejects.toThrow('disk full');
    expect(RNFS.unlink).toHaveBeenCalledWith('/mock/docs/papers/p1.docx.tmp');
  });

  it('loads by id', async () => {
    await expect(loadPaperDocx('p1')).resolves.toBe('AAA=');
    expect(RNFS.readFile).toHaveBeenCalledWith(
      '/mock/docs/papers/p1.docx',
      'base64',
    );
  });

  it('delete ignores missing files', async () => {
    (RNFS.unlink as jest.Mock).mockRejectedValueOnce(new Error('nope'));
    await expect(deletePaperDocx('p1')).resolves.toBeUndefined();
  });

  it('duplicates copies source to destination', async () => {
    (RNFS.exists as jest.Mock)
      .mockResolvedValueOnce(true) // ensureDir
      .mockResolvedValueOnce(true); // source file
    await duplicatePaperDocx('a', 'b');
    expect(RNFS.copyFile).toHaveBeenCalledWith(
      '/mock/docs/papers/a.docx',
      '/mock/docs/papers/b.docx',
    );
  });

  it('duplicate rejects identical source and destination ids', async () => {
    await expect(duplicatePaperDocx('a', 'a')).rejects.toThrow('must differ');
    expect(RNFS.copyFile).not.toHaveBeenCalled();
  });

  it('duplicate rejects a missing source file', async () => {
    await expect(duplicatePaperDocx('missing', 'b')).rejects.toThrow(
      'source paper not found',
    );
    expect(RNFS.copyFile).not.toHaveBeenCalled();
  });

  it('importDocxFromUri copies the picked file into the papers store', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValueOnce(true); // ensureDir
    await importDocxFromUri('file:///cache/picked.docx', 'p7');
    expect(RNFS.copyFile).toHaveBeenCalledWith(
      '/cache/picked.docx',
      '/mock/docs/papers/p7.docx',
    );
  });

  it('copyBlankTemplate copies the bundled asset into place', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValueOnce(true); // ensureDir
    await copyBlankTemplate('p9');
    expect(RNFS.copyFileAssets).toHaveBeenCalledWith(
      'documents/blank.docx',
      '/mock/docs/papers/p9.docx',
    );
  });

  it('restoreFromBase64 delegates to atomic save', async () => {
    const {restoreFromBase64} = require('@/services/paperFileStore');
    await restoreFromBase64('p9', 'QQ==');
    expect(RNFS.moveFile).toHaveBeenCalledWith(
      '/mock/docs/papers/p9.docx.tmp',
      '/mock/docs/papers/p9.docx',
    );
  });
});
