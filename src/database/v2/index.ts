import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import { models } from './models';

// The v2 SQLite adapter
const adapter = new SQLiteAdapter({
  schema,
  // We use dbName to separate v2 from the legacy implementation until teardown
  dbName: 'rsmts_v2', 
  jsi: true,
  onSetUpError: error => {
    console.error('Database setup failed:', error);
  },
});

// The v2 Database Instance
export const database = new Database({
  adapter,
  modelClasses: models,
});
