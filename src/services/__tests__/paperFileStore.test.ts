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

import {savePaperDocx, loadPaperDocx, deletePaperDocx, duplicatePaperDocx} from '@/services/paperFileStore';

describe('paperFileStore', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saves atomically via temp file', async () => {
    await savePaperDocx('p1', 'AAA=');
    expect(RNFS.writeFile).toHaveBeenCalledWith('/mock/docs/papers/p1.docx.tmp', 'AAA=', 'base64');
    expect(RNFS.moveFile).toHaveBeenCalledWith('/mock/docs/papers/p1.docx.tmp', '/mock/docs/papers/p1.docx');
  });

  it('loads by id', async () => {
    await expect(loadPaperDocx('p1')).resolves.toBe('AAA=');
    expect(RNFS.readFile).toHaveBeenCalledWith('/mock/docs/papers/p1.docx', 'base64');
  });

  it('delete ignores missing files', async () => {
    (RNFS.unlink as jest.Mock).mockRejectedValueOnce(new Error('nope'));
    await expect(deletePaperDocx('p1')).resolves.toBeUndefined();
  });

  it('duplicates copies source to destination', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValueOnce(true);
    await duplicatePaperDocx('a', 'b');
    expect(RNFS.copyFile).toHaveBeenCalledWith('/mock/docs/papers/a.docx', '/mock/docs/papers/b.docx');
  });
});
