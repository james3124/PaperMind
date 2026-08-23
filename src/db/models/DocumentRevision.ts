import {Model} from '@nozbe/watermelondb';
import {field} from '@nozbe/watermelondb/decorators';

export default class DocumentRevision extends Model {
  static table = 'document_revisions';

  @field('document_id') documentId!: string;
  @field('content') content!: string;
  @field('word_count') wordCount!: number;
  @field('label') label?: string;
  @field('created_at') createdAt!: number;
}
