import {appSchema, tableSchema} from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'documents',
      columns: [
        {name: 'title', type: 'string'},
        {name: 'content', type: 'string'}, // Quill delta JSON
        {name: 'word_count', type: 'number'},
        {name: 'citation_style', type: 'string'},
        {name: 'citation_edition', type: 'string'},
        {name: 'status', type: 'string'}, // DocumentStatus
        {name: 'starred', type: 'boolean'},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
  ],
});
