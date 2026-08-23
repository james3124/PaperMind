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
  it('mla omits url fragment when neither doi nor url present', () => {
    const noUrl = {...paper, doi: undefined, url: undefined};
    expect(formatReference(noUrl, 'mla', '9th', 1)).toBe(
      'Smith, J., and Doe, A. "The impact of mobile learning." 2020',
    );
  });
  it('chicago omits url fragment when neither doi nor url present', () => {
    const noUrl = {...paper, doi: undefined, url: undefined};
    expect(formatReference(noUrl, 'chicago', '17th', 1)).toBe(
      'Smith, J., and Doe, A. 2020. "The impact of mobile learning."',
    );
  });
  it('harvard omits url fragment when neither doi nor url present', () => {
    const noUrl = {...paper, doi: undefined, url: undefined};
    expect(formatReference(noUrl, 'harvard', '', 1)).toBe(
      'Smith, J., and Doe, A. (2020) The impact of mobile learning.',
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
