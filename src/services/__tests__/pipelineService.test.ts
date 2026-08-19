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

import {STAGE_LABELS, PipelineConfig, runPipeline} from '../pipelineService';
import {
  buildReferencesEntries,
  buildReferencesMarkdown,
} from '../referencesService';
import {documentRepository} from '@/db/DocumentRepository';

jest.mock('@/services/inference', () => ({
  complete: jest.fn(),
  stream: jest.fn(),
}));

jest.mock('@/services/literatureSearch', () => ({
  searchLiterature: jest.fn(),
}));

import {complete, stream} from '@/services/inference';
import {searchLiterature} from '@/services/literatureSearch';

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

describe('runPipeline section prompts', () => {
  const plan = {
    title: 'Test Paper',
    researchQuestions: ['q1'],
    thesis: 'thesis',
    outline: {
      introduction: 'intro',
      litReview: 'lit',
      background: 'bg',
      methodology: 'meth',
      results: 'res',
      discussion: 'disc',
      conclusion: 'concl',
    },
    keywords: ['k'],
  };

  const baseConfig: PipelineConfig = {
    topic: 'topic',
    researchType: 'quantitative',
    academicLevel: 'shs',
    paperLength: 'short',
    citationStyle: 'apa',
    citationEdition: '7th',
  };

  const source = {
    title: 'Mobile learning',
    authors: ['Smith, J.'],
    year: 2020,
    abstract: '',
    source: 'crossref' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (complete as jest.Mock).mockResolvedValue(JSON.stringify(plan));
    (stream as jest.Mock).mockImplementation(
      async (_messages: unknown, onToken: (t: string) => void) => {
        onToken('section text');
      },
    );
    (documentRepository.create as jest.Mock).mockResolvedValue({id: 'doc-1'});
    (searchLiterature as jest.Mock).mockResolvedValue([]);
  });

  async function firstUserPrompt(config: PipelineConfig): Promise<string> {
    let completed = false;
    for await (const ev of runPipeline(config)) {
      if (ev.type === 'complete') {
        completed = true;
      }
    }
    expect(completed).toBe(true);
    return (stream as jest.Mock).mock.calls[0][0][1].content as string;
  }

  it('omits the example citation marker when the pipeline has no sources', async () => {
    const prompt = await firstUserPrompt(baseConfig);
    expect(prompt).not.toContain('(Unknown, 0)');
    expect(prompt).not.toContain('(e.g.');
  });

  it('includes the example citation marker when sources exist', async () => {
    const prompt = await firstUserPrompt({...baseConfig, sources: [source]});
    expect(prompt).toContain('(e.g. (Smith, 2020))');
  });
});
