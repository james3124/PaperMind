import RNFS from 'react-native-fs';

const PAPERS_DIR = `${RNFS.DocumentDirectoryPath}/papers`;
const BLANK_ASSET = 'documents/blank.docx';

function pathFor(id: string): string {
  return `${PAPERS_DIR}/${id}.docx`;
}

export function paperPath(id: string): string {
  return pathFor(id);
}

async function ensureDir(): Promise<void> {
  if (!(await RNFS.exists(PAPERS_DIR))) {
    await RNFS.mkdir(PAPERS_DIR);
  }
}

// Best-effort cleanup; failures here must never mask the primary error.
async function tryUnlink(path: string): Promise<void> {
  try {
    await RNFS.unlink(path);
  } catch {}
}

export async function savePaperDocx(id: string, base64: string): Promise<void> {
  await ensureDir();
  const dest = pathFor(id);
  const tmp = `${dest}.tmp`;
  const backup = `${dest}.bak`;
  let backupCreated = false;
  try {
    await RNFS.writeFile(tmp, base64, 'base64');
    if (await RNFS.exists(dest)) {
      await RNFS.moveFile(dest, backup);
      backupCreated = true;
    }
    try {
      await RNFS.moveFile(tmp, dest);
    } catch (moveErr) {
      if (backupCreated) {
        // Roll back so the previous good file survives a failed swap.
        await RNFS.moveFile(backup, dest);
      }
      throw moveErr;
    }
    if (backupCreated) {
      await tryUnlink(backup);
    }
  } catch (err) {
    await tryUnlink(tmp);
    throw err;
  }
}

export async function loadPaperDocx(id: string): Promise<string> {
  return RNFS.readFile(pathFor(id), 'base64');
}

export async function deletePaperDocx(id: string): Promise<void> {
  // Sweep the atomic-save siblings too: a crash during autosave can strand
  // .tmp/.bak next to the deleted paper.
  const dest = pathFor(id);
  for (const p of [dest, `${dest}.tmp`, `${dest}.bak`]) {
    await tryUnlink(p);
  }
}

export async function duplicatePaperDocx(
  srcId: string,
  destId: string,
): Promise<void> {
  if (srcId === destId) {
    throw new Error(
      `duplicatePaperDocx: source and destination ids must differ (${srcId})`,
    );
  }
  await ensureDir();
  const src = pathFor(srcId);
  if (!(await RNFS.exists(src))) {
    throw new Error(`duplicatePaperDocx: source paper not found at ${src}`);
  }
  await RNFS.copyFile(src, pathFor(destId));
}

// Imports an externally picked .docx (DocumentPicker file:// or content://
// URI) into the papers store under the given id, replacing whatever is there
// (typically the blank template provisioned by repository.create).
export async function importDocxFromUri(
  sourceUri: string,
  id: string,
): Promise<void> {
  await ensureDir();
  const src = sourceUri.replace(/^file:\/\//, '');
  await RNFS.copyFile(src, pathFor(id));
}

export async function copyBlankTemplate(destId: string): Promise<void> {
  await ensureDir();
  await RNFS.copyFileAssets(BLANK_ASSET, pathFor(destId));
}

// Snapshot restore reuses the atomic save path: the revision payload is a
// full docx base64, identical in shape to what autosave persists.
export const restoreFromBase64 = savePaperDocx;
