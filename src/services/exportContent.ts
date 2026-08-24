import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import {paperPath} from './paperFileStore';

// Shares the stored papers/<id>.docx directly — no rebuilding from text. The
// file is copied to a readable, title-named path first; the original paper
// file is never touched (a failed share cannot corrupt it).
export async function shareExistingDocx(doc: {
  id: string;
  title: string;
}): Promise<void> {
  const fileName = `${sanitizeTitle(doc.title)}.docx`;
  // App-private cache works on Android 10+ scoped storage without extra
  // permissions; the system share sheet gets the file:// URL.
  const sharePath = `${RNFS.CachesDirectoryPath}/export/${fileName}`;
  await RNFS.mkdir(`${RNFS.CachesDirectoryPath}/export`);
  await RNFS.copyFile(paperPath(doc.id), sharePath);
  await Share.open({
    url: `file://${sharePath}`,
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    title: `Share ${fileName}`,
  });
}

export function sanitizeTitle(title: string): string {
  const safe = title
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return safe || 'paper';
}
