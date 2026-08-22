import {appSchema, tableSchema} from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 3,
  tables: [
    tableSchema({
      name: 'documents',
      columns: [
        {name: 'title', type: 'string'},
        {name: 'content', type: 'string'}, // Quill delta JSON
        {name: 'word_count', type: 'number'},
        {name: 'citation_style', type: 'string'},
        {name: 'citation_edition', type: 'string'},
        {name: 'sources_json', type: 'string'},
        {name: 'chat_json', type: 'string'},
        {name: 'status', type: 'string'}, // DocumentStatus
        {name: 'starred', type: 'boolean'},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'document_revisions',
      columns: [
        {name: 'document_id', type: 'string'},
        {name: 'content', type: 'string'},
        {name: 'word_count', type: 'number'},
        {name: 'label', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
      ],
    }),
  ],
});
