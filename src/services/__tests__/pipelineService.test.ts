// WatermelonDB's SQLite adapter can't run in Node (JSI) — mock the
// repository so the pipeline module loads without native DB initialisation.
jest.mock('@/db/DocumentRepository', () => ({
  documentRepository: {
    create: jest.fn(),
    update: jest.fn(),
  },
}));

import { STAGE_LABELS, PipelineConfig } from '../pipelineService';

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
    STAGE_LABELS.forEach((label) => {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });
});

describe('PipelineConfig type shape', () => {
  it('accepts valid config', () => {
    const config: PipelineConfig = {
      topic:           'Mobile learning in Philippine high schools',
      researchType:    'quantitative',
      academicLevel:   'shs',
      paperLength:     'standard',
      citationStyle:   'apa',
      citationEdition: '7th',
    };
    expect(config.topic).toBeTruthy();
    expect(config.researchType).toBe('quantitative');
    expect(config.paperLength).toBe('standard');
  });
});