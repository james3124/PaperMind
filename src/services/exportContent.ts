import RNFS from 'react-native-fs';
import {exportDocx, shareDocx} from './docxExport';

export async function exportAndShareDocx(
  title: string,
  content: string,
): Promise<void> {
  const outPath = await exportDocx(title, content);
  const fileName = outPath.split('/').pop() ?? `${title || 'paper'}.docx`;
  await shareDocx(outPath, fileName);
}

export function getFileNameFromPath(path: string): string {
  const name = path.split('/').pop() ?? '';
  return name.length > 0 ? name : 'paper.docx';
}

export {RNFS};

export async function ensureExportDir(): Promise<void> {
  await RNFS.mkdir(`${RNFS.CachesDirectoryPath}/export`);
}
