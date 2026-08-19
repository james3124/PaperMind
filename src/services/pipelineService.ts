import {complete, stream} from './inference';
import {searchLiterature, SourcePaper, SourceKey} from './literatureSearch';
import {
  buildReferencesEntries,
  buildReferencesMarkdown,
} from './referencesService';
import {formatMarker} from './citationFormat';
import {documentRepository} from '@/db/DocumentRepository';
import {markdownToDeltaJson} from '@/utils/markdownToQuillDelta';

// ── Public types ──────────────────────────────────────────────────────────────

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

export type PipelineEventType =
  | 'stage-start'
  | 'stage-complete'
  | 'token'
  | 'sources-found'
  | 'error'
  | 'complete';

export interface PipelineEvent {
  type: PipelineEventType;
  stage?: number;
  label?: string;
  text?: string;
  count?: number;
  message?: string;
  fatal?: boolean;
  documentId?: string;
}

export const STAGE_LABELS: string[] = [
  'Initialising pipeline',
  'Analysing research topic',
  'Formulating research questions',
  'Planning paper structure',
  'Searching literature',
  'Writing introduction',
  'Synthesising literature review',
  'Developing background',
  'Designing methodology',
  'Writing results',
  'Writing discussion',
  'Writing conclusion',
  'Generating abstract',
  'Compiling references',
  'Applying academic style',
  'Proofreading',
  'Formatting document',
  'Final review',
  'Saving to library',
];

// ── Word targets ──────────────────────────────────────────────────────────────

const WORD_TARGETS: Record<
  PipelineConfig['paperLength'],
  Record<string, number>
> = {
  short: {
    intro: 150,
    litReview: 250,
    background: 150,
    methodology: 200,
    results: 200,
    discussion: 200,
    conclusion: 125,
  },
  standard: {
    intro: 300,
    litReview: 500,
    background: 300,
    methodology: 400,
    results: 400,
    discussion: 400,
    conclusion: 250,
  },
  long: {
    intro: 500,
    litReview: 850,
    background: 500,
    methodology: 680,
    results: 680,
    discussion: 680,
    conclusion: 425,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSources(
  sources: SourcePaper[],
  style: string,
  _edition: string,
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

function stageEvent(
  stage: number,
  type: 'stage-start' | 'stage-complete',
): PipelineEvent {
  return {type, stage, label: STAGE_LABELS[stage - 1]};
}

// ── Batch 1: Planning ─────────────────────────────────────────────────────────

interface PaperPlan {
  title: string;
  researchQuestions: string[];
  thesis: string;
  outline: {
    introduction: string;
    litReview: string;
    background: string;
    methodology: string;
    results: string;
    discussion: string;
    conclusion: string;
  };
  keywords: string[];
}

async function runBatch1(config: PipelineConfig): Promise<PaperPlan> {
  const prompt = `You are PaperMind, an expert academic research paper planner.
Output ONLY valid JSON — no markdown fences, no explanation.

Topic: ${config.topic}
Research type: ${config.researchType}
Academic level: ${config.academicLevel}
Paper length: ${config.paperLength}
Citation style: ${config.citationStyle} ${config.citationEdition}

Plan a complete academic research paper. Return this exact JSON shape:
{
  "title": "...",
  "researchQuestions": ["...", "..."],
  "thesis": "...",
  "outline": {
    "introduction":  "...",
    "litReview":     "...",
    "background":    "...",
    "methodology":   "...",
    "results":       "...",
    "discussion":    "...",
    "conclusion":    "..."
  },
  "keywords": ["...", "..."]
}`;

  const raw = await complete([{role: 'user', content: prompt}], 0.3, 1024);

  try {
    return JSON.parse(raw) as PaperPlan;
  } catch {
    const retry = await complete(
      [
        {role: 'user', content: prompt},
        {role: 'assistant', content: raw},
        {
          role: 'user',
          content:
            'The JSON above is malformed. Return ONLY valid JSON, nothing else.',
        },
      ],
      0.1,
      1024,
    );
    return JSON.parse(retry) as PaperPlan;
  }
}

// ── Batch 2: Writing ──────────────────────────────────────────────────────────

type SectionKey =
  | 'introduction'
  | 'litReview'
  | 'background'
  | 'methodology'
  | 'results'
  | 'discussion'
  | 'conclusion';

const SECTION_NAMES: Record<SectionKey, string> = {
  introduction: 'Introduction',
  litReview: 'Literature Review',
  background: 'Background',
  methodology: 'Methodology',
  results: 'Results',
  discussion: 'Discussion',
  conclusion: 'Conclusion',
};

const SECTION_STAGES: Record<SectionKey, number> = {
  introduction: 6,
  litReview: 7,
  background: 8,
  methodology: 9,
  results: 10,
  discussion: 11,
  conclusion: 12,
};

const WORD_TARGET_KEYS: Record<SectionKey, string> = {
  introduction: 'intro',
  litReview: 'litReview',
  background: 'background',
  methodology: 'methodology',
  results: 'results',
  discussion: 'discussion',
  conclusion: 'conclusion',
};

async function* runSection(
  key: SectionKey,
  config: PipelineConfig,
  plan: PaperPlan,
  sources: SourcePaper[],
): AsyncGenerator<string> {
  const targets = WORD_TARGETS[config.paperLength];
  const wordTarget = targets[WORD_TARGET_KEYS[key]];
  const citStyle = `${config.citationStyle.toUpperCase()} ${
    config.citationEdition
  }`.trim();

  const systemPrompt = `You are PaperMind, an expert academic writer.
Write in formal academic English appropriate for ${config.academicLevel} level.
Output ONLY the section content — no headings, no section labels, no preamble.
Target length: approximately ${wordTarget} words.`;

  const userPrompt = `Paper title: ${plan.title}
Thesis: ${plan.thesis}
Section to write: ${SECTION_NAMES[key]}
Section outline: ${plan.outline[key]}
Research questions: ${plan.researchQuestions.join('; ')}
Citation style: ${citStyle}
Research type: ${config.researchType}

Real academic sources (cite these — do not invent citations):
${formatSources(sources, config.citationStyle, config.citationEdition)}

Write the ${SECTION_NAMES[key]} section.
Use ONLY the exact in-text citation markers shown above (e.g. ${formatMarker(
    sources[0] ?? {
      title: '',
      authors: ['Unknown'],
      year: 0,
      abstract: '',
      source: 'crossref',
    },
    config.citationStyle,
    1,
  )}), verbatim, citing only the sources listed above.`;

  const tokens: string[] = [];
  await stream(
    [
      {role: 'system', content: systemPrompt},
      {role: 'user', content: userPrompt},
    ],
    token => {
      tokens.push(token);
    },
    0.7,
    1024,
  );

  yield tokens.join('');
}

// ── Batch 3: Polish ───────────────────────────────────────────────────────────

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

async function runStyleAndProofread(
  config: PipelineConfig,
  draft: string,
): Promise<string> {
  const prompt = `You are an expert academic editor. Review the following research paper and:
1. Fix any grammar, punctuation, or spelling errors
2. Improve academic tone where informal language appears
3. Ensure consistent citation formatting throughout
4. Return ONLY the corrected full paper text — no commentary, no preamble.

Paper:
${draft.slice(0, 1500)}`;

  return await complete([{role: 'user', content: prompt}], 0.2, 1024);
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

export async function* runPipeline(
  config: PipelineConfig,
): AsyncGenerator<PipelineEvent> {
  const sections: SectionKey[] = [
    'introduction',
    'litReview',
    'background',
    'methodology',
    'results',
    'discussion',
    'conclusion',
  ];

  // ── Batch 1: Planning (stages 1–4) ──────────────────────────────────────────

  yield stageEvent(1, 'stage-start');
  await new Promise(r => setTimeout(r, 300));
  yield stageEvent(1, 'stage-complete');

  yield stageEvent(2, 'stage-start');
  yield stageEvent(3, 'stage-start');
  yield stageEvent(4, 'stage-start');

  let plan: PaperPlan;
  try {
    plan = await runBatch1(config);
  } catch (e: unknown) {
    yield {
      type: 'error',
      message: `Planning failed: ${e instanceof Error ? e.message : String(e)}`,
      fatal: true,
    };
    return;
  }

  yield stageEvent(2, 'stage-complete');
  yield stageEvent(3, 'stage-complete');
  yield stageEvent(4, 'stage-complete');

  // ── Stage 5: Literature search ───────────────────────────────────────────────

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

  // ── Batch 2: Writing (stages 6–12) ──────────────────────────────────────────

  const sectionTexts: Partial<Record<SectionKey, string>> = {};

  for (const key of sections) {
    const stageNum = SECTION_STAGES[key];
    yield stageEvent(stageNum, 'stage-start');

    let sectionText = '';
    try {
      for await (const chunk of runSection(key, config, plan, sources)) {
        sectionText += chunk;
        yield {type: 'token', text: chunk};
      }
    } catch (e: unknown) {
      yield {
        type: 'error',
        message: `${SECTION_NAMES[key]} writing failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
        fatal: false,
      };
      sectionText = '[Section generation failed. Please regenerate.]';
    }

    sectionTexts[key] = sectionText;
    yield stageEvent(stageNum, 'stage-complete');
  }

  const draft = sections.map(k => sectionTexts[k] ?? '').join('\n\n');

  // ── Batch 3a: Abstract + References (stages 13–14) ───────────────────────────

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

  // ── Batch 3b: Style + Proofread (stages 15–16) ───────────────────────────────

  yield stageEvent(15, 'stage-start');
  yield stageEvent(16, 'stage-start');

  let polishedDraft = draft;
  try {
    polishedDraft = await runStyleAndProofread(config, draft);
  } catch {
    yield {
      type: 'error',
      message: 'Proofreading failed — using unpolished draft',
      fatal: false,
    };
  }

  yield stageEvent(15, 'stage-complete');
  yield stageEvent(16, 'stage-complete');

  // ── Batch 4: Assemble + Save (stages 17–19) ──────────────────────────────────

  yield stageEvent(17, 'stage-start');

  // Assemble full paper as plain text first (for word count).
  // Use the proofread draft — falls back to raw draft if proofreading failed.
  const referencesMarkdown = buildReferencesMarkdown(
    buildReferencesEntries(
      sources,
      config.citationStyle,
      config.citationEdition,
    ),
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

  // Convert to Quill Delta JSON — fixes ** markers, section headers bold,
  // and first-line paragraph indent before saving to the editor.
  const fullPaperDelta = markdownToDeltaJson(fullPaperText);

  yield stageEvent(17, 'stage-complete');

  yield stageEvent(18, 'stage-start');
  const wordCount = fullPaperText.split(/\s+/).filter(Boolean).length;
  yield stageEvent(18, 'stage-complete');

  // ── Stage 19: Save to WatermelonDB ────────────────────────────────────────────

  yield stageEvent(19, 'stage-start');

  let documentId: string;
  try {
    const doc = await documentRepository.create(plan.title, {
      citationStyle: config.citationStyle,
      citationEdition: config.citationEdition,
      sourcesJson: JSON.stringify(sources),
    });
    await documentRepository.update(doc.id, {
      content: fullPaperDelta, // ← saved as Quill Delta JSON
      wordCount,
      status: 'aiReady',
    });
    documentId = doc.id;
  } catch (e: unknown) {
    yield {
      type: 'error',
      message: `Failed to save: ${e instanceof Error ? e.message : String(e)}`,
      fatal: true,
    };
    return;
  }

  yield stageEvent(19, 'stage-complete');
  yield {type: 'complete', documentId};
}
