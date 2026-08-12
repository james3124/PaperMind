import RNFS from 'react-native-fs';

export const MODEL_FILENAME = 'qwen2.5-0.5b-instruct-q8_0.gguf';
export const MODEL_DIR      = `${RNFS.DocumentDirectoryPath}/models`;
export const MODEL_PATH     = `${MODEL_DIR}/${MODEL_FILENAME}`;
export const MODEL_URL      = 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q8_0.gguf';

// Bundled in the APK at android/app/src/main/assets/models/. Path is relative
// to the Android assets root.
export const BUNDLED_MODEL_PATH = `models/${MODEL_FILENAME}`;

export async function modelExists(): Promise<boolean> {
  return RNFS.exists(MODEL_PATH);
}

export async function bundledModelExists(): Promise<boolean> {
  return RNFS.existsAssets(BUNDLED_MODEL_PATH);
}

export async function ensureModelDir(): Promise<void> {
  const exists = await RNFS.exists(MODEL_DIR);
  if (!exists) await RNFS.mkdir(MODEL_DIR);
}

// Copies the model bundled in the APK assets into internal storage where the
// llama context can load it. Returns true on success, false if the bundled
// asset is missing.
export async function copyBundledModel(): Promise<boolean> {
  if (!(await bundledModelExists())) return false;

  await ensureModelDir();
  if (await RNFS.exists(MODEL_PATH)) await RNFS.unlink(MODEL_PATH);

  await RNFS.copyFileAssets(BUNDLED_MODEL_PATH, MODEL_PATH);
  return true;
}
