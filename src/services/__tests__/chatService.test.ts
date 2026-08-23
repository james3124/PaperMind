import {buildSystemPrompt, trimMessages, ChatMessage} from '../chatService';
import {SourcePaper} from '../literatureSearch';

const sources: SourcePaper[] = [
  {
    title: 'Mobile learning',
    authors: ['Smith, J.'],
    year: 2020,
    abstract: '',
    doi: '10.1000/xyz',
    url: 'https://doi.org/10.1000/xyz',
    source: 'crossref',
  },
];

it('builds a paper-aware system prompt with markers', () => {
  const prompt = buildSystemPrompt(
    'Full paper text here',
    sources,
    'apa',
    '7th',
  );
  expect(prompt).toContain('Full paper text here');
  expect(prompt).toContain('(Smith, 2020)');
  expect(prompt).toContain('Mobile learning');
});

it('truncates paper content beyond 15000 chars', () => {
  const longPaper = 'a'.repeat(20000);
  const prompt = buildSystemPrompt(longPaper, sources, 'apa', '7th');
  expect(prompt.length).toBeLessThan(16000);
  expect(prompt).toContain('truncated');
});

it('trims history to last 50 messages', () => {
  const messages: ChatMessage[] = Array.from({length: 60}, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `msg ${i}`,
  }));
  const trimmed = trimMessages(messages);
  expect(trimmed).toHaveLength(50);
  expect(trimmed[0].content).toBe('msg 10');
  expect(trimmed[49].content).toBe('msg 59');
});

it('keeps short histories unchanged', () => {
  const messages: ChatMessage[] = [{role: 'user', content: 'hi'}];
  expect(trimMessages(messages)).toHaveLength(1);
});
