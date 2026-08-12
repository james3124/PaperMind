import { initLlama, LlamaContext } from 'llama.rn';

export interface CompletionMessage {
  role:    'system' | 'user' | 'assistant';
  content: string;
}

// ── Singleton context ─────────────────────────────────────────────────────────

let _context: LlamaContext | null = null;

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
}

export async function releaseModel(): Promise<void> {
  if (_context) {
    await _context.release();
    _context = null;
  }
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
  if (!_context) throw new Error('Model not loaded. Call initModel() first.');

  const prompt = formatChatML(messages);
  const result = await _context.completion({
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
  if (!_context) throw new Error('Model not loaded. Call initModel() first.');

  const prompt = formatChatML(messages);
  await _context.completion(
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
