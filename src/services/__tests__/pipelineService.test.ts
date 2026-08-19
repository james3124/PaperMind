// react-native-fs uses NativeEventEmitter at module load, which throws in Node — mock it.
jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/data/user/0/com.papermind/files',
  exists: jest.fn().mockResolvedValue(false),
  mkdir: jest.fn().mockResolvedValue(undefined),
}));

// WatermelonDB's SQLite adapter can't run in Node (JSI) — mock the
// repository so the pipeline module loads without native DB initialisation.
jest.mock('@/db/DocumentRepository', () => ({
  documentRepository: {
    create: jest.fn(),
    update: jest.fn(),
  },
}));

import {STAGE_LABELS, PipelineConfig} from '../pipelineService';
import {
  buildReferencesEntries,
  buildReferencesMarkdown,
} from '../referencesService';

describe('STAGE_LABELS', () => {
  it('has exactly 19 stages', () => {
    expect(STAGE_LABELS).toHaveLength(19);
  });

  it('first stage is initialising pipeline', () => {
    expect(STAGE_LABELS[0].toLowerCase()).toContain('initialising');
  });

  it('last stage is saving to library', () => {
    expect(STAGE_LABELS[18].toLowerCase()).toContain('saving');
  });

  it('stage 5 is literature search', () => {
    expect(STAGE_LABELS[4].toLowerCase()).toContain('literature');
  });

  it('all labels are non-empty strings', () => {
    STAGE_LABELS.forEach(label => {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });
});

describe('PipelineConfig type shape', () => {
  it('accepts valid config', () => {
    const config: PipelineConfig = {
      topic: 'Mobile learning in Philippine high schools',
      researchType: 'quantitative',
      academicLevel: 'shs',
      paperLength: 'standard',
      citationStyle: 'apa',
      citationEdition: '7th',
    };
    expect(config.topic).toBeTruthy();
    expect(config.researchType).toBe('quantitative');
    expect(config.paperLength).toBe('standard');
  });
});

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
