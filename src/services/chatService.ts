import {SourcePaper} from './literatureSearch';
import {formatMarker} from './citationFormat';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  applied?: boolean;
  createdAt?: number;
}

const MAX_PAPER_CHARS = 15_000;
const DEFAULT_TRIM = 50;

export function buildSystemPrompt(
  paperText: string,
  sources: SourcePaper[],
  style: string,
  edition: string,
): string {
  const truncated =
    paperText.length > MAX_PAPER_CHARS
      ? `${paperText.slice(0, MAX_PAPER_CHARS)}\n\n[paper truncated]`
      : paperText;
  const sourceLines = sources
    .map(
      (s, i) =>
        `${formatMarker(s, style, i + 1)} — ${s.authors
          .slice(0, 3)
          .join(', ')} (${s.year}). ${s.title}.`,
    )
    .join('\n');
  return `You are PaperMind, an academic writing assistant embedded in the paper editor.
You are helping with the current paper. Answer concisely and academically.
You may suggest text edits; when you do, output the exact replacement text in a fenced block so it can be applied.

Citation style: ${style.toUpperCase()} ${edition}
Sources available (use their exact in-text markers):
${sourceLines || '(none)'}

Current paper content:
${truncated}`;
}

export function trimMessages(
  messages: ChatMessage[],
  max: number = DEFAULT_TRIM,
): ChatMessage[] {
  if (messages.length <= max) {
    return messages;
  }
  return messages.slice(messages.length - max);
}
