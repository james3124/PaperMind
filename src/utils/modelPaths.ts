import RNFS from 'react-native-fs';

export const MODEL_FILENAME = 'qwen2.5-0.5b-instruct-q8_0.gguf';

export function getModelDir(): string {
  return `${RNFS.DocumentDirectoryPath}/models`;
}

export function getModelPath(): string {
  return `${getModelDir()}/${MODEL_FILENAME}`;
}

export const MODEL_URL =
  'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q8_0.gguf';

export async function modelExists(): Promise<boolean> {
  return RNFS.exists(getModelPath());
}

export async function ensureModelDir(): Promise<void> {
  const dir = getModelDir();
  const exists = await RNFS.exists(dir);
  if (!exists) {
    await RNFS.mkdir(dir);
  }
}
