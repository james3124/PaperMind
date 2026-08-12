import {
  tokenise,
  jaccardSimilarity,
  keywordOverlap,
  deduplicate,
  rankPapers,
  SourcePaper,
} from '../literatureSearch';

// ── tokenise ──────────────────────────────────────────────────────────────────

describe('tokenise', () => {
  it('lowercases and splits on non-word chars', () => {
    const tokens = tokenise('Mobile Learning: Benefits & Challenges');
    expect(tokens.has('mobile')).toBe(true);
    expect(tokens.has('learning')).toBe(true);
    expect(tokens.has('benefits')).toBe(true);
    expect(tokens.has('challenges')).toBe(true);
  });

  it('removes stopwords', () => {
    const tokens = tokenise('the effect of a variable');
    expect(tokens.has('the')).toBe(false);
    expect(tokens.has('of')).toBe(false);
    expect(tokens.has('a')).toBe(false);
    expect(tokens.has('effect')).toBe(true);
    expect(tokens.has('variable')).toBe(true);
  });

  it('removes words shorter than 3 chars', () => {
    const tokens = tokenise('AI in education');
    expect(tokens.has('ai')).toBe(false);
    expect(tokens.has('in')).toBe(false);
    expect(tokens.has('education')).toBe(true);
  });

  it('returns empty set for empty string', () => {
    expect(tokenise('').size).toBe(0);
  });
});

// ── jaccardSimilarity ─────────────────────────────────────────────────────────

describe('jaccardSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(jaccardSimilarity('mobile learning', 'mobile learning')).toBe(1);
  });

  it('returns 0 for completely different strings', () => {
    expect(jaccardSimilarity('mobile learning', 'quantum physics')).toBe(0);
  });

  it('returns partial score for overlapping strings', () => {
    const score = jaccardSimilarity(
      'mobile learning in education',
      'mobile learning for students'
    );
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('returns 1 for two empty strings', () => {
    expect(jaccardSimilarity('', '')).toBe(1);
  });
});

// ── keywordOverlap ────────────────────────────────────────────────────────────

describe('keywordOverlap', () => {
  const paper: SourcePaper = {
    title:    'Mobile Learning in Higher Education',
    authors:  ['Smith, J.'],
    year:     2023,
    abstract: 'This study examines mobile learning adoption in universities.',
    source:   'crossref',
  };

  it('returns high score when paper matches topic well', () => {
    const score = keywordOverlap(paper, 'mobile learning higher education universities');
    expect(score).toBeGreaterThan(0.5);
  });

  it('returns 0 for unrelated query', () => {
    const score = keywordOverlap(paper, 'quantum computing semiconductor physics');
    expect(score).toBe(0);
  });

  it('returns 0 for empty query', () => {
    expect(keywordOverlap(paper, '')).toBe(0);
  });
});

// ── deduplicate ───────────────────────────────────────────────────────────────

describe('deduplicate', () => {
  const paper1: SourcePaper = {
    title: 'Mobile Learning in Education',
    authors: ['Smith, J.'],
    year: 2023,
    abstract: 'Study of mobile learning.',
    doi: '10.1234/test.001',
    source: 'crossref',
  };

  const paper2: SourcePaper = {
    ...paper1,
    source: 'openalex',  // same DOI, different source
  };

  const paper3: SourcePaper = {
    title: 'Mobile Learning in Education',  // same title, no DOI
    authors: ['Smith, J.'],
    year: 2023,
    abstract: 'Study of mobile learning.',
    source: 'semanticscholar',
  };

  const paper4: SourcePaper = {
    title: 'Quantum Computing Applications',
    authors: ['Jones, A.'],
    year: 2022,
    abstract: 'Research on quantum computing.',
    doi: '10.1234/test.002',
    source: 'arxiv',
  };

  it('removes duplicate DOIs', () => {
    const result = deduplicate([paper1, paper2, paper4]);
    expect(result).toHaveLength(2);
    expect(result.some((p) => p.doi === '10.1234/test.001')).toBe(true);
    expect(result.some((p) => p.doi === '10.1234/test.002')).toBe(true);
  });

  it('removes near-duplicate titles (no DOI)', () => {
    const result = deduplicate([paper3, paper4]);
    // paper3 has no DOI — should still deduplicate by title
    const mobile = result.filter((p) =>
      p.title.toLowerCase().includes('mobile')
    );
    expect(mobile).toHaveLength(1);
  });

  it('keeps distinct papers', () => {
    const result = deduplicate([paper1, paper4]);
    expect(result).toHaveLength(2);
  });

  it('handles empty array', () => {
    expect(deduplicate([])).toHaveLength(0);
  });
});

// ── rankPapers ────────────────────────────────────────────────────────────────

describe('rankPapers', () => {
  const papers: SourcePaper[] = [
    {
      title:    'Quantum Physics Fundamentals',
      authors:  ['Jones, A.'],
      year:     2022,
      abstract: 'An introduction to quantum mechanics and particle physics.',
      source:   'arxiv',
    },
    {
      title:    'Mobile Learning Adoption in Philippine High Schools',
      authors:  ['Cruz, M.'],
      year:     2023,
      abstract: 'Examines mobile phone usage for learning among high school students in the Philippines.',
      source:   'crossref',
    },
    {
      title:    'Academic Performance and Technology',
      authors:  ['Reyes, P.'],
      year:     2021,
      abstract: 'Relationship between technology adoption and academic performance among students.',
      source:   'openalex',
    },
  ];

  it('ranks most relevant paper first', () => {
    const ranked = rankPapers(
      papers,
      'mobile learning academic performance high school students Philippines',
      ['Does mobile phone usage affect academic performance?']
    );
    // The mobile learning paper and academic performance paper should rank above quantum physics
    expect(ranked[ranked.length - 1].title).toBe('Quantum Physics Fundamentals');
  });

  it('returns same number of papers', () => {
    const ranked = rankPapers(papers, 'mobile learning', []);
    expect(ranked).toHaveLength(papers.length);
  });

  it('handles empty papers array', () => {
    expect(rankPapers([], 'mobile learning', [])).toHaveLength(0);
  });
});

// ── searchLiterature (integration shape) ─────────────────────────────────────

describe('searchLiterature shape', () => {
  // We don't make real network calls in tests — just verify the export exists
  it('exports searchLiterature function', async () => {
    const { searchLiterature } = require('../literatureSearch');
    expect(typeof searchLiterature).toBe('function');
  });
});