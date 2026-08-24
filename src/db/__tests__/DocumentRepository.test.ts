// WatermelonDB's SQLite adapter can't run in Node (JSI), so we mock the
// database instance with an in-memory store and test the repository
// interface shape and round-trip behavior only.
jest.mock('../database', () => {
  let nextDocId = 1;
  let nextRevId = 1;
  const store = new Map<string, Record<string, unknown>>();

  const makeCollection = (prefix: string) => {
    const toCamel = (name: string) =>
      name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    return {
      query: (...clauses: any[]) => ({
        observe: () => ({}),
        fetch: async () => {
          let rows = Array.from(store.values());
          for (const clause of clauses) {
            if (clause?.type === 'where') {
              const col = toCamel(clause.left);
              const rawExpected =
                clause.comparison?.right !== undefined
                  ? clause.comparison.right
                  : clause.right;
              const expected =
                rawExpected !== null &&
                typeof rawExpected === 'object' &&
                'value' in rawExpected
                  ? rawExpected.value
                  : rawExpected;
              rows = rows.filter(row => row[col] === expected);
            } else if (clause?.type === 'sortBy') {
              const key = toCamel(clause.sortColumn ?? clause.sortBy);
              rows = [...rows].sort((a, b) =>
                (a[key] as number) < (b[key] as number) ? -1 : 1,
              );
              if (clause.sortOrder === 'desc') {
                rows.reverse();
              }
            }
          }
          return rows;
        },
      }),
      find: async (id: string) => store.get(id) ?? null,
      create: async (fn: (doc: any) => void) => {
        const doc: any = {
          id: `${prefix}-${prefix === 'doc' ? nextDocId++ : nextRevId++}`,
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
  };

  const documentsCollection = makeCollection('doc');
  const revisionsCollection = makeCollection('rev');

  return {
    database: {
      get: (_table: string) =>
        _table === 'document_revisions'
          ? revisionsCollection
          : documentsCollection,
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

  describe('delete', () => {
    it('purges snapshots together with the paper row', async () => {
      const doc = await documentRepository.create('Doomed doc');
      const other = await documentRepository.create('Survivor doc');
      await documentRepository.createSnapshot(doc.id, 'base64-v1', 10);
      await documentRepository.createSnapshot(doc.id, 'base64-v2', 20);
      await documentRepository.createSnapshot(other.id, 'keep-me', 5);

      await documentRepository.delete(doc.id);

      expect(await documentRepository.getById(doc.id)).toBeNull();
      expect(await documentRepository.listSnapshots(doc.id)).toHaveLength(0);
      // Other papers keep their history untouched.
      const survivorSnaps = await documentRepository.listSnapshots(other.id);
      expect(survivorSnaps).toHaveLength(1);
      expect(survivorSnaps[0].content).toBe('keep-me');
    });
  });

  describe('snapshots (document revisions)', () => {
    let dateNowSpy: jest.SpyInstance;
    let currentTime: number;

    beforeEach(() => {
      currentTime = 1000;
      dateNowSpy = jest
        .spyOn(Date, 'now')
        .mockImplementation(() => currentTime++);
    });

    afterEach(() => {
      dateNowSpy.mockRestore();
    });

    it('exports snapshot functions', () => {
      expect(typeof documentRepository.createSnapshot).toBe('function');
      expect(typeof documentRepository.listSnapshots).toBe('function');
      expect(typeof documentRepository.restoreSnapshot).toBe('function');
      expect(typeof documentRepository.deleteSnapshot).toBe('function');
    });

    it('createSnapshot creates a revision with content and wordCount', async () => {
      const doc = await documentRepository.create('Snap doc');
      const revision = await documentRepository.createSnapshot(
        doc.id,
        'delta-json-v1',
        42,
      );
      expect(revision.documentId).toBe(doc.id);
      expect(revision.content).toBe('delta-json-v1');
      expect(revision.wordCount).toBe(42);
      expect(revision.label).toBeUndefined();
      expect(typeof revision.createdAt).toBe('number');
    });

    it('listSnapshots returns revisions newest first and only for the given document', async () => {
      const docA = await documentRepository.create('Snap order A');
      const docB = await documentRepository.create('Snap order B');

      await documentRepository.createSnapshot(docA.id, 'v1', 10);
      await documentRepository.createSnapshot(docA.id, 'v2', 20);
      await documentRepository.createSnapshot(docB.id, 'other', 5);

      const snapshots = await documentRepository.listSnapshots(docA.id);
      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].content).toBe('v2');
      expect(snapshots[1].content).toBe('v1');
      expect(snapshots.every(rev => rev.documentId === docA.id)).toBe(true);
    });

    it('restoreSnapshot updates wordCount and updatedAt but never touches the content path', async () => {
      const doc = await documentRepository.create('Restore doc');
      const pathContent = doc.content;
      await documentRepository.update(doc.id, {
        content: pathContent,
        wordCount: 3,
      });
      const revision = await documentRepository.createSnapshot(
        doc.id,
        'docx-base64-payload',
        99,
      );
      const beforeUpdatedAt = (await documentRepository.getById(doc.id))!
        .updatedAt;

      await new Promise(resolve => setTimeout(resolve, 5));
      await documentRepository.restoreSnapshot(doc.id, revision.id);

      const restored = await documentRepository.getById(doc.id);
      // The docx base64 must never land in `content` — the legacy guard
      // would treat it as a non-path and blank the paper on next open.
      expect(restored!.content).toBe(pathContent);
      expect(restored!.wordCount).toBe(99);
      expect(new Date(restored!.updatedAt).getTime()).toBeGreaterThan(
        new Date(beforeUpdatedAt).getTime(),
      );
    });

    it('getRevision returns the revision for its owning document', async () => {
      const docA = await documentRepository.create('GetRevision A');
      const docB = await documentRepository.create('GetRevision B');
      const revision = await documentRepository.createSnapshot(
        docA.id,
        'owned',
        1,
      );
      await expect(
        documentRepository.getRevision(docB.id, revision.id),
      ).rejects.toThrow();
      const owned = await documentRepository.getRevision(docA.id, revision.id);
      expect(owned.content).toBe('owned');
    });

    it('restoreSnapshot throws when the revision belongs to another document', async () => {
      const docA = await documentRepository.create('Restore owner');
      const docB = await documentRepository.create('Restore intruder');
      const revision = await documentRepository.createSnapshot(
        docA.id,
        'owned',
        1,
      );
      await expect(
        documentRepository.restoreSnapshot(docB.id, revision.id),
      ).rejects.toThrow();
    });

    it('deleteSnapshot removes the revision', async () => {
      const doc = await documentRepository.create('Delete snap doc');
      const revision = await documentRepository.createSnapshot(
        doc.id,
        'to-delete',
        7,
      );
      await documentRepository.deleteSnapshot(revision.id);
      const remaining = await documentRepository.listSnapshots(doc.id);
      expect(remaining).toHaveLength(0);
    });
  });
});
