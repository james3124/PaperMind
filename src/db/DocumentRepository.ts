import {Q} from '@nozbe/watermelondb';
import {database} from './database';
import Document, {DocumentStatus} from './models/Document';
import DocumentRevision from './models/DocumentRevision';
import {SourcePaper} from '@/services/literatureSearch';

// Loaded lazily: paperFileStore pulls in react-native-fs, whose module load
// throws under Jest's Node environment. Resolving at call time keeps this
// module importable there; call sites already tolerate failure.
type PaperFileStoreModule = typeof import('@/services/paperFileStore');

function paperFileStore(): PaperFileStoreModule {
  return require('@/services/paperFileStore');
}

const collection = database.get<Document>('documents');
const revisionsCollection =
  database.get<DocumentRevision>('document_revisions');

export const documentRepository = {
  getAll() {
    return collection.query(Q.sortBy('updated_at', Q.desc)).observe();
  },

  async getById(id: string): Promise<Document | null> {
    try {
      return await collection.find(id);
    } catch {
      return null;
    }
  },

  async create(
    title: string,
    options: Partial<{
      citationStyle: string;
      citationEdition: string;
      sourcesJson: string;
    }> = {},
  ): Promise<Document> {
    const doc = await database.write(async () => {
      return await collection.create(d => {
        d.title = title;
        d.content = `papers/${d.id}.docx`;
        d.wordCount = 0;
        d.citationStyle = options.citationStyle ?? 'apa';
        d.citationEdition = options.citationEdition ?? '7th';
        d.sourcesJson = options.sourcesJson ?? '';
        d.chatJson = '';
        d.status = 'draft';
        d.starred = false;
        d.updatedAt = new Date();
      });
    });
    // Provision the backing docx file; on failure fall back to empty content
    // so the editor screen's legacy guard re-provisions it later.
    try {
      await paperFileStore().copyBlankTemplate(doc.id);
    } catch {
      await database.write(async () => {
        await doc.update(d => {
          d.content = '';
          d.updatedAt = new Date();
        });
      });
    }
    return doc;
  },

  async update(
    id: string,
    changes: Partial<{
      title: string;
      content: string;
      wordCount: number;
      citationStyle: string;
      citationEdition: string;
      sourcesJson: string;
      chatJson: string;
      status: DocumentStatus;
      starred: boolean;
    }>,
  ): Promise<void> {
    const doc = await collection.find(id);
    await database.write(async () => {
      await doc.update(d => {
        if (changes.title !== undefined) {
          d.title = changes.title;
        }
        if (changes.content !== undefined) {
          d.content = changes.content;
        }
        if (changes.wordCount !== undefined) {
          d.wordCount = changes.wordCount;
        }
        if (changes.citationStyle !== undefined) {
          d.citationStyle = changes.citationStyle;
        }
        if (changes.citationEdition !== undefined) {
          d.citationEdition = changes.citationEdition;
        }
        if (changes.sourcesJson !== undefined) {
          d.sourcesJson = changes.sourcesJson;
        }
        if (changes.chatJson !== undefined) {
          d.chatJson = changes.chatJson;
        }
        if (changes.status !== undefined) {
          d.status = changes.status;
        }
        if (changes.starred !== undefined) {
          d.starred = changes.starred;
        }
        d.updatedAt = new Date();
      });
    });
  },

  async duplicate(id: string): Promise<Document> {
    const original = await collection.find(id);
    const doc = await database.write(async () => {
      return await collection.create(d => {
        d.title = `Copy of ${original.title}`;
        // Provisional path; replaced below once the copy has its own file.
        d.content = '';
        d.wordCount = original.wordCount;
        d.citationStyle = original.citationStyle;
        d.citationEdition = original.citationEdition;
        d.sourcesJson = original.sourcesJson;
        d.chatJson = original.chatJson;
        d.status = 'draft';
        d.starred = false;
        d.updatedAt = new Date();
      });
    });
    if (original.content.startsWith('papers/')) {
      try {
        await paperFileStore().duplicatePaperDocx(id, doc.id);
        await database.write(async () => {
          await doc.update(d => {
            d.content = `papers/${doc.id}.docx`;
            d.updatedAt = new Date();
          });
        });
      } catch {}
    }
    return doc;
  },

  async updateSources(id: string, sources: SourcePaper[]): Promise<void> {
    await this.update(id, {sourcesJson: JSON.stringify(sources)});
  },

  async updateChat(id: string, messages: unknown[]): Promise<void> {
    await this.update(id, {chatJson: JSON.stringify(messages)});
  },

  async delete(id: string): Promise<void> {
    const doc = await collection.find(id);
    await database.write(async () => {
      await doc.destroyPermanently();
    });
  },

  async createSnapshot(
    id: string,
    content: string,
    wordCount: number,
  ): Promise<DocumentRevision> {
    return await database.write(async () => {
      return await revisionsCollection.create(revision => {
        revision.documentId = id;
        revision.content = content;
        revision.wordCount = wordCount;
        revision.createdAt = Date.now();
      });
    });
  },

  async listSnapshots(id: string): Promise<DocumentRevision[]> {
    return await revisionsCollection
      .query(Q.where('document_id', id), Q.sortBy('created_at', Q.desc))
      .fetch();
  },

  async restoreSnapshot(documentId: string, revisionId: string): Promise<void> {
    const revision = await revisionsCollection.find(revisionId);
    if (revision.documentId !== documentId) {
      throw new Error('Revision does not belong to this document');
    }
    const doc = await collection.find(documentId);
    await database.write(async () => {
      await doc.update(d => {
        d.content = revision.content;
        d.wordCount = revision.wordCount;
        d.updatedAt = new Date();
      });
    });
  },

  async deleteSnapshot(revisionId: string): Promise<void> {
    const revision = await revisionsCollection.find(revisionId);
    await database.write(async () => {
      await revision.destroyPermanently();
    });
  },
};
