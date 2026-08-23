import RNFS from 'react-native-fs';

const PAPERS_DIR = `${RNFS.DocumentDirectoryPath}/papers`;
const BLANK_ASSET = 'documents/blank.docx';

function pathFor(id: string): string {
  return `${PAPERS_DIR}/${id}.docx`;
}

async function ensureDir(): Promise<void> {
  if (!(await RNFS.exists(PAPERS_DIR))) {
    await RNFS.mkdir(PAPERS_DIR);
  }
}

export async function savePaperDocx(id: string, base64: string): Promise<void> {
  await ensureDir();
  const dest = pathFor(id);
  const tmp = `${dest}.tmp`;
  await RNFS.writeFile(tmp, base64, 'base64');
  try {
    await RNFS.unlink(dest);
  } catch {}
  await RNFS.moveFile(tmp, dest);
}

export async function loadPaperDocx(id: string): Promise<string> {
  return RNFS.readFile(pathFor(id), 'base64');
}

export async function deletePaperDocx(id: string): Promise<void> {
  try {
    await RNFS.unlink(pathFor(id));
  } catch {}
}

export async function duplicatePaperDocx(srcId: string, destId: string): Promise<void> {
  await ensureDir();
  await RNFS.copyFile(pathFor(srcId), pathFor(destId));
}

export async function copyBlankTemplate(destId: string): Promise<void> {
  await ensureDir();
  await RNFS.copyFileAssets(BLANK_ASSET, pathFor(destId));
}
