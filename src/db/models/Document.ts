import {Model} from '@nozbe/watermelondb';
import {field, date, readonly} from '@nozbe/watermelondb/decorators';

export type DocumentStatus = 'draft' | 'aiReady' | 'analyzing' | 'finalDraft';

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: 'Draft',
  aiReady: 'AI Ready',
  analyzing: 'Analyzing…',
  finalDraft: 'Final',
};

export const STATUS_COLORS: Record<DocumentStatus, string> = {
  draft: '#9E9E9E',
  aiReady: '#4CAF50',
  analyzing: '#2196F3',
  finalDraft: '#9C27B0',
};

export default class Document extends Model {
  static table = 'documents';

  @field('title') title!: string;
  @field('content') content!: string;
  @field('word_count') wordCount!: number;
  @field('citation_style') citationStyle!: string;
  @field('citation_edition') citationEdition!: string;
  @field('sources_json') sourcesJson!: string;
  @field('chat_json') chatJson!: string;
  @field('status') status!: DocumentStatus;
  @field('starred') starred!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
