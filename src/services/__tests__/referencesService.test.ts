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