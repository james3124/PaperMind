import {
  schemaMigrations,
  addColumns,
  createTable,
} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'documents',
          columns: [
            {name: 'sources_json', type: 'string'},
            {name: 'chat_json', type: 'string'},
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        createTable({
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
    },
  ],
});
