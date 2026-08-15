import RNFS from 'react-native-fs';

export const MODEL_FILENAME = 'qwen2.5-0.5b-instruct-q8_0.gguf';
export function getModelDir(): string {
  return `${RNFS.DocumentDirectoryPath}/models`;
}
export function getModelPath(): string {
  return `${getModelDir()}/${MODEL_FILENAME}`;
}
export const MODEL_URL = 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q8_0.gguf';

// Bundled in the APK at android/app/src/main/assets/models/. Path is relative
// to the Android assets root.
export const BUNDLED_MODEL_PATH = `models/${MODEL_FILENAME}`;

export async function modelExists(): Promise<boolean> {
  return RNFS.exists(getModelPath());
}

export async function bundledModelExists(): Promise<boolean> {
  return RNFS.existsAssets(BUNDLED_MODEL_PATH);
}

export async function ensureModelDir(): Promise<void> {
  const dir = getModelDir();
  const exists = await RNFS.exists(dir);
  if (!exists) await RNFS.mkdir(dir);
}

// Copies the model bundled in the APK assets into internal storage where the
// llama context can load it. Returns true on success, false if the bundled
// asset is missing.
export async function copyBundledModel(): Promise<boolean> {
  if (!(await bundledModelExists())) return false;

  await ensureModelDir();
  const dest = getModelPath();
  if (await RNFS.exists(dest)) await RNFS.unlink(dest);

  await RNFS.copyFileAssets(BUNDLED_MODEL_PATH, dest);
  return true;
}