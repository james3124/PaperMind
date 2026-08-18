// WatermelonDB's SQLite adapter can't run in Node (JSI), so we mock the
// database instance with an in-memory store and test the repository
// interface shape and round-trip behavior only.
jest.mock('../database', () => {
  let nextId = 1;
  const store = new Map<string, Record<string, unknown>>();

  const collection = {
    query: () => ({observe: () => ({})}),
    find: async (id: string) => store.get(id) ?? null,
    create: async (fn: (doc: any) => void) => {
      const doc: any = {
        id: `doc-${nextId++}`,
        update: async (updateFn: (d: any) => void) => {
          updateFn(doc);
          return doc;
        },
        destroyPermanently: async () => {
          store.delete(doc.id);
        },
      };
      fn(doc);
      store.set(doc.id, doc);
      return doc;
    },
  };

  return {
    database: {
      get: () => collection,
      write: async (fn: () => unknown) => fn(),
    },
  };
});

import {SourcePaper} from '@/services/literatureSearch';
import {documentRepository} from '../DocumentRepository';

const sourcePaper: SourcePaper = {
  title: 'Mobile learning effects',
  authors: ['Smith, J.'],
  year: 2020,
  abstract: 'Abstract text',
  doi: '10.1000/xyz',
  url: 'https://doi.org/10.1000/xyz',
  source: 'crossref',
};

describe('documentRepository interface', () => {
  it('exports getAll function', () => {
    expect(typeof documentRepository.getAll).toBe('function');
  });

  it('exports getById function', () => {
    expect(typeof documentRepository.getById).toBe('function');
  });

  it('exports create function', () => {
    expect(typeof documentRepository.create).toBe('function');
  });

  it('exports update function', () => {
    expect(typeof documentRepository.update).toBe('function');
  });

  it('exports duplicate function', () => {
    expect(typeof documentRepository.duplicate).toBe('function');
  });

  it('exports delete function', () => {
    expect(typeof documentRepository.delete).toBe('function');
  });

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
});
