import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import Asset from './models/Asset';
import MovementLog from './models/MovementLog';

const adapter = new SQLiteAdapter({
  schema,
  // jsi: true, // Requires complex native setup in MainApplication.kt
  onSetUpError: error => {
    console.error("Database setup failed", error);
  }
});

export const database = new Database({
  adapter,
  modelClasses: [
    Asset,
    MovementLog,
  ],
});
