import { initLlama, LlamaContext } from 'llama.rn';
import { MODEL_PATH } from '@/utils/modelPaths';
import { useSettingsStore } from '@/stores/settingsStore';

export interface CompletionMessage {
  role:    'system' | 'user' | 'assistant';
  content: string;
}

const IDLE_TIMEOUT_MS = 3 * 60 * 1000;

// ── Singleton context ─────────────────────────────────────────────────────────

let _context: LlamaContext | null = null;
let _idleTimer: ReturnType<typeof setTimeout> | null = null;

function clearIdleTimer(): void {
  if (_idleTimer) {
    clearTimeout(_idleTimer);
    _idleTimer = null;
  }
}

function resetIdleTimer(): void {
  clearIdleTimer();
  _idleTimer = setTimeout(() => {
    void releaseModel();
  }, IDLE_TIMEOUT_MS);
}

async function ensureModelLoaded(): Promise<void> {
  if (!_context) {
    await initModel(MODEL_PATH);
    useSettingsStore.getState().setModelLoaded(true);
  }
}

export function isModelLoaded(): boolean {
  return _context !== null;
}

export async function initModel(modelPath: string): Promise<void> {
  if (_context) return; // Already loaded
  _context = await initLlama({
    model:        modelPath,
    n_ctx:        2048,
    n_threads:    4,
    n_gpu_layers: 0,   // CPU only — Android GPU support is unstable
  });
  resetIdleTimer();
}

export async function releaseModel(): Promise<void> {
  clearIdleTimer();
  if (_context) {
    await _context.release();
    _context = null;
  }
  useSettingsStore.getState().setModelLoaded(false);
}

// ── Prompt formatting ─────────────────────────────────────────────────────────
// Qwen2.5 uses ChatML format:
// <|im_start|>system\n{system}<|im_end|>\n
// <|im_start|>user\n{user}<|im_end|>\n
// <|im_start|>assistant\n

export function formatChatML(messages: CompletionMessage[]): string {
  let prompt = '';
  for (const msg of messages) {
    prompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
  }
  prompt += '<|im_start|>assistant\n';
  return prompt;
}

// ── Inference ─────────────────────────────────────────────────────────────────

export async function complete(
  messages:     CompletionMessage[],
  temperature:  number = 0.7,
  maxTokens:    number = 1024,
): Promise<string> {
  await ensureModelLoaded();
  resetIdleTimer();

  const prompt = formatChatML(messages);
  const result = await _context!.completion({
    prompt,
    n_predict:   maxTokens,
    temperature,
    stop:        ['<|im_end|>', '<|im_start|>'],
  });

  return result.text.trim();
}

export async function stream(
  messages:    CompletionMessage[],
  onToken:     (token: string) => void,
  temperature: number = 0.7,
  maxTokens:   number = 1024,
): Promise<void> {
  await ensureModelLoaded();
  resetIdleTimer();

  const prompt = formatChatML(messages);
  await _context!.completion(
    {
      prompt,
      n_predict:   maxTokens,
      temperature,
      stop:        ['<|im_end|>', '<|im_start|>'],
    },
    (data) => {
      if (data.token) onToken(data.token);
    }
  );
}
