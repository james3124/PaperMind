import RNFS from 'react-native-fs';

export const MODEL_FILENAME = 'qwen2.5-0.5b-instruct-q8_0.gguf';
export const MODEL_DIR      = `${RNFS.DocumentDirectoryPath}/models`;
export const MODEL_PATH     = `${MODEL_DIR}/${MODEL_FILENAME}`;
export const MODEL_URL      = 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q8_0.gguf';

export async function modelExists(): Promise<boolean> {
  return RNFS.exists(MODEL_PATH);
}

export async function ensureModelDir(): Promise<void> {
  const exists = await RNFS.exists(MODEL_DIR);
  if (!exists) await RNFS.mkdir(MODEL_DIR);
}
