import {
  schemaMigrations,
  addColumns,
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
  ],
});
