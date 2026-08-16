import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';
import Document from './models/Document';

export function createDatabaseAdapter() {
  return new SQLiteAdapter({
    schema,
    migrations,
    dbName: 'papermind',
    jsi: false,
    onSetUpError: (error) => {
      console.error('WatermelonDB setup error:', error);
    },
  });
}

const adapter = createDatabaseAdapter();

export const database = new Database({
  adapter,
  modelClasses: [Document],
});
