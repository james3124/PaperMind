import axios from 'axios';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SourcePaper {
  title:    string;
  authors:  string[];
  year:     number;
  abstract: string;
  doi?:     string;
  url?:     string;
  source:   'crossref' | 'openalex' | 'semanticscholar' | 'arxiv';
}

// ── Stopwords ─────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that',
  'these', 'those', 'it', 'its', 'as', 'not', 'no', 'so', 'if', 'than',
]);

// ── Text helpers ──────────────────────────────────────────────────────────────

export function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

export function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenise(a);
  const setB = tokenise(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersection = new Set([...setA].filter((w) => setB.has(w)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

export function keywordOverlap(paper: SourcePaper, query: string): number {
  const queryTokens = tokenise(query);
  const paperTokens = tokenise(`${paper.title} ${paper.abstract}`);
  const matches = [...queryTokens].filter((w) => paperTokens.has(w));
  return queryTokens.size > 0 ? matches.length / queryTokens.size : 0;
}

// ── CrossRef ──────────────────────────────────────────────────────────────────

async function fetchCrossRef(query: string): Promise<SourcePaper[]> {
  const res = await axios.get<{
    message: {
      items: {
        title?:     string[];
        author?:    { family?: string; given?: string }[];
        published?: { 'date-parts'?: number[][] };
        abstract?:  string;
        DOI?:       string;
        URL?:       string;
      }[];
    };
  }>(
    'https://api.crossref.org/works',
    {
      params: {
        query,
        rows:   20,
        select: 'title,author,published,abstract,DOI,URL',
      },
      timeout: 10_000,
    }
  );

  return (res.data.message.items ?? [])
    .filter((item) => item.title?.[0] && item.published?.['date-parts']?.[0]?.[0])
    .map((item) => ({
      title:    item.title![0],
      authors:  (item.author ?? []).map(
        (a) => `${a.family ?? ''}${a.given ? `, ${a.given[0]}.` : ''}`
      ),
      year:     item.published!['date-parts']![0][0],
      abstract: item.abstract?.replace(/<[^>]+>/g, '') ?? '',
      doi:      item.DOI,
      url:      item.URL,
      source:   'crossref' as const,
    }));
}

// ── OpenAlex ──────────────────────────────────────────────────────────────────

async function fetchOpenAlex(query: string): Promise<SourcePaper[]> {
  const res = await axios.get<{
    results: {
      title?:                string;
      authorships?:          { author: { display_name: string } }[];
      publication_year?:     number;
      abstract_inverted_index?: Record<string, number[]>;
      doi?:                  string;
      id?:                   string;
    }[];
  }>(
    'https://api.openalex.org/works',
    {
      params: {
        search:       query,
        'per-page':   20,
        select:       'title,authorships,publication_year,abstract_inverted_index,doi,id',
        mailto:       'papermind@example.com',  // polite pool
      },
      timeout: 10_000,
    }
  );

  return (res.data.results ?? [])
    .filter((item) => item.title && item.publication_year)
    .map((item) => ({
      title:    item.title!,
      authors:  (item.authorships ?? []).map((a) => a.author.display_name),
      year:     item.publication_year!,
      abstract: reconstructAbstract(item.abstract_inverted_index),
      doi:      item.doi?.replace('https://doi.org/', ''),
      url:      item.id,
      source:   'openalex' as const,
    }));
}

function reconstructAbstract(
  invertedIndex?: Record<string, number[]>
): string {
  if (!invertedIndex) return '';
  const words: string[] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  return words.filter(Boolean).join(' ');
}

// ── Semantic Scholar ──────────────────────────────────────────────────────────

async function fetchSemanticScholar(query: string): Promise<SourcePaper[]> {
  const res = await axios.get<{
    data: {
      title?:         string;
      authors?:       { name: string }[];
      year?:          number;
      abstract?:      string;
      externalIds?:   { DOI?: string };
      url?:           string;
    }[];
  }>(
    'https://api.semanticscholar.org/graph/v1/paper/search',
    {
      params: {
        query,
        limit:  20,
        fields: 'title,authors,year,abstract,externalIds,url',
      },
      timeout: 10_000,
    }
  );

  return (res.data.data ?? [])
    .filter((item) => item.title && item.year)
    .map((item) => ({
      title:    item.title!,
      authors:  (item.authors ?? []).map((a) => a.name),
      year:     item.year!,
      abstract: item.abstract ?? '',
      doi:      item.externalIds?.DOI,
      url:      item.url,
      source:   'semanticscholar' as const,
    }));
}

// ── arXiv ─────────────────────────────────────────────────────────────────────

async function fetchArXiv(query: string): Promise<SourcePaper[]> {
  const res = await axios.get<string>(
    'https://export.arxiv.org/api/query',
    {
      params: {
        search_query: `all:${query}`,
        max_results:  20,
        sortBy:       'relevance',
      },
      timeout: 10_000,
      responseType: 'text',
    }
  );

  return parseArXivXml(res.data);
}

function parseArXivXml(xml: string): SourcePaper[] {
  const entries: SourcePaper[] = [];

  // Simple regex-based XML extraction (no DOM parser available in RN)
  const entryMatches = xml.match(/<entry>([\s\S]*?)<\/entry>/g) ?? [];

  for (const entry of entryMatches) {
    const title    = extractTag(entry, 'title')?.replace(/\s+/g, ' ').trim();
    const summary  = extractTag(entry, 'summary')?.replace(/\s+/g, ' ').trim();
    const published = extractTag(entry, 'published');
    const year     = published ? parseInt(published.slice(0, 4), 10) : 0;
    const id       = extractTag(entry, 'id');

    const authorMatches = entry.match(/<author>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<\/author>/g) ?? [];
    const authors = authorMatches
      .map((a) => extractTag(a, 'name') ?? '')
      .filter(Boolean);

    if (!title || !year) continue;

    entries.push({
      title,
      authors,
      year,
      abstract: summary ?? '',
      url:      id ?? undefined,
      source:   'arxiv',
    });
  }

  return entries;
}

function extractTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match?.[1]?.trim();
}

// ── Deduplication ─────────────────────────────────────────────────────────────

export function deduplicate(papers: SourcePaper[]): SourcePaper[] {
  const seen = new Map<string, SourcePaper>();

  for (const paper of papers) {
    // DOI exact match — highest confidence
    if (paper.doi) {
      const normDoi = paper.doi.toLowerCase().trim();
      if (seen.has(normDoi)) continue;
      seen.set(normDoi, paper);
      continue;
    }

    // Fuzzy title match — Jaccard ≥ 0.9
    let isDuplicate = false;
    for (const [key, existing] of seen.entries()) {
      if (jaccardSimilarity(paper.title, existing.title) >= 0.9) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      // Use title as key for non-DOI papers
      seen.set(`title:${paper.title.toLowerCase().trim()}`, paper);
    }
  }

  return Array.from(seen.values());
}

// ── Ranking ───────────────────────────────────────────────────────────────────

export function rankPapers(
  papers: SourcePaper[],
  topic: string,
  researchQuestions: string[]
): SourcePaper[] {
  const fullQuery = [topic, ...researchQuestions].join(' ');

  const scored = papers.map((paper) => ({
    paper,
    score: keywordOverlap(paper, fullQuery),
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .map((s) => s.paper);
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function searchLiterature(
  topic: string,
  researchQuestions: string[] = []
): Promise<SourcePaper[]> {
  const results = await Promise.allSettled([
    fetchCrossRef(topic),
    fetchOpenAlex(topic),
    fetchSemanticScholar(topic),
    fetchArXiv(topic),
  ]);

  const allPapers: SourcePaper[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allPapers.push(...result.value);
    } else {
      // Log but never throw — missing one source is acceptable
      console.warn('[literatureSearch] Source failed:', result.reason);
    }
  }

  const deduped = deduplicate(allPapers);
  const ranked  = rankPapers(deduped, topic, researchQuestions);

  return ranked.slice(0, 15);
}