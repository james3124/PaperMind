import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';
import Document from './models/Document';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'papermind',
  jsi: true,   // Use JSI for better performance on Android
  onSetUpError: (error) => {
    console.error('WatermelonDB setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Document],
});
