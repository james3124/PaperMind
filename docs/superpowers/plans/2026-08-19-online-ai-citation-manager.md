# Online AI + Citation Manager + Editor Chat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let PaperMind write papers via any OpenAI-compatible cloud endpoint (with on-device fallback), let users pick literature sources and review papers before generation, swap individual citations from the editor with deterministic auto-updated references, and chat with a paper-aware assistant inside the editor.

**Architecture:** Provider-agnostic inference router (`inference.ts`) dispatches to local llama or a new cloud SSE client. Sources are stored as structured metadata (`sourcesJson`) so the References section is generated deterministically (`citationFormat.ts` + `referencesService.ts`) instead of by the LLM. The editor gets two new WebView commands (`replaceCitationMarkers`, `replaceReferences`) for in-place citation swaps, plus a `ChatPanel` with per-paper persisted history (`chatJson`).

**Tech Stack:** React Native 0.74, TypeScript, Zustand (AsyncStorage persistence), WatermelonDB (schema v1 → v2), Quill.js in WebView, axios, Jest.

**Spec:** `docs/superpowers/specs/2026-08-19-online-ai-citation-manager-design.md`

## Global Constraints

- Jest command: `npx jest <path>` from the repo root (`/public/PROJECT/PaperMind-master (5)/PaperMind-master`).
- All new service modules must export pure, unit-testable functions; components stay thin.
- Marker strings must be produced ONLY by `citationFormat.formatMarker` — never hardcoded in prompts or UI.
- `SourcePaper` type comes from `src/services/literatureSearch.ts` and is imported, never redefined.
- `ChatMessage` type is defined in `src/services/chatService.ts` — import it everywhere it is needed.
- API key lives only in the settings store (AsyncStorage). Never log, print, or commit it.
- No new npm dependencies.
- All commits on `master` in the existing repo; message style: `feat: ...` / `test: ...` (existing convention).
- Work from repo root: `/public/PROJECT/PaperMind-master (5)/PaperMind-master`

---

### Task 1: DB migration v2 — `sources_json` + `chat_json`

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/migrations/index.ts`
- Modify: `src/db/models/Document.ts`
- Modify: `src/db/DocumentRepository.ts`
- Test: `src/db/__tests__/DocumentRepository.test.ts`

**Interfaces:**
- Produces: `Document.sourcesJson: string`, `Document.chatJson: string`; `documentRepository.updateSources(id: string, sources: SourcePaper[]): Promise<void>`; `documentRepository.updateChat(id: string, messages: ChatMessage[]): Promise<void>`; `update(id, changes)` now also accepts `sourcesJson: string`, `chatJson: string`.

- [ ] **Step 1: Write the failing tests**

In `src/db/__tests__/DocumentRepository.test.ts`, add:

```ts
import {SourcePaper} from '@/services/literatureSearch';

const sourcePaper: SourcePaper = {
  title: 'Mobile learning effects',
  authors: ['Smith, J.'],
  year: 2020,
  abstract: 'Abstract text',
  doi: '10.1000/xyz',
  url: 'https://doi.org/10.1000/xyz',
  source: 'crossref',
};

it('updateSources persists sourcesJson and updateChat persists chatJson', async () => {
  const doc = await documentRepository.create('Sources test');
  await documentRepository.updateSources(doc.id, [sourcePaper]);
  await documentRepository.updateChat(doc.id, [
    {role: 'user', content: 'hello'},
    {role: 'assistant', content: 'hi', applied: true},
  ]);
  const reloaded = await documentRepository.getById(doc.id);
  expect(JSON.parse(reloaded!.sourcesJson)).toEqual([sourcePaper]);
  expect(JSON.parse(reloaded!.chatJson)).toEqual([
    {role: 'user', content: 'hello'},
    {role: 'assistant', content: 'hi', applied: true},
  ]);
});

it('duplicate copies sourcesJson and chatJson', async () => {
  const doc = await documentRepository.create('Dup sources test');
  await documentRepository.updateSources(doc.id, [sourcePaper]);
  await documentRepository.updateChat(doc.id, [{role: 'user', content: 'x'}]);
  const copy = await documentRepository.duplicate(doc.id);
  expect(copy.sourcesJson).toBe(doc.sourcesJson);
  expect(copy.chatJson).toBe(doc.chatJson);
});
```

Note: `ChatMessage` is not created until Task 11; to keep Task 1 green, define the shape inline as an object literal (no import needed — the test passes plain objects).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/db/__tests__/DocumentRepository.test.ts`
Expected: FAIL — `sourcesJson`/`chatJson` are `undefined` and `updateSources`/`updateChat` don't exist.

- [ ] **Step 3: Implement schema v2 + migration**

`src/db/schema.ts` — bump version and add columns:

```ts
export const schema = appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: 'documents',
      columns: [
        {name: 'title', type: 'string'},
        {name: 'content', type: 'string'},
        {name: 'word_count', type: 'number'},
        {name: 'citation_style', type: 'string'},
        {name: 'citation_edition', type: 'string'},
        {name: 'sources_json', type: 'string'},
        {name: 'chat_json', type: 'string'},
        {name: 'status', type: 'string'},
        {name: 'starred', type: 'boolean'},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
  ],
});
```

`src/db/migrations/index.ts`:

```ts
import {schemaMigrations, addColumns} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'documents',
          columns: [
            {name: 'sources_json', type: 'string'},
            {name: 'chat_json', type: 'string'},
          ],
        }),
      ],
    },
  ],
});
```

- [ ] **Step 4: Update the Document model**

`src/db/models/Document.ts` — add after `citation_edition`:

```ts
  @field('sources_json') sourcesJson!: string;
  @field('chat_json') chatJson!: string;
```

- [ ] **Step 5: Update the repository**

`src/db/DocumentRepository.ts`:
- Import `SourcePaper` from `@/services/literatureSearch`.
- In `create(...)`: add `doc.sourcesJson = ''; doc.chatJson = '';` before `doc.updatedAt`.
- In `update(...)` changes type: add `sourcesJson: string; chatJson: string;` and apply:

```ts
        if (changes.sourcesJson !== undefined) {
          d.sourcesJson = changes.sourcesJson;
        }
        if (changes.chatJson !== undefined) {
          d.chatJson = changes.chatJson;
        }
```

- In `duplicate(...)`: add `doc.sourcesJson = original.sourcesJson; doc.chatJson = original.chatJson;` after `doc.citationEdition`.
- Add two methods:

```ts
  async updateSources(id: string, sources: SourcePaper[]): Promise<void> {
    await this.update(id, {sourcesJson: JSON.stringify(sources)});
  },

  async updateChat(id: string, messages: unknown[]): Promise<void> {
    await this.update(id, {chatJson: JSON.stringify(messages)});
  },
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest src/db/__tests__/DocumentRepository.test.ts`
Expected: PASS (both new tests + existing ones)

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.ts src/db/migrations/index.ts src/db/models/Document.ts src/db/DocumentRepository.ts src/db/__tests__/DocumentRepository.test.ts
git commit -m "feat: add sources_json and chat_json to documents (schema v2)"
```

---

### Task 2: `literatureSearch` — user-selectable sources

**Files:**
- Modify: `src/services/literatureSearch.ts`
- Test: `src/services/__tests__/literatureSearch.test.ts`

**Interfaces:**
- Produces: `export type SourceKey = 'crossref' | 'openalex' | 'semanticscholar' | 'arxiv';` and `searchLiterature(topic: string, researchQuestions: string[] = [], enabledSources?: SourceKey[]): Promise<SourcePaper[]>`. When `enabledSources` is undefined, all four are used (backwards compatible).

- [ ] **Step 1: Write the failing tests**

Add to `src/services/__tests__/literatureSearch.test.ts`:

```ts
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedAxios.get.mockImplementation((url: string) => {
    if (String(url).includes('crossref')) {
      return Promise.resolve({
        data: {
          message: {
            items: [
              {
                title: ['Only crossref result'],
                author: [{family: 'Smith', given: 'John'}],
                published: {'date-parts': [[2020]]},
              },
            ],
          },
        },
      });
    }
    if (String(url).includes('arxiv')) {
      return Promise.resolve({
        data: `<?xml version="1.0"?><feed><entry><title>Only arxiv result</title><id>http://arxiv.org/abs/2001.00001v1</id><published>2020-01-01T00:00:00Z</published><summary>Some abstract</summary><author><name>Jane Doe</name></author></entry></feed>`,
      });
    }
    return Promise.resolve({data: {results: []}}); // openalex
    // semanticscholar would return {data: {data: []}} — never reached when disabled
  });
});

it('searches only enabled sources', async () => {
  const results = await searchLiterature('test topic', [], [
    'crossref',
    'arxiv',
  ]);
  const calledUrls = mockedAxios.get.mock.calls.map(c => String(c[0]));
  expect(calledUrls.some(u => u.includes('api.semanticscholar.org'))).toBe(
    false,
  );
  expect(calledUrls.some(u => u.includes('api.openalex.org'))).toBe(false);
  expect(results.map(r => r.title)).toEqual([
    'Only crossref result',
    'Only arxiv result',
  ]);
});

it('uses all sources by default', async () => {
  mockedAxios.get.mockResolvedValue({data: {results: []}});
  await searchLiterature('topic');
  const calledUrls = mockedAxios.get.mock.calls.map(c => String(c[0]));
  expect(calledUrls.some(u => u.includes('api.crossref.org'))).toBe(true);
  expect(calledUrls.some(u => u.includes('api.openalex.org'))).toBe(true);
  expect(calledUrls.some(u => u.includes('api.semanticscholar.org'))).toBe(
    true,
  );
  expect(calledUrls.some(u => u.includes('export.arxiv.org'))).toBe(true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/services/__tests__/literatureSearch.test.ts`
Expected: FAIL — third parameter is ignored (all sources called regardless).

- [ ] **Step 3: Implement source filtering**

In `src/services/literatureSearch.ts`:

```ts
export type SourceKey = 'crossref' | 'openalex' | 'semanticscholar' | 'arxiv';

const ALL_SOURCES: SourceKey[] = [
  'crossref',
  'openalex',
  'semanticscholar',
  'arxiv',
];
```

Change the main export:

```ts
export async function searchLiterature(
  topic: string,
  researchQuestions: string[] = [],
  enabledSources: SourceKey[] = ALL_SOURCES,
): Promise<SourcePaper[]> {
  const results = await Promise.allSettled([
    enabledSources.includes('crossref') ? fetchCrossRef(topic) : Promise.resolve([]),
    enabledSources.includes('openalex') ? fetchOpenAlex(topic) : Promise.resolve([]),
    enabledSources.includes('semanticscholar')
      ? fetchSemanticScholar(topic)
      : Promise.resolve([]),
    enabledSources.includes('arxiv') ? fetchArXiv(topic) : Promise.resolve([]),
  ]);
  // ...rest unchanged
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/services/__tests__/literatureSearch.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/literatureSearch.ts src/services/__tests__/literatureSearch.test.ts
git commit -m "feat: allow selecting which literature sources to search"
```

---

### Task 3: `citationFormat.ts` — deterministic markers + reference entries

**Files:**
- Create: `src/services/citationFormat.ts`
- Test: `src/services/__tests__/citationFormat.test.ts`

**Interfaces:**
- Produces:
  - `formatMarker(paper: SourcePaper, style: string, index: number): string` — in-text marker.
  - `formatReference(paper: SourcePaper, style: string, edition: string, index: number): string` — reference-list entry WITHOUT the leading list number (numbering added by `referencesService`).
  - Helper `familyName(author: string): string` — exported for tests.

**Marker rules** (`formatMarker`), `a1..an` = authors, `l(x)` = `familyName(x)`, `year` = paper.year:
- `ieee`, `vancouver`: `` `[${index}]` ``
- `apa`, `harvard`: 1 author `` `(${l(a1)}, ${year})` ``; 2 authors `` `(${l(a1)} & ${l(a2)}, ${year})` ``; 3+ `` `(${l(a1)} et al., ${year})` ``
- `mla`: 1 `` `(${l(a1)})` ``; 2 `` `(${l(a1)} and ${l(a2)})` ``; 3+ `` `(${l(a1)} et al.)` ``
- `chicago`: 1 `` `(${l(a1)} ${year})` ``; 2 `` `(${l(a1)} and ${l(a2)} ${year})` ``; 3+ `` `(${l(a1)} et al. ${year})` ``
- unknown style: `` `[${index}]` ``

`familyName(author)`: split on `,`, take first part, trim, split on whitespace, take last token; empty → `'Unknown'`.

**Reference rules** (`formatReference`), `urlPart = paper.doi ? 'https://doi.org/' + paper.doi : paper.url`, `initials(authors)` = `authors.map(a => familyName(a) + ', ' + givenInitials(a)).join(', ')` where `givenInitials(a)` takes the first letters of tokens after the comma (crossref-style `"Smith, J."`) or all non-final tokens (openalex-style `"John Smith"`); if no given names → just family names. For 4+ authors: `apa` keeps all, others use `first + ' et al.'`. Author list string is `authorsText(paper, style)`.

- `apa`: `` `${authorsText}, (${year}). ${title}. ${urlPart}` `` (url omitted if neither doi nor url)
- `mla`: `` `${authorsText}. "${title}." ${year}, ${urlPart}.` ``
- `ieee`: `` `[${index}] ${authorsText}, "${title}," ${year}.` `` (authorsText = `family + initial.` e.g. `J. Smith`)
- `chicago`: `` `${authorsText}. ${year}. "${title}." ${urlPart}.` ``
- `harvard`: `` `${authorsText} (${year}) ${title}. Available at: ${urlPart}.` ``
- `vancouver`: `` `${index}. ${authorsText}. ${title}. ${year}.` `` (authorsText = `Smith J, Doe A`)
- unknown style: fall back to `apa` rules.

- [ ] **Step 1: Write the failing tests**

Create `src/services/__tests__/citationFormat.test.ts`:

```ts
import {formatMarker, formatReference, familyName} from '../citationFormat';
import {SourcePaper} from '../literatureSearch';

const paper: SourcePaper = {
  title: 'The impact of mobile learning',
  authors: ['Smith, J.', 'Doe, A.'],
  year: 2020,
  abstract: '',
  doi: '10.1000/xyz',
  url: 'https://doi.org/10.1000/xyz',
  source: 'crossref',
};

describe('familyName', () => {
  it('handles crossref and openalex author formats', () => {
    expect(familyName('Smith, J.')).toBe('Smith');
    expect(familyName('John Smith')).toBe('Smith');
    expect(familyName('')).toBe('Unknown');
  });
});

describe('formatMarker', () => {
  it('numeric styles use bracket index', () => {
    expect(formatMarker(paper, 'ieee', 3)).toBe('[3]');
    expect(formatMarker(paper, 'vancouver', 3)).toBe('[3]');
  });
  it('apa/harvard: two authors with ampersand', () => {
    expect(formatMarker(paper, 'apa', 1)).toBe('(Smith & Doe, 2020)');
    expect(formatMarker(paper, 'harvard', 1)).toBe('(Smith & Doe, 2020)');
  });
  it('apa/harvard: three authors use et al.', () => {
    const three = {...paper, authors: ['Smith, J.', 'Doe, A.', 'Roe, B.']};
    expect(formatMarker(three, 'apa', 1)).toBe('(Smith et al., 2020)');
  });
  it('mla: two authors use "and", no year', () => {
    expect(formatMarker(paper, 'mla', 1)).toBe('(Smith and Doe)');
  });
  it('chicago: author-date without comma', () => {
    expect(formatMarker(paper, 'chicago', 1)).toBe('(Smith and Doe 2020)');
  });
  it('unknown style falls back to numeric', () => {
    expect(formatMarker(paper, 'weird', 2)).toBe('[2]');
  });
});

describe('formatReference', () => {
  it('apa 7th', () => {
    expect(formatReference(paper, 'apa', '7th', 1)).toBe(
      'Smith, J., & Doe, A. (2020). The impact of mobile learning. https://doi.org/10.1000/xyz',
    );
  });
  it('ieee', () => {
    expect(formatReference(paper, 'ieee', '', 2)).toBe(
      '[2] J. Smith and A. Doe, "The impact of mobile learning," 2020.',
    );
  });
  it('vancouver', () => {
    expect(formatReference(paper, 'vancouver', '', 2)).toBe(
      '2. Smith J, Doe A. The impact of mobile learning. 2020.',
    );
  });
  it('mla 9th', () => {
    expect(formatReference(paper, 'mla', '9th', 1)).toBe(
      'Smith, J., and Doe, A. "The impact of mobile learning." 2020, https://doi.org/10.1000/xyz.',
    );
  });
  it('chicago 17th', () => {
    expect(formatReference(paper, 'chicago', '17th', 1)).toBe(
      'Smith, J., and Doe, A. 2020. "The impact of mobile learning." https://doi.org/10.1000/xyz.',
    );
  });
  it('harvard', () => {
    expect(formatReference(paper, 'harvard', '', 1)).toBe(
      'Smith, J., and Doe, A. (2020) The impact of mobile learning. Available at: https://doi.org/10.1000/xyz.',
    );
  });
  it('omits url when neither doi nor url present', () => {
    const noUrl = {...paper, doi: undefined, url: undefined};
    expect(formatReference(noUrl, 'apa', '7th', 1)).toBe(
      'Smith, J., & Doe, A. (2020). The impact of mobile learning.',
    );
  });
  it('four authors: apa lists all, mla uses et al.', () => {
    const four = {
      ...paper,
      authors: ['Smith, J.', 'Doe, A.', 'Roe, B.', 'Lee, C.'],
    };
    expect(formatReference(four, 'apa', '7th', 1)).toContain('& Lee, C.');
    expect(formatReference(four, 'mla', '9th', 1)).toContain('et al.');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/services/__tests__/citationFormat.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `citationFormat.ts`**

```ts
import {SourcePaper} from './literatureSearch';

const NUMERIC_STYLES = new Set(['ieee', 'vancouver']);

export function familyName(author: string): string {
  const family = author.split(',')[0].trim();
  const tokens = family.split(/\s+/).filter(Boolean);
  return tokens.length > 0 ? tokens[tokens.length - 1] : 'Unknown';
}

function givenInitials(author: string): string {
  const parts = author.split(',');
  const given = parts.length > 1 ? parts[1].trim() : '';
  if (given) {
    return given
      .split(/\s+/)
      .filter(Boolean)
      .map(w => `${w[0]}.`)
      .join(' ');
  }
  const tokens = parts[0].trim().split(/\s+/).filter(Boolean);
  return tokens
    .slice(0, -1)
    .map(w => `${w[0]}.`)
    .join(' ');
}

function authorText(paper: SourcePaper, style: string): string {
  const authors = paper.authors;
  const first = (a: string) => `${familyName(a)}, ${givenInitials(a)}`;
  const andText = (list: string[], joiner: string) =>
    list.length > 1
      ? `${list.slice(0, -1).join(', ')}${joiner}${list[list.length - 1]}`
      : list[0];

  switch (style) {
    case 'apa': {
      const formatted = authors.map(first);
      return andText(formatted, ' & ');
    }
    case 'mla':
    case 'chicago':
    case 'harvard': {
      const formatted =
        authors.length > 3
          ? [`${familyName(authors[0])}, ${givenInitials(authors[0])} et al.`]
          : authors.map(first);
      return andText(formatted, ' and ');
    }
    case 'ieee': {
      const formatted =
        authors.length > 3
          ? [`${givenInitials(authors[0])} ${familyName(authors[0])} et al.`]
          : authors.map(a => `${givenInitials(a)} ${familyName(a)}`);
      return andText(formatted, ' and ');
    }
    case 'vancouver': {
      const formatted =
        authors.length > 6
          ? [
              `${familyName(authors[0])} ${givenInitials(authors[0])
                .replace(/\./g, '')
                .replace(/ /g, '')} et al.`,
            ]
          : authors.map(
              a =>
                `${familyName(a)} ${givenInitials(a)
                  .replace(/\./g, '')
                  .replace(/ /g, '')}`,
            );
      return formatted.join(', ');
    }
    default:
      return authorText(paper, 'apa');
  }
}

export function formatMarker(
  paper: SourcePaper,
  style: string,
  index: number,
): string {
  if (NUMERIC_STYLES.has(style)) {
    return `[${index}]`;
  }
  const year = paper.year;
  const l = (i: number) => familyName(paper.authors[i]);
  const n = paper.authors.length;
  switch (style) {
    case 'apa':
    case 'harvard':
      if (n === 1) {
        return `(${l(0)}, ${year})`;
      }
      if (n === 2) {
        return `(${l(0)} & ${l(1)}, ${year})`;
      }
      return `(${l(0)} et al., ${year})`;
    case 'mla':
      if (n === 1) {
        return `(${l(0)})`;
      }
      if (n === 2) {
        return `(${l(0)} and ${l(1)})`;
      }
      return `(${l(0)} et al.)`;
    case 'chicago':
      if (n === 1) {
        return `(${l(0)} ${year})`;
      }
      if (n === 2) {
        return `(${l(0)} and ${l(1)} ${year})`;
      }
      return `(${l(0)} et al. ${year})`;
    default:
      return `[${index}]`;
  }
}

export function formatReference(
  paper: SourcePaper,
  style: string,
  edition: string,
  index: number,
): string {
  const urlPart = paper.doi
    ? `https://doi.org/${paper.doi}`
    : paper.url
    ? paper.url
    : '';
  const withUrl = (s: string) => (urlPart ? s.replace('{url}', urlPart) : s);
  const title = paper.title;

  switch (style) {
    case 'apa': {
      const base = `${authorText(paper, 'apa')} (${paper.year}). ${title}.`;
      return withUrl(base + (urlPart ? ` {url}` : ''));
    }
    case 'mla':
      return withUrl(
        `${authorText(paper, 'mla')}. "${title}." ${paper.year}, {url}.`,
      );
    case 'ieee':
      return `${formatMarker(paper, 'ieee', index)} ${authorText(
        paper,
        'ieee',
      )}, "${title}," ${paper.year}.`;
    case 'chicago':
      return withUrl(
        `${authorText(paper, 'chicago')}. ${paper.year}. "${title}." {url}.`,
      );
    case 'harvard':
      return withUrl(
        `${authorText(paper, 'harvard')} (${paper.year}) ${title}. Available at: {url}.`,
      );
    case 'vancouver':
      return `${index}. ${authorText(paper, 'vancouver')}. ${title}. ${paper.year}.`;
    default:
      return formatReference(paper, 'apa', edition, index);
  }
}
```

Note: `vancouverList` and `initialsList` were removed from the final implementation — only `authorText` is used.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/services/__tests__/citationFormat.test.ts`
Expected: PASS. Fix any formatting discrepancies by matching the golden strings exactly.

- [ ] **Step 5: Commit**

```bash
git add src/services/citationFormat.ts src/services/__tests__/citationFormat.test.ts
git commit -m "feat: deterministic citation markers and reference formatting"
```

---

### Task 4: `referencesService.ts` — deterministic References section

**Files:**
- Create: `src/services/referencesService.ts`
- Test: `src/services/__tests__/referencesService.test.ts`

**Interfaces:**
- Produces:
  - `buildReferencesEntries(sources: SourcePaper[], style: string, edition: string): string[]` — one entry per source. Numbering: styles whose `formatReference` already carries a leading marker (`ieee` → `[n] …`, `vancouver` → `n. …`) get NO extra prefix; all other styles get a `1. ` / `2. ` prefix.
  - `buildReferencesMarkdown(entries: string[]): string` — `'## References\n\n' + entries.join('\n')` (the `## References` header is converted to a bold H2 by `markdownToQuillDelta` since `references` is in `SECTION_HEADERS`).

- [ ] **Step 1: Write the failing tests**

Create `src/services/__tests__/referencesService.test.ts`:

```ts
import {buildReferencesEntries, buildReferencesMarkdown} from '../referencesService';
import {SourcePaper} from '../literatureSearch';

const a: SourcePaper = {
  title: 'Mobile learning effects',
  authors: ['Smith, J.'],
  year: 2020,
  abstract: '',
  doi: '10.1000/aaa',
  url: 'https://doi.org/10.1000/aaa',
  source: 'crossref',
};
const b: SourcePaper = {
  title: 'Gamification in classrooms',
  authors: ['Doe, A.', 'Roe, B.'],
  year: 2019,
  abstract: '',
  doi: '10.1000/bbb',
  url: 'https://doi.org/10.1000/bbb',
  source: 'openalex',
};

it('builds numbered entries in source order', () => {
  const entries = buildReferencesEntries([a, b], 'apa', '7th');
  expect(entries).toHaveLength(2);
  expect(entries[0]).toBe(
    '1. Smith, J. (2020). Mobile learning effects. https://doi.org/10.1000/aaa',
  );
  expect(entries[1]).toContain('2.');
  expect(entries[1]).toContain('Doe, A., & Roe, B.');
});

it('entries stay byte-identical when only one entry changes', () => {
  const before = buildReferencesEntries([a, b], 'apa', '7th');
  const swapped = buildReferencesEntries(
    [
      a,
      {...b, title: 'Gamification in classrooms (revised)', doi: '10.1000/ccc'},
    ],
    'apa',
    '7th',
  );
  expect(swapped[0]).toBe(before[0]);
  expect(swapped[1]).not.toBe(before[1]);
});

it('builds references markdown with heading', () => {
  const md = buildReferencesMarkdown(
    buildReferencesEntries([a], 'apa', '7th'),
  );
  expect(md).toBe(
    '## References\n\n1. Smith, J. (2020). Mobile learning effects. https://doi.org/10.1000/aaa',
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/services/__tests__/referencesService.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `referencesService.ts`**

```ts
import {SourcePaper} from './literatureSearch';
import {formatReference} from './citationFormat';

const SELF_NUMBERED_STYLES = new Set(['ieee', 'vancouver']);

export function buildReferencesEntries(
  sources: SourcePaper[],
  style: string,
  edition: string,
): string[] {
  return sources.map((paper, i) => {
    const entry = formatReference(paper, style, edition, i + 1);
    return SELF_NUMBERED_STYLES.has(style) ? entry : `${i + 1}. ${entry}`;
  });
}

export function buildReferencesMarkdown(entries: string[]): string {
  return `## References\n\n${entries.join('\n')}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/services/__tests__/referencesService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/referencesService.ts src/services/__tests__/referencesService.test.ts
git commit -m "feat: deterministic references section builder"
```

---

### Task 5: `cloudService.ts` — OpenAI-compatible client with SSE streaming

**Files:**
- Create: `src/services/cloudService.ts`
- Test: `src/services/__tests__/cloudService.test.ts`

**Interfaces:**
- Consumes: `CompletionMessage` from `./llamaService`.
- Produces:
  - `completeCloud(messages: CompletionMessage[], opts?: {temperature?: number; maxTokens?: number; onToken?: (token: string) => void}): Promise<string>`
  - `testConnection(): Promise<{ok: boolean; latencyMs?: number; error?: string}>`
  - `getCloudConfig()` and `isCloudConfigured()` reading from `useSettingsStore` (store fields added in Task 6 — to keep this task green, read store fields defensively: `(store as Record<string, unknown>).cloudBaseUrl` with fallbacks, see step 3).

**SSE parsing:** axios with `responseType: 'text'` and `onDownloadProgress`; accumulate `data:` lines; each line JSON `{choices: [{delta: {content: string}}]}`; strip `data: ` prefix; ignore `[DONE]`. If no streaming callback provided, still stream-parse internally and return the full text.

- [ ] **Step 1: Write the failing tests**

Create `src/services/__tests__/cloudService.test.ts`:

```ts
import {completeCloud, testConnection} from '../cloudService';
import {useSettingsStore} from '@/stores/settingsStore';

const sseChunks = [
  'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
  'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
  'data: [DONE]\n\n',
];

function sseBody() {
  return {
    getReader: () => {
      let i = 0;
      return {
        read: async () =>
          i < sseChunks.length
            ? {done: false, value: new TextEncoder().encode(sseChunks[i++])}
            : {done: true, value: undefined},
      };
    },
  };
}

function mockFetch(response: Partial<Response>) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: sseBody(),
    json: async () => ({}),
    ...response,
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({
    provider: 'cloud',
    cloudBaseUrl: 'https://api.example.com/v1',
    cloudApiKey: 'test-key',
    cloudModel: 'test-model',
  });
});

it('streams tokens from SSE and returns full text', async () => {
  mockFetch({});
  let received = '';
  const result = await completeCloud([{role: 'user', content: 'hi'}], {
    onToken: t => (received += t),
  });
  expect(received).toBe('Hello world');
  expect(result).toBe('Hello world');
});

it('posts correct OpenAI-compatible body and auth header', async () => {
  mockFetch({});
  await completeCloud([{role: 'user', content: 'hi'}], {temperature: 0.5});
  const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe('https://api.example.com/v1/chat/completions');
  expect(JSON.parse(init.body)).toEqual({
    model: 'test-model',
    messages: [{role: 'user', content: 'hi'}],
    stream: true,
    temperature: 0.5,
    max_tokens: 1024,
  });
  expect(init.headers.Authorization).toBe('Bearer test-key');
});

it('non-streaming fallback when streaming fails', async () => {
  mockFetch({});
  global.fetch = jest
    .fn()
    .mockRejectedValueOnce(new Error('stream failed'))
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{message: {content: 'fallback answer'}}],
      }),
    }) as unknown as typeof fetch;
  const result = await completeCloud([{role: 'user', content: 'hi'}]);
  expect(result).toBe('fallback answer');
});

it('testConnection reports ok with latency', async () => {
  mockFetch({});
  const res = await testConnection();
  expect(res.ok).toBe(true);
  expect(res.latencyMs).toBeGreaterThanOrEqual(0);
});

it('testConnection reports error on failure', async () => {
  global.fetch = jest
    .fn()
    .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
  const res = await testConnection();
  expect(res.ok).toBe(false);
  expect(res.error).toContain('network down');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/services/__tests__/cloudService.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `cloudService.ts`**

SSE with axios can't read the response body, so this client uses `fetch` with a `ReadableStream` reader (Hermes on RN 0.74 supports `fetch` + `ReadableStream` + `TextDecoder`).

```ts
import {CompletionMessage} from './llamaService';
import {useSettingsStore} from '@/stores/settingsStore';

const TIMEOUT_MS = 30_000;

export function getCloudConfig() {
  const s = useSettingsStore.getState();
  return {
    baseUrl: (s.cloudBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    apiKey: s.cloudApiKey || '',
    model: s.cloudModel || 'gpt-4o-mini',
  };
}

export function isCloudConfigured(): boolean {
  const {apiKey, baseUrl} = getCloudConfig();
  return apiKey.length > 0 && baseUrl.length > 0;
}

export async function completeCloud(
  messages: CompletionMessage[],
  opts: {
    temperature?: number;
    maxTokens?: number;
    onToken?: (token: string) => void;
  } = {},
): Promise<string> {
  const {baseUrl, apiKey, model} = getCloudConfig();
  const {temperature = 0.7, maxTokens = 1024, onToken} = opts;

  let fullText = '';
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature,
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const {done, value} = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, {stream: true});
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) {
          continue;
        }
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') {
          continue;
        }
        try {
          const json = JSON.parse(payload);
          const content: string | undefined = json.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            onToken?.(content);
          }
        } catch {
          // ignore malformed chunk
        }
      }
    }
  } catch (e) {
    // Non-streaming fallback.
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        temperature,
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Cloud request failed (HTTP ${res.status})${e instanceof Error ? `: ${e.message}` : ''}`,
      );
    }
    const data = (await res.json()) as {
      choices?: {message?: {content?: string}}[];
    };
    fullText = (data.choices?.[0]?.message?.content ?? '').trim();
  }
  return fullText;
}

export async function testConnection(): Promise<{
  ok: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const {baseUrl, apiKey, model} = getCloudConfig();
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{role: 'user', content: 'ping'}],
        stream: false,
        max_tokens: 1,
      }),
    });
    if (!res.ok) {
      return {ok: false, error: `HTTP ${res.status}`};
    }
    await res.json();
    return {ok: true, latencyMs: Date.now() - start};
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
```

For the tests: mock `global.fetch` (not axios) with a fake `ReadableStream`-like reader:

```ts
const sseBody = () => ({
  getReader: () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    let i = 0;
    return {
      read: async () =>
        i < chunks.length
          ? {done: false, value: new TextEncoder().encode(chunks[i++])}
          : {done: true, value: undefined},
    };
  },
});

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: sseBody(),
    json: async () => ({}),
  }) as unknown as typeof fetch;
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/services/__tests__/cloudService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/cloudService.ts src/services/__tests__/cloudService.test.ts
git commit -m "feat: OpenAI-compatible cloud client with SSE streaming"
```

---

### Task 6: settings store fields + `inference.ts` provider router

**Files:**
- Modify: `src/stores/settingsStore.ts`
- Create: `src/services/inference.ts`
- Modify: `src/screens/EditorScreen.tsx` (AiPanel actions route through `inference`)
- Test: `src/stores/__tests__/settingsStore.test.ts`, `src/services/__tests__/inference.test.ts`

**Interfaces:**
- Consumes: `completeCloud`/`isCloudConfigured` from `./cloudService`; `complete`/`stream` from `./llamaService`; `SourceKey` from `./literatureSearch`.
- Produces (settingsStore): `provider: 'local' | 'cloud'` (default `'local'`), `cloudBaseUrl: string` (default `'https://api.openai.com/v1'`), `cloudApiKey: string` (default `''`), `cloudModel: string` (default `'gpt-4o-mini'`), `cloudFallbackEnabled: boolean` (default `true`), `enabledSources: SourceKey[]` (default all four), plus setters: `setProvider`, `setCloudBaseUrl`, `setCloudApiKey`, `setCloudModel`, `setCloudFallbackEnabled`, `setEnabledSources`.
- Produces (inference): `complete(messages: CompletionMessage[], temperature?: number, maxTokens?: number): Promise<string>` and `stream(messages: CompletionMessage[], onToken: (t: string) => void, temperature?: number, maxTokens?: number): Promise<void>` — same signatures as `llamaService` so pipeline code swaps seamlessly.

- [ ] **Step 1: Write the failing tests**

`src/stores/__tests__/settingsStore.test.ts` — add:

```ts
it('cloud provider fields default correctly', () => {
  const s = useSettingsStore.getState();
  expect(s.provider).toBe('local');
  expect(s.cloudBaseUrl).toBe('https://api.openai.com/v1');
  expect(s.cloudApiKey).toBe('');
  expect(s.cloudModel).toBe('gpt-4o-mini');
  expect(s.cloudFallbackEnabled).toBe(true);
  expect(s.enabledSources).toEqual([
    'crossref',
    'openalex',
    'semanticscholar',
    'arxiv',
  ]);
});
```

`src/services/__tests__/inference.test.ts`:

```ts
import {complete, stream} from '../inference';
import {useSettingsStore} from '@/stores/settingsStore';
import * as cloudService from '../cloudService';
import * as llamaService from '../llamaService';

jest.mock('../cloudService', () => ({
  completeCloud: jest.fn().mockResolvedValue('cloud answer'),
  isCloudConfigured: jest.fn().mockReturnValue(true),
}));
jest.mock('../llamaService', () => ({
  complete: jest.fn().mockResolvedValue('local answer'),
  stream: jest.fn().mockImplementation(async (_m, onToken) => {
    onToken('local ');
    onToken('tokens');
  }),
}));

const cloud = cloudService as jest.Mocked<typeof cloudService>;
const llama = llamaService as jest.Mocked<typeof llamaService>;

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({provider: 'local'});
});

it('routes to local when provider is local', async () => {
  const result = await complete([{role: 'user', content: 'x'}]);
  expect(result).toBe('local answer');
  expect(cloud.completeCloud).not.toHaveBeenCalled();
});

it('routes to cloud when provider is cloud and configured', async () => {
  useSettingsStore.setState({provider: 'cloud'});
  cloud.isCloudConfigured.mockReturnValue(true);
  const result = await complete([{role: 'user', content: 'x'}]);
  expect(result).toBe('cloud answer');
  expect(llama.complete).not.toHaveBeenCalled();
});

it('falls back to local when provider is cloud but unconfigured', async () => {
  useSettingsStore.setState({provider: 'cloud'});
  cloud.isCloudConfigured.mockReturnValue(false);
  const result = await complete([{role: 'user', content: 'x'}]);
  expect(result).toBe('local answer');
});

it('stream routes through cloud and local', async () => {
  useSettingsStore.setState({provider: 'cloud'});
  const tokens: string[] = [];
  await stream([{role: 'user', content: 'x'}], t => tokens.push(t));
  expect(cloud.completeCloud).toHaveBeenCalled();
  useSettingsStore.setState({provider: 'local'});
  const localTokens: string[] = [];
  await stream([{role: 'user', content: 'x'}], t => localTokens.push(t));
  expect(localTokens.join('')).toBe('local tokens');
});

it('cloud stream failure falls back to local when fallback enabled', async () => {
  useSettingsStore.setState({provider: 'cloud', cloudFallbackEnabled: true});
  cloud.completeCloud.mockRejectedValue(new Error('boom'));
  const result = await complete([{role: 'user', content: 'x'}]);
  expect(result).toBe('local answer');
});

it('cloud stream failure rethrows when fallback disabled', async () => {
  useSettingsStore.setState({
    provider: 'cloud',
    cloudFallbackEnabled: false,
  });
  cloud.completeCloud.mockRejectedValue(new Error('boom'));
  await expect(complete([{role: 'user', content: 'x'}])).rejects.toThrow(
    'boom',
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/stores/__tests__/settingsStore.test.ts src/services/__tests__/inference.test.ts`
Expected: FAIL — fields and module missing.

- [ ] **Step 3: Implement settings store fields**

`src/stores/settingsStore.ts` — add to interface and store:

```ts
import {SourceKey} from '@/services/literatureSearch';

  provider: 'local' | 'cloud';
  cloudBaseUrl: string;
  cloudApiKey: string;
  cloudModel: string;
  cloudFallbackEnabled: boolean;
  enabledSources: SourceKey[];
  // actions
  setProvider: (p: 'local' | 'cloud') => void;
  setCloudBaseUrl: (u: string) => void;
  setCloudApiKey: (k: string) => void;
  setCloudModel: (m: string) => void;
  setCloudFallbackEnabled: (v: boolean) => void;
  setEnabledSources: (s: SourceKey[]) => void;
```

Initial values:

```ts
      provider: 'local',
      cloudBaseUrl: 'https://api.openai.com/v1',
      cloudApiKey: '',
      cloudModel: 'gpt-4o-mini',
      cloudFallbackEnabled: true,
      enabledSources: ['crossref', 'openalex', 'semanticscholar', 'arxiv'],
```

Setters:

```ts
      setProvider: provider => set({provider}),
      setCloudBaseUrl: cloudBaseUrl => set({cloudBaseUrl}),
      setCloudApiKey: cloudApiKey => set({cloudApiKey}),
      setCloudModel: cloudModel => set({cloudModel}),
      setCloudFallbackEnabled: cloudFallbackEnabled =>
        set({cloudFallbackEnabled}),
      setEnabledSources: enabledSources => set({enabledSources}),
```

- [ ] **Step 4: Implement `inference.ts`**

```ts
import {CompletionMessage} from './llamaService';
import * as llamaService from './llamaService';
import {completeCloud, isCloudConfigured} from './cloudService';
import {useSettingsStore} from '@/stores/settingsStore';

export function resolveProvider(): 'cloud' | 'local' {
  const s = useSettingsStore.getState();
  if (s.provider === 'cloud' && isCloudConfigured()) {
    return 'cloud';
  }
  return 'local';
}

export async function complete(
  messages: CompletionMessage[],
  temperature: number = 0.7,
  maxTokens: number = 1024,
): Promise<string> {
  const s = useSettingsStore.getState();
  if (s.provider === 'cloud' && isCloudConfigured()) {
    try {
      return await completeCloud(messages, {temperature, maxTokens});
    } catch (e) {
      if (!s.cloudFallbackEnabled) {
        throw e;
      }
      console.warn('[inference] cloud failed, falling back to local:', e);
    }
  }
  return await llamaService.complete(messages, temperature, maxTokens);
}

export async function stream(
  messages: CompletionMessage[],
  onToken: (token: string) => void,
  temperature: number = 0.7,
  maxTokens: number = 1024,
): Promise<void> {
  const s = useSettingsStore.getState();
  if (s.provider === 'cloud' && isCloudConfigured()) {
    try {
      await completeCloud(messages, {temperature, maxTokens, onToken});
      return;
    } catch (e) {
      if (!s.cloudFallbackEnabled) {
        throw e;
      }
      console.warn('[inference] cloud stream failed, falling back to local:', e);
    }
  }
  await llamaService.stream(messages, onToken, temperature, maxTokens);
}
```

- [ ] **Step 5: Update `EditorScreen` AiPanel to route through inference**

`src/screens/EditorScreen.tsx`:
- Replace `import {complete} from '@/services/llamaService';` with `import {complete} from '@/services/inference';`
- In `handleAiAction`, gate the model check on provider:

```ts
      const provider = useSettingsStore.getState().provider;
      if (provider === 'local' && !modelReady) {
        Alert.alert(
          'Model not ready',
          'The AI model is still downloading. Please wait.',
        );
        return;
      }
```

(keep the rest identical — `complete` signature is unchanged).

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest src/stores/__tests__/settingsStore.test.ts src/services/__tests__/inference.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/stores/settingsStore.ts src/services/inference.ts src/screens/EditorScreen.tsx src/stores/__tests__/settingsStore.test.ts src/services/__tests__/inference.test.ts
git commit -m "feat: provider router with cloud fallback for all AI calls"
```

---

### Task 7: `pipelineService` — provider-agnostic, deterministic references, marker prompts

**Files:**
- Modify: `src/services/pipelineService.ts`
- Test: `src/services/__tests__/pipelineService.test.ts`

**Interfaces:**
- Consumes: `complete`, `stream` from `./inference`; `buildReferencesEntries`, `buildReferencesMarkdown` from `./referencesService`; `formatMarker` from `./citationFormat`; `SourceKey` from `./literatureSearch`.
- Produces: `PipelineConfig` gains `sources?: SourcePaper[]` and `enabledSources?: SourceKey[]`. `runPipeline` skips stage-5 search when `config.sources` is provided (still emits `sources-found`), otherwise calls `searchLiterature(topic, questions, enabledSources)`. References come from `referencesService`, not the LLM.

- [ ] **Step 1: Update tests to match new behavior**

`src/services/__tests__/pipelineService.test.ts` — the existing test asserts stage labels only; add:

```ts
import {buildReferencesMarkdown, buildReferencesEntries} from '../referencesService';

it('references are built deterministically, not by the LLM', () => {
  const sources = [
    {
      title: 'Mobile learning',
      authors: ['Smith, J.'],
      year: 2020,
      abstract: '',
      doi: '10.1000/xyz',
      url: 'https://doi.org/10.1000/xyz',
      source: 'crossref' as const,
    },
  ];
  const entries = buildReferencesEntries(sources, 'apa', '7th');
  const md = buildReferencesMarkdown(entries);
  expect(md).toContain('## References');
  expect(md).toContain('Smith, J. (2020). Mobile learning.');
  expect(md).not.toContain('undefined');
});
```

(Kept here rather than Task 4 to avoid duplicating service tests — asserts pipeline integration point.)

- [ ] **Step 2: Run tests to verify the new test fails**

Run: `npx jest src/services/__tests__/pipelineService.test.ts`
Expected: the new test may pass (it tests referencesService); the pipeline changes below are what matter. Verify existing tests still pass BEFORE refactoring.

- [ ] **Step 3: Refactor imports and config**

`src/services/pipelineService.ts`:
- Replace `import {complete, stream} from './llamaService';` with `import {complete, stream} from './inference';`
- Add: `import {buildReferencesEntries, buildReferencesMarkdown} from './referencesService';` and `import {formatMarker} from './citationFormat';`
- Extend `PipelineConfig`:

```ts
export interface PipelineConfig {
  topic: string;
  researchType: 'quantitative' | 'qualitative' | 'mixed' | 'literature-review';
  academicLevel: 'shs' | 'undergraduate' | 'graduate';
  paperLength: 'short' | 'standard' | 'long';
  citationStyle: string;
  citationEdition: string;
  sources?: SourcePaper[];
  enabledSources?: SourceKey[];
}
```

- [ ] **Step 4: Update source formatting with markers**

Replace `formatSources` with a marker-aware version:

```ts
function formatSources(
  sources: SourcePaper[],
  style: string,
  edition: string,
): string {
  return sources
    .map((s, i) => {
      const marker = formatMarker(s, style, i + 1);
      return `${i + 1}. ${marker} — ${s.authors.slice(0, 3).join(', ')} (${
        s.year
      }). ${s.title}. ${s.abstract.slice(0, 200)}…`;
    })
    .join('\n');
}
```

Update its two call sites (in `runSection` userPrompt and stage-5 block) to pass `config.citationStyle, config.citationEdition`.

- [ ] **Step 5: Deterministic references — split abstract from references**

In `runSection`'s userPrompt, change the final instruction from "Use ${citStyle} in-text citations where appropriate, citing only the sources listed above." to:

```ts
Write the ${SECTION_NAMES[key]} section.
Use ONLY the exact in-text citation markers shown above (e.g. ${formatMarker(sources[0] ?? {title: '', authors: ['Unknown'], year: 0, abstract: '', source: 'crossref'}, config.citationStyle, 1)}), verbatim, citing only the sources listed above.
```

Replace `runAbstractAndReferences` with an abstract-only function:

```ts
interface AbstractOnly {
  abstract: string;
}

async function runAbstract(
  config: PipelineConfig,
  plan: PaperPlan,
  draft: string,
): Promise<string> {
  const draftSlice = draft.slice(0, 1200);
  const prompt = `Given the following research paper draft:

${draftSlice}

Write a structured abstract (150–250 words) covering: background, objective, methods, results, conclusion.

Return ONLY valid JSON — no markdown:
{ "abstract": "..." }`;

  const raw = await complete([{role: 'user', content: prompt}], 0.3, 1024);
  try {
    return (JSON.parse(raw) as AbstractOnly).abstract ?? '';
  } catch {
    return '';
  }
}
```

Remove `formatSourcesForReferences` (no longer used).

- [ ] **Step 6: Update the main pipeline flow**

In `runPipeline`:

Stage 5 block becomes:

```ts
  yield stageEvent(5, 'stage-start');
  let sources: SourcePaper[] = [];
  try {
    if (config.sources && config.sources.length > 0) {
      sources = config.sources;
    } else {
      sources = await searchLiterature(
        config.topic,
        plan.researchQuestions,
        config.enabledSources,
      );
    }
    yield {type: 'sources-found', count: sources.length};
  } catch {
    yield {
      type: 'error',
      message: 'Literature search failed — continuing without sources',
      fatal: false,
    };
  }
  yield stageEvent(5, 'stage-complete');
```

Batch 3a (stages 13–14):

```ts
  yield stageEvent(13, 'stage-start');
  yield stageEvent(14, 'stage-start');

  let abstractText = '';
  try {
    abstractText = await runAbstract(config, plan, draft);
  } catch (e: unknown) {
    yield {
      type: 'error',
      message: `Abstract generation failed: ${
        e instanceof Error ? e.message : String(e)
      }`,
      fatal: false,
    };
  }

  yield stageEvent(13, 'stage-complete');
  yield stageEvent(14, 'stage-complete');
```

Assemble (replace `abstractAndRefs` usage):

```ts
  const referencesMarkdown = buildReferencesMarkdown(
    buildReferencesEntries(sources, config.citationStyle, config.citationEdition),
  );

  const fullPaperText = [
    plan.title,
    '',
    'Abstract',
    abstractText,
    '',
    polishedDraft,
    '',
    referencesMarkdown,
  ].join('\n\n');
```

Save: pass sources into the create call:

```ts
    const doc = await documentRepository.create(plan.title, {
      citationStyle: config.citationStyle,
      citationEdition: config.citationEdition,
      sourcesJson: JSON.stringify(sources),
    });
```

(Add `sourcesJson` to the `create` options type in `DocumentRepository.create` — `Partial<{citationStyle: string; citationEdition: string; sourcesJson: string}>` — and apply `doc.sourcesJson = options.sourcesJson ?? '';`.)

- [ ] **Step 7: Run the tests**

Run: `npx jest src/services/__tests__/pipelineService.test.ts src/services/__tests__/llamaService.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/services/pipelineService.ts src/db/DocumentRepository.ts src/services/__tests__/pipelineService.test.ts
git commit -m "feat: provider-agnostic pipeline with deterministic references and marker prompts"
```

---

### Task 8: Generation flow — source toggles + paper review screen

**Files:**
- Create: `src/screens/CitationReviewScreen.tsx`
- Modify: `src/navigation/AppNavigator.tsx`
- Modify: `src/screens/GenerateScreen.tsx`
- Modify: `src/screens/ProgressScreen.tsx`

**Interfaces:**
- Consumes: `searchLiterature`, `SourceKey`, `SourcePaper` from `./literatureSearch`; `useSettingsStore.enabledSources`/`setEnabledSources`.
- Produces: new route `CitationReview` with params `{topic: string; citationStyle: string; citationEdition: string; researchType: string; academicLevel: string; paperLength: string; context?: string}`; `Progress` params gain `sources?: SourcePaper[]; enabledSources?: SourceKey[]`.

- [ ] **Step 1: Wire the route**

`src/navigation/AppNavigator.tsx`:

```ts
  CitationReview: {
    topic: string;
    citationStyle: string;
    citationEdition: string;
    researchType: string;
    academicLevel: string;
    paperLength: string;
    context?: string;
  };
```

Add lazy import + screen registration (after `Generate`), title `'Review Sources'`.

- [ ] **Step 2: Update `GenerateScreen`**

- `handleGenerate`: only require the local model when provider is `local`:

```ts
  async function handleGenerate() {
    if (!topic.trim()) {
      return;
    }
    const provider = useSettingsStore.getState().provider;
    if (provider === 'local' && !(await modelExists())) {
      navigation.navigate('ModelDownload');
      return;
    }
    setShowCitation(true);
  }
```

- `handleCitationConfirm`: navigate to `CitationReview` instead of `Progress`:

```ts
  function handleCitationConfirm(choice: CitationChoice) {
    setCitation(choice);
    setShowCitation(false);
    navigation.navigate('CitationReview', {
      topic: context.trim()
        ? `${topic.trim()}\n\nAdditional context: ${context.trim()}`
        : topic.trim(),
      citationStyle: choice.style,
      citationEdition: choice.edition,
      researchType,
      academicLevel,
      paperLength,
    });
  }
```

- [ ] **Step 3: Create `CitationReviewScreen.tsx`**

```tsx
import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/AppNavigator';
import {searchLiterature, SourceKey, SourcePaper} from '@/services/literatureSearch';
import {useSettingsStore} from '@/stores/settingsStore';

type Props = NativeStackScreenProps<RootStackParamList, 'CitationReview'>;

const SOURCE_OPTIONS: {key: SourceKey; label: string}[] = [
  {key: 'crossref', label: 'CrossRef'},
  {key: 'openalex', label: 'OpenAlex'},
  {key: 'semanticscholar', label: 'Semantic Scholar'},
  {key: 'arxiv', label: 'arXiv'},
];

export default function CitationReviewScreen({route, navigation}: Props) {
  const {topic} = route.params;
  const settings = useSettingsStore();
  const [enabled, setEnabled] = useState<SourceKey[]>(settings.enabledSources);
  const [refine, setRefine] = useState('');
  const [results, setResults] = useState<SourcePaper[] | null>(null);
  const [selected, setSelected] = useState<SourcePaper[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    setSearching(true);
    setError(null);
    try {
      const query = refine.trim() ? `${topic}\n${refine.trim()}` : topic;
      const found = await searchLiterature(query, [], enabled);
      setResults(found.filter(
        r => !selected.some(s => s.doi === r.doi && s.title === r.title),
      ));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  function toggleSource(key: SourceKey) {
    setEnabled(prev => {
      if (prev.includes(key)) {
        const next = prev.filter(k => k !== key);
        return next.length === 0 ? prev : next;
      }
      return [...prev, key];
    });
  }

  function addPaper(paper: SourcePaper) {
    setSelected(prev => [...prev, paper]);
    setResults(prev => (prev ? prev.filter(r => r !== paper) : prev));
  }

  function removePaper(index: number) {
    setSelected(prev => prev.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    setSelected(prev => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) {
        return prev;
      }
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleGenerate() {
    settings.setEnabledSources(enabled);
    navigation.navigate('Progress', {
      topic: route.params.topic,
      citationStyle: route.params.citationStyle,
      citationEdition: route.params.citationEdition,
      researchType: route.params.researchType,
      academicLevel: route.params.academicLevel,
      paperLength: route.params.paperLength,
      sources: selected,
      enabledSources: enabled,
    });
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Sources</Text>
      <Text style={styles.subheading}>
        Choose which literature sources to search, review the papers, then
        generate. Tap any paper to select it — it becomes a citation.
      </Text>

      {/* Source toggles */}
      <Text style={styles.label}>Search sources</Text>
      <View style={styles.chipRow}>
        {SOURCE_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.chip,
              enabled.includes(opt.key) && styles.chipSelected,
            ]}
            onPress={() => toggleSource(opt.key)}>
            <Text
              style={[
                styles.chipText,
                enabled.includes(opt.key) && styles.chipTextSelected,
              ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Refine query */}
      <Text style={styles.label}>Refine query (optional)</Text>
      <TextInput
        style={styles.input}
        value={refine}
        onChangeText={setRefine}
        placeholder="e.g. focus on 2020–2025 studies"
      />

      <TouchableOpacity
        style={styles.searchButton}
        onPress={handleSearch}
        disabled={searching}>
        {searching ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.searchButtonText}>Search & Review</Text>
        )}
      </TouchableOpacity>

      {error && <Text style={styles.error}>{error}</Text>}

      {/* Selected papers */}
      {selected.length > 0 && (
        <>
          <Text style={styles.label}>
            Selected ({selected.length}) — citation order
          </Text>
          {selected.map((p, i) => (
            <View key={`${p.title}-${i}`} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>[{i + 1}]</Text>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {p.title}
                </Text>
              </View>
              <Text style={styles.cardMeta}>
                {p.authors.slice(0, 3).join(', ')} ({p.year}) · {p.source}
              </Text>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  onPress={() => move(i, -1)}
                  disabled={i === 0}>
                  <Text style={styles.actionBtn}>↑</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => move(i, 1)}
                  disabled={i === selected.length - 1}>
                  <Text style={styles.actionBtn}>↓</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removePaper(i)}>
                  <Text style={[styles.actionBtn, styles.removeBtn]}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Search results */}
      {results && (
        <>
          <Text style={styles.label}>Results ({results.length})</Text>
          {results.map((p, i) => (
            <TouchableOpacity
              key={`${p.title}-${i}`}
              style={styles.resultRow}
              onPress={() => addPaper(p)}>
              <Text style={styles.resultTitle} numberOfLines={2}>
                {p.title}
              </Text>
              <Text style={styles.resultMeta}>
                {p.authors.slice(0, 3).join(', ')} ({p.year}) · {p.source}
              </Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      <TouchableOpacity
        style={[
          styles.generateButton,
          selected.length === 0 && styles.generateButtonDisabled,
        ]}
        onPress={handleGenerate}
        disabled={selected.length === 0}>
        <Text style={styles.generateText}>
          Generate Paper with {selected.length} Sources
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
```

(Full `StyleSheet` follows the patterns in `GenerateScreen`: `heading` 24px/800 `#111827`, `label` 13px/600 `#374151`, chips with `#6366f1` selection, `generateButton` `#6366f1`, cards `#f9fafb` with border `#e5e7eb`. Reuse the exact values from `GenerateScreen.tsx`.)

- [ ] **Step 4: Update `ProgressScreen` params + config**

`src/navigation/AppNavigator.tsx` — `Progress` params gain:

```ts
    sources?: SourcePaper[];
    enabledSources?: SourceKey[];
```

(import the types from `@/services/literatureSearch` at top of the navigator file)

`src/screens/ProgressScreen.tsx`:

```ts
    const config: PipelineConfig = {
      topic: params.topic,
      researchType: params.researchType as PipelineConfig['researchType'],
      academicLevel: params.academicLevel as PipelineConfig['academicLevel'],
      paperLength: params.paperLength as PipelineConfig['paperLength'],
      citationStyle: params.citationStyle,
      citationEdition: params.citationEdition,
      sources: params.sources,
      enabledSources: params.enabledSources,
    };
```

Replace the model gate:

```ts
    async function run() {
      const provider = useSettingsStore.getState().provider;
      const needsLocal =
        provider === 'local' ||
        !isCloudConfigured() ||
        !useSettingsStore.getState().cloudFallbackEnabled;
      if (needsLocal && !(await modelExists())) {
        setFatalError('AI model is not loaded. Please restart the app.');
        return;
      }
      // ...existing for-await loop unchanged
```

Add `import {isCloudConfigured} from '@/services/cloudService';` and `import {useSettingsStore} from '@/stores/settingsStore';` to ProgressScreen.

- [ ] **Step 5: Run the existing test suite**

Run: `npx jest`
Expected: PASS (all existing tests; new screen has no unit tests — UI-only, consistent with repo conventions)

- [ ] **Step 6: Commit**

```bash
git add src/screens/CitationReviewScreen.tsx src/navigation/AppNavigator.tsx src/screens/GenerateScreen.tsx src/screens/ProgressScreen.tsx
git commit -m "feat: source selection and paper review step before generation"
```

---

### Task 9: Progress screen — cloud failure fallback

**Files:**
- Modify: `src/screens/ProgressScreen.tsx`

**Interfaces:**
- Consumes: `useSettingsStore.setProvider`.
- Produces: on fatal error when cloud was active, render buttons **Retry** and **Use on-device model instead** (the latter sets `provider = 'local'` and re-runs the pipeline).

- [ ] **Step 1: Add state + re-run mechanism**

In `ProgressScreen.tsx`:

```ts
  const [runKey, setRunKey] = useState(0);
  const [failedWithCloud, setFailedWithCloud] = useState(false);
```

Add `runKey` to the effect deps array. In the `run()` function, before the loop:

```ts
      setFailedWithCloud(false);
      const provider = useSettingsStore.getState().provider;
```

Inside the `case 'error':` handler, when `event.fatal`:

```ts
            if (event.fatal) {
              setFatalError(event.message ?? 'Unknown error');
              setFailedWithCloud(
                useSettingsStore.getState().provider === 'cloud' ||
                  (event.message ?? '').toLowerCase().includes('cloud'),
              );
              return;
            }
```

- [ ] **Step 2: Render fallback buttons**

In the `fatalError` branch, replace the single "Go Back" button with:

```tsx
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => setRunKey(k => k + 1)}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
        {failedWithCloud && (
          <TouchableOpacity
            style={[styles.retryButton, styles.localButton]}
            onPress={() => {
              useSettingsStore.getState().setProvider('local');
              setRunKey(k => k + 1);
            }}>
            <Text style={styles.retryText}>Use on-device model instead</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
```

Add `localButton: {backgroundColor: '#eef2ff'}` to the StyleSheet.

- [ ] **Step 3: Verify**

Run: `npx jest` — PASS. Manual check not possible here; logic reviewed.
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/screens/ProgressScreen.tsx
git commit -m "feat: retry and on-device fallback on cloud generation failure"
```

---

### Task 10: Editor citation manager — WebView commands, modals, swap flow

**Files:**
- Modify: `src/components/editor/quillHtml.ts`
- Modify: `src/components/editor/EditorWebView.tsx`
- Create: `src/components/editor/CitationManagerModal.tsx`
- Create: `src/components/editor/CitationPickerModal.tsx`
- Modify: `src/components/editor/TabToolbar.tsx`
- Modify: `src/screens/EditorScreen.tsx`
- Test: `src/components/editor/__tests__/quillHtml.test.ts`

**Interfaces:**
- Consumes: `formatMarker`, `formatReference` from `./citationFormat`; `buildReferencesEntries` from `./referencesService`; `searchLiterature`, `SourcePaper`, `SourceKey` from `./literatureSearch`; `documentRepository.updateSources`.
- Produces (EditorRef): `replaceCitationMarkers(index: number, oldMarker: string, newMarker: string): void`; `replaceReferences(entries: string[]): void`.

- [ ] **Step 1: Write the failing tests**

In `src/components/editor/__tests__/quillHtml.test.ts`, add:

```ts
it('embeds replaceCitationMarkers command handler', () => {
  const html = buildQuillHtml('');
  expect(html).toContain(`case 'replaceCitationMarkers'`);
  expect(html).toContain('msg.oldMarker');
  expect(html).toContain('msg.newMarker');
});

it('embeds replaceReferences command handler', () => {
  const html = buildQuillHtml('');
  expect(html).toContain(`case 'replaceReferences'`);
  expect(html).toContain('msg.entries');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/components/editor/__tests__/quillHtml.test.ts`
Expected: FAIL — commands not present.

- [ ] **Step 3: Implement WebView commands**

In `src/components/editor/quillHtml.ts`, inside `executeCommand`, add before `case 'setPaperSize':`:

```js
        case 'replaceCitationMarkers': {
          const text = quill.getText();
          let idx = 0;
          while ((idx = text.indexOf(msg.oldMarker, idx)) !== -1) {
            quill.deleteText(idx, msg.oldMarker.length);
            quill.insertText(idx, msg.newMarker);
            idx += msg.newMarker.length;
          }
          break;
        }

        case 'replaceReferences': {
          const delta = quill.getContents();
          let refPos = -1;
          let pos = 0;
          delta.ops.forEach(op => {
            if (typeof op.insert === 'string') {
              const lines = op.insert.split('\n');
              lines.forEach((line, li) => {
                if (
                  line.trim().toLowerCase() === 'references' &&
                  op.attributes && op.attributes.header
                ) {
                  refPos = pos;
                }
                pos += line.length + (li < lines.length - 1 ? 1 : 0);
              });
            } else {
              pos += 1;
            }
          });
          if (refPos === -1) break;
          const afterHeader = refPos + 'References'.length + 1;
          const total = quill.getLength();
          if (afterHeader < total) {
            quill.deleteText(afterHeader, total - afterHeader);
          }
          quill.insertText(
            afterHeader,
            '\n' + (Array.isArray(msg.entries) ? msg.entries : []).join('\n'),
          );
          break;
        }
```

- [ ] **Step 4: Add EditorRef methods**

`src/components/editor/EditorWebView.tsx` — add to `EditorRef` interface and the forwarded methods:

```ts
  replaceCitationMarkers: (
    index: number,
    oldMarker: string,
    newMarker: string,
  ) => void;
  replaceReferences: (entries: string[]) => void;
```

```ts
    replaceCitationMarkers: (index, oldMarker, newMarker) =>
      postCmd({cmd: 'replaceCitationMarkers', index, oldMarker, newMarker}),
    replaceReferences: entries => postCmd({cmd: 'replaceReferences', entries}),
```

- [ ] **Step 5: Run tests**

Run: `npx jest src/components/editor/__tests__/quillHtml.test.ts`
Expected: PASS

- [ ] **Step 6: Create `CitationManagerModal.tsx`**

Bottom-sheet Modal (pattern from `AiPanel.tsx`), props:

```ts
interface Props {
  visible: boolean;
  sources: SourcePaper[];
  style: string;
  edition: string;
  onReplace: (index: number) => void;
  onDismiss: () => void;
}
```

Render each source row: `formatMarker(paper, style, i + 1)` badge, title, and the formatted reference preview (`formatReference(paper, style, edition, i + 1)`), plus a "Replace" button calling `onReplace(i)`.

- [ ] **Step 7: Create `CitationPickerModal.tsx`**

Props:

```ts
interface Props {
  visible: boolean;
  current: SourcePaper;
  enabledSources: SourceKey[];
  onToggleSource: (key: SourceKey) => void;
  onPick: (paper: SourcePaper) => void;
  onDismiss: () => void;
}
```

Content: query `TextInput`, source chips (same 4 toggles), "Search" button → `searchLiterature(query, [], enabledSources)`, results list excluding the current paper (compare `doi` OR title equality); tapping a result calls `onPick(paper)`. Search state (`results`, `searching`, `error`) internal. On error show inline text.

- [ ] **Step 8: Add toolbar buttons**

`TabToolbar.tsx` — add props `onCitations: () => void` and `onChat: () => void`; in `renderReferencesTab()` add a Citations button before the link button:

```tsx
        <Btn icon="document-text-outline" onPress={onCitations} />
        <Divider />
```

In `renderReviewTab()` add the chat button:

```tsx
        <Btn icon="chatbubble-ellipses-outline" onPress={onChat} />
        <Divider />
```

Wire both through the Props interface and destructuring.

- [ ] **Step 9: Wire swap flow in `EditorScreen.tsx`**

Add state and imports:

```ts
import CitationManagerModal from '@/components/editor/CitationManagerModal';
import CitationPickerModal from '@/components/editor/CitationPickerModal';
import {formatMarker} from '@/services/citationFormat';
import {buildReferencesEntries} from '@/services/referencesService';
import {SourcePaper, SourceKey} from '@/services/literatureSearch';
import {useSettingsStore} from '@/stores/settingsStore';

  const [sources, setSources] = useState<SourcePaper[]>([]);
  const [citationStyle, setCitationStyle] = useState('apa');
  const [citationEdition, setCitationEdition] = useState('7th');
  const [showCitations, setShowCitations] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
```

In the document-load effect, also read `doc.sourcesJson`, `doc.citationStyle`, `doc.citationEdition`:

```ts
        try {
          setSources(JSON.parse(doc.sourcesJson || '[]'));
        } catch {
          setSources([]);
        }
        setCitationStyle(doc.citationStyle || 'apa');
        setCitationEdition(doc.citationEdition || '7th');
```

Swap handler:

```ts
  const handleSwapSource = useCallback(
    async (paper: SourcePaper) => {
      if (replaceIndex === null) {
        return;
      }
      const oldPaper = sources[replaceIndex];
      const next = [...sources];
      next[replaceIndex] = paper;
      setSources(next);
      setReplaceIndex(null);
      if (oldPaper) {
        editorRef.current?.replaceCitationMarkers(
          replaceIndex + 1,
          formatMarker(oldPaper, citationStyle, replaceIndex + 1),
          formatMarker(paper, citationStyle, replaceIndex + 1),
        );
      }
      editorRef.current?.replaceReferences(
        buildReferencesEntries(next, citationStyle, citationEdition),
      );
      await documentRepository.updateSources(documentId, next);
    },
    [replaceIndex, sources, citationStyle, citationEdition, documentId],
  );
```

Render both modals near the other modals:

```tsx
      <CitationManagerModal
        visible={showCitations}
        sources={sources}
        style={citationStyle}
        edition={citationEdition}
        onReplace={index => setReplaceIndex(index)}
        onDismiss={() => setShowCitations(false)}
      />

      <CitationPickerModal
        visible={replaceIndex !== null}
        current={sources[replaceIndex] ?? ({} as SourcePaper)}
        enabledSources={useSettingsStore.getState().enabledSources}
        onToggleSource={key =>
          useSettingsStore
            .getState()
            .setEnabledSources(
              useSettingsStore.getState().enabledSources.includes(key)
                ? useSettingsStore
                    .getState()
                    .enabledSources.filter(k => k !== key)
                : [...useSettingsStore.getState().enabledSources, key],
            )
        }
        onPick={handleSwapSource}
        onDismiss={() => setReplaceIndex(null)}
      />
```

Wire toolbar: `onCitations={() => setShowCitations(true)}`, `onChat={() => setShowChat(true)}` (chat state added in Task 11 — add `const [showChat, setShowChat] = useState(false);` here so Task 11 only extends the panel).

- [ ] **Step 10: Run the full test suite**

Run: `npx jest`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/components/editor/quillHtml.ts src/components/editor/EditorWebView.tsx src/components/editor/CitationManagerModal.tsx src/components/editor/CitationPickerModal.tsx src/components/editor/TabToolbar.tsx src/screens/EditorScreen.tsx src/components/editor/__tests__/quillHtml.test.ts
git commit -m "feat: in-editor citation manager with deterministic reference updates"
```

---

### Task 11: Paper-aware editor chat

**Files:**
- Create: `src/services/chatService.ts`
- Create: `src/components/editor/ChatPanel.tsx`
- Modify: `src/screens/EditorScreen.tsx`
- Test: `src/services/__tests__/chatService.test.ts`

**Interfaces:**
- Consumes: `inference.stream`; `formatMarker` from `./citationFormat`; `markdownToDeltaJson` from `@/utils/markdownToQuillDelta`; `documentRepository.updateChat`; `SourcePaper` from `./literatureSearch`.
- Produces:
  - `export interface ChatMessage {role: 'user' | 'assistant'; content: string; applied?: boolean; createdAt?: number}`
  - `buildSystemPrompt(paperText: string, sources: SourcePaper[], style: string, edition: string): string` — paper content truncated to 15,000 chars with a note, sources with markers.
  - `trimMessages(messages: ChatMessage[], max?: number): ChatMessage[]` — keeps the last `max` (default 50).

- [ ] **Step 1: Write the failing tests**

Create `src/services/__tests__/chatService.test.ts`:

```ts
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
  const prompt = buildSystemPrompt('Full paper text here', sources, 'apa', '7th');
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/services/__tests__/chatService.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `chatService.ts`**

```ts
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
        `${formatMarker(s, style, i + 1)} — ${s.authors.slice(0, 3).join(
          ', ',
        )} (${s.year}). ${s.title}.`,
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
```

- [ ] **Step 4: Create `ChatPanel.tsx`**

Bottom-sheet Modal (pattern from `AiPanel.tsx`), props:

```ts
interface Props {
  visible: boolean;
  messages: ChatMessage[];
  streamingText: string;
  busy: boolean;
  onSend: (text: string) => void;
  onApply: (message: ChatMessage) => void;
  onDismiss: () => void;
}
```

Render: header "AI Assistant", `FlatList`-style ScrollView of bubbles (user right-aligned `#6366f1` white text; assistant left-aligned gray card), an "Apply" button on assistant messages not yet applied (label `✓ Applied` when `applied`), a streaming bubble while `busy && streamingText`, and a bottom input row (`TextInput` + send button `➤`). `onSend` clears the input (internal `TextInput` state).

- [ ] **Step 5: Wire chat into `EditorScreen.tsx`**

Add state:

```ts
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatStreaming, setChatStreaming] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
```

Load history in the document-load effect:

```ts
        try {
          const parsed = JSON.parse(doc.chatJson || '[]');
          if (Array.isArray(parsed)) {
            setChatMessages(parsed);
          }
        } catch {
          setChatMessages([]);
        }
```

Save helper:

```ts
  const saveChat = useCallback(
    (messages: ChatMessage[]) => {
      void documentRepository.updateChat(documentId, messages);
    },
    [documentId],
  );
```

Send handler:

```ts
  const handleChatSend = useCallback(
    (text: string) => {
      const userMsg: ChatMessage = {
        role: 'user',
        content: text,
        createdAt: Date.now(),
      };
      const next = [...chatMessages, userMsg];
      setChatMessages(next);
      saveChat(next);
      setChatStreaming('');
      setChatBusy(true);

      editorRef.current?.getContent(delta => {
        const paperText = extractPlainText(delta);
        const systemPrompt = buildSystemPrompt(
          paperText,
          sources,
          citationStyle,
          citationEdition,
        );
        const history = trimMessages(next);
        const messages = [
          {role: 'system' as const, content: systemPrompt},
          ...history.map(m => ({role: m.role, content: m.content})),
        ];
        stream(messages, token => {
          setChatStreaming(prev => prev + token);
        })
          .then(() => {
            setChatStreaming(current => {
              const assistantMsg: ChatMessage = {
                role: 'assistant',
                content: current,
                createdAt: Date.now(),
              };
              const withAssistant = [...next, assistantMsg];
              setChatMessages(withAssistant);
              saveChat(withAssistant);
              return '';
            });
            setChatBusy(false);
          })
          .catch(e => {
            setChatStreaming('');
            setChatBusy(false);
            Alert.alert(
              'Chat error',
              e instanceof Error ? e.message : 'Unknown error',
            );
          });
      });
    },
    [chatMessages, saveChat, sources, citationStyle, citationEdition],
  );
```

Apply handler:

```ts
  const handleChatApply = useCallback(
    (message: ChatMessage) => {
      editorRef.current?.insertDelta(markdownToDeltaJson(message.content));
      const next = chatMessages.map(m =>
        m === message ? {...m, applied: true} : m,
      );
      setChatMessages(next);
      saveChat(next);
    },
    [chatMessages, saveChat],
  );
```

Render the panel (before the closing `</SafeAreaView>`):

```tsx
      <ChatPanel
        visible={showChat}
        messages={chatMessages}
        streamingText={chatStreaming}
        busy={chatBusy}
        onSend={handleChatSend}
        onApply={handleChatApply}
        onDismiss={() => setShowChat(false)}
      />
```

Imports to add in EditorScreen: `ChatPanel`, `ChatMessage`, `buildSystemPrompt`, `trimMessages` from `@/services/chatService`, `stream` from `@/services/inference`.

- [ ] **Step 6: Run the full test suite**

Run: `npx jest`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/services/chatService.ts src/components/editor/ChatPanel.tsx src/screens/EditorScreen.tsx src/services/__tests__/chatService.test.ts
git commit -m "feat: paper-aware chat panel with apply-to-cursor"
```

---

### Task 12: Settings — AI Provider section

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`
- Test: none (UI-only, consistent with repo conventions)

**Interfaces:**
- Consumes: `useSettingsStore` provider fields/setters; `testConnection` from `./cloudService`.

- [ ] **Step 1: Add provider UI state + section**

`SettingsScreen.tsx` — add imports:

```ts
import {TextInput} from 'react-native';
import {testConnection} from '@/services/cloudService';
```

Add state:

```ts
  const [testState, setTestState] = useState<
    'idle' | 'testing' | 'ok' | 'fail'
  >('idle');
  const [testMessage, setTestMessage] = useState('');
```

Add between the "AI Model" section and "Default Citation Style" section:

```tsx
      {/* ── AI Provider ─────────────────────────────── */}
      <SectionHeader label="AI Provider" />
      <View style={styles.chipRow}>
        {[
          {id: 'local', label: 'On-device (offline)'},
          {id: 'cloud', label: 'Cloud (online)'},
        ].map(p => (
          <TouchableOpacity
            key={p.id}
            style={[
              styles.chip,
              store.provider === p.id && styles.chipSelected,
            ]}
            onPress={() => store.setProvider(p.id as 'local' | 'cloud')}>
            <Text
              style={[
                styles.chipText,
                store.provider === p.id && styles.chipTextSelected,
              ]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {store.provider === 'cloud' && (
        <View style={styles.cloudCard}>
          <Text style={styles.labelText}>Base URL</Text>
          <TextInput
            style={styles.textInput}
            value={store.cloudBaseUrl}
            onChangeText={store.setCloudBaseUrl}
            placeholder="https://api.openai.com/v1"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.labelText}>API Key</Text>
          <TextInput
            style={styles.textInput}
            value={store.cloudApiKey}
            onChangeText={store.setCloudApiKey}
            placeholder="sk-…"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.labelText}>Model</Text>
          <TextInput
            style={styles.textInput}
            value={store.cloudModel}
            onChangeText={store.setCloudModel}
            placeholder="gpt-4o-mini"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>
              Fall back to on-device if cloud fails
            </Text>
            <Switch
              value={store.cloudFallbackEnabled}
              onValueChange={store.setCloudFallbackEnabled}
            />
          </View>
          <TouchableOpacity
            style={styles.secondaryBtn}
            disabled={testState === 'testing'}
            onPress={async () => {
              setTestState('testing');
              setTestMessage('');
              const res = await testConnection();
              setTestState(res.ok ? 'ok' : 'fail');
              setTestMessage(
                res.ok
                  ? `Connected in ${res.latencyMs}ms`
                  : res.error ?? 'Connection failed',
              );
            }}>
            <Text style={styles.secondaryBtnText}>
              {testState === 'testing' ? 'Testing…' : 'Test connection'}
            </Text>
          </TouchableOpacity>
          {testMessage.length > 0 && (
            <Text
              style={[
                styles.testMessage,
                testState === 'ok' ? styles.testOk : styles.testFail,
              ]}>
              {testMessage}
            </Text>
          )}
        </View>
      )}
```

Add styles:

```ts
  cloudCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  testMessage: {fontSize: 13, marginTop: 8},
  testOk: {color: '#16a34a'},
  testFail: {color: '#dc2626'},
```

- [ ] **Step 2: Update the About tagline**

Change the "Fully offline · No API keys required" tagline to:

```tsx
      <Text style={styles.tagline}>On-device AI · Optional cloud provider</Text>
```

- [ ] **Step 3: Verify**

Run: `npx jest`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: AI provider settings with connection test"
```

---

## Final verification

After all tasks:

```bash
npx jest
npx tsc --noEmit
npx eslint .
```

All three must pass before the feature is complete. Then update `README.md` tech stack rows (On-device AI → "Local Qwen + optional cloud provider", add citation manager + chat bullets) and commit:

```bash
git add README.md
git commit -m "docs: update README for cloud AI, citation manager, and editor chat"
```